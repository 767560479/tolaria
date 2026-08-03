use std::path::Path;

fn log_startup_result(label: &str, result: Result<usize, String>) {
    match result {
        Ok(count) if count > 0 => log::info!("{}: {} files", label, count),
        Err(error) => log::warn!("{}: {}", label, error),
        _ => {}
    }
}

fn spawn_background_task<F>(thread_name: &'static str, task: F)
where
    F: FnOnce() + Send + 'static,
{
    if let Err(error) = std::thread::Builder::new()
        .name(thread_name.into())
        .spawn(task)
    {
        log::warn!("Failed to start {thread_name}: {error}");
    }
}

fn run_startup_tasks_for_vault(vault_path: &Path) {
    let vault_path_string = vault_path.to_str().unwrap_or_default();
    log_startup_result(
        "Migrated is_a to type on startup",
        crate::vault::migrate_is_a_to_type(vault_path_string),
    );
    crate::vault::migrate_agents_md(vault_path_string);
    crate::vault::seed_config_files(vault_path_string);
}

pub(crate) fn spawn_startup_tasks_for_vault_with<F>(vault_path: std::path::PathBuf, task: F) -> bool
where
    F: FnOnce(std::path::PathBuf) + Send + 'static,
{
    if !vault_path.is_dir() {
        return false;
    }

    spawn_background_task("tolaria-startup-tasks", move || task(vault_path));
    true
}

pub(crate) fn spawn_startup_tasks() {
    let Some(vault_path) = dirs::home_dir().map(|home| home.join("Laputa")) else {
        return;
    };
    spawn_startup_tasks_for_vault_with(vault_path, |path| run_startup_tasks_for_vault(&path));
}
