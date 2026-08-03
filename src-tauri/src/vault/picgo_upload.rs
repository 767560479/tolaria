use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use reqwest::blocking::{multipart, Client};
use reqwest::header::{AUTHORIZATION, HeaderMap, HeaderValue};
use serde_json::Value;
use std::fs;
use std::path::Path;
use std::time::Duration;

const REQUEST_TIMEOUT: Duration = Duration::from_secs(30);
const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);
const MAX_UPLOAD_BYTES: usize = 15 * 1024 * 1024;

pub fn normalize_picgo_server_url(value: Option<&str>) -> Option<String> {
    let trimmed = value?.trim();
    if trimmed.is_empty() {
        return None;
    }
    let Ok(parsed) = reqwest::Url::parse(trimmed) else {
        return None;
    };
    match parsed.scheme() {
        "http" | "https" => Some(trimmed.to_string()),
        _ => None,
    }
}

pub fn normalize_picgo_server_token(value: Option<&str>) -> Option<String> {
    let trimmed = value?.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

pub fn parse_picgo_upload_response(body: &str) -> Result<String, String> {
    let value: Value = serde_json::from_str(body)
        .map_err(|error| format!("PicGo response was not valid JSON: {error}"))?;

    if let Some(success) = value.get("success") {
        if success.as_bool() == Some(false) {
            let message = value
                .get("message")
                .or_else(|| value.get("msg"))
                .or_else(|| value.get("error"))
                .and_then(Value::as_str)
                .unwrap_or("upload failed");
            return Err(format!("PicGo upload failed: {message}"));
        }
    }

    if let Some(url) = extract_url_from_value(&value) {
        return Ok(url);
    }

    Err("PicGo response did not include an image URL".to_string())
}

fn extract_url_from_value(value: &Value) -> Option<String> {
    if let Some(url) = value.get("url").and_then(Value::as_str) {
        return Some(url.to_string());
    }

    match value.get("result") {
        Some(Value::String(url)) => Some(url.clone()),
        Some(Value::Array(items)) => items
            .iter()
            .find_map(|item| item.as_str().map(str::to_string)),
        _ => None,
    }
}

fn guess_mime(filename: &str) -> &'static str {
    match Path::new(filename)
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_ascii_lowercase())
        .as_deref()
    {
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("webp") => "image/webp",
        Some("bmp") => "image/bmp",
        Some("svg") => "image/svg+xml",
        Some("tif") | Some("tiff") => "image/tiff",
        _ => "application/octet-stream",
    }
}

fn build_client() -> Result<Client, String> {
    Client::builder()
        .timeout(REQUEST_TIMEOUT)
        .connect_timeout(CONNECT_TIMEOUT)
        .redirect(reqwest::redirect::Policy::limited(5))
        .build()
        .map_err(|error| format!("Failed to create HTTP client: {error}"))
}

fn authorization_headers(token: Option<&str>) -> Result<HeaderMap, String> {
    let mut headers = HeaderMap::new();
    if let Some(token) = token.map(str::trim).filter(|value| !value.is_empty()) {
        let value = HeaderValue::from_str(token)
            .map_err(|error| format!("Invalid PicGo authorization token: {error}"))?;
        headers.insert(AUTHORIZATION, value);
    }
    Ok(headers)
}

fn build_data_url(mime: &str, bytes: &[u8]) -> String {
    format!("data:{mime};base64,{}", BASE64.encode(bytes))
}

fn uses_json_base64_upload(server_url: &str) -> bool {
    server_url.to_ascii_lowercase().contains("base64")
}

fn post_json_base64_list(
    server_url: &str,
    token: Option<&str>,
    filename: &str,
    bytes: Vec<u8>,
) -> Result<String, String> {
    if bytes.len() > MAX_UPLOAD_BYTES {
        return Err(format!(
            "Image exceeds maximum upload size of {} bytes",
            MAX_UPLOAD_BYTES
        ));
    }

    let mime = guess_mime(filename);
    let payload = serde_json::json!({
        "list": [build_data_url(mime, &bytes)],
    });

    let client = build_client()?;
    let response = client
        .post(server_url)
        .headers(authorization_headers(token)?)
        .json(&payload)
        .send()
        .map_err(|error| format!("PicGo upload request failed: {error}"))?;

    let status = response.status();
    let body = response
        .text()
        .map_err(|error| format!("Failed to read PicGo response: {error}"))?;

    if !status.is_success() {
        return Err(format!(
            "PicGo upload HTTP {status}: {}",
            body.chars().take(200).collect::<String>()
        ));
    }

    parse_picgo_upload_response(&body)
}

fn post_image(
    server_url: &str,
    token: Option<&str>,
    filename: &str,
    bytes: Vec<u8>,
) -> Result<String, String> {
    if uses_json_base64_upload(server_url) {
        post_json_base64_list(server_url, token, filename, bytes)
    } else {
        post_multipart(server_url, token, filename, bytes)
    }
}

fn post_multipart(
    server_url: &str,
    token: Option<&str>,
    filename: &str,
    bytes: Vec<u8>,
) -> Result<String, String> {
    if bytes.len() > MAX_UPLOAD_BYTES {
        return Err(format!(
            "Image exceeds maximum upload size of {} bytes",
            MAX_UPLOAD_BYTES
        ));
    }

    let mime = guess_mime(filename);
    let part = multipart::Part::bytes(bytes)
        .file_name(filename.to_string())
        .mime_str(mime)
        .map_err(|error| format!("Invalid image MIME type: {error}"))?;

    let form = multipart::Form::new().part("file", part);

    let client = build_client()?;
    let response = client
        .post(server_url)
        .headers(authorization_headers(token)?)
        .multipart(form)
        .send()
        .map_err(|error| format!("PicGo upload request failed: {error}"))?;

    let status = response.status();
    let body = response
        .text()
        .map_err(|error| format!("Failed to read PicGo response: {error}"))?;

    if !status.is_success() {
        return Err(format!(
            "PicGo upload HTTP {status}: {}",
            body.chars().take(200).collect::<String>()
        ));
    }

    // Some servers return JSON with wrong content-type; still parse as JSON.
    parse_picgo_upload_response(&body)
}

pub fn upload_image_bytes_via_picgo(
    server_url: &str,
    token: Option<&str>,
    filename: &str,
    data_base64: &str,
) -> Result<String, String> {
    let server_url = normalize_picgo_server_url(Some(server_url))
        .ok_or_else(|| "PicGo server URL must be http(s)".to_string())?;
    let token = normalize_picgo_server_token(token);
    let bytes = BASE64
        .decode(data_base64.trim())
        .map_err(|error| format!("Invalid image base64 data: {error}"))?;
    post_image(&server_url, token.as_deref(), filename, bytes)
}

pub fn upload_image_path_via_picgo(
    server_url: &str,
    token: Option<&str>,
    source_path: &str,
) -> Result<String, String> {
    let path = Path::new(source_path);
    let filename = path
        .file_name()
        .and_then(|name| name.to_str())
        .filter(|name| !name.is_empty())
        .ok_or_else(|| "Image path is missing a file name".to_string())?;
    let bytes = fs::read(path).map_err(|error| format!("Failed to read image file: {error}"))?;
    let server_url = normalize_picgo_server_url(Some(server_url))
        .ok_or_else(|| "PicGo server URL must be http(s)".to_string())?;
    let token = normalize_picgo_server_token(token);
    post_image(&server_url, token.as_deref(), filename, bytes)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_url_requires_http_scheme() {
        assert_eq!(
            normalize_picgo_server_url(Some(" https://a.example/upload ")).as_deref(),
            Some("https://a.example/upload")
        );
        assert!(normalize_picgo_server_url(Some("ftp://a.example")).is_none());
        assert!(normalize_picgo_server_url(Some("")).is_none());
        assert!(normalize_picgo_server_url(None).is_none());
    }

    #[test]
    fn parse_result_array() {
        let url = parse_picgo_upload_response(
            r#"{"success":true,"result":["https://cdn.example/a.png"]}"#,
        )
        .unwrap();
        assert_eq!(url, "https://cdn.example/a.png");
    }

    #[test]
    fn parse_result_string_and_url_field() {
        assert_eq!(
            parse_picgo_upload_response(r#"{"result":"https://cdn.example/b.png"}"#).unwrap(),
            "https://cdn.example/b.png"
        );
        assert_eq!(
            parse_picgo_upload_response(r#"{"success":true,"url":"https://cdn.example/c.png"}"#)
                .unwrap(),
            "https://cdn.example/c.png"
        );
    }

    #[test]
    fn parse_explicit_failure() {
        let err = parse_picgo_upload_response(r#"{"success":false,"message":"denied"}"#).unwrap_err();
        assert!(err.contains("denied"));
        let err = parse_picgo_upload_response(r#"{"success":false,"error":"readable error"}"#).unwrap_err();
        assert!(err.contains("readable error"));
    }

    #[test]
    fn json_base64_upload_urls_are_detected() {
        assert!(uses_json_base64_upload("https://gxtzf.ccwu.cc/api/upload/base64"));
        assert!(!uses_json_base64_upload("http://127.0.0.1:36677/upload"));
    }

    #[test]
    fn build_data_url_uses_mime_and_base64_payload() {
        let data_url = build_data_url("image/png", &[137, 80, 78, 71]);
        assert!(data_url.starts_with("data:image/png;base64,"));
        assert!(data_url.len() > "data:image/png;base64,".len());
    }
}
