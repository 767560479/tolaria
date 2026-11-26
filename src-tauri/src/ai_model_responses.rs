use serde_json::{json, Value};

pub(crate) fn required(status: reqwest::StatusCode, body: &str) -> bool {
    status.is_client_error()
        && serde_json::from_str::<Value>(body)
            .ok()
            .is_some_and(|body| body["error"]["code"] == "chat_completions_disabled")
}

pub(crate) fn request_payload(chat: Value) -> Value {
    let mut payload = json!({
        "model": chat["model"],
        "input": chat["messages"],
        "stream": false,
        "store": false,
    });
    if let Some(tools) = chat["tools"].as_array() {
        payload["tools"] = tools
            .iter()
            .map(|tool| {
                let mut function = tool["function"].clone();
                function["type"] = json!("function");
                function["strict"] = json!(false);
                function
            })
            .collect();
        payload["tool_choice"] = chat["tool_choice"].clone();
    }
    payload
}

pub(crate) fn chat_response(response: Value) -> Result<Value, String> {
    if let Some(message) = response["error"]["message"].as_str() {
        return Err(format!("Responses API failed: {message}"));
    }
    let Some(status) = response["status"].as_str() else {
        return Err("Responses API response did not include a completion status.".into());
    };
    if status != "completed" {
        let reason = response["incomplete_details"]["reason"]
            .as_str()
            .unwrap_or("generation did not complete");
        return Err(format!("Responses API returned {status}: {reason}"));
    }
    let mut text = String::new();
    let mut calls = Vec::new();
    for item in response["output"].as_array().into_iter().flatten() {
        match item["type"].as_str() {
            Some("message") => text.push_str(&message_text(item)),
            Some("function_call") => calls.push(json!({
                "id": item["call_id"],
                "type": "function",
                "function": { "name": item["name"], "arguments": item["arguments"] },
            })),
            _ => {}
        }
    }
    Ok(json!({ "choices": [{ "message": { "content": text, "tool_calls": calls } }] }))
}

fn message_text(message: &Value) -> String {
    message["content"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|part| match part["type"].as_str() {
            Some("output_text") => part["text"].as_str(),
            Some("refusal") => part["refusal"].as_str(),
            _ => None,
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn incomplete_or_failed_responses_cannot_execute_partial_tool_calls() {
        for response in [
            json!({"status": "incomplete", "incomplete_details": {"reason": "max_output_tokens"},
                "output": [{"type": "function_call", "name": "create_note", "arguments": "{}"}]}),
            json!({"status": "failed", "error": {"message": "Model unavailable"}}),
            json!({"status": "in_progress", "output": []}),
            json!({"status": "cancelled", "output": []}),
            json!({"output": [{"type": "function_call", "name": "create_note", "arguments": "{}"}]}),
        ] {
            assert!(chat_response(response).is_err());
        }
    }

    #[test]
    fn response_conversion_ignores_reasoning_and_preserves_function_arguments() {
        let response = chat_response(json!({"status": "completed", "output": [
            {"type": "reasoning", "summary": [{"text": "private reasoning"}]},
            {"type": "message", "content": [
                {"type": "output_text", "text": "Created "},
                {"type": "output_text", "text": "a note"}
            ]},
            {"type": "function_call", "call_id": "call-1", "name": "create_note",
             "arguments": "{\"path\":\"note.md\"}"}
        ]}))
        .unwrap();
        assert_eq!(
            response["choices"][0]["message"]["content"],
            "Created a note"
        );
        assert_eq!(
            response["choices"][0]["message"]["tool_calls"],
            json!([{
                "id": "call-1", "type": "function", "function": {
                    "name": "create_note", "arguments": "{\"path\":\"note.md\"}"
                }
            }])
        );
    }

    #[test]
    fn response_conversion_keeps_refusal_text() {
        let response = chat_response(json!({"status": "completed", "output": [{
            "type": "message", "content": [{"type": "refusal", "refusal": "I cannot help."}]
        }]}))
        .unwrap();
        assert_eq!(
            response["choices"][0]["message"]["content"],
            "I cannot help."
        );
    }

    #[test]
    fn only_structured_client_error_codes_select_responses() {
        assert!(required(
            reqwest::StatusCode::BAD_REQUEST,
            r#"{"error":{"code":"chat_completions_disabled"}}"#
        ));
        for body in [
            "not JSON",
            "{}",
            r#"{"error":{"message":"chat_completions_disabled"}}"#,
        ] {
            assert!(!required(reqwest::StatusCode::BAD_REQUEST, body));
        }
        for status in [
            reqwest::StatusCode::OK,
            reqwest::StatusCode::INTERNAL_SERVER_ERROR,
        ] {
            assert!(!required(
                status,
                r#"{"error":{"code":"chat_completions_disabled"}}"#
            ));
        }
    }
}
