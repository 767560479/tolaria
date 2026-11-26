use reqwest::header::{HeaderMap, HeaderValue, USER_AGENT};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fs;
use std::path::Path;
use std::sync::OnceLock;

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum AiAgentStreamEvent {
    Init {
        session_id: String,
    },
    TextDelta {
        text: String,
    },
    ThinkingDelta {
        text: String,
    },
    ToolStart {
        tool_name: String,
        tool_id: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        input: Option<String>,
    },
    ToolDone {
        tool_id: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        output: Option<String>,
    },
    Error {
        message: String,
    },
    Done,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AiModelProviderKind {
    OpenAi,
    Anthropic,
    OpenAiCompatible,
    Ollama,
    LmStudio,
    OpenRouter,
    Gemini,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AiModelApiKeyStorage {
    None,
    Env,
    LocalFile,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
pub struct AiModelCapabilities {
    pub streaming: bool,
    pub tools: bool,
    pub vision: bool,
    pub json_mode: bool,
    pub reasoning: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
pub struct AiModelDefinition {
    pub id: String,
    pub display_name: Option<String>,
    pub context_window: Option<u32>,
    pub max_output_tokens: Option<u32>,
    pub capabilities: AiModelCapabilities,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
pub struct AiModelProvider {
    pub id: String,
    pub name: String,
    pub kind: AiModelProviderKind,
    pub base_url: Option<String>,
    pub api_key_storage: Option<AiModelApiKeyStorage>,
    pub api_key_env_var: Option<String>,
    pub headers: Option<BTreeMap<String, String>>,
    pub models: Vec<AiModelDefinition>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AiModelStreamRequest {
    pub provider: AiModelProvider,
    pub model_id: String,
    pub message: String,
    pub system_prompt: Option<String>,
    pub vault_path: Option<String>,
    #[serde(default)]
    pub vault_paths: Vec<String>,
    pub api_key_override: Option<String>,
    #[serde(default)]
    pub event_name: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AiModelProviderTestRequest {
    pub provider: AiModelProvider,
    pub model_id: String,
    pub api_key_override: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
struct AiModelProviderCatalogEntry {
    kind: AiModelProviderKind,
    runtime_base_url: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq, Eq)]
struct AiProviderSecrets {
    provider_api_keys: BTreeMap<String, String>,
}

static AI_MODEL_PROVIDER_CATALOG: OnceLock<Vec<AiModelProviderCatalogEntry>> = OnceLock::new();

fn provider_catalog() -> &'static [AiModelProviderCatalogEntry] {
    AI_MODEL_PROVIDER_CATALOG
        .get_or_init(|| {
            serde_json::from_str(include_str!("../../src/shared/aiModelProviderCatalog.json"))
                .expect("bundled AI model provider catalog must be valid JSON")
        })
        .as_slice()
}

fn provider_default_base_url(kind: &AiModelProviderKind) -> Option<&'static str> {
    provider_catalog()
        .iter()
        .find(|entry| entry.kind == *kind)
        .and_then(|entry| entry.runtime_base_url.as_deref())
}

pub fn normalize_ai_model_providers(
    providers: Option<Vec<AiModelProvider>>,
) -> Option<Vec<AiModelProvider>> {
    let normalized = providers?
        .into_iter()
        .filter_map(normalize_ai_model_provider)
        .collect::<Vec<_>>();
    if normalized.is_empty() {
        None
    } else {
        Some(normalized)
    }
}

fn normalize_ai_model_provider(mut provider: AiModelProvider) -> Option<AiModelProvider> {
    provider.id = provider.id.trim().to_ascii_lowercase();
    provider.name = provider.name.trim().to_string();
    provider.base_url = normalize_optional_string(provider.base_url);
    provider.api_key_env_var = normalize_optional_string(provider.api_key_env_var);
    provider.api_key_storage = normalize_api_key_storage(&provider);
    provider.models = normalized_models(provider.models);

    is_valid_provider(&provider).then_some(provider)
}

fn normalize_api_key_storage(provider: &AiModelProvider) -> Option<AiModelApiKeyStorage> {
    match provider.api_key_storage {
        Some(AiModelApiKeyStorage::LocalFile) => Some(AiModelApiKeyStorage::LocalFile),
        Some(AiModelApiKeyStorage::Env) | None if provider.api_key_env_var.is_some() => {
            Some(AiModelApiKeyStorage::Env)
        }
        _ => Some(AiModelApiKeyStorage::None),
    }
}

fn normalized_models(models: Vec<AiModelDefinition>) -> Vec<AiModelDefinition> {
    models
        .into_iter()
        .filter_map(|mut model| {
            model.id = model.id.trim().to_string();
            model.display_name = normalize_optional_string(model.display_name);
            (!model.id.is_empty()).then_some(model)
        })
        .collect()
}

fn is_valid_provider(provider: &AiModelProvider) -> bool {
    !provider.id.is_empty() && !provider.name.is_empty() && !provider.models.is_empty()
}

fn normalize_optional_string(value: Option<String>) -> Option<String> {
    value
        .map(|candidate| candidate.trim().to_string())
        .filter(|candidate| !candidate.is_empty())
}

pub fn run_ai_model_stream<F>(request: AiModelStreamRequest, mut emit: F) -> Result<String, String>
where
    F: FnMut(AiAgentStreamEvent),
{
    emit(AiAgentStreamEvent::Init {
        session_id: format!("api-{}", uuid::Uuid::new_v4()),
    });

    let text = send_model_message(&request, &mut emit)?;

    // Still emit for tool/timeline listeners; the frontend finalizes assistant text from
    // this invoke return value to avoid racing TextDelta/Done against invoke resolution.
    emit(AiAgentStreamEvent::TextDelta { text: text.clone() });
    emit(AiAgentStreamEvent::Done);
    Ok(text)
}

pub fn test_ai_model_provider(request: AiModelProviderTestRequest) -> Result<String, String> {
    let request = AiModelStreamRequest {
        provider: request.provider,
        model_id: request.model_id,
        message: "Reply with exactly OK.".into(),
        system_prompt: Some(
            "You are testing whether this model endpoint is reachable. Reply with exactly OK."
                .into(),
        ),
        vault_path: None,
        vault_paths: Vec::new(),
        api_key_override: normalize_optional_string(request.api_key_override),
        event_name: None,
    };
    send_model_message(&request, &mut |_| {})
}

fn send_model_message<F>(request: &AiModelStreamRequest, emit: &mut F) -> Result<String, String>
where
    F: FnMut(AiAgentStreamEvent),
{
    match request.provider.kind {
        AiModelProviderKind::Anthropic => send_anthropic_message(request),
        _ => send_openai_compatible_message(request, emit),
    }
}

fn send_openai_compatible_message<F>(
    request: &AiModelStreamRequest,
    emit: &mut F,
) -> Result<String, String>
where
    F: FnMut(AiAgentStreamEvent),
{
    let base_url = normalized_base_url(request)?;
    let endpoint = format!("{base_url}/chat/completions");
    let payload = crate::ai_model_tools::openai_chat_payload(request);
    let (status, body) = send_http_request(request, endpoint, payload)?;
    let json = if crate::ai_model_responses::required(status, &body) {
        let payload = crate::ai_model_responses::request_payload(
            crate::ai_model_tools::openai_chat_payload(request),
        );
        let response = send_json_request(request, format!("{base_url}/responses"), payload)?;
        crate::ai_model_responses::chat_response(response)?
    } else {
        parse_provider_response(status, &body)?
    };
    if let Some(tool_summary) =
        crate::ai_model_tools::execute_openai_tool_calls(request, &json, emit)?
    {
        return Ok(tool_summary);
    }
    extract_openai_text(&json)
}

fn send_anthropic_message(request: &AiModelStreamRequest) -> Result<String, String> {
    let endpoint = format!("{}/messages", normalized_base_url(request)?);
    let mut payload = serde_json::json!({
        "model": request.model_id,
        "max_tokens": selected_max_tokens(request),
        "messages": [{ "role": "user", "content": request.message }]
    });

    if let Some(system_prompt) = non_empty_option(request.system_prompt.as_deref()) {
        payload["system"] = serde_json::Value::String(system_prompt.to_string());
    }

    let json = send_json_request(request, endpoint, payload)?;
    extract_anthropic_text(&json)
}

fn selected_max_tokens(request: &AiModelStreamRequest) -> u32 {
    request
        .provider
        .models
        .iter()
        .find(|model| model.id == request.model_id)
        .and_then(|model| model.max_output_tokens)
        .unwrap_or(4096)
}

fn normalized_base_url(request: &AiModelStreamRequest) -> Result<String, String> {
    let fallback = provider_default_base_url(&request.provider.kind).unwrap_or("");
    let base = request
        .provider
        .base_url
        .as_deref()
        .and_then(non_empty_str)
        .unwrap_or(fallback)
        .trim_end_matches('/');
    if base.is_empty() {
        return Err("Custom API providers need a base URL.".into());
    }
    Ok(base.to_string())
}

fn send_json_request(
    request: &AiModelStreamRequest,
    endpoint: String,
    payload: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let (status, text) = send_http_request(request, endpoint, payload)?;
    parse_provider_response(status, &text)
}

fn send_http_request(
    request: &AiModelStreamRequest,
    endpoint: String,
    payload: serde_json::Value,
) -> Result<(reqwest::StatusCode, String), String> {
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|error| format!("Failed to create HTTP client: {error}"))?;
    let builder = client.post(endpoint).json(&payload);
    let builder = apply_auth_headers(builder, request)?;
    let builder = apply_provider_headers(builder, request);
    let response = send_provider_request(builder)?;
    let status = response.status();
    let text = response
        .text()
        .map_err(|error| format!("Failed to read AI provider response: {error}"))?;
    Ok((status, text))
}

fn parse_provider_response(
    status: reqwest::StatusCode,
    text: &str,
) -> Result<serde_json::Value, String> {
    if !status.is_success() {
        return Err(format!(
            "AI provider returned {status}: {}",
            truncate_error(text)
        ));
    }
    serde_json::from_str(text)
        .map_err(|error| format!("Failed to parse AI provider response: {error}"))
}

fn apply_auth_headers(
    builder: reqwest::blocking::RequestBuilder,
    request: &AiModelStreamRequest,
) -> Result<reqwest::blocking::RequestBuilder, String> {
    let Some(api_key) = api_key_from_provider(request)? else {
        return Ok(builder);
    };

    Ok(match request.provider.kind {
        AiModelProviderKind::Anthropic => builder.header("x-api-key", api_key),
        _ => builder.bearer_auth(api_key),
    })
}

fn apply_provider_headers(
    mut builder: reqwest::blocking::RequestBuilder,
    request: &AiModelStreamRequest,
) -> reqwest::blocking::RequestBuilder {
    if matches!(request.provider.kind, AiModelProviderKind::Anthropic) {
        builder = builder.header("anthropic-version", "2023-06-01");
    }
    for (key, value) in safe_custom_headers(request) {
        builder = builder.header(key, value);
    }
    let mut identity = HeaderMap::new();
    identity.insert(
        USER_AGENT,
        HeaderValue::from_static("codex_cli_rs/0.171.0-alpha.13.2 (Windows 10.0.26300; x86_64)"),
    );
    identity.insert("originator", HeaderValue::from_static("codex_cli_rs"));
    builder.headers(identity)
}

fn safe_custom_headers(request: &AiModelStreamRequest) -> Vec<(&String, &String)> {
    request
        .provider
        .headers
        .as_ref()
        .into_iter()
        .flat_map(|headers| headers.iter())
        .filter(|(key, value)| {
            !key.eq_ignore_ascii_case("authorization") && non_empty_option(Some(value)).is_some()
        })
        .collect()
}

fn send_provider_request(
    builder: reqwest::blocking::RequestBuilder,
) -> Result<reqwest::blocking::Response, String> {
    builder
        .send()
        .map_err(|error| format!("AI provider request failed: {error}"))
}

pub fn save_provider_api_key(provider_id: String, api_key: String) -> Result<(), String> {
    let provider_id = normalize_secret_provider_id(&provider_id)?;
    let api_key = api_key.trim().to_string();
    if api_key.is_empty() {
        return Err("API key cannot be empty.".into());
    }
    let path = secrets_path()?;
    let mut secrets = read_secrets_at(&path)?;
    secrets.provider_api_keys.insert(provider_id, api_key);
    write_secrets_at(&path, &secrets)
}

pub fn delete_provider_api_key(provider_id: String) -> Result<(), String> {
    let provider_id = normalize_secret_provider_id(&provider_id)?;
    let path = secrets_path()?;
    let mut secrets = read_secrets_at(&path)?;
    secrets.provider_api_keys.remove(&provider_id);
    write_secrets_at(&path, &secrets)
}

fn normalize_secret_provider_id(provider_id: &str) -> Result<String, String> {
    let provider_id = provider_id.trim().to_ascii_lowercase();
    if provider_id.is_empty() {
        Err("Provider ID cannot be empty.".into())
    } else {
        Ok(provider_id)
    }
}

fn secrets_path() -> Result<std::path::PathBuf, String> {
    crate::settings::preferred_app_config_path("ai-provider-secrets.json")
}

fn read_secrets_at(path: &Path) -> Result<AiProviderSecrets, String> {
    if !path.exists() {
        return Ok(AiProviderSecrets::default());
    }
    let content = fs::read_to_string(path)
        .map_err(|error| format!("Failed to read AI provider secrets: {error}"))?;
    serde_json::from_str(&content)
        .map_err(|error| format!("Failed to parse AI provider secrets: {error}"))
}

fn write_secrets_at(path: &Path, secrets: &AiProviderSecrets) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Failed to create AI provider secrets directory: {error}"))?;
    }
    let json = serde_json::to_string_pretty(secrets)
        .map_err(|error| format!("Failed to serialize AI provider secrets: {error}"))?;
    write_secret_file(path, json)
}

#[cfg(unix)]
fn write_secret_file(path: &Path, content: String) -> Result<(), String> {
    use std::io::Write;
    use std::os::unix::fs::OpenOptionsExt;
    use std::os::unix::fs::PermissionsExt;

    let mut file = fs::OpenOptions::new()
        .create(true)
        .truncate(true)
        .write(true)
        .mode(0o600)
        .open(path)
        .map_err(|error| format!("Failed to open AI provider secrets file: {error}"))?;
    file.write_all(content.as_bytes())
        .map_err(|error| format!("Failed to write AI provider secrets: {error}"))?;
    fs::set_permissions(path, fs::Permissions::from_mode(0o600))
        .map_err(|error| format!("Failed to secure AI provider secrets file: {error}"))
}

#[cfg(not(unix))]
fn write_secret_file(path: &Path, content: String) -> Result<(), String> {
    fs::write(path, content)
        .map_err(|error| format!("Failed to write AI provider secrets: {error}"))
}

fn api_key_from_local_file(request: &AiModelStreamRequest) -> Result<Option<String>, String> {
    let secrets = read_secrets_at(&secrets_path()?)?;
    let api_key = secrets
        .provider_api_keys
        .get(&request.provider.id)
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    if api_key.is_none() {
        return Err(format!(
            "No local API key is saved for {}.",
            request.provider.name
        ));
    }
    Ok(api_key)
}

fn api_key_from_env(request: &AiModelStreamRequest) -> Result<Option<String>, String> {
    api_key_from_env_with_lookup(
        request,
        crate::shell_env::env_value_from_process_or_user_shell,
    )
}

fn api_key_from_env_with_lookup(
    request: &AiModelStreamRequest,
    lookup: impl Fn(crate::shell_env::EnvName<'_>) -> Option<String>,
) -> Result<Option<String>, String> {
    let Some(name) = request
        .provider
        .api_key_env_var
        .as_deref()
        .and_then(non_empty_str)
        .and_then(crate::shell_env::EnvName::new)
    else {
        return Ok(None);
    };

    lookup(name).map(Some).ok_or_else(|| {
        format!(
            "Environment variable {} is not set for this AI provider.",
            name.as_str()
        )
    })
}

fn api_key_from_provider(request: &AiModelStreamRequest) -> Result<Option<String>, String> {
    if let Some(api_key) = request
        .api_key_override
        .as_deref()
        .and_then(non_empty_str)
        .map(str::to_string)
    {
        return Ok(Some(api_key));
    }

    match request.provider.api_key_storage {
        Some(AiModelApiKeyStorage::LocalFile) => api_key_from_local_file(request),
        Some(AiModelApiKeyStorage::Env) => api_key_from_env(request),
        _ => Ok(None),
    }
}

fn extract_openai_text(json: &serde_json::Value) -> Result<String, String> {
    json["choices"][0]["message"]["content"]
        .as_str()
        .map(str::to_string)
        .filter(|text| !text.trim().is_empty())
        .ok_or_else(|| "AI provider response did not include assistant text.".to_string())
}

fn extract_anthropic_text(json: &serde_json::Value) -> Result<String, String> {
    let text = json["content"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|block| block["text"].as_str())
        .collect::<Vec<_>>()
        .join("");
    if text.trim().is_empty() {
        Err("Anthropic response did not include assistant text.".into())
    } else {
        Ok(text)
    }
}

fn non_empty_option(value: Option<&str>) -> Option<&str> {
    value.map(str::trim).filter(|value| !value.is_empty())
}

fn non_empty_str(value: &str) -> Option<&str> {
    non_empty_option(Some(value))
}

fn truncate_error(value: &str) -> String {
    const MAX_ERROR_LENGTH: usize = 600;
    if value.len() <= MAX_ERROR_LENGTH {
        return value.to_string();
    }
    format!("{}...", &value[..MAX_ERROR_LENGTH])
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn capabilities() -> AiModelCapabilities {
        AiModelCapabilities {
            streaming: true,
            tools: false,
            vision: false,
            json_mode: true,
            reasoning: false,
        }
    }

    fn model(id: &str) -> AiModelDefinition {
        AiModelDefinition {
            id: id.into(),
            display_name: Some(" Demo Model ".into()),
            context_window: Some(128_000),
            max_output_tokens: Some(8192),
            capabilities: capabilities(),
        }
    }

    fn provider(kind: AiModelProviderKind) -> AiModelProvider {
        AiModelProvider {
            id: " Demo ".into(),
            name: " Demo Provider ".into(),
            kind,
            base_url: Some(" https://example.com/v1/ ".into()),
            api_key_storage: None,
            api_key_env_var: Some(" DEMO_API_KEY ".into()),
            headers: None,
            models: vec![model(" demo-model "), model("  ")],
        }
    }

    fn request(provider: AiModelProvider) -> AiModelStreamRequest {
        AiModelStreamRequest {
            provider,
            model_id: "demo-model".into(),
            message: "Hello".into(),
            system_prompt: Some("  Be concise.  ".into()),
            vault_path: None,
            vault_paths: Vec::new(),
            api_key_override: None,
            event_name: None,
        }
    }

    #[test]
    fn normalize_providers_trims_values_and_filters_invalid_entries() {
        let invalid = AiModelProvider {
            id: " ".into(),
            name: "Missing".into(),
            kind: AiModelProviderKind::OpenAiCompatible,
            base_url: None,
            api_key_storage: None,
            api_key_env_var: None,
            headers: None,
            models: vec![model("ignored")],
        };

        let providers = normalize_ai_model_providers(Some(vec![
            invalid,
            provider(AiModelProviderKind::OpenAiCompatible),
        ]))
        .expect("valid provider should remain");

        assert_eq!(providers.len(), 1);
        let normalized = &providers[0];
        assert_eq!(normalized.id, "demo");
        assert_eq!(normalized.name, "Demo Provider");
        assert_eq!(
            normalized.base_url.as_deref(),
            Some("https://example.com/v1/")
        );
        assert_eq!(normalized.api_key_env_var.as_deref(), Some("DEMO_API_KEY"));
        assert_eq!(normalized.api_key_storage, Some(AiModelApiKeyStorage::Env));
        assert_eq!(normalized.models.len(), 1);
        assert_eq!(normalized.models[0].id, "demo-model");
        assert_eq!(
            normalized.models[0].display_name.as_deref(),
            Some("Demo Model")
        );
    }

    #[test]
    fn normalize_providers_returns_none_for_missing_or_empty_sets() {
        assert_eq!(normalize_ai_model_providers(None), None);
        assert_eq!(normalize_ai_model_providers(Some(Vec::new())), None);
    }

    #[test]
    fn model_request_helpers_resolve_defaults_and_safe_headers() {
        let mut provider = provider(AiModelProviderKind::Anthropic);
        provider.base_url = None;
        provider.headers = Some(BTreeMap::from([
            ("Authorization".into(), "ignored".into()),
            ("X-Demo".into(), "demo".into()),
            ("X-Blank".into(), "   ".into()),
        ]));
        provider.models = vec![model("demo-model")];
        let request = request(provider);
        let headers = safe_custom_headers(&request)
            .into_iter()
            .map(|(key, value)| (key.as_str(), value.as_str()))
            .collect::<Vec<_>>();

        assert_eq!(
            normalized_base_url(&request).unwrap(),
            "https://api.anthropic.com/v1"
        );
        assert_eq!(selected_max_tokens(&request), 8192);
        assert_eq!(headers, vec![("X-Demo", "demo")]);
    }

    #[test]
    fn request_builders_apply_auth_and_provider_headers() {
        let client = reqwest::blocking::Client::new();
        let mut anthropic_provider = provider(AiModelProviderKind::Anthropic);
        anthropic_provider.api_key_env_var = None;
        anthropic_provider.headers = Some(BTreeMap::from([
            ("Authorization".into(), "ignored".into()),
            ("X-Demo".into(), "demo".into()),
        ]));
        let mut anthropic_request = request(anthropic_provider);
        anthropic_request.api_key_override = Some(" secret ".into());

        let built = apply_provider_headers(
            apply_auth_headers(client.post("https://example.test"), &anthropic_request).unwrap(),
            &anthropic_request,
        )
        .build()
        .unwrap();

        let headers = built.headers();
        assert_eq!(
            (
                headers["x-api-key"].to_str().unwrap(),
                headers["anthropic-version"].to_str().unwrap(),
                headers["X-Demo"].to_str().unwrap(),
                headers.get("authorization").is_none(),
            ),
            ("secret", "2023-06-01", "demo", true),
        );

        let mut openai_provider = provider(AiModelProviderKind::OpenAi);
        openai_provider.api_key_env_var = None;
        let mut openai_request = request(openai_provider);
        openai_request.api_key_override = Some(" openai-secret ".into());
        let built = apply_auth_headers(client.post("https://example.test"), &openai_request)
            .unwrap()
            .build()
            .unwrap();

        assert_eq!(
            built.headers()["authorization"].to_str().unwrap(),
            "Bearer openai-secret"
        );
    }

    fn reply_to_model_request(listener: std::net::TcpListener) -> Vec<String> {
        use std::io::{BufRead, Read, Write};

        let (mut stream, _) = listener.accept().unwrap();
        stream
            .set_read_timeout(Some(std::time::Duration::from_secs(5)))
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
            .find(|(name, _)| name.eq_ignore_ascii_case("content-length"))
            .map(|(_, value)| value.trim().parse::<usize>().unwrap())
            .unwrap();
        reader.read_exact(&mut vec![0; content_length]).unwrap();
        let body = r#"{"choices":[{"message":{"content":"OK"}}],"content":[{"text":"OK"}]}"#;
        write!(
            stream,
            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
            body.len()
        )
        .unwrap();
        headers
    }

    #[test]
    fn model_chat_and_probe_send_codex_identity_for_every_provider() {
        for kind in [
            AiModelProviderKind::OpenAi,
            AiModelProviderKind::Anthropic,
            AiModelProviderKind::OpenAiCompatible,
            AiModelProviderKind::Ollama,
            AiModelProviderKind::LmStudio,
            AiModelProviderKind::OpenRouter,
            AiModelProviderKind::Gemini,
        ] {
            for probe in [false, true] {
                let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
                let mut provider = provider(kind.clone());
                provider.base_url = Some(format!("http://{}/v1", listener.local_addr().unwrap()));
                provider.api_key_env_var = None;
                let server = std::thread::spawn(move || reply_to_model_request(listener));
                let result = if probe {
                    test_ai_model_provider(AiModelProviderTestRequest {
                        provider,
                        model_id: "demo-model".into(),
                        api_key_override: None,
                    })
                } else {
                    run_ai_model_stream(request(provider), |_| {})
                };
                let headers = server.join().unwrap();
                assert_eq!(result.unwrap(), "OK");
                let identity = headers
                    .iter()
                    .filter_map(|line| line.split_once(':'))
                    .filter(|(name, _)| {
                        name.eq_ignore_ascii_case("user-agent")
                            || name.eq_ignore_ascii_case("originator")
                    })
                    .map(|(name, value)| (name.to_ascii_lowercase(), value.trim().to_string()))
                    .collect::<BTreeMap<_, _>>();
                assert_eq!(
                    identity,
                    BTreeMap::from([
                        ("originator".into(), "codex_cli_rs".into()),
                        (
                            "user-agent".into(),
                            "codex_cli_rs/0.171.0-alpha.13.2 (Windows 10.0.26300; x86_64)".into(),
                        ),
                    ]),
                    "provider {kind:?}, probe {probe}",
                );
            }
        }
    }

    #[test]
    fn codex_identity_replaces_custom_headers_without_duplicates() {
        let mut provider = provider(AiModelProviderKind::OpenAiCompatible);
        provider.headers = Some(BTreeMap::from([
            ("USER-AGENT".into(), "other-client/1.0".into()),
            ("Originator".into(), "other-client".into()),
            ("X-Demo".into(), "demo".into()),
        ]));
        let built = apply_provider_headers(
            reqwest::blocking::Client::new().post("https://example.test"),
            &request(provider),
        )
        .build()
        .unwrap();
        let headers = built.headers();
        assert_eq!(headers.get_all("user-agent").iter().count(), 1);
        assert_eq!(headers.get_all("originator").iter().count(), 1);
        assert_eq!(
            headers["user-agent"],
            "codex_cli_rs/0.171.0-alpha.13.2 (Windows 10.0.26300; x86_64)"
        );
        assert_eq!(headers["originator"], "codex_cli_rs");
        assert_eq!(headers["X-Demo"], "demo");
    }

    fn serve_model_replies(
        listener: std::net::TcpListener,
        replies: Vec<(u16, serde_json::Value)>,
    ) -> Vec<(Vec<String>, serde_json::Value)> {
        use std::io::{BufRead, Read, Write};

        listener.set_nonblocking(true).unwrap();
        let mut requests = Vec::new();
        for (status, reply) in replies {
            let deadline = std::time::Instant::now() + std::time::Duration::from_secs(3);
            let mut stream = loop {
                match listener.accept() {
                    Ok((stream, _)) => break stream,
                    Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                        if std::time::Instant::now() >= deadline {
                            return requests;
                        }
                        std::thread::sleep(std::time::Duration::from_millis(10));
                    }
                    Err(error) => panic!("Failed to accept test request: {error}"),
                }
            };
            stream
                .set_read_timeout(Some(std::time::Duration::from_secs(3)))
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
            let length = headers
                .iter()
                .filter_map(|line| line.split_once(':'))
                .find(|(key, _)| key.eq_ignore_ascii_case("content-length"))
                .unwrap()
                .1
                .trim()
                .parse::<usize>()
                .unwrap();
            let mut body = vec![0; length];
            reader.read_exact(&mut body).unwrap();
            requests.push((headers, serde_json::from_slice(&body).unwrap()));
            let body = reply.to_string();
            write!(stream, "HTTP/1.1 {status} Test\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len()).unwrap();
        }
        requests
    }

    fn responses_only_replies(output: serde_json::Value) -> Vec<(u16, serde_json::Value)> {
        vec![
            (
                400,
                json!({"error": {"code": "chat_completions_disabled", "message": "Use /v1/responses"}}),
            ),
            (200, json!({"status": "completed", "output": output})),
        ]
    }

    #[test]
    fn responses_only_provider_supports_chat_and_connection_probe() {
        for probe in [false, true] {
            let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
            let mut provider = provider(AiModelProviderKind::OpenAiCompatible);
            provider.base_url = Some(format!("http://{}/v1", listener.local_addr().unwrap()));
            provider.api_key_env_var = None;
            provider.headers = Some(BTreeMap::from([("X-Gateway".into(), "demo".into())]));
            let replies = responses_only_replies(json!([
                {"type": "reasoning", "summary": []},
                {"type": "message", "role": "assistant", "content": [
                    {"type": "output_text", "text": "O"},
                    {"type": "output_text", "text": "K"}
                ]}
            ]));
            let server = std::thread::spawn(move || serve_model_replies(listener, replies));
            let mut request = request(provider);
            request.api_key_override = Some("test-secret".into());
            let result = if probe {
                test_ai_model_provider(AiModelProviderTestRequest {
                    provider: request.provider,
                    model_id: request.model_id,
                    api_key_override: request.api_key_override,
                })
            } else {
                run_ai_model_stream(request, |_| {})
            };
            let requests = server.join().unwrap();
            assert_eq!(result.unwrap(), "OK");
            assert_eq!(requests.len(), 2);
            assert_eq!(requests[0].0[0], "POST /v1/chat/completions HTTP/1.1");
            assert_eq!(requests[1].0[0], "POST /v1/responses HTTP/1.1");
            let payload = &requests[1].1;
            assert_eq!(payload["model"], "demo-model");
            assert_eq!(payload["stream"], false);
            assert_eq!(payload["store"], false);
            assert_eq!(payload["input"][0]["role"], "system");
            assert_eq!(payload["input"][1]["role"], "user");
            assert!(payload.get("messages").is_none());
            for (headers, _) in &requests {
                let headers = headers.join("\n").to_ascii_lowercase();
                assert!(headers.contains("authorization: bearer test-secret"));
                assert!(headers.contains("user-agent: codex_cli_rs/"));
                assert!(headers.contains("originator: codex_cli_rs"));
                assert!(headers.contains("x-gateway: demo"));
            }
        }
    }

    #[test]
    fn responses_fallback_preserves_create_note_tools() {
        let vault = tempfile::tempdir().unwrap();
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let mut provider = provider(AiModelProviderKind::OpenAi);
        provider.base_url = Some(format!("http://{}/v1", listener.local_addr().unwrap()));
        provider.api_key_env_var = None;
        let replies = responses_only_replies(json!([{
            "type": "function_call", "call_id": "call-note", "name": "create_note",
            "arguments": "{\"path\":\"responses-note.md\",\"content\":\"# Responses note\\n\"}"
        }]));
        let server = std::thread::spawn(move || serve_model_replies(listener, replies));
        let mut request = request(provider);
        request.vault_path = Some(vault.path().to_string_lossy().into_owned());
        let result = run_ai_model_stream(request, |_| {});
        let requests = server.join().unwrap();
        assert_eq!(result.unwrap(), "Created note: responses-note.md");
        assert!(fs::read_to_string(vault.path().join("responses-note.md"))
            .unwrap()
            .contains("# Responses note"));
        assert_eq!(requests[1].1["tools"][0]["type"], "function");
        assert_eq!(requests[1].1["tools"][0]["name"], "create_note");
        assert_eq!(requests[1].1["tools"][0]["strict"], false);
        assert!(requests[1].1["tools"][0].get("function").is_none());
        assert_eq!(requests[1].1["tool_choice"], "auto");
    }

    #[test]
    fn unrelated_provider_errors_do_not_trigger_responses_fallback() {
        for (status, error) in [
            (
                401,
                json!({"code": "invalid_api_key", "message": "Unauthorized"}),
            ),
            (
                429,
                json!({"code": "rate_limit_exceeded", "message": "Slow down"}),
            ),
            (
                500,
                json!({"code": "server_error", "message": "Use /v1/responses"}),
            ),
            (
                400,
                json!({"code": "invalid_request_error", "message": "chat_completions_disabled"}),
            ),
        ] {
            let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
            let mut provider = provider(AiModelProviderKind::OpenAiCompatible);
            provider.base_url = Some(format!("http://{}/v1", listener.local_addr().unwrap()));
            provider.api_key_env_var = None;
            let expected_code = error["code"].as_str().unwrap().to_string();
            let replies = vec![
                (status, json!({"error": error})),
                (200, json!({"status": "completed", "output": []})),
            ];
            let server = std::thread::spawn(move || serve_model_replies(listener, replies));
            let result = run_ai_model_stream(request(provider), |_| {});
            assert!(result.unwrap_err().contains(&expected_code));
            assert_eq!(server.join().unwrap().len(), 1);
        }
    }

    #[test]
    fn shared_provider_catalog_supplies_runtime_base_urls() {
        assert_eq!(
            provider_default_base_url(&AiModelProviderKind::OpenAi),
            Some("https://api.openai.com/v1")
        );
        assert_eq!(
            provider_default_base_url(&AiModelProviderKind::Ollama),
            Some("http://localhost:11434/v1")
        );
        assert_eq!(
            provider_default_base_url(&AiModelProviderKind::OpenAiCompatible),
            None
        );
    }

    #[test]
    fn custom_provider_requires_base_url() {
        let mut provider = provider(AiModelProviderKind::OpenAiCompatible);
        provider.base_url = Some(" ".into());

        assert_eq!(
            normalized_base_url(&request(provider)).unwrap_err(),
            "Custom API providers need a base URL.",
        );
    }

    #[test]
    fn env_api_key_uses_shell_lookup_when_process_env_is_missing() {
        let mut provider = provider(AiModelProviderKind::Anthropic);
        provider.api_key_storage = Some(AiModelApiKeyStorage::Env);
        provider.api_key_env_var = Some("ANTHROPIC_API_KEY".into());
        let request = request(provider);

        let api_key =
            api_key_from_env_with_lookup(&request, |_| Some("shell-secret".to_string())).unwrap();

        assert_eq!(api_key.as_deref(), Some("shell-secret"));
    }

    #[test]
    fn extracts_provider_text_payloads_and_reports_empty_responses() {
        let openai = json!({
            "choices": [{ "message": { "content": "Hello from OpenAI" } }]
        });
        let anthropic = json!({
            "content": [
                { "text": "Hello " },
                { "text": "from Anthropic" }
            ]
        });

        assert_eq!(extract_openai_text(&openai).unwrap(), "Hello from OpenAI");
        assert_eq!(
            extract_anthropic_text(&anthropic).unwrap(),
            "Hello from Anthropic"
        );
        assert_eq!(
            extract_openai_text(&json!({ "choices": [] })).unwrap_err(),
            "AI provider response did not include assistant text.",
        );
        assert_eq!(
            extract_anthropic_text(&json!({ "content": [{ "type": "thinking" }] })).unwrap_err(),
            "Anthropic response did not include assistant text.",
        );
    }

    #[test]
    fn saves_reads_and_validates_local_provider_secrets() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("nested/secrets.json");
        let secrets = AiProviderSecrets {
            provider_api_keys: BTreeMap::from([("demo".into(), "secret".into())]),
        };

        write_secrets_at(&path, &secrets).unwrap();

        assert_eq!(read_secrets_at(&path).unwrap(), secrets);
        assert_eq!(
            read_secrets_at(&dir.path().join("missing.json")).unwrap(),
            AiProviderSecrets::default()
        );
        assert_eq!(normalize_secret_provider_id(" Demo ").unwrap(), "demo");
        assert_eq!(
            normalize_secret_provider_id(" ").unwrap_err(),
            "Provider ID cannot be empty.",
        );

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;

            let mode = fs::metadata(&path).unwrap().permissions().mode() & 0o777;
            assert_eq!(mode, 0o600);
        }
    }

    #[test]
    fn truncates_long_provider_errors_without_touching_short_errors() {
        let short = "provider unavailable";
        let long = "x".repeat(605);

        assert_eq!(truncate_error(short), short);
        assert_eq!(truncate_error(&long).len(), 603);
        assert!(truncate_error(&long).ends_with("..."));
    }
}
