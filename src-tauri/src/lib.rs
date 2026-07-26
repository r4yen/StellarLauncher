mod auth;
mod discord_rpc;
mod instances;
mod java_setup;
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
    #[cfg(target_os = "linux")]
    let config_path = "$HOME/.local/share/StellarLauncher/config.json";

    #[cfg(not(target_os = "linux"))]
    let config_path = "%APPDATA%\\StellarLauncher\\config.json";

    LauncherStatus {
        version: env!("CARGO_PKG_VERSION").to_string(),
        java_detected: true,
        storage_ready: true,
        config_path: config_path.to_string(),
    }
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(auth::AuthState::default())
        .manage(discord_rpc::DiscordRpcState::default())
        .invoke_handler(tauri::generate_handler![
            get_launcher_status,
            discord_rpc::update_discord_rpc,
            discord_rpc::clear_discord_rpc,
            instances::build_launch_request,
            instances::ensure_minecraft_files,
            instances::start_minecraft_process,
            instances::stop_minecraft_process,
            instances::is_minecraft_process_running,
            instances::read_launch_log_tail,
            java_setup::setup_adoptium_java,
            mods::list_mods,
            mods::set_mod_enabled,
            mods::delete_mod,
            mods::add_mod_file,
            mods::install_modrinth_mod,
            storage::load_accounts,
            storage::save_accounts,
            storage::load_skin_library,
            storage::save_skin_library,
            storage::load_instances,
            storage::save_instances,
            storage::load_settings,
            storage::save_settings,
            storage::load_theme,
            storage::save_theme,
            storage::load_minecraft_cache,
            storage::save_minecraft_cache,
            storage::copy_instance_icon,
            storage::read_stellar_instance_file,
            storage::write_stellar_instance_file,
            auth::begin_ms_device_login,
            auth::poll_ms_device_login,
            auth::refresh_minecraft_account,
            auth::remove_account_tokens,
            auth::open_external_url
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Stellar Launcher");
}
