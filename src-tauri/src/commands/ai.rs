#[cfg(desktop)]
use crate::ai_models::{AiModelProviderTestRequest, AiModelStreamRequest};

#[cfg(desktop)]
type StreamEmitter<Event> = Box<dyn Fn(Event) + Send>;

#[cfg(desktop)]
struct DesktopStreamScope {
    event_name: String,
}

#[cfg(desktop)]
impl DesktopStreamScope {
    fn shared(event_name: impl Into<String>) -> Self {
        Self {
            event_name: event_name.into(),
        }
    }
}

#[cfg(desktop)]
async fn run_desktop_stream<Event, Request, Runner>(
    app_handle: tauri::AppHandle,
    scope: DesktopStreamScope,
    request: Request,
    runner: Runner,
) -> Result<String, String>
where
    Event: serde::Serialize + Send + 'static,
    Request: Send + 'static,
    Runner: FnOnce(Request, StreamEmitter<Event>) -> Result<String, String> + Send + 'static,
{
    use tauri::Emitter;

    tokio::task::spawn_blocking(move || {
        let DesktopStreamScope { event_name } = scope;
        runner(
            request,
            Box::new(move |event| {
                let _ = app_handle.emit(event_name.as_str(), &event);
            }),
        )
    })
    .await
    .map_err(|e| format!("Task failed: {e}"))?
}

#[cfg(desktop)]
fn is_scoped_stream_event_name(default_event_name: &str, event_name: &str) -> bool {
    event_name
        .strip_prefix(default_event_name)
        .and_then(|suffix| suffix.strip_prefix('-'))
        .is_some_and(|suffix| {
            !suffix.is_empty()
                && suffix
                    .chars()
                    .all(|character| character.is_ascii_alphanumeric() || character == '-')
        })
}

#[cfg(desktop)]
fn stream_event_name(default_event_name: &'static str, requested: Option<&str>) -> String {
    requested
        .filter(|event_name| is_scoped_stream_event_name(default_event_name, event_name))
        .unwrap_or(default_event_name)
        .to_string()
}

#[cfg(desktop)]
#[tauri::command]
pub async fn stream_ai_model(
    app_handle: tauri::AppHandle,
    request: AiModelStreamRequest,
) -> Result<String, String> {
    let event_name = stream_event_name("ai-model-stream", request.event_name.as_deref());
    run_desktop_stream(
        app_handle,
        DesktopStreamScope::shared(event_name),
        request,
        crate::ai_models::run_ai_model_stream,
    )
    .await
}

#[cfg(desktop)]
#[tauri::command]
pub fn save_ai_model_provider_api_key(provider_id: String, api_key: String) -> Result<(), String> {
    crate::ai_models::save_provider_api_key(provider_id, api_key)
}

#[cfg(desktop)]
#[tauri::command]
pub fn delete_ai_model_provider_api_key(provider_id: String) -> Result<(), String> {
    crate::ai_models::delete_provider_api_key(provider_id)
}

#[cfg(desktop)]
#[tauri::command]
pub fn test_ai_model_provider(request: AiModelProviderTestRequest) -> Result<String, String> {
    crate::ai_models::test_ai_model_provider(request)
}

#[cfg(mobile)]
#[tauri::command]
pub async fn stream_ai_model(
    _app_handle: tauri::AppHandle,
    _request: crate::ai_models::AiModelStreamRequest,
) -> Result<String, String> {
    Err("Direct AI model chat is not available in this mobile build yet.".into())
}

#[cfg(mobile)]
#[tauri::command]
pub fn save_ai_model_provider_api_key(
    _provider_id: String,
    _api_key: String,
) -> Result<(), String> {
    Err("Local AI provider secret storage is only available in the desktop app.".into())
}

#[cfg(mobile)]
#[tauri::command]
pub fn delete_ai_model_provider_api_key(_provider_id: String) -> Result<(), String> {
    Err("Local AI provider secret storage is only available in the desktop app.".into())
}

#[cfg(mobile)]
#[tauri::command]
pub fn test_ai_model_provider(
    _request: crate::ai_models::AiModelProviderTestRequest,
) -> Result<String, String> {
    Err("Direct AI model tests are not available in this mobile build yet.".into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(desktop)]
    #[test]
    fn stream_event_name_accepts_only_scoped_names() {
        assert_eq!(
            stream_event_name("ai-model-stream", Some("ai-model-stream-chat-123")),
            "ai-model-stream-chat-123",
        );
        assert_eq!(
            stream_event_name("ai-model-stream", Some("ai-agent-stream-chat-123")),
            "ai-model-stream",
        );
        assert_eq!(
            stream_event_name("ai-model-stream", Some("ai-model-stream/../bad")),
            "ai-model-stream",
        );
    }
}
