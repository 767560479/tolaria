use std::ffi::{OsStr, OsString};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

const VAULT_INSTANCE_FLAG: &str = "--tolaria-vault-instance";
const VAULT_COLOR_FLAG: &str = "--tolaria-vault-color";

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VaultInstanceLaunch {
    pub vault_path: PathBuf,
    pub vault_color: Option<String>,
}

#[derive(Debug, Eq, PartialEq)]
struct LaunchPlan {
    program: PathBuf,
    args: Vec<OsString>,
}

fn parse_launch_args<I, S>(args: I) -> Option<VaultInstanceLaunch>
where
    I: IntoIterator<Item = S>,
    S: Into<OsString>,
{
    let args = args.into_iter().map(Into::into).collect::<Vec<_>>();
    let instance_index = args
        .iter()
        .position(|argument| argument == OsStr::new(VAULT_INSTANCE_FLAG))?;
    let vault_path = args.get(instance_index + 1).map(PathBuf::from)?;
    if vault_path.as_os_str().is_empty() {
        return None;
    }

    let vault_color = args
        .iter()
        .position(|argument| argument == OsStr::new(VAULT_COLOR_FLAG))
        .and_then(|index| args.get(index + 1))
        .and_then(|value| value.to_str())
        .and_then(crate::workspace_colors::normalize);

    Some(VaultInstanceLaunch {
        vault_path,
        vault_color,
    })
}

pub fn current_launch() -> Option<VaultInstanceLaunch> {
    parse_launch_args(tauri::Env::default().args_os)
}

pub fn is_separate_vault_instance() -> bool {
    current_launch().is_some()
}

fn app_bundle_for_executable(executable: &Path) -> Option<PathBuf> {
    let macos_dir = executable.parent()?;
    if macos_dir.file_name()? != "MacOS" {
        return None;
    }
    let contents_dir = macos_dir.parent()?;
    if contents_dir.file_name()? != "Contents" {
        return None;
    }
    let app_bundle = contents_dir.parent()?;
    (app_bundle.extension()? == "app").then(|| app_bundle.to_path_buf())
}

fn vault_launch_arguments(
    vault_path: &Path,
    vault_color: Option<&str>,
    markdown_path: Option<&Path>,
) -> Vec<OsString> {
    let mut args = vec![
        OsString::from(VAULT_INSTANCE_FLAG),
        vault_path.as_os_str().to_owned(),
    ];
    if let Some(color) = vault_color.and_then(crate::workspace_colors::normalize) {
        args.push(OsString::from(VAULT_COLOR_FLAG));
        args.push(OsString::from(color));
    }
    if let Some(markdown_path) = markdown_path {
        args.push(markdown_path.as_os_str().to_owned());
    }
    args
}

fn launch_plan(
    executable: &Path,
    vault_path: &Path,
    vault_color: Option<&str>,
    markdown_path: Option<&Path>,
    target_os: &str,
) -> LaunchPlan {
    let vault_args = vault_launch_arguments(vault_path, vault_color, markdown_path);

    if target_os == "macos" {
        if let Some(app_bundle) = app_bundle_for_executable(executable) {
            let mut args = vec![OsString::from("-n"), app_bundle.into_os_string()];
            args.push(OsString::from("--args"));
            args.extend(vault_args);
            return LaunchPlan {
                program: PathBuf::from("/usr/bin/open"),
                args,
            };
        }
    }

    LaunchPlan {
        program: executable.to_path_buf(),
        args: vault_args,
    }
}

fn spawn_launch_plan(plan: LaunchPlan) -> Result<(), String> {
    Command::new(plan.program)
        .args(plan.args)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("Failed to open vault window: {error}"))
}

pub fn open_vault_in_new_window(
    vault_path: &Path,
    vault_color: Option<&str>,
) -> Result<(), String> {
    let resolved_vault = std::fs::canonicalize(vault_path)
        .map_err(|error| format!("Vault is not available: {error}"))?;
    if !resolved_vault.is_dir() {
        return Err("Vault path must be a directory".to_string());
    }

    let executable = tauri::process::current_binary(&tauri::Env::default())
        .map_err(|error| format!("Failed to locate Tolaria executable: {error}"))?;
    let plan = launch_plan(
        &executable,
        &resolved_vault,
        vault_color,
        None,
        std::env::consts::OS,
    );
    spawn_launch_plan(plan)
}

/// Open a Markdown file in a separate vault-instance process.
/// The parent directory becomes the vault root; the note path is passed so the
/// instance can select it without changing the ordinary shared `active_vault`.
pub fn open_markdown_in_new_vault_instance(
    markdown_path: &Path,
    vault_color: Option<&str>,
) -> Result<(), String> {
    let resolved_markdown = std::fs::canonicalize(markdown_path)
        .map_err(|error| format!("Markdown file is not available: {error}"))?;
    if !resolved_markdown.is_file() {
        return Err("Markdown path must be a file".to_string());
    }
    let resolved_vault = resolved_markdown
        .parent()
        .filter(|path| !path.as_os_str().is_empty())
        .ok_or_else(|| "Markdown file has no parent directory".to_string())?
        .to_path_buf();
    if !resolved_vault.is_dir() {
        return Err("Vault path must be a directory".to_string());
    }

    let executable = tauri::process::current_binary(&tauri::Env::default())
        .map_err(|error| format!("Failed to locate Tolaria executable: {error}"))?;
    let plan = launch_plan(
        &executable,
        &resolved_vault,
        vault_color,
        Some(&resolved_markdown),
        std::env::consts::OS,
    );
    spawn_launch_plan(plan)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_vault_path_and_supported_color() {
        let launch = parse_launch_args([
            "tolaria",
            VAULT_INSTANCE_FLAG,
            "/Users/luca/Work Vault",
            VAULT_COLOR_FLAG,
            "Red",
        ]);

        assert_eq!(
            launch,
            Some(VaultInstanceLaunch {
                vault_path: PathBuf::from("/Users/luca/Work Vault"),
                vault_color: Some("red".to_string()),
            })
        );
    }

    #[test]
    fn ignores_unknown_colors_and_unrelated_launches() {
        let unsupported = parse_launch_args([
            "tolaria",
            VAULT_INSTANCE_FLAG,
            "/tmp/vault",
            VAULT_COLOR_FLAG,
            "#bad",
        ]);

        assert_eq!(
            unsupported,
            Some(VaultInstanceLaunch {
                vault_path: PathBuf::from("/tmp/vault"),
                vault_color: None,
            })
        );
        assert_eq!(parse_launch_args(["tolaria"]), None);
    }

    #[test]
    fn packaged_macos_launches_through_launch_services_as_a_new_instance() {
        let plan = launch_plan(
            Path::new("/Applications/Tolaria.app/Contents/MacOS/Tolaria"),
            Path::new("/Users/luca/Work Vault"),
            Some("green"),
            None,
            "macos",
        );

        assert_eq!(plan.program, PathBuf::from("/usr/bin/open"));
        assert_eq!(
            plan.args,
            [
                "-n",
                "/Applications/Tolaria.app",
                "--args",
                VAULT_INSTANCE_FLAG,
                "/Users/luca/Work Vault",
                VAULT_COLOR_FLAG,
                "green",
            ]
            .map(OsString::from)
        );
    }

    #[test]
    fn development_launches_the_current_executable_directly() {
        let executable = Path::new("/repo/target/debug/tolaria");
        let plan = launch_plan(executable, Path::new("/tmp/vault"), None, None, "macos");

        assert_eq!(plan.program, executable);
        assert_eq!(
            plan.args,
            [VAULT_INSTANCE_FLAG, "/tmp/vault"].map(OsString::from)
        );
    }

    #[test]
    fn passes_renderer_only_workspace_colors_to_new_instances() {
        let args = vault_launch_arguments(Path::new("/tmp/vault"), Some("Pink"), None);

        assert_eq!(
            args,
            [VAULT_INSTANCE_FLAG, "/tmp/vault", VAULT_COLOR_FLAG, "pink",].map(OsString::from)
        );
    }

    #[test]
    fn launch_args_include_trailing_markdown_path() {
        let markdown = Path::new("/tmp/Notes/meeting.md");
        let plan = launch_plan(
            Path::new("/repo/target/debug/tolaria"),
            Path::new("/tmp/Notes"),
            None,
            Some(markdown),
            "windows",
        );

        assert_eq!(
            plan.args,
            [
                VAULT_INSTANCE_FLAG,
                "/tmp/Notes",
                "/tmp/Notes/meeting.md",
            ]
            .map(OsString::from)
        );
    }

    #[test]
    fn parse_launch_still_works_when_markdown_path_follows_flags() {
        let launch = parse_launch_args([
            "tolaria",
            VAULT_INSTANCE_FLAG,
            "/tmp/Notes",
            "/tmp/Notes/meeting.md",
        ]);

        assert_eq!(
            launch,
            Some(VaultInstanceLaunch {
                vault_path: PathBuf::from("/tmp/Notes"),
                vault_color: None,
            })
        );
    }
}
