use serde::{de::DeserializeOwned, Deserialize, Serialize};
use std::{fs, path::PathBuf};
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Account {
    pub id: String,
    pub username: String,
    pub uuid: String,
    pub r#type: String,
    pub avatar_color: String,
    pub skin_head_url: Option<String>,
    pub login_status: String,
    pub token_expires_at: Option<String>,
    pub last_used_at: Option<String>,
    pub is_active: bool,
    #[serde(default)]
    pub is_favorite: Option<bool>,
    #[serde(default)]
    pub order: Option<u32>,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Instance {
    pub id: String,
    pub name: String,
    pub minecraft_version: String,
    pub loader_type: String,
    pub loader_version: String,
    pub game_directory: String,
    pub java_path: String,
    pub ram_mb: u32,
    pub jvm_args: String,
    pub created_at: String,
    pub last_played_at: Option<String>,
    pub status: String,
    pub icon: String,
    #[serde(default)]
    pub is_favorite: Option<bool>,
    #[serde(default)]
    pub order: Option<u32>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LauncherSettings {
    pub java_path: String,
    #[serde(default = "default_java_8_path")]
    pub java_8_path: String,
    #[serde(default = "default_java_17_path")]
    pub java_17_path: String,
    #[serde(default = "default_java_21_path")]
    pub java_21_path: String,
    #[serde(default = "default_java_25_path")]
    pub java_25_path: String,
    pub default_ram_mb: u32,
    pub game_directory: String,
    pub jvm_args: String,
    pub launcher_folder: String,
    #[serde(default = "default_minecraft_storage_directory")]
    pub minecraft_storage_directory: String,
    #[serde(default = "default_language")]
    pub language: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThemeSettings {
    pub accent_color: String,
}

fn app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Cannot resolve app data directory: {error}"))?;
    fs::create_dir_all(&dir).map_err(|error| format!("Cannot create app data directory: {error}"))?;
    Ok(dir)
}

fn default_language() -> String {
    "en".to_string()
}

fn default_minecraft_storage_directory() -> String {
    "%APPDATA%\\StellarLauncher\\minecraft".to_string()
}

fn default_java_8_path() -> String {
    "C:\\Program Files\\Eclipse Adoptium\\jdk-8\\bin\\java.exe".to_string()
}

fn default_java_17_path() -> String {
    "C:\\Program Files\\Eclipse Adoptium\\jdk-17\\bin\\java.exe".to_string()
}

fn default_java_21_path() -> String {
    "C:\\Program Files\\Eclipse Adoptium\\jdk-21\\bin\\java.exe".to_string()
}

fn default_java_25_path() -> String {
    "C:\\Program Files\\Eclipse Adoptium\\jdk-25\\bin\\java.exe".to_string()
}

fn file_path(app: &AppHandle, name: &str) -> Result<PathBuf, String> {
    Ok(app_data_dir(app)?.join(name))
}

fn read_json<T: DeserializeOwned>(app: &AppHandle, name: &str, fallback: T) -> Result<T, String> {
    let path = file_path(app, name)?;
    if !path.exists() {
        return Ok(fallback);
    }

    let raw = fs::read_to_string(&path).map_err(|error| format!("Cannot read {}: {error}", path.display()))?;
    serde_json::from_str(&raw).map_err(|error| format!("Cannot parse {}: {error}", path.display()))
}

fn write_json<T: Serialize>(app: &AppHandle, name: &str, value: &T) -> Result<(), String> {
    let path = file_path(app, name)?;
    let raw = serde_json::to_string_pretty(value).map_err(|error| format!("Cannot serialize {name}: {error}"))?;
    fs::write(&path, raw).map_err(|error| format!("Cannot write {}: {error}", path.display()))
}

#[tauri::command]
pub fn load_accounts(app: AppHandle) -> Result<Vec<Account>, String> {
    read_json(&app, "accounts.json", Vec::<Account>::new())
}

#[tauri::command]
pub fn save_accounts(app: AppHandle, accounts: Vec<Account>) -> Result<Vec<Account>, String> {
    write_json(&app, "accounts.json", &accounts)?;
    Ok(accounts)
}

#[tauri::command]
pub fn load_instances(app: AppHandle) -> Result<Vec<Instance>, String> {
    read_json(&app, "instances.json", Vec::<Instance>::new())
}

#[tauri::command]
pub fn save_instances(app: AppHandle, instances: Vec<Instance>) -> Result<Vec<Instance>, String> {
    write_json(&app, "instances.json", &instances)?;
    Ok(instances)
}

#[tauri::command]
pub fn load_settings(app: AppHandle) -> Result<LauncherSettings, String> {
    read_json(
        &app,
        "settings.json",
        LauncherSettings {
            java_path: "C:\\Program Files\\Eclipse Adoptium\\jdk-21\\bin\\java.exe".to_string(),
            java_8_path: default_java_8_path(),
            java_17_path: default_java_17_path(),
            java_21_path: default_java_21_path(),
            java_25_path: default_java_25_path(),
            default_ram_mb: 6144,
            game_directory: "%APPDATA%\\.minecraft".to_string(),
            jvm_args: "-XX:+UseG1GC -XX:+UnlockExperimentalVMOptions".to_string(),
            launcher_folder: "%APPDATA%\\StellarLauncher".to_string(),
            minecraft_storage_directory: default_minecraft_storage_directory(),
            language: default_language(),
        },
    )
}

#[tauri::command]
pub fn save_settings(app: AppHandle, settings: LauncherSettings) -> Result<LauncherSettings, String> {
    write_json(&app, "settings.json", &settings)?;
    Ok(settings)
}

#[tauri::command]
pub fn load_theme(app: AppHandle) -> Result<ThemeSettings, String> {
    read_json(
        &app,
        "theme.json",
        ThemeSettings {
            accent_color: "#39d5ff".to_string(),
        },
    )
}

#[tauri::command]
pub fn save_theme(app: AppHandle, theme: ThemeSettings) -> Result<ThemeSettings, String> {
    write_json(&app, "theme.json", &theme)?;
    Ok(theme)
}

#[tauri::command]
pub fn load_minecraft_cache(app: AppHandle) -> Result<Vec<String>, String> {
    read_json(&app, "minecraft-cache.json", Vec::<String>::new())
}

#[tauri::command]
pub fn save_minecraft_cache(app: AppHandle, cache_keys: Vec<String>) -> Result<Vec<String>, String> {
    write_json(&app, "minecraft-cache.json", &cache_keys)?;
    Ok(cache_keys)
}
