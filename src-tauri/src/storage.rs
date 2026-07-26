use serde::{de::DeserializeOwned, Deserialize, Serialize};
use std::{
    collections::HashSet,
    fs,
    io::{Read, Write},
    path::{Path, PathBuf},
};
use tauri::{AppHandle, Manager};
use zip::{write::SimpleFileOptions, CompressionMethod, ZipArchive, ZipWriter};

const LOCAL_FILE_ICON_PREFIX: &str = "local-file:";
const ARCHIVE_ICON_PREFIX: &str = "stellar-archive:";

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
pub struct StellarInstanceFile {
    pub format: String,
    pub version: u32,
    #[serde(default)]
    pub included_folders: Vec<String>,
    #[serde(default)]
    pub mod_downloads: Vec<StellarInstanceModDownload>,
    pub instance: Instance,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StellarInstanceModDownload {
    pub file_name: String,
    pub archive_file_name: Option<String>,
    pub download_url: String,
    pub enabled: bool,
    pub sha1: Option<String>,
    pub project_id: Option<String>,
    pub version_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StellarInstanceImportResult {
    pub instance: Instance,
    #[serde(default)]
    pub mod_downloads: Vec<StellarInstanceModDownload>,
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

fn write_json<T: Serialize>(app: &AppHandle, name: &str, value: &T) -> Result<(), String> {
    let path = file_path(app, name)?;
    let raw = serde_json::to_string_pretty(value)
        .map_err(|error| format!("Cannot serialize {name}: {error}"))?;
    fs::write(&path, raw).map_err(|error| format!("Cannot write {}: {error}", path.display()))
}

fn expand_path(path: &str) -> Result<PathBuf, String> {
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

fn is_safe_folder_name(folder: &str) -> bool {
    !folder.is_empty()
        && !folder.contains("..")
        && !folder.contains('/')
        && !folder.contains('\\')
        && folder.chars().all(|character| {
            character.is_ascii_alphanumeric() || matches!(character, '_' | '-' | '.')
        })
}

fn safe_archive_relative_path(path: &str) -> Option<PathBuf> {
    let normalized = path.replace('\\', "/");
    let relative = normalized.strip_prefix("overrides/")?;
    if relative.is_empty() || relative.contains("../") || relative.starts_with('/') {
        return None;
    }
    Some(PathBuf::from(relative))
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

fn add_file_to_archive(
    archive: &mut ZipWriter<fs::File>,
    source_path: &Path,
    archive_name: &str,
    options: SimpleFileOptions,
) -> Result<(), String> {
    archive
        .start_file(archive_name, options)
        .map_err(|error| format!("Cannot add {archive_name} to archive: {error}"))?;
    let mut file = fs::File::open(source_path)
        .map_err(|error| format!("Cannot open {}: {error}", source_path.display()))?;
    std::io::copy(&mut file, archive).map_err(|error| {
        format!(
            "Cannot write {} into archive: {error}",
            source_path.display()
        )
    })?;
    Ok(())
}

fn archive_instance_icon(icon: &str) -> Result<Option<(PathBuf, String)>, String> {
    let Some(raw_path) = icon.strip_prefix(LOCAL_FILE_ICON_PREFIX) else {
        return Ok(None);
    };

    let source_path = expand_path(raw_path)?;
    if !source_path.exists() || !source_path.is_file() {
        return Ok(None);
    }

    let Some(extension) = supported_image_extension(&source_path) else {
        return Ok(None);
    };

    Ok(Some((
        source_path,
        format!("media/instance-icon.{extension}"),
    )))
}

fn extract_instance_icon(
    app: &AppHandle,
    archive: &mut ZipArchive<fs::File>,
    icon: &str,
) -> Result<Option<String>, String> {
    let Some(archive_name) = icon.strip_prefix(ARCHIVE_ICON_PREFIX) else {
        return Ok(None);
    };

    let normalized = archive_name.replace('\\', "/");
    if !normalized.starts_with("media/")
        || normalized.contains("../")
        || normalized.starts_with('/')
    {
        return Err("Packed instance image path is unsafe.".to_string());
    }

    let extension = Path::new(&normalized)
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_lowercase())
        .unwrap_or_else(|| "png".to_string());
    if !["png", "jpg", "jpeg", "webp", "gif"].contains(&extension.as_str()) {
        return Err("Packed instance image is not a supported image.".to_string());
    }

    let mut entry = archive
        .by_name(&normalized)
        .map_err(|error| format!("Cannot read packed instance image {normalized}: {error}"))?;
    let icons_dir = app_data_dir(app)?.join("instance-icons");
    fs::create_dir_all(&icons_dir).map_err(|error| {
        format!(
            "Cannot create icon directory {}: {error}",
            icons_dir.display()
        )
    })?;
    let target = icons_dir.join(format!(
        "imported-instance-{}.{}",
        chrono::Utc::now().timestamp_millis(),
        extension
    ));
    let mut target_file = fs::File::create(&target)
        .map_err(|error| format!("Cannot create imported icon {}: {error}", target.display()))?;
    std::io::copy(&mut entry, &mut target_file)
        .map_err(|error| format!("Cannot extract packed instance image: {error}"))?;
    Ok(Some(format!(
        "{LOCAL_FILE_ICON_PREFIX}{}",
        target.to_string_lossy()
    )))
}

fn add_directory_to_archive(
    archive: &mut ZipWriter<fs::File>,
    source_dir: &Path,
    archive_prefix: &str,
    options: SimpleFileOptions,
    skipped_file_names: Option<&HashSet<String>>,
) -> Result<(), String> {
    if !source_dir.exists() || !source_dir.is_dir() {
        return Ok(());
    }

    for entry in fs::read_dir(source_dir)
        .map_err(|error| format!("Cannot read {}: {error}", source_dir.display()))?
    {
        let entry = entry.map_err(|error| {
            format!(
                "Cannot read directory entry in {}: {error}",
                source_dir.display()
            )
        })?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        let archive_name = format!("{archive_prefix}/{name}").replace('\\', "/");

        if path.is_dir() {
            add_directory_to_archive(archive, &path, &archive_name, options, skipped_file_names)?;
            continue;
        }

        if path.is_file() {
            if skipped_file_names
                .map(|names| names.contains(&name))
                .unwrap_or(false)
            {
                continue;
            }
            archive
                .start_file(&archive_name, options)
                .map_err(|error| format!("Cannot add {archive_name} to archive: {error}"))?;
            let mut file = fs::File::open(&path)
                .map_err(|error| format!("Cannot open {}: {error}", path.display()))?;
            std::io::copy(&mut file, archive).map_err(|error| {
                format!("Cannot write {} into archive: {error}", path.display())
            })?;
        }
    }

    Ok(())
}

fn extract_overrides(
    archive: &mut ZipArchive<fs::File>,
    game_directory: &str,
) -> Result<(), String> {
    let game_dir = expand_path(game_directory)?;
    fs::create_dir_all(&game_dir).map_err(|error| {
        format!(
            "Cannot create game directory {}: {error}",
            game_dir.display()
        )
    })?;

    for index in 0..archive.len() {
        let mut entry = archive
            .by_index(index)
            .map_err(|error| format!("Cannot read archive entry: {error}"))?;
        if entry.is_dir() {
            continue;
        }

        let Some(relative_path) = safe_archive_relative_path(entry.name()) else {
            continue;
        };
        let target = game_dir.join(relative_path);
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent).map_err(|error| {
                format!("Cannot create directory {}: {error}", parent.display())
            })?;
        }
        let mut target_file = fs::File::create(&target)
            .map_err(|error| format!("Cannot create {}: {error}", target.display()))?;
        std::io::copy(&mut entry, &mut target_file)
            .map_err(|error| format!("Cannot extract {}: {error}", target.display()))?;
    }

    Ok(())
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
        },
    )
}

#[tauri::command]
pub fn save_settings(
    app: AppHandle,
    settings: LauncherSettings,
) -> Result<LauncherSettings, String> {
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

#[tauri::command]
pub fn read_stellar_instance_file(
    app: AppHandle,
    path: String,
) -> Result<StellarInstanceImportResult, String> {
    let file_path = PathBuf::from(&path);
    if !file_path.exists() {
        return Err(format!(
            "Selected instance file does not exist: {}",
            file_path.display()
        ));
    }

    let extension = file_path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_lowercase())
        .unwrap_or_default();

    if extension != "stellarinstance" {
        return Err("Selected file is not a .stellarinstance file.".to_string());
    }

    let mut is_archive = false;
    let raw = match fs::File::open(&file_path)
        .ok()
        .and_then(|file| ZipArchive::new(file).ok())
    {
        Some(mut archive) => {
            is_archive = true;
            let mut entry = archive.by_name("instance.json").map_err(|error| {
                format!(
                    "Cannot find instance.json in {}: {error}",
                    file_path.display()
                )
            })?;
            let mut raw = String::new();
            entry.read_to_string(&mut raw).map_err(|error| {
                format!(
                    "Cannot read instance.json in {}: {error}",
                    file_path.display()
                )
            })?;
            raw
        }
        None => fs::read_to_string(&file_path)
            .map_err(|error| format!("Cannot read {}: {error}", file_path.display()))?,
    };
    let mut manifest: StellarInstanceFile = serde_json::from_str(&raw).map_err(|error| {
        format!(
            "Cannot parse instance manifest in {}: {error}",
            file_path.display()
        )
    })?;

    if manifest.format != "app.stellarlauncher.instance" {
        return Err(
            "This .stellarinstance file is not a Stellar Launcher instance manifest.".to_string(),
        );
    }

    if is_archive {
        let file = fs::File::open(&file_path)
            .map_err(|error| format!("Cannot open {}: {error}", file_path.display()))?;
        let mut archive = ZipArchive::new(file)
            .map_err(|error| format!("Cannot read {}: {error}", file_path.display()))?;
        extract_overrides(&mut archive, &manifest.instance.game_directory)?;
        if let Some(imported_icon) =
            extract_instance_icon(&app, &mut archive, &manifest.instance.icon)?
        {
            manifest.instance.icon = imported_icon;
        }
    }

    Ok(StellarInstanceImportResult {
        instance: manifest.instance,
        mod_downloads: manifest.mod_downloads,
    })
}

#[tauri::command]
pub fn write_stellar_instance_file(
    path: String,
    instance: Instance,
    included_folders: Vec<String>,
    mod_downloads: Vec<StellarInstanceModDownload>,
) -> Result<String, String> {
    let mut file_path = PathBuf::from(&path);
    if file_path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_lowercase())
        .as_deref()
        != Some("stellarinstance")
    {
        file_path.set_extension("stellarinstance");
    }

    let mut exported_instance = instance;
    let packed_instance_icon = archive_instance_icon(&exported_instance.icon)?;
    if let Some((_, archive_name)) = &packed_instance_icon {
        exported_instance.icon = format!("{ARCHIVE_ICON_PREFIX}{archive_name}");
    }

    let manifest = StellarInstanceFile {
        format: "app.stellarlauncher.instance".to_string(),
        version: 1,
        included_folders: included_folders.clone(),
        mod_downloads,
        instance: exported_instance,
    };
    let raw = serde_json::to_string_pretty(&manifest)
        .map_err(|error| format!("Cannot serialize .stellarinstance file: {error}"))?;
    let file = fs::File::create(&file_path)
        .map_err(|error| format!("Cannot create {}: {error}", file_path.display()))?;
    let mut archive = ZipWriter::new(file);
    let options = SimpleFileOptions::default().compression_method(CompressionMethod::Stored);
    archive
        .start_file("instance.json", options)
        .map_err(|error| {
            format!(
                "Cannot write instance.json to {}: {error}",
                file_path.display()
            )
        })?;
    archive.write_all(raw.as_bytes()).map_err(|error| {
        format!(
            "Cannot write instance manifest to {}: {error}",
            file_path.display()
        )
    })?;
    if let Some((source_path, archive_name)) = &packed_instance_icon {
        add_file_to_archive(&mut archive, source_path, archive_name, options)?;
    }
    let game_dir = expand_path(&manifest.instance.game_directory)?;
    let skipped_mod_file_names = manifest
        .mod_downloads
        .iter()
        .flat_map(|mod_download| {
            [
                Some(mod_download.file_name.clone()),
                mod_download.archive_file_name.clone(),
                Some(format!("{}.disabled", mod_download.file_name)),
            ]
        })
        .flatten()
        .collect::<HashSet<_>>();

    for folder in included_folders {
        if !is_safe_folder_name(&folder) {
            return Err(format!(
                "Cannot export unsafe instance folder name: {folder}"
            ));
        }

        let source_dir = game_dir.join(&folder);
        let skipped_file_names = if folder == "mods" {
            Some(&skipped_mod_file_names)
        } else {
            None
        };
        add_directory_to_archive(
            &mut archive,
            &source_dir,
            &format!("overrides/{folder}"),
            options,
            skipped_file_names,
        )?;
    }
    archive
        .finish()
        .map_err(|error| format!("Cannot finish {}: {error}", file_path.display()))?;
    Ok(file_path.to_string_lossy().to_string())
}
