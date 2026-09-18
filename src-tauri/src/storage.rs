use serde::{de::DeserializeOwned, Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
};
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
    pub selected_skin_id: Option<String>,
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
pub struct SkinLibraryItem {
    pub id: String,
    pub name: String,
    pub image_url: String,
    pub full_image_url: Option<String>,
    pub source: String,
    pub account_id: Option<String>,
    pub uuid: Option<String>,
    #[serde(default)]
    pub is_favorite: Option<bool>,
    #[serde(default)]
    pub order: Option<u32>,
    pub created_at: String,
    pub updated_at: String,
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
    #[serde(default)]
    pub playtime_seconds: Option<u64>,
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
    #[serde(default = "default_java_8_path")]
    pub java_8_path: String,
    #[serde(default = "default_java_17_path")]
    pub java_17_path: String,
    #[serde(default = "default_java_21_path")]
    pub java_21_path: String,
    #[serde(default = "default_java_25_path")]
    pub java_25_path: String,
    pub default_ram_mb: u32,
    #[serde(default = "default_game_directory")]
    pub game_directory: String,
    pub jvm_args: String,
    #[serde(default = "default_launcher_folder")]
    pub launcher_folder: String,
    #[serde(default = "default_minecraft_storage_directory")]
    pub minecraft_storage_directory: String,
    #[serde(default = "default_language")]
    pub language: String,
    #[serde(default = "default_discord_rich_presence_enabled")]
    pub discord_rich_presence_enabled: bool,
    #[serde(default = "default_auto_update_enabled")]
    pub auto_update_enabled: bool,
    // Existing installations predate the guide; only fresh installations start it.
    #[serde(default = "default_auto_update_enabled")]
    pub initial_setup_completed: bool,
    #[serde(default = "default_auto_update_enabled")]
    pub open_downloads_automatically: bool,
    #[serde(default = "default_auto_update_enabled")]
    pub auto_backup_before_changes: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThemeSettings {
    pub accent_color: String,
}

pub(super) fn app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Cannot resolve app data directory: {error}"))?;
    fs::create_dir_all(&dir)
        .map_err(|error| format!("Cannot create app data directory: {error}"))?;
    Ok(dir)
}

fn default_language() -> String {
    "en".to_string()
}

fn default_discord_rich_presence_enabled() -> bool {
    true
}

fn default_auto_update_enabled() -> bool {
    true
}

fn default_minecraft_storage_directory() -> String {
    #[cfg(target_os = "linux")]
    {
        return "$HOME/.local/share/StellarLauncher/minecraft".to_string();
    }

    "%APPDATA%\\StellarLauncher\\minecraft".to_string()
}

fn default_game_directory() -> String {
    #[cfg(target_os = "linux")]
    {
        return "$HOME/.minecraft".to_string();
    }

    "%APPDATA%\\.minecraft".to_string()
}

fn default_launcher_folder() -> String {
    #[cfg(target_os = "linux")]
    {
        return "$HOME/.local/share/StellarLauncher".to_string();
    }

    "%APPDATA%\\StellarLauncher".to_string()
}

fn default_java_8_path() -> String {
    #[cfg(target_os = "linux")]
    {
        return "/usr/lib/jvm/java-8-openjdk/bin/java".to_string();
    }

    "C:\\Program Files\\Eclipse Adoptium\\jdk-8\\bin\\java.exe".to_string()
}

fn default_java_17_path() -> String {
    #[cfg(target_os = "linux")]
    {
        return "/usr/lib/jvm/java-17-openjdk/bin/java".to_string();
    }

    "C:\\Program Files\\Eclipse Adoptium\\jdk-17\\bin\\java.exe".to_string()
}

fn default_java_21_path() -> String {
    #[cfg(target_os = "linux")]
    {
        return "/usr/lib/jvm/java-21-openjdk/bin/java".to_string();
    }

    "C:\\Program Files\\Eclipse Adoptium\\jdk-21\\bin\\java.exe".to_string()
}

fn default_java_25_path() -> String {
    #[cfg(target_os = "linux")]
    {
        return "/usr/lib/jvm/java-25-openjdk/bin/java".to_string();
    }

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

    let raw = fs::read_to_string(&path)
        .map_err(|error| format!("Cannot read {}: {error}", path.display()))?;
    serde_json::from_str(&raw).map_err(|error| format!("Cannot parse {}: {error}", path.display()))
}

pub(super) fn write_json<T: Serialize>(app: &AppHandle, name: &str, value: &T) -> Result<(), String> {
    let path = file_path(app, name)?;
    let raw = serde_json::to_string_pretty(value)
        .map_err(|error| format!("Cannot serialize {name}: {error}"))?;
    fs::write(&path, raw).map_err(|error| format!("Cannot write {}: {error}", path.display()))
}

pub(super) fn expand_path(path: &str) -> Result<PathBuf, String> {
    let mut expanded = path.to_string();
    if expanded.contains("%APPDATA%") {
        let appdata = std::env::var("APPDATA")
            .map_err(|_| "APPDATA is not available on this system.".to_string())?;
        expanded = expanded.replace("%APPDATA%", &appdata);
    }
    if expanded.contains("%LOCALAPPDATA%") {
        let local_appdata = std::env::var("LOCALAPPDATA")
            .map_err(|_| "LOCALAPPDATA is not available on this system.".to_string())?;
        expanded = expanded.replace("%LOCALAPPDATA%", &local_appdata);
    }
    for (key, value) in std::env::vars() {
        expanded = expanded.replace(&format!("${key}"), &value);
        expanded = expanded.replace(&format!("%{key}%"), &value);
    }
    Ok(PathBuf::from(expanded))
}

fn supported_image_extension(path: &Path) -> Option<String> {
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_lowercase())?;
    ["png", "jpg", "jpeg", "webp", "gif"]
        .contains(&extension.as_str())
        .then_some(extension)
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
pub fn load_skin_library(app: AppHandle) -> Result<Vec<SkinLibraryItem>, String> {
    read_json(&app, "skin-library.json", Vec::<SkinLibraryItem>::new())
}

#[tauri::command]
pub fn save_skin_library(
    app: AppHandle,
    skins: Vec<SkinLibraryItem>,
) -> Result<Vec<SkinLibraryItem>, String> {
    write_json(&app, "skin-library.json", &skins)?;
    Ok(skins)
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
            java_8_path: default_java_8_path(),
            java_17_path: default_java_17_path(),
            java_21_path: default_java_21_path(),
            java_25_path: default_java_25_path(),
            default_ram_mb: 6144,
            game_directory: default_game_directory(),
            jvm_args: "-XX:+UseG1GC -XX:+UnlockExperimentalVMOptions".to_string(),
            launcher_folder: default_launcher_folder(),
            minecraft_storage_directory: default_minecraft_storage_directory(),
            language: default_language(),
            discord_rich_presence_enabled: default_discord_rich_presence_enabled(),
            auto_update_enabled: default_auto_update_enabled(),
            initial_setup_completed: false,
            open_downloads_automatically: true,
            auto_backup_before_changes: true,
        },
    )
}

#[tauri::command]
pub fn save_settings(
    app: AppHandle,
    settings: LauncherSettings,
) -> Result<LauncherSettings, String> {
    // Closing during background setup must not leave a partially written config.
    use std::io::Write;
    let directory = app_data_dir(&app)?;
    let mut file = tempfile::NamedTempFile::new_in(&directory).map_err(|error| error.to_string())?;
    file.write_all(&serde_json::to_vec_pretty(&settings).map_err(|error| error.to_string())?)
        .map_err(|error| error.to_string())?;
    file.as_file().sync_all().map_err(|error| error.to_string())?;
    file.persist(directory.join("settings.json")).map_err(|error| error.to_string())?;
    Ok(settings)
}

#[cfg(test)]
mod settings_tests {
    use super::LauncherSettings;

    #[test]
    fn existing_settings_enable_auto_updates_by_default() {
        let settings: LauncherSettings = serde_json::from_value(serde_json::json!({
            "defaultRamMb": 6144,
            "jvmArgs": ""
        })).unwrap();
        assert!(settings.auto_update_enabled);
        assert!(settings.initial_setup_completed);
        assert!(settings.open_downloads_automatically);
        assert!(settings.auto_backup_before_changes);
    }

    #[test]
    fn disabled_auto_updates_survive_a_settings_round_trip() {
        let settings: LauncherSettings = serde_json::from_value(serde_json::json!({
            "defaultRamMb": 6144,
            "jvmArgs": "",
            "autoUpdateEnabled": false
        })).unwrap();
        let stored = serde_json::to_string(&settings).unwrap();
        let loaded: LauncherSettings = serde_json::from_str(&stored).unwrap();
        assert!(!loaded.auto_update_enabled);
    }

    #[test]
    fn unfinished_first_run_survives_restart() {
        let settings: LauncherSettings = serde_json::from_value(serde_json::json!({
            "defaultRamMb": 6144, "jvmArgs": "", "initialSetupCompleted": false
        })).unwrap();
        let reloaded: LauncherSettings = serde_json::from_str(&serde_json::to_string(&settings).unwrap()).unwrap();
        assert!(!reloaded.initial_setup_completed);
    }
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
pub fn save_minecraft_cache(
    app: AppHandle,
    cache_keys: Vec<String>,
) -> Result<Vec<String>, String> {
    write_json(&app, "minecraft-cache.json", &cache_keys)?;
    Ok(cache_keys)
}

#[tauri::command]
pub fn copy_instance_icon(app: AppHandle, source_path: String) -> Result<String, String> {
    let source = PathBuf::from(&source_path);
    if !source.exists() {
        return Err(format!(
            "Selected image does not exist: {}",
            source.display()
        ));
    }

    let Some(extension) = supported_image_extension(&source) else {
        return Err("Selected file is not a supported image.".to_string());
    };

    let icons_dir = app_data_dir(&app)?.join("instance-icons");
    fs::create_dir_all(&icons_dir).map_err(|error| {
        format!(
            "Cannot create icon directory {}: {error}",
            icons_dir.display()
        )
    })?;
    let stem = source
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("instance-icon")
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() {
                character
            } else {
                '-'
            }
        })
        .collect::<String>();
    let target = icons_dir.join(format!(
        "{}-{}.{}",
        stem,
        chrono::Utc::now().timestamp_millis(),
        extension
    ));
    fs::copy(Path::new(&source), &target)
        .map_err(|error| format!("Cannot copy icon to {}: {error}", target.display()))?;
    Ok(target.to_string_lossy().to_string())
}
