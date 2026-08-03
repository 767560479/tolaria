use serde::Serialize;
use std::ffi::{OsStr, OsString};
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use tauri::{AppHandle, Emitter, Manager, State};

const VAULT_INSTANCE_FLAG: &str = "--tolaria-vault-instance";
const VAULT_COLOR_FLAG: &str = "--tolaria-vault-color";

pub const OPEN_MARKDOWN_EVENT: &str = "tolaria-open-markdown";

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenMarkdownPayload {
    pub markdown_path: String,
    pub vault_path: String,
    pub relative_note: String,
}

#[derive(Default)]
pub struct PendingShellMarkdownOpen(Mutex<Option<OpenMarkdownPayload>>);

pub fn parse_open_markdown_from_args<I, S>(args: I) -> Option<OpenMarkdownPayload>
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    let path = first_markdown_path_arg(args)?;
    open_markdown_payload_for_path(&path)
}

/// When the ordinary (non-instance) process receives a shell `.md` path, spawn a
/// separate vault instance instead of switching the shared active vault.
pub fn try_delegate_shell_markdown_launch() -> bool {
    if crate::vault_instance::is_separate_vault_instance() {
        return false;
    }
    spawn_shell_markdown_vault_instance_from_args(tauri::Env::default().args_os)
}

pub fn spawn_shell_markdown_vault_instance_from_args<I, S>(args: I) -> bool
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    let Some(payload) = parse_open_markdown_from_args(args) else {
        return false;
    };
    let markdown_path = Path::new(&payload.markdown_path);
    if !markdown_path.is_file() {
        return false;
    }
    match crate::vault_instance::open_markdown_in_new_vault_instance(markdown_path, None) {
        Ok(()) => true,
        Err(error) => {
            log::error!("Failed to open shell Markdown in a vault instance: {error}");
            false
        }
    }
}

pub fn emit_open_markdown_from_args<I, S>(app: &AppHandle, args: I)
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    let Some(payload) = parse_open_markdown_from_args(args) else {
        return;
    };
    if !Path::new(&payload.markdown_path).is_file() {
        return;
    }
    store_and_emit(app, payload);
}

pub fn emit_open_markdown_from_current_args(app: &AppHandle) {
    emit_open_markdown_from_args(app, tauri::Env::default().args_os);
}

#[tauri::command]
pub fn take_pending_shell_markdown_open(
    state: State<'_, PendingShellMarkdownOpen>,
) -> Option<OpenMarkdownPayload> {
    state.0.lock().ok().and_then(|mut guard| guard.take())
}

fn store_and_emit(app: &AppHandle, payload: OpenMarkdownPayload) {
    if let Some(state) = app.try_state::<PendingShellMarkdownOpen>() {
        if let Ok(mut guard) = state.0.lock() {
            *guard = Some(payload.clone());
        }
    }
    let _ = app.emit(OPEN_MARKDOWN_EVENT, &payload);
}

fn open_markdown_payload_for_path(path: &Path) -> Option<OpenMarkdownPayload> {
    if !is_markdown_path(path) {
        return None;
    }
    let parent = path.parent().filter(|value| !value.as_os_str().is_empty())?;
    let relative_note = path.file_name()?.to_string_lossy().into_owned();
    Some(OpenMarkdownPayload {
        markdown_path: path_to_string(path),
        vault_path: path_to_string(parent),
        relative_note,
    })
}

fn path_to_string(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

fn is_markdown_path(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("md"))
}

fn first_markdown_path_arg<I, S>(args: I) -> Option<PathBuf>
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    let args: Vec<OsString> = args.into_iter().map(|arg| arg.as_ref().to_os_string()).collect();
    let mut index = 1;
    while index < args.len() {
        let arg = &args[index];
        if arg == OsStr::new(VAULT_INSTANCE_FLAG) || arg == OsStr::new(VAULT_COLOR_FLAG) {
            index += 2;
            continue;
        }

        let Some(text) = arg.to_str() else {
            index += 1;
            continue;
        };
        if text.starts_with('-') || text.starts_with("tolaria://") {
            index += 1;
            continue;
        }

        if let Some(path) = path_from_arg(text) {
            if is_markdown_path(&path) {
                return Some(path);
            }
        }
        index += 1;
    }
    None
}

fn path_from_arg(arg: &str) -> Option<PathBuf> {
    if arg.starts_with("file:") {
        let url = url::Url::parse(arg).ok()?;
        return url.to_file_path().ok();
    }
    Some(PathBuf::from(arg))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn join_path(parts: &[&str]) -> PathBuf {
        parts.iter().fold(PathBuf::new(), |mut path, part| {
            path.push(part);
            path
        })
    }

    #[test]
    fn parses_plain_markdown_path_as_parent_vault() {
        let markdown = join_path(&["Notes", "meeting.md"]);
        let payload = parse_open_markdown_from_args(["tolaria", markdown.as_os_str()]);

        assert_eq!(
            payload,
            Some(OpenMarkdownPayload {
                markdown_path: path_to_string(&markdown),
                vault_path: path_to_string(Path::new("Notes")),
                relative_note: "meeting.md".to_string(),
            })
        );
    }

    #[test]
    fn skips_flags_deep_links_and_non_markdown() {
        let other_vault = join_path(&["OtherVault"]);
        let text_file = join_path(&["Notes", "readme.txt"]);
        let markdown = join_path(&["Notes", "actual.md"]);
        let payload = parse_open_markdown_from_args([
            OsString::from("tolaria"),
            OsString::from(VAULT_INSTANCE_FLAG),
            other_vault.into_os_string(),
            OsString::from(VAULT_COLOR_FLAG),
            OsString::from("blue"),
            OsString::from("tolaria://work/note.md"),
            text_file.into_os_string(),
            OsString::from("-v"),
            markdown.as_os_str().to_os_string(),
        ]);

        assert_eq!(
            payload,
            Some(OpenMarkdownPayload {
                markdown_path: path_to_string(&markdown),
                vault_path: path_to_string(Path::new("Notes")),
                relative_note: "actual.md".to_string(),
            })
        );
    }

    #[test]
    fn parses_file_url_markdown_paths() {
        #[cfg(windows)]
        let (url, markdown, vault) = (
            "file:///C:/Notes/hello.md",
            PathBuf::from(r"C:\Notes\hello.md"),
            PathBuf::from(r"C:\Notes"),
        );
        #[cfg(not(windows))]
        let (url, markdown, vault) = (
            "file:///tmp/Notes/hello.md",
            PathBuf::from("/tmp/Notes/hello.md"),
            PathBuf::from("/tmp/Notes"),
        );

        let payload = parse_open_markdown_from_args(["tolaria", url]);

        assert_eq!(
            payload,
            Some(OpenMarkdownPayload {
                markdown_path: path_to_string(&markdown),
                vault_path: path_to_string(&vault),
                relative_note: "hello.md".to_string(),
            })
        );
    }

    #[test]
    fn returns_none_without_markdown_args() {
        assert_eq!(
            parse_open_markdown_from_args(["tolaria", "tolaria://vault/note.md"]),
            None
        );
        assert_eq!(parse_open_markdown_from_args(["tolaria"]), None);
    }

    #[test]
    fn accepts_uppercase_md_extension() {
        let markdown = join_path(&["Notes", "README.MD"]);
        let payload = parse_open_markdown_from_args(["tolaria", markdown.as_os_str()]);
        assert_eq!(
            payload.map(|value| value.relative_note),
            Some("README.MD".to_string())
        );
    }

    #[test]
    fn parses_markdown_after_vault_instance_flags() {
        let markdown = join_path(&["Notes", "meeting.md"]);
        let vault = join_path(&["Notes"]);
        let payload = parse_open_markdown_from_args([
            OsString::from("tolaria"),
            OsString::from(VAULT_INSTANCE_FLAG),
            vault.into_os_string(),
            markdown.as_os_str().to_os_string(),
        ]);

        assert_eq!(
            payload.map(|value| value.relative_note),
            Some("meeting.md".to_string())
        );
    }
}
