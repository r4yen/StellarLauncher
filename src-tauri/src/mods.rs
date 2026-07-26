use base64::{engine::general_purpose, Engine};
use futures_util::StreamExt;
use reqwest::Client;
use serde::Serialize;
use serde_json::Value;
use sha1::{Digest, Sha1};
use std::{
    fs,
    io::{Read, Write},
    path::{Path, PathBuf},
};
use tauri::{AppHandle, Emitter};
use zip::ZipArchive;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModFile {
    file_name: String,
    path: String,
    sha1: String,
    enabled: bool,
    name: String,
    version: String,
    authors: Vec<String>,
    icon_data_url: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModDownloadProgress {
    operation_id: String,
    status: String,
    downloaded_bytes: u64,
    total_bytes: Option<u64>,
    file_name: String,
    target_path: String,
}

#[tauri::command]
pub fn list_mods(game_directory: String) -> Result<Vec<ModFile>, String> {
    let mods_dir = PathBuf::from(expand_path(&game_directory)).join("mods");
    fs::create_dir_all(&mods_dir).map_err(|error| {
        format!(
            "Cannot create mods directory {}: {error}",
            mods_dir.display()
        )
    })?;
    let mut mods = Vec::new();

    for entry in fs::read_dir(&mods_dir)
        .map_err(|error| format!("Cannot read mods directory {}: {error}", mods_dir.display()))?
    {
        let path = entry
            .map_err(|error| format!("Cannot read mod file entry: {error}"))?
            .path();
        if is_mod_file(&path) {
            mods.push(read_mod_file(&path)?);
        }
    }

    mods.sort_by(|left, right| {
        left.file_name
            .to_lowercase()
            .cmp(&right.file_name.to_lowercase())
    });
    Ok(mods)
}

#[tauri::command]
pub fn set_mod_enabled(path: String, enabled: bool) -> Result<ModFile, String> {
    let source = PathBuf::from(path);
    if !source.exists() {
        return Err(format!("Mod file {} does not exist.", source.display()));
    }

    let file_name = source
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "Invalid mod filename.".to_string())?;
    let target_name = if enabled {
        file_name
            .strip_suffix(".disabled")
            .unwrap_or(file_name)
            .to_string()
    } else if file_name.ends_with(".disabled") {
        file_name.to_string()
    } else {
        format!("{file_name}.disabled")
    };
    let target = source.with_file_name(target_name);

    if source != target {
        fs::rename(&source, &target).map_err(|error| format!("Cannot rename mod file: {error}"))?;
    }

    read_mod_file(&target)
}

#[tauri::command]
pub fn delete_mod(path: String) -> Result<(), String> {
    let source = PathBuf::from(path);
    fs::remove_file(&source)
        .map_err(|error| format!("Cannot delete mod file {}: {error}", source.display()))
}

#[tauri::command]
pub fn add_mod_file(game_directory: String, source_path: String) -> Result<ModFile, String> {
    let source = PathBuf::from(expand_path(&source_path));
    if !is_mod_file(&source) {
        return Err("Only .jar and .jar.disabled files can be added.".to_string());
    }

    let mods_dir = PathBuf::from(expand_path(&game_directory)).join("mods");
    fs::create_dir_all(&mods_dir).map_err(|error| {
        format!(
            "Cannot create mods directory {}: {error}",
            mods_dir.display()
        )
    })?;
    let file_name = source
        .file_name()
        .ok_or_else(|| "Invalid source filename.".to_string())?;
    let target = mods_dir.join(file_name);
    fs::copy(&source, &target)
        .map_err(|error| format!("Cannot copy mod file into {}: {error}", mods_dir.display()))?;
    read_mod_file(&target)
}

#[tauri::command]
pub async fn install_modrinth_mod(
    app: AppHandle,
    game_directory: String,
    download_url: String,
    file_name: String,
    replace_path: Option<String>,
    operation_id: Option<String>,
) -> Result<ModFile, String> {
    let mods_dir = PathBuf::from(expand_path(&game_directory)).join("mods");
    fs::create_dir_all(&mods_dir).map_err(|error| {
        format!(
            "Cannot create mods directory {}: {error}",
            mods_dir.display()
        )
    })?;

    let safe_name = sanitize_file_name(&file_name);
    if !safe_name.ends_with(".jar") {
        return Err("Modrinth download did not provide a .jar file.".to_string());
    }
    let operation_id = operation_id
        .unwrap_or_else(|| format!("modrinth-{}", chrono::Utc::now().timestamp_millis()));
    let target = unique_target_path(&mods_dir, &safe_name);

    emit_mod_progress(&app, &operation_id, "pending", 0, None, &safe_name, &target);

    let response = Client::new()
        .get(&download_url)
        .send()
        .await
        .map_err(|error| format!("Cannot download Modrinth mod: {error}"))?
        .error_for_status()
        .map_err(|error| format!("Modrinth mod download failed: {error}"))?;
    let total_bytes = response.content_length();
    let mut downloaded_bytes = 0_u64;
    let mut output = fs::File::create(&target)
        .map_err(|error| format!("Cannot create Modrinth mod {}: {error}", target.display()))?;
    let mut stream = response.bytes_stream();

    while let Some(chunk) = stream.next().await {
        let bytes = chunk.map_err(|error| format!("Cannot read Modrinth mod download: {error}"))?;
        output
            .write_all(&bytes)
            .map_err(|error| format!("Cannot write Modrinth mod {}: {error}", target.display()))?;
        downloaded_bytes += bytes.len() as u64;
        emit_mod_progress(
            &app,
            &operation_id,
            "downloading",
            downloaded_bytes,
            total_bytes,
            &safe_name,
            &target,
        );
    }

    if let Some(old_path) = replace_path {
        let old = PathBuf::from(old_path);
        if old.exists() && old != target {
            let _ = fs::remove_file(old);
        }
    }

    emit_mod_progress(
        &app,
        &operation_id,
        "completed",
        downloaded_bytes,
        total_bytes,
        &safe_name,
        &target,
    );
    read_mod_file(&target)
}

fn emit_mod_progress(
    app: &AppHandle,
    operation_id: &str,
    status: &str,
    downloaded_bytes: u64,
    total_bytes: Option<u64>,
    file_name: &str,
    target_path: &Path,
) {
    let _ = app.emit(
        "mod-download-progress",
        ModDownloadProgress {
            operation_id: operation_id.to_string(),
            status: status.to_string(),
            downloaded_bytes,
            total_bytes,
            file_name: file_name.to_string(),
            target_path: target_path.to_string_lossy().to_string(),
        },
    );
}

fn read_mod_file(path: &Path) -> Result<ModFile, String> {
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("unknown.jar")
        .to_string();
    let enabled = file_name.ends_with(".jar");
    let mut mod_file = ModFile {
        file_name: file_name.clone(),
        path: path.to_string_lossy().to_string(),
        sha1: file_sha1(path)?,
        enabled,
        name: file_name
            .trim_end_matches(".disabled")
            .trim_end_matches(".jar")
            .to_string(),
        version: "unknown".to_string(),
        authors: Vec::new(),
        icon_data_url: None,
    };

    let file = fs::File::open(path)
        .map_err(|error| format!("Cannot open mod file {}: {error}", path.display()))?;
    let mut archive = ZipArchive::new(file)
        .map_err(|error| format!("Cannot read mod jar {}: {error}", path.display()))?;

    if let Some(metadata) = read_json_entry(&mut archive, "fabric.mod.json")
        .or_else(|| read_json_entry(&mut archive, "quilt.mod.json"))
    {
        apply_json_metadata(&mut mod_file, &metadata);
        if let Some(icon_path) = metadata.get("icon").and_then(|value| value.as_str()) {
            mod_file.icon_data_url = read_icon(&mut archive, icon_path);
        }
    } else if let Some(metadata) = read_text_entry(&mut archive, "META-INF/mods.toml") {
        apply_toml_metadata(&mut mod_file, &metadata);
    } else if let Some(metadata) = read_json_entry(&mut archive, "mcmod.info") {
        if let Some(first) = metadata.as_array().and_then(|mods| mods.first()) {
            apply_json_metadata(&mut mod_file, first);
        }
    }

    Ok(mod_file)
}

fn file_sha1(path: &Path) -> Result<String, String> {
    let mut file = fs::File::open(path)
        .map_err(|error| format!("Cannot open mod file {}: {error}", path.display()))?;
    let mut hasher = Sha1::new();
    let mut buffer = [0_u8; 64 * 1024];

    loop {
        let read = file
            .read(&mut buffer)
            .map_err(|error| format!("Cannot hash mod file {}: {error}", path.display()))?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }

    Ok(format!("{:x}", hasher.finalize()))
}

fn sanitize_file_name(file_name: &str) -> String {
    file_name
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || ".-_+[]() ".contains(character) {
                character
            } else {
                '-'
            }
        })
        .collect::<String>()
}

fn unique_target_path(mods_dir: &Path, file_name: &str) -> PathBuf {
    let mut target = mods_dir.join(file_name);
    if !target.exists() {
        return target;
    }

    let stem = file_name.trim_end_matches(".jar");
    for index in 1..1000 {
        target = mods_dir.join(format!("{stem}-{index}.jar"));
        if !target.exists() {
            return target;
        }
    }

    mods_dir.join(format!(
        "{stem}-{}.jar",
        chrono::Utc::now().timestamp_millis()
    ))
}

fn read_json_entry(archive: &mut ZipArchive<fs::File>, name: &str) -> Option<Value> {
    read_text_entry(archive, name).and_then(|raw| serde_json::from_str(&raw).ok())
}

fn read_text_entry(archive: &mut ZipArchive<fs::File>, name: &str) -> Option<String> {
    let mut entry = archive.by_name(name).ok()?;
    let mut raw = String::new();
    entry.read_to_string(&mut raw).ok()?;
    Some(raw)
}

fn apply_json_metadata(mod_file: &mut ModFile, metadata: &Value) {
    if let Some(name) = metadata
        .get("name")
        .or_else(|| metadata.get("modid"))
        .and_then(|value| value.as_str())
    {
        mod_file.name = name.to_string();
    }
    if let Some(version) = metadata.get("version").and_then(|value| value.as_str()) {
        mod_file.version = version.to_string();
    }
    if let Some(authors) = metadata.get("authors") {
        mod_file.authors = parse_authors(authors);
    }
}

fn parse_authors(value: &Value) -> Vec<String> {
    match value {
        Value::String(author) => vec![author.to_string()],
        Value::Array(authors) => authors
            .iter()
            .filter_map(|author| {
                author.as_str().map(ToString::to_string).or_else(|| {
                    author
                        .get("name")
                        .and_then(|name| name.as_str())
                        .map(ToString::to_string)
                })
            })
            .collect(),
        _ => Vec::new(),
    }
}

fn apply_toml_metadata(mod_file: &mut ModFile, raw: &str) {
    for line in raw.lines() {
        let trimmed = line.trim();
        if let Some(value) = trimmed
            .strip_prefix("displayName=")
            .or_else(|| trimmed.strip_prefix("displayName ="))
        {
            mod_file.name = clean_toml_value(value);
        } else if let Some(value) = trimmed
            .strip_prefix("version=")
            .or_else(|| trimmed.strip_prefix("version ="))
        {
            mod_file.version = clean_toml_value(value);
        } else if let Some(value) = trimmed
            .strip_prefix("authors=")
            .or_else(|| trimmed.strip_prefix("authors ="))
        {
            mod_file.authors = clean_toml_value(value)
                .split(',')
                .map(|author| author.trim().to_string())
                .filter(|author| !author.is_empty())
                .collect();
        }
    }
}

fn clean_toml_value(value: &str) -> String {
    value.trim().trim_matches('"').to_string()
}

fn read_icon(archive: &mut ZipArchive<fs::File>, path: &str) -> Option<String> {
    let mut entry = archive.by_name(path).ok()?;
    let mut bytes = Vec::new();
    entry.read_to_end(&mut bytes).ok()?;
    let mime = if path.ends_with(".jpg") || path.ends_with(".jpeg") {
        "image/jpeg"
    } else {
        "image/png"
    };
    Some(format!(
        "data:{mime};base64,{}",
        general_purpose::STANDARD.encode(bytes)
    ))
}

fn is_mod_file(path: &Path) -> bool {
    let name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or_default();
    path.is_file() && (name.ends_with(".jar") || name.ends_with(".jar.disabled"))
}

fn expand_path(path: &str) -> String {
    let mut expanded = path.to_string();
    for (key, value) in std::env::vars() {
        expanded = expanded.replace(&format!("%{key}%"), &value);
        expanded = expanded.replace(&format!("${key}"), &value);
    }
    expanded
}
