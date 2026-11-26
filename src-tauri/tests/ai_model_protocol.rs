use serde_json::{json, Value};
use std::collections::BTreeMap;
use std::io::{BufRead, Read, Write};
use std::net::TcpListener;
use std::thread;
use std::time::{Duration, Instant};
use tempfile::tempdir;
use tolaria_lib::ai_models::{
    run_ai_model_stream, test_ai_model_provider, AiModelCapabilities, AiModelDefinition,
    AiModelProvider, AiModelProviderKind, AiModelProviderTestRequest, AiModelStreamRequest,
};

fn provider(kind: AiModelProviderKind, base_url: String) -> AiModelProvider {
    AiModelProvider {
        id: "test-provider".into(),
        name: "Test provider".into(),
        kind,
        base_url: Some(base_url),
        api_key_storage: None,
        api_key_env_var: None,
        headers: Some(BTreeMap::from([("X-Gateway".into(), "test".into())])),
        models: vec![AiModelDefinition {
            id: "test-model".into(),
            display_name: Some("Test model".into()),
            context_window: Some(128_000),
            max_output_tokens: Some(8192),
            capabilities: AiModelCapabilities {
                streaming: true,
                tools: true,
                vision: false,
                json_mode: true,
                reasoning: true,
            },
        }],
    }
}

fn request(provider: AiModelProvider) -> AiModelStreamRequest {
    AiModelStreamRequest {
        provider,
        model_id: "test-model".into(),
        message: "Reply with exactly OK.".into(),
        system_prompt: Some("This is a protocol test.".into()),
        vault_path: None,
        vault_paths: Vec::new(),
        api_key_override: Some("test-secret".into()),
        event_name: None,
    }
}

fn serve_replies(listener: TcpListener, replies: Vec<(u16, Value)>) -> Vec<(Vec<String>, Value)> {
    listener.set_nonblocking(true).unwrap();
    let mut requests = Vec::new();
    for (status, reply) in replies {
        let deadline = Instant::now() + Duration::from_secs(5);
        let mut stream = loop {
            match listener.accept() {
                Ok((stream, _)) => break stream,
                Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                    assert!(
                        Instant::now() < deadline,
                        "Timed out waiting for the model request"
                    );
                    thread::sleep(Duration::from_millis(10));
                }
                Err(error) => panic!("Failed to accept model request: {error}"),
            }
        };
        stream
            .set_read_timeout(Some(Duration::from_secs(5)))
            .unwrap();
        let mut reader = std::io::BufReader::new(&stream);
        let mut headers = Vec::new();
        loop {
            let mut line = String::new();
            assert_ne!(reader.read_line(&mut line).unwrap(), 0);
            if line == "\r\n" {
                break;
            }
            headers.push(line.trim_end().to_string());
        }
        let content_length = headers
            .iter()
            .filter_map(|line| line.split_once(':'))
            .find(|(key, _)| key.eq_ignore_ascii_case("content-length"))
            .unwrap()
            .1
            .trim()
            .parse::<usize>()
            .unwrap();
        let mut body = vec![0; content_length];
        reader.read_exact(&mut body).unwrap();
        requests.push((headers, serde_json::from_slice(&body).unwrap()));

        let body = reply.to_string();
        write!(
            stream,
            "HTTP/1.1 {status} Test\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
            body.len()
        )
        .unwrap();
    }
    requests
}

fn start_responses_only_server(
    output: Value,
) -> (String, thread::JoinHandle<Vec<(Vec<String>, Value)>>) {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let base_url = format!("http://{}/v1", listener.local_addr().unwrap());
    let replies = vec![
        (400, json!({"error": {"code": "chat_completions_disabled"}})),
        (200, json!({"status": "completed", "output": output})),
    ];
    (
        base_url,
        thread::spawn(move || serve_replies(listener, replies)),
    )
}

#[test]
fn responses_only_provider_supports_chat_and_connection_probe() {
    for probe in [false, true] {
        let (base_url, server) = start_responses_only_server(json!([
            {"type": "reasoning", "summary": []},
            {"type": "message", "role": "assistant", "content": [
                {"type": "output_text", "text": "O"},
                {"type": "output_text", "text": "K"}
            ]}
        ]));
        let provider = provider(AiModelProviderKind::OpenAiCompatible, base_url);
        let model_request = request(provider);
        let result = if probe {
            test_ai_model_provider(AiModelProviderTestRequest {
                provider: model_request.provider,
                model_id: model_request.model_id,
                api_key_override: model_request.api_key_override,
            })
        } else {
            run_ai_model_stream(model_request, |_| {})
        };
        let requests = server.join().unwrap();

        assert_eq!(result.unwrap(), "OK");
        assert_eq!(requests.len(), 2);
        assert_eq!(requests[0].0[0], "POST /v1/chat/completions HTTP/1.1");
        assert_eq!(requests[1].0[0], "POST /v1/responses HTTP/1.1");
        assert_eq!(requests[1].1["model"], "test-model");
        assert_eq!(requests[1].1["store"], false);
        assert_eq!(requests[1].1["input"][0]["role"], "system");
        assert_eq!(requests[1].1["input"][1]["role"], "user");
        assert!(requests[1].1.get("messages").is_none());

        for (headers, _) in &requests {
            let headers = headers.join("\n").to_ascii_lowercase();
            assert!(headers.contains("authorization: bearer test-secret"));
            assert!(headers.contains("user-agent: codex_cli_rs/"));
            assert!(headers.contains("originator: codex_cli_rs"));
            assert!(headers.contains("x-gateway: test"));
        }
    }
}

#[test]
fn responses_fallback_preserves_native_create_note_tools() {
    let vault = tempdir().unwrap();
    let (base_url, server) = start_responses_only_server(json!([{
        "type": "function_call",
        "call_id": "call-note",
        "name": "create_note",
        "arguments": "{\"path\":\"responses-note.md\",\"content\":\"# Responses note\\n\"}"
    }]));
    let mut model_request = request(provider(AiModelProviderKind::OpenAi, base_url));
    model_request.vault_path = Some(vault.path().to_string_lossy().into_owned());

    let result = run_ai_model_stream(model_request, |_| {});
    let requests = server.join().unwrap();

    assert_eq!(result.unwrap(), "Created note: responses-note.md");
    assert!(
        std::fs::read_to_string(vault.path().join("responses-note.md"))
            .unwrap()
            .contains("# Responses note")
    );
    assert_eq!(requests[1].1["tools"][0]["type"], "function");
    assert_eq!(requests[1].1["tools"][0]["name"], "create_note");
    assert_eq!(requests[1].1["tools"][0]["strict"], false);
    assert_eq!(requests[1].1["tool_choice"], "auto");
}

#[test]
fn unrelated_provider_errors_do_not_trigger_responses_fallback() {
    for (status, error) in [
        (401, json!({"code": "invalid_api_key"})),
        (429, json!({"code": "rate_limit_exceeded"})),
        (
            500,
            json!({"code": "server_error", "message": "Use /v1/responses"}),
        ),
        (
            400,
            json!({"code": "invalid_request_error", "message": "chat_completions_disabled"}),
        ),
    ] {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let base_url = format!("http://{}/v1", listener.local_addr().unwrap());
        let reply = json!({"error": error});
        let server = thread::spawn(move || serve_replies(listener, vec![(status, reply)]));
        let result = run_ai_model_stream(
            request(provider(AiModelProviderKind::OpenAiCompatible, base_url)),
            |_| {},
        );

        assert!(result.is_err());
        assert_eq!(server.join().unwrap().len(), 1);
    }
}

#[test]
fn incomplete_or_statusless_responses_cannot_create_notes() {
    for response in [
        json!({"status": "incomplete", "output": [{
            "type": "function_call", "call_id": "call-note", "name": "create_note",
            "arguments": "{\"path\":\"partial-note.md\"}"
        }]}),
        json!({"output": [{
            "type": "function_call", "call_id": "call-note", "name": "create_note",
            "arguments": "{\"path\":\"partial-note.md\"}"
        }]}),
    ] {
        let vault = tempdir().unwrap();
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let base_url = format!("http://{}/v1", listener.local_addr().unwrap());
        let replies = vec![
            (400, json!({"error": {"code": "chat_completions_disabled"}})),
            (200, response),
        ];
        let server = thread::spawn(move || serve_replies(listener, replies));
        let mut model_request = request(provider(AiModelProviderKind::OpenAi, base_url));
        model_request.vault_path = Some(vault.path().to_string_lossy().into_owned());

        assert!(run_ai_model_stream(model_request, |_| {}).is_err());
        assert!(server.join().unwrap().len() == 2);
        assert!(!vault.path().join("partial-note.md").exists());
    }
}
