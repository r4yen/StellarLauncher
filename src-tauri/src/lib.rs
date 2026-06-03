use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize)]
struct LauncherStatus {
    version: String,
    java_detected: bool,
    storage_ready: bool,
    config_path: String,
}

#[derive(Debug, Clone, Serialize)]
struct LaunchResponse {
    state: String,
    message: String,
    instance_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct LaunchRequest {
    instance_id: String,
    java_path: Option<String>,
    game_directory: Option<String>,
    ram_mb: Option<u32>,
    jvm_args: Option<String>,
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

#[tauri::command]
fn start_mock_launch(instance_id: String) -> LaunchResponse {
    LaunchResponse {
        state: "preparing".to_string(),
        message: "Preparing launch plan through Tauri command".to_string(),
        instance_id,
    }
}

#[tauri::command]
fn build_launch_request(request: LaunchRequest) -> LaunchRequest {
    request
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_launcher_status,
            start_mock_launch,
            build_launch_request
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Stellar Launcher");
}
