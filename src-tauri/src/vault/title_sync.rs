use std::fs;
use std::path::Path;

use crate::frontmatter::{update_frontmatter_content, FrontmatterValue};

use super::parsing::slug_to_title;
use super::rename::title_to_slug;

const TITLE_PREFIXES: [&str; 2] = ["title:", "\"title\":"];

/// Result of a title sync check.
#[derive(Debug, PartialEq)]
pub enum SyncAction {
    /// Title and filename are already in sync.
    InSync,
    /// Title was absent or desynced; frontmatter was updated on disk.
    Updated { title: String },
}

/// Extract the raw `title:` value from frontmatter in file content.
fn extract_raw_title(content: &str) -> Option<String> {
    if !content.starts_with("---\n") {
        return None;
    }
    let fm = content[4..].split("\n---").next()?;
    fm.lines().find_map(extract_title_from_line)
}

fn extract_title_from_line(line: &str) -> Option<String> {
    TITLE_PREFIXES
        .iter()
        .find_map(|prefix| line.trim_start().strip_prefix(prefix))
        .map(clean_title_value)
        .filter(|value| !value.is_empty())
}

fn clean_title_value(raw_value: &str) -> String {
    raw_value
        .trim()
        .trim_matches('"')
        .trim_matches('\'')
        .to_string()
}

fn append_copy_suffix(title: &str, suffix: &str) -> String {
    if title.ends_with(suffix) {
        return title.to_string();
    }
    format!("{title}{suffix}")
}

fn body_start_index(content: &str) -> usize {
    if !content.starts_with("---") {
        return 0;
    }
    match content[3..].find("\n---") {
        Some(end) => {
            let after = 3 + end + 4;
            if content[after..].starts_with('\n') {
                after + 1
            } else if content[after..].starts_with("\r\n") {
                after + 2
            } else {
                after
            }
        }
        None => 0,
    }
}

fn rewrite_first_atx_h1(content: &str, suffix: &str) -> String {
    let body_start = body_start_index(content);
    let body = &content[body_start..];
    let mut offset = 0usize;
    for line in body.split_inclusive('\n') {
        let trimmed = line.trim_end_matches(['\r', '\n']);
        let trimmed_start = trimmed.trim_start();
        if trimmed_start.is_empty() {
            offset += line.len();
            continue;
        }
        if let Some(title) = trimmed_start
            .strip_prefix("# ")
            .filter(|text| !text.starts_with('#'))
        {
            let leading_len = trimmed.len() - trimmed_start.len();
            let leading = &trimmed[..leading_len];
            let newline = &line[trimmed.len()..];
            let next_title = append_copy_suffix(title.trim_end(), suffix);
            let rewritten = format!("{leading}# {next_title}{newline}");
            return format!(
                "{}{}{}{}",
                &content[..body_start],
                &body[..offset],
                rewritten,
                &body[offset + line.len()..]
            );
        }
        break;
    }
    content.to_string()
}

/// Append the duplicate filename suffix (` copy` / ` copy N`) to frontmatter `title`
/// and the first body ATX H1 so the copy is distinguishable from the source note.
pub(crate) fn rewrite_titles_for_duplicate(content: &str, title_suffix: &str) -> String {
    if title_suffix.is_empty() {
        return content.to_string();
    }

    let mut out = content.to_string();
    if let Some(title) = extract_raw_title(&out) {
        let next = append_copy_suffix(&title, title_suffix);
        if next != title {
            if let Ok(updated) =
                update_frontmatter_content(&out, "title", Some(FrontmatterValue::String(next)))
            {
                out = updated;
            }
        }
    }
    rewrite_first_atx_h1(&out, title_suffix)
}

/// Sync the `title` frontmatter field with the filename.
///
/// Rules (filename is source of truth):
/// - If `title` is absent → derive from filename, write to frontmatter
/// - If `title` is present but its slug doesn't match the filename stem → overwrite
/// - If both are in sync → no-op
pub fn sync_title_on_open(path: &Path) -> Result<SyncAction, String> {
    let content = fs::read_to_string(path)
        .map_err(|e| format!("Failed to read {}: {}", path.display(), e))?;
    let filename = path
        .file_name()
        .map(|f| f.to_string_lossy().to_string())
        .unwrap_or_default();
    let stem = filename.strip_suffix(".md").unwrap_or(&filename);
    let expected_title = slug_to_title(stem);

    let fm_title = extract_raw_title(&content);

    match fm_title {
        Some(ref title) if title_to_slug(title) == stem => Ok(SyncAction::InSync),
        _ => {
            // Title absent or desynced — filename wins
            let value = FrontmatterValue::String(expected_title.clone());
            let updated = update_frontmatter_content(&content, "title", Some(value))
                .map_err(|e| format!("Failed to update frontmatter: {}", e))?;
            fs::write(path, &updated)
                .map_err(|e| format!("Failed to write {}: {}", path.display(), e))?;
            Ok(SyncAction::Updated {
                title: expected_title,
            })
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    fn write_note(dir: &Path, name: &str, content: &str) -> std::path::PathBuf {
        let path = dir.join(name);
        fs::write(&path, content).unwrap();
        path
    }

    fn assert_title_update(dir: &Path, name: &str, content: &str, expected_title: &str) -> String {
        let path = write_note(dir, name, content);
        let result = sync_title_on_open(&path).unwrap();
        assert_eq!(
            result,
            SyncAction::Updated {
                title: expected_title.to_string()
            }
        );
        fs::read_to_string(&path).unwrap()
    }

    #[test]
    fn test_sync_adds_title_when_absent() {
        let dir = TempDir::new().unwrap();
        let content = assert_title_update(
            dir.path(),
            "career-tracks.md",
            "---\ntype: Note\n---\n# Career Tracks\n",
            "Career Tracks",
        );
        assert!(content.contains("title: Career Tracks"));
    }

    #[test]
    fn test_sync_noop_when_in_sync() {
        let dir = TempDir::new().unwrap();
        let path = write_note(
            dir.path(),
            "my-note.md",
            "---\ntitle: My Note\ntype: Note\n---\n# My Note\n",
        );
        let result = sync_title_on_open(&path).unwrap();
        assert_eq!(result, SyncAction::InSync);
    }

    #[test]
    fn test_sync_overwrites_desynced_title() {
        let dir = TempDir::new().unwrap();
        // Filename says "new-name" but title says "Old Name"
        let content = assert_title_update(
            dir.path(),
            "new-name.md",
            "---\ntitle: Old Name\ntype: Note\n---\n# Old Name\n",
            "New Name",
        );
        assert!(content.contains("title: New Name"));
        assert!(!content.contains("title: Old Name"));
    }

    #[test]
    fn test_sync_adds_frontmatter_when_none_exists() {
        let dir = TempDir::new().unwrap();
        let content = assert_title_update(
            dir.path(),
            "plain-note.md",
            "# Plain Note\n\nSome content.\n",
            "Plain Note",
        );
        assert!(content.starts_with("---\n"));
        assert!(content.contains("title: Plain Note"));
    }

    #[test]
    fn test_sync_e2e_filename() {
        let dir = TempDir::new().unwrap();
        assert_title_update(
            dir.path(),
            "e2e-test.md",
            "---\ntype: Note\n---\n",
            "E2e Test",
        );
    }

    #[test]
    fn test_sync_preserves_other_frontmatter() {
        let dir = TempDir::new().unwrap();
        let path = write_note(
            dir.path(),
            "my-note.md",
            "---\ntype: Project\nstatus: Active\n---\n# My Note\n",
        );
        sync_title_on_open(&path).unwrap();
        let content = fs::read_to_string(&path).unwrap();
        assert!(content.contains("type: Project"));
        assert!(content.contains("status: Active"));
        assert!(content.contains("title: My Note"));
    }

    #[test]
    fn rewrite_titles_for_duplicate_updates_h1_and_frontmatter() {
        let rewritten = rewrite_titles_for_duplicate(
            "---\ntitle: Alpha\ntype: Note\n---\n# Alpha\n\nBody\n",
            " copy",
        );
        assert!(rewritten.contains("title: Alpha copy"));
        assert!(rewritten.contains("# Alpha copy\n"));
        assert!(rewritten.contains("type: Note"));
        assert!(rewritten.contains("Body"));
    }

    #[test]
    fn rewrite_titles_for_duplicate_handles_numbered_suffix() {
        let rewritten = rewrite_titles_for_duplicate("# Alpha\n", " copy 2");
        assert_eq!(rewritten, "# Alpha copy 2\n");
    }
}
