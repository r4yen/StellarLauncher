mod auth;
mod instances;
mod mods;
mod storage;

use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct LauncherStatus {
    version: String,
    java_detected: bool,
    storage_ready: bool,
    config_path: String,
}

#[tauri::command]
fn get_launcher_status() -> LauncherStatus {
    LauncherStatus {
        version: env!("CARGO_PKG_VERSION").to_string(),
        java_detected: true,
        storage_ready: true,
        config_path: "%APPDATA%\\StellarLauncher\\config.json".to_string(),
    }
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(auth::AuthState::default())
        .invoke_handler(tauri::generate_handler![
            get_launcher_status,
            instances::build_launch_request,
            instances::ensure_minecraft_files,
            instances::start_minecraft_process,
            instances::stop_minecraft_process,
            instances::is_minecraft_process_running,
            instances::read_launch_log_tail,
            mods::list_mods,
            mods::set_mod_enabled,
            mods::delete_mod,
            mods::add_mod_file,
            storage::load_accounts,
            storage::save_accounts,
            storage::load_instances,
            storage::save_instances,
            storage::load_settings,
            storage::save_settings,
            storage::load_theme,
            storage::save_theme,
            storage::load_minecraft_cache,
            storage::save_minecraft_cache,
            auth::begin_ms_device_login,
            auth::poll_ms_device_login,
            auth::refresh_minecraft_account,
            auth::remove_account_tokens,
            auth::open_external_url
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Stellar Launcher");
}
