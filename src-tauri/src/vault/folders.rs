use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Component, Path, PathBuf};

use super::filename_rules::validate_folder_name;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct FolderRenameResult {
    pub old_path: String,
    pub new_path: String,
}

fn normalize_folder_name(next_name: &str) -> Result<String, String> {
    let trimmed = next_name.trim();
    if trimmed.is_empty() {
        return Err("Folder name cannot be empty".to_string());
    }
    validate_folder_name(trimmed)?;
    Ok(trimmed.to_string())
}

fn ensure_relative_folder_path(folder_path: &str) -> Result<PathBuf, String> {
    let trimmed = folder_path.trim();
    if trimmed.is_empty() {
        return Err("Folder path cannot be empty".to_string());
    }

    let relative = Path::new(trimmed);
    if relative.is_absolute() {
        return Err("Folder path must be relative to the vault root".to_string());
    }
    if relative
        .components()
        .any(|component| matches!(component, Component::ParentDir))
    {
        return Err("Folder path cannot escape the vault root".to_string());
    }

    Ok(relative.to_path_buf())
}

fn display_relative_path(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

pub fn rename_folder(
    vault_path: &Path,
    folder_path: &str,
    next_name: &str,
) -> Result<FolderRenameResult, String> {
    let relative_path = ensure_relative_folder_path(folder_path)?;
    let normalized_name = normalize_folder_name(next_name)?;
    let source_path = vault_path.join(&relative_path);

    if !source_path.exists() {
        return Err(format!("Folder does not exist: {}", folder_path));
    }
    if !source_path.is_dir() {
        return Err(format!("Not a folder: {}", folder_path));
    }

    let current_name = source_path
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .ok_or_else(|| "Folder path cannot target the vault root".to_string())?;

    if current_name == normalized_name {
        return Ok(FolderRenameResult {
            old_path: display_relative_path(&relative_path),
            new_path: display_relative_path(&relative_path),
        });
    }

    let parent_relative = relative_path
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_default();
    let destination_relative = parent_relative.join(&normalized_name);
    let destination_path = vault_path.join(&destination_relative);

    if destination_path.exists() {
        return Err(format!(
            "Folder '{}' already exists",
            display_relative_path(&destination_relative)
        ));
    }

    fs::rename(&source_path, &destination_path)
        .map_err(|error| format!("Failed to rename folder: {}", error))?;

    Ok(FolderRenameResult {
        old_path: display_relative_path(&relative_path),
        new_path: display_relative_path(&destination_relative),
    })
}

pub fn delete_folder(vault_path: &Path, folder_path: &str) -> Result<String, String> {
    let relative_path = ensure_relative_folder_path(folder_path)?;
    let target_path = vault_path.join(&relative_path);

    if !target_path.exists() {
        return Err(format!("Folder does not exist: {}", folder_path));
    }
    if !target_path.is_dir() {
        return Err(format!("Not a folder: {}", folder_path));
    }

    fs::remove_dir_all(&target_path)
        .map_err(|error| format!("Failed to delete folder: {}", error))?;
    Ok(display_relative_path(&relative_path))
}

fn is_within_relative_prefix(path: &str, prefix: &str) -> bool {
    path == prefix || path.starts_with(&format!("{prefix}/"))
}

fn ensure_destination_parent(
    vault_path: &Path,
    dest_parent_relative: &str,
) -> Result<PathBuf, String> {
    let trimmed = dest_parent_relative.trim().trim_matches('/').replace('\\', "/");
    if trimmed.is_empty() {
        return Ok(PathBuf::new());
    }
    let relative = ensure_relative_folder_path(&trimmed)?;
    let absolute = vault_path.join(&relative);
    if !absolute.exists() {
        return Err(format!(
            "Destination folder does not exist: {}",
            display_relative_path(&relative)
        ));
    }
    if !absolute.is_dir() {
        return Err(format!(
            "Destination is not a folder: {}",
            display_relative_path(&relative)
        ));
    }
    Ok(relative)
}

fn folder_name(path: &Path) -> Result<String, String> {
    path.file_name()
        .map(|name| name.to_string_lossy().to_string())
        .ok_or_else(|| "Folder path cannot target the vault root".to_string())
}

fn unique_duplicate_folder_path(parent: &Path, name: &str) -> Result<PathBuf, String> {
    let first = parent.join(format!("{name} copy"));
    if !first.exists() {
        return Ok(first);
    }
    for index in 2u32..=10_000 {
        let candidate = parent.join(format!("{name} copy {index}"));
        if !candidate.exists() {
            return Ok(candidate);
        }
    }
    Err(format!(
        "Could not find a unique duplicate name for folder '{}'",
        name
    ))
}

fn copy_dir_recursive(source: &Path, destination: &Path) -> Result<(), String> {
    fs::create_dir_all(destination)
        .map_err(|error| format!("Failed to create folder copy: {}", error))?;
    for entry in fs::read_dir(source)
        .map_err(|error| format!("Failed to read folder for copy: {}", error))?
    {
        let entry = entry.map_err(|error| format!("Failed to read folder entry: {}", error))?;
        let file_type = entry
            .file_type()
            .map_err(|error| format!("Failed to inspect folder entry: {}", error))?;
        let target = destination.join(entry.file_name());
        if file_type.is_dir() {
            copy_dir_recursive(&entry.path(), &target)?;
        } else {
            fs::copy(entry.path(), &target)
                .map_err(|error| format!("Failed to copy folder file: {}", error))?;
        }
    }
    Ok(())
}

/// Move a folder under a new parent (empty parent = vault root). Rejects moves into self/descendants.
pub fn move_folder(
    vault_path: &Path,
    folder_path: &str,
    dest_parent_relative: &str,
) -> Result<FolderRenameResult, String> {
    let relative_path = ensure_relative_folder_path(folder_path)?;
    let source_path = vault_path.join(&relative_path);
    if !source_path.exists() {
        return Err(format!("Folder does not exist: {}", folder_path));
    }
    if !source_path.is_dir() {
        return Err(format!("Not a folder: {}", folder_path));
    }

    let old_relative = display_relative_path(&relative_path);
    let dest_parent = ensure_destination_parent(vault_path, dest_parent_relative)?;
    let dest_parent_display = display_relative_path(&dest_parent);
    if !dest_parent_display.is_empty() && is_within_relative_prefix(&dest_parent_display, &old_relative)
    {
        return Err("Cannot move a folder into itself or a descendant".to_string());
    }

    let name = folder_name(&source_path)?;
    let destination_relative = if dest_parent.as_os_str().is_empty() {
        PathBuf::from(&name)
    } else {
        dest_parent.join(&name)
    };
    let destination_path = vault_path.join(&destination_relative);
    let new_relative = display_relative_path(&destination_relative);

    if new_relative == old_relative {
        return Ok(FolderRenameResult {
            old_path: old_relative,
            new_path: new_relative,
        });
    }
    if destination_path.exists() {
        return Err(format!("Folder '{}' already exists", new_relative));
    }

    fs::rename(&source_path, &destination_path)
        .map_err(|error| format!("Failed to move folder: {}", error))?;

    Ok(FolderRenameResult {
        old_path: old_relative,
        new_path: new_relative,
    })
}

/// Recursively copy a folder to a unique sibling (`name copy` / `name copy N`).
pub fn duplicate_folder(
    vault_path: &Path,
    folder_path: &str,
) -> Result<FolderRenameResult, String> {
    let relative_path = ensure_relative_folder_path(folder_path)?;
    let source_path = vault_path.join(&relative_path);
    if !source_path.exists() {
        return Err(format!("Folder does not exist: {}", folder_path));
    }
    if !source_path.is_dir() {
        return Err(format!("Not a folder: {}", folder_path));
    }

    let name = folder_name(&source_path)?;
    let parent_relative = relative_path
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_default();
    let parent_absolute = if parent_relative.as_os_str().is_empty() {
        vault_path.to_path_buf()
    } else {
        vault_path.join(&parent_relative)
    };
    let destination_absolute = unique_duplicate_folder_path(&parent_absolute, &name)?;
    let destination_relative = if parent_relative.as_os_str().is_empty() {
        PathBuf::from(destination_absolute.file_name().unwrap())
    } else {
        parent_relative.join(destination_absolute.file_name().unwrap())
    };

    copy_dir_recursive(&source_path, &destination_absolute)?;

    Ok(FolderRenameResult {
        old_path: display_relative_path(&relative_path),
        new_path: display_relative_path(&destination_relative),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn make_folder(dir: &TempDir, relative: &str) -> PathBuf {
        let path = dir.path().join(relative);
        fs::create_dir_all(&path).unwrap();
        path
    }

    #[test]
    fn rename_folder_updates_relative_destination() {
        let dir = TempDir::new().unwrap();
        make_folder(&dir, "projects/laputa");

        let result = rename_folder(dir.path(), "projects", "work").unwrap();

        assert_eq!(
            result,
            FolderRenameResult {
                old_path: "projects".to_string(),
                new_path: "work".to_string(),
            }
        );
        assert!(dir.path().join("work/laputa").is_dir());
        assert!(!dir.path().join("projects").exists());
    }

    #[test]
    fn rename_folder_rejects_duplicate_sibling() {
        let dir = TempDir::new().unwrap();
        make_folder(&dir, "projects");
        make_folder(&dir, "areas");

        let error = rename_folder(dir.path(), "projects", "areas").unwrap_err();

        assert_eq!(error, "Folder 'areas' already exists");
    }

    #[test]
    fn rename_folder_rejects_invalid_names() {
        let dir = TempDir::new().unwrap();
        make_folder(&dir, "projects");

        let error = rename_folder(dir.path(), "projects", "../areas").unwrap_err();

        assert_eq!(error, "Invalid folder name");
    }

    #[test]
    fn rename_folder_rejects_windows_invalid_names() {
        let dir = TempDir::new().unwrap();
        make_folder(&dir, "projects");

        let error = rename_folder(dir.path(), "projects", "LPT1").unwrap_err();

        assert_eq!(error, "Invalid folder name");
    }

    #[test]
    fn delete_folder_removes_nested_contents() {
        let dir = TempDir::new().unwrap();
        let nested = make_folder(&dir, "projects/laputa");
        fs::write(nested.join("note.md"), "# Note\n").unwrap();

        let deleted_path = delete_folder(dir.path(), "projects").unwrap();

        assert_eq!(deleted_path, "projects");
        assert!(!dir.path().join("projects").exists());
    }

    #[test]
    fn delete_folder_rejects_missing_folder() {
        let dir = TempDir::new().unwrap();

        let error = delete_folder(dir.path(), "projects").unwrap_err();

        assert_eq!(error, "Folder does not exist: projects");
    }

    #[test]
    fn move_folder_relocates_under_destination_parent() {
        let dir = TempDir::new().unwrap();
        make_folder(&dir, "projects/laputa");
        make_folder(&dir, "archive");

        let result = move_folder(dir.path(), "projects/laputa", "archive").unwrap();

        assert_eq!(
            result,
            FolderRenameResult {
                old_path: "projects/laputa".to_string(),
                new_path: "archive/laputa".to_string(),
            }
        );
        assert!(dir.path().join("archive/laputa").is_dir());
        assert!(!dir.path().join("projects/laputa").exists());
    }

    #[test]
    fn move_folder_rejects_descendant_destination() {
        let dir = TempDir::new().unwrap();
        make_folder(&dir, "projects/laputa");

        let error = move_folder(dir.path(), "projects", "projects/laputa").unwrap_err();

        assert_eq!(error, "Cannot move a folder into itself or a descendant");
    }

    #[test]
    fn duplicate_folder_creates_sibling_copy() {
        let dir = TempDir::new().unwrap();
        let nested = make_folder(&dir, "projects/laputa");
        fs::write(nested.join("note.md"), "# Note\n").unwrap();

        let result = duplicate_folder(dir.path(), "projects").unwrap();

        assert_eq!(result.old_path, "projects");
        assert_eq!(result.new_path, "projects copy");
        assert!(dir.path().join("projects copy/laputa/note.md").is_file());
        assert!(dir.path().join("projects/laputa/note.md").is_file());
    }
}
