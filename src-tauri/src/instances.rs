use keyring::Entry;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    collections::HashMap,
    env, fs,
    io::{self, Read},
    path::{Path, PathBuf},
    process::{Command, Stdio},
};
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use zip::ZipArchive;

const KEYRING_SERVICE: &str = "app.stellarlauncher.desktop";
const VERSION_MANIFEST_URL: &str = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";
const ASSET_OBJECT_BASE_URL: &str = "https://resources.download.minecraft.net";
const FABRIC_PROFILE_URL: &str = "https://meta.fabricmc.net/v2/versions/loader";
const QUILT_PROFILE_URL: &str = "https://meta.quiltmc.org/v3/versions/loader";
const FORGE_MAVEN_URL: &str = "https://maven.minecraftforge.net";
const NEOFORGE_MAVEN_URL: &str = "https://maven.neoforged.net/releases";
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;
#[cfg(target_os = "windows")]
const DETACHED_PROCESS: u32 = 0x00000008;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LaunchRequest {
    pub instance_id: String,
    pub java_path: Option<String>,
    pub game_directory: Option<String>,
    pub ram_mb: Option<u32>,
    pub jvm_args: Option<String>,
    pub account_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Account {
    pub id: String,
    pub username: String,
    pub uuid: String,
    pub r#type: String,
    pub login_status: String,
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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartMinecraftRequest {
    pub instance: Instance,
    pub account: Account,
    pub minecraft_storage_directory: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnsureMinecraftFilesRequest {
    pub instance: Instance,
    pub minecraft_storage_directory: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EnsureMinecraftFilesResponse {
    pub version_id: String,
    pub files_downloaded: u32,
    pub bytes_downloaded: u64,
    pub storage_path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessLaunchResponse {
    pub state: String,
    pub message: String,
    pub instance_id: String,
    pub process_id: u32,
    pub log_path: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct VersionJson {
    id: String,
    main_class: String,
    #[serde(default)]
    inherits_from: Option<String>,
    #[serde(default)]
    downloads: Option<VersionDownloads>,
    #[serde(default)]
    arguments: Option<VersionArguments>,
    #[serde(default)]
    minecraft_arguments: Option<String>,
    #[serde(default)]
    libraries: Vec<Library>,
    #[serde(default)]
    asset_index: Option<AssetIndex>,
    #[serde(default)]
    assets: Option<String>,
    #[serde(default)]
    r#type: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct VersionDownloads {
    #[serde(default)]
    client: Option<DownloadFile>,
}

#[derive(Debug, Serialize, Deserialize)]
struct DownloadFile {
    url: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct VersionArguments {
    #[serde(default)]
    game: Vec<Value>,
}

#[derive(Debug, Serialize, Deserialize)]
struct AssetIndex {
    id: String,
    #[serde(default)]
    url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct Library {
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    url: Option<String>,
    #[serde(default)]
    downloads: Option<LibraryDownloads>,
    #[serde(default)]
    natives: Option<HashMap<String, String>>,
    #[serde(default)]
    rules: Option<Vec<Rule>>,
}

#[derive(Debug, Serialize, Deserialize)]
struct LibraryDownloads {
    #[serde(default)]
    artifact: Option<LibraryArtifact>,
    #[serde(default)]
    classifiers: Option<HashMap<String, LibraryArtifact>>,
}

#[derive(Debug, Serialize, Deserialize)]
struct LibraryArtifact {
    path: String,
    #[serde(default)]
    url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct Rule {
    action: String,
    #[serde(default)]
    os: Option<RuleOs>,
}

#[derive(Debug, Serialize, Deserialize)]
struct RuleOs {
    #[serde(default)]
    name: Option<String>,
}

#[derive(Debug, Deserialize)]
struct VersionManifest {
    versions: Vec<ManifestVersion>,
}

#[derive(Debug, Deserialize)]
struct ManifestVersion {
    id: String,
    url: String,
}

#[derive(Debug, Deserialize)]
struct AssetObjects {
    objects: HashMap<String, AssetObject>,
}

#[derive(Debug, Deserialize)]
struct AssetObject {
    hash: String,
}

#[tauri::command]
pub fn build_launch_request(request: LaunchRequest) -> Result<LaunchRequest, String> {
    if request.instance_id.trim().is_empty() {
        return Err("Instance id is required.".to_string());
    }

    if request.account_id.as_deref().unwrap_or("").trim().is_empty() {
        return Err("A logged-in account is required before launch.".to_string());
    }

    if request.game_directory.as_deref().unwrap_or("").trim().is_empty() {
        return Err("Game directory is required before launch.".to_string());
    }

    Ok(request)
}

#[tauri::command]
pub async fn ensure_minecraft_files(request: EnsureMinecraftFilesRequest) -> Result<EnsureMinecraftFilesResponse, String> {
    let instance = request.instance;
    let storage_dir = expand_path(&request.minecraft_storage_directory)?;
    fs::create_dir_all(&storage_dir).map_err(|error| format!("Cannot create Minecraft storage directory {}: {error}", storage_dir.display()))?;

    let client = Client::new();
    let manifest = client
        .get(VERSION_MANIFEST_URL)
        .send()
        .await
        .map_err(|error| format!("Cannot download Minecraft version manifest: {error}"))?
        .error_for_status()
        .map_err(|error| format!("Minecraft version manifest request failed: {error}"))?
        .json::<VersionManifest>()
        .await
        .map_err(|error| format!("Cannot parse Minecraft version manifest: {error}"))?;
    let manifest_version = manifest
        .versions
        .into_iter()
        .find(|version| version.id == instance.minecraft_version)
        .ok_or_else(|| format!("Minecraft version {} was not found in Mojang's version manifest.", instance.minecraft_version))?;
    let version_dir = storage_dir.join("versions").join(&manifest_version.id);
    let version_json_path = version_dir.join(format!("{}.json", manifest_version.id));

    let mut files_downloaded = 0;
    let mut bytes_downloaded = 0;
    let downloaded = download_to_file(&client, &manifest_version.url, &version_json_path).await?;
    if downloaded > 0 {
        files_downloaded += 1;
        bytes_downloaded += downloaded;
    }

    let version_raw = fs::read_to_string(&version_json_path)
        .map_err(|error| format!("Cannot read version JSON {}: {error}", version_json_path.display()))?;
    let version: VersionJson = serde_json::from_str(&version_raw)
        .map_err(|error| format!("Cannot parse version JSON {}: {error}", version_json_path.display()))?;

    if let Some(client_download) = version.downloads.as_ref().and_then(|downloads| downloads.client.as_ref()) {
        let client_jar_path = version_dir.join(format!("{}.jar", manifest_version.id));
        let downloaded = download_to_file(&client, &client_download.url, &client_jar_path).await?;
        if downloaded > 0 {
            files_downloaded += 1;
            bytes_downloaded += downloaded;
        }
    }

    for library in &version.libraries {
        if !rules_allow(library.rules.as_deref()) {
            continue;
        }

        if let Some((artifact_path, url)) = library_artifact_path_url(library) {
            let downloaded = download_to_file(&client, &url, &storage_dir.join("libraries").join(&artifact_path)).await?;
            if downloaded > 0 {
                files_downloaded += 1;
                bytes_downloaded += downloaded;
            }
        }

        if let Some(native_artifact) = native_artifact(library) {
            if let Some(url) = &native_artifact.url {
                let downloaded = download_to_file(&client, url, &storage_dir.join("libraries").join(&native_artifact.path)).await?;
                if downloaded > 0 {
                    files_downloaded += 1;
                    bytes_downloaded += downloaded;
                }
            }
        }
    }

    if let Some(asset_index) = &version.asset_index {
        if let Some(url) = &asset_index.url {
            let asset_index_path = storage_dir.join("assets").join("indexes").join(format!("{}.json", asset_index.id));
            let downloaded = download_to_file(&client, url, &asset_index_path).await?;
            if downloaded > 0 {
                files_downloaded += 1;
                bytes_downloaded += downloaded;
            }

            let raw = fs::read_to_string(&asset_index_path)
                .map_err(|error| format!("Cannot read asset index {}: {error}", asset_index_path.display()))?;
            let assets = serde_json::from_str::<AssetObjects>(&raw)
                .map_err(|error| format!("Cannot parse asset index {}: {error}", asset_index_path.display()))?;

            for asset in assets.objects.values() {
                let prefix = asset.hash.get(0..2).ok_or_else(|| "Asset hash was invalid.".to_string())?;
                let path = storage_dir.join("assets").join("objects").join(prefix).join(&asset.hash);
                let url = format!("{ASSET_OBJECT_BASE_URL}/{prefix}/{}", asset.hash);
                let downloaded = download_to_file(&client, &url, &path).await?;
                if downloaded > 0 {
                    files_downloaded += 1;
                    bytes_downloaded += downloaded;
                }
            }
        }
    }

    if instance.loader_type != "vanilla" {
        let loader_result = ensure_loader_files(&client, &instance, &storage_dir).await?;
        files_downloaded += loader_result.0;
        bytes_downloaded += loader_result.1;
    }

    Ok(EnsureMinecraftFilesResponse {
        version_id: manifest_version.id,
        files_downloaded,
        bytes_downloaded,
        storage_path: storage_dir.to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub fn start_minecraft_process(request: StartMinecraftRequest) -> Result<ProcessLaunchResponse, String> {
    let instance = request.instance;
    let account = request.account;
    let game_dir = expand_path(&instance.game_directory)?;
    let storage_dir = expand_path(&request.minecraft_storage_directory)?;
    let java_path = expand_path(&instance.java_path)?;

    if !game_dir.exists() {
        fs::create_dir_all(&game_dir).map_err(|error| format!("Cannot create game directory {}: {error}", game_dir.display()))?;
    }

    if !java_path.exists() {
        return Err(format!("Java executable was not found at {}.", java_path.display()));
    }

    let (version_id, version_json_path) = find_version_json(&instance, &game_dir, &storage_dir).ok_or_else(|| {
        format!(
            "No runnable Minecraft version JSON was found for {}. Expected local files under {} or {}.",
            instance.minecraft_version,
            game_dir.join("versions").display(),
            storage_dir.join("versions").display()
        )
    })?;
    let version = read_version_json(&version_json_path)?;
    let parent_version = find_parent_version(&version, &game_dir, &storage_dir)?;
    let client_jar = find_client_jar(&instance.minecraft_version, &game_dir, &storage_dir)
        .or_else(|| find_client_jar(&version_id, &game_dir, &storage_dir))
        .ok_or_else(|| format!("Client jar for {version_id} was not found."))?;
    let classpath = build_classpath(&version, parent_version.as_ref(), &client_jar, &game_dir, &storage_dir)?;
    let access_token = minecraft_access_token(&account)?;
    let assets_index = version
        .asset_index
        .as_ref()
        .map(|asset_index| asset_index.id.clone())
        .or_else(|| parent_version.as_ref().and_then(|parent| parent.asset_index.as_ref().map(|asset_index| asset_index.id.clone())))
        .or(version.assets.clone())
        .or_else(|| parent_version.as_ref().and_then(|parent| parent.assets.clone()))
        .unwrap_or_else(|| "legacy".to_string());
    let assets_dir = first_existing_path(&[
        game_dir.join("assets"),
        storage_dir.join("assets"),
    ])
    .unwrap_or_else(|| game_dir.join("assets"));
    let natives_dir = game_dir.join("natives").join(&instance.id);
    fs::create_dir_all(&natives_dir).map_err(|error| format!("Cannot create natives directory {}: {error}", natives_dir.display()))?;
    if let Some(parent) = &parent_version {
        extract_natives(parent, &game_dir, &storage_dir, &natives_dir)?;
    }
    extract_natives(&version, &game_dir, &storage_dir, &natives_dir)?;

    let mut replacements = HashMap::new();
    replacements.insert("auth_player_name".to_string(), account.username.clone());
    replacements.insert("version_name".to_string(), version.id.clone());
    replacements.insert("game_directory".to_string(), game_dir.to_string_lossy().to_string());
    replacements.insert("assets_root".to_string(), assets_dir.to_string_lossy().to_string());
    replacements.insert("assets_index_name".to_string(), assets_index);
    replacements.insert("auth_uuid".to_string(), account.uuid.replace('-', ""));
    replacements.insert("auth_access_token".to_string(), access_token);
    replacements.insert("user_type".to_string(), if account.r#type == "microsoft" { "msa" } else { "legacy" }.to_string());
    replacements.insert(
        "version_type".to_string(),
        version
            .r#type
            .clone()
            .or_else(|| parent_version.as_ref().and_then(|parent| parent.r#type.clone()))
            .unwrap_or_else(|| "release".to_string()),
    );
    replacements.insert("classpath".to_string(), classpath.clone());
    replacements.insert("natives_directory".to_string(), natives_dir.to_string_lossy().to_string());
    replacements.insert("launcher_name".to_string(), "StellarLauncher".to_string());
    replacements.insert("launcher_version".to_string(), "1.0.1".to_string());

    let mut args = Vec::new();
    args.push(format!("-Xmx{}M", instance.ram_mb));
    args.extend(split_args(&instance.jvm_args));
    args.push(format!("-Djava.library.path={}", natives_dir.display()));
    args.push("-cp".to_string());
    args.push(classpath);
    args.push(version.main_class.clone());
    args.extend(game_arguments(&version, parent_version.as_ref(), &replacements));

    let log_path = game_dir.join(format!("stellar-launch-{}.log", instance.id));
    let stdout = fs::File::create(&log_path).map_err(|error| format!("Cannot create launch log {}: {error}", log_path.display()))?;
    let stderr = stdout.try_clone().map_err(|error| format!("Cannot attach launch log: {error}"))?;
    let mut command = Command::new(&java_path);
    command
        .args(args)
        .current_dir(&game_dir)
        .stdin(Stdio::null())
        .stdout(Stdio::from(stdout))
        .stderr(Stdio::from(stderr));

    #[cfg(target_os = "windows")]
    command.creation_flags(CREATE_NO_WINDOW | DETACHED_PROCESS);

    let child = command
        .spawn()
        .map_err(|error| format!("Cannot start Java process: {error}"))?;
    let process_id = child.id();

    Ok(ProcessLaunchResponse {
        state: "running".to_string(),
        message: format!("Minecraft process started with pid {process_id}."),
        instance_id: instance.id,
        process_id,
        log_path: log_path.to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub fn stop_minecraft_process(process_id: u32) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    let status = Command::new("taskkill")
        .args(["/PID", &process_id.to_string(), "/T", "/F"])
        .status()
        .map_err(|error| format!("Cannot stop process {process_id}: {error}"))?;

    #[cfg(not(target_os = "windows"))]
    let status = Command::new("kill")
        .args(["-TERM", &process_id.to_string()])
        .status()
        .map_err(|error| format!("Cannot stop process {process_id}: {error}"))?;

    if status.success() {
        Ok(())
    } else {
        Err(format!("Stop command failed for process {process_id}."))
    }
}

#[tauri::command]
pub fn is_minecraft_process_running(process_id: u32) -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        let output = Command::new("tasklist")
            .args(["/FI", &format!("PID eq {process_id}"), "/NH"])
            .output()
            .map_err(|error| format!("Cannot inspect process {process_id}: {error}"))?;
        let stdout = String::from_utf8_lossy(&output.stdout).to_lowercase();
        Ok(stdout.contains(&process_id.to_string()) && !stdout.contains("no tasks"))
    }

    #[cfg(not(target_os = "windows"))]
    {
        let status = Command::new("kill")
            .args(["-0", &process_id.to_string()])
            .status()
            .map_err(|error| format!("Cannot inspect process {process_id}: {error}"))?;
        Ok(status.success())
    }
}

#[tauri::command]
pub fn read_launch_log_tail(path: String, max_lines: Option<usize>) -> Result<Vec<String>, String> {
    let path = expand_path(&path)?;
    if !path.exists() {
        return Ok(Vec::new());
    }

    let raw = fs::read_to_string(&path).map_err(|error| format!("Cannot read launch log {}: {error}", path.display()))?;
    let limit = max_lines.unwrap_or(160);
    let lines = raw
        .lines()
        .rev()
        .take(limit)
        .map(|line| line.to_string())
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect();
    Ok(lines)
}

async fn download_to_file(client: &Client, url: &str, path: &Path) -> Result<u64, String> {
    if path.exists() {
        return Ok(0);
    }

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("Cannot create directory {}: {error}", parent.display()))?;
    }

    let bytes = client
        .get(url)
        .send()
        .await
        .map_err(|error| format!("Cannot download {url}: {error}"))?
        .error_for_status()
        .map_err(|error| format!("Download failed for {url}: {error}"))?
        .bytes()
        .await
        .map_err(|error| format!("Cannot read download body from {url}: {error}"))?;
    fs::write(path, &bytes).map_err(|error| format!("Cannot write {}: {error}", path.display()))?;
    Ok(bytes.len() as u64)
}

async fn ensure_loader_files(client: &Client, instance: &Instance, storage_dir: &Path) -> Result<(u32, u64), String> {
    match instance.loader_type.as_str() {
        "fabric" => ensure_meta_loader_profile(
            client,
            &format!("{FABRIC_PROFILE_URL}/{}/{}/profile/json", instance.minecraft_version, instance.loader_version),
            storage_dir,
        )
        .await,
        "quilt" => ensure_meta_loader_profile(
            client,
            &format!("{QUILT_PROFILE_URL}/{}/{}/profile/json", instance.minecraft_version, instance.loader_version),
            storage_dir,
        )
        .await,
        "forge" => {
            let coordinate = format!("{}-{}", instance.minecraft_version, instance.loader_version);
            let url = format!("{FORGE_MAVEN_URL}/net/minecraftforge/forge/{coordinate}/forge-{coordinate}-installer.jar");
            ensure_installer_loader_profile(client, &url, storage_dir).await
        }
        "neoforge" => {
            let url = format!(
                "{NEOFORGE_MAVEN_URL}/net/neoforged/neoforge/{}/neoforge-{}-installer.jar",
                instance.loader_version, instance.loader_version
            );
            ensure_installer_loader_profile(client, &url, storage_dir).await
        }
        _ => Ok((0, 0)),
    }
}

async fn ensure_meta_loader_profile(client: &Client, url: &str, storage_dir: &Path) -> Result<(u32, u64), String> {
    let profile = client
        .get(url)
        .send()
        .await
        .map_err(|error| format!("Cannot download loader profile {url}: {error}"))?
        .error_for_status()
        .map_err(|error| format!("Loader profile request failed for {url}: {error}"))?
        .json::<VersionJson>()
        .await
        .map_err(|error| format!("Cannot parse loader profile {url}: {error}"))?;
    write_loader_profile_and_libraries(client, storage_dir, &profile).await
}

async fn ensure_installer_loader_profile(client: &Client, url: &str, storage_dir: &Path) -> Result<(u32, u64), String> {
    let installer_path = storage_dir.join("installers").join(url.rsplit('/').next().unwrap_or("loader-installer.jar"));
    let mut files_downloaded = 0;
    let mut bytes_downloaded = download_to_file(client, url, &installer_path).await?;
    if bytes_downloaded > 0 {
        files_downloaded += 1;
    }

    let file = fs::File::open(&installer_path).map_err(|error| format!("Cannot open loader installer {}: {error}", installer_path.display()))?;
    let mut archive = ZipArchive::new(file).map_err(|error| format!("Cannot read loader installer {}: {error}", installer_path.display()))?;
    let mut raw = String::new();
    archive
        .by_name("version.json")
        .map_err(|_| format!("Loader installer {} did not contain version.json.", installer_path.display()))?
        .read_to_string(&mut raw)
        .map_err(|error| format!("Cannot read loader version.json: {error}"))?;
    let profile = serde_json::from_str::<VersionJson>(&raw).map_err(|error| format!("Cannot parse loader version.json: {error}"))?;
    let result = write_loader_profile_and_libraries(client, storage_dir, &profile).await?;
    files_downloaded += result.0;
    bytes_downloaded += result.1;
    Ok((files_downloaded, bytes_downloaded))
}

async fn write_loader_profile_and_libraries(client: &Client, storage_dir: &Path, profile: &VersionJson) -> Result<(u32, u64), String> {
    let version_dir = storage_dir.join("versions").join(&profile.id);
    fs::create_dir_all(&version_dir).map_err(|error| format!("Cannot create loader version directory {}: {error}", version_dir.display()))?;
    let profile_path = version_dir.join(format!("{}.json", profile.id));
    let mut files_downloaded = 0;
    let mut bytes_downloaded = 0;

    if !profile_path.exists() {
        let raw = serde_json::to_vec_pretty(profile).map_err(|error| format!("Cannot serialize loader profile: {error}"))?;
        fs::write(&profile_path, &raw).map_err(|error| format!("Cannot write loader profile {}: {error}", profile_path.display()))?;
        files_downloaded += 1;
        bytes_downloaded += raw.len() as u64;
    }

    let result = download_version_libraries(client, profile, storage_dir).await?;
    files_downloaded += result.0;
    bytes_downloaded += result.1;
    Ok((files_downloaded, bytes_downloaded))
}

async fn download_version_libraries(client: &Client, version: &VersionJson, storage_dir: &Path) -> Result<(u32, u64), String> {
    let mut files_downloaded = 0;
    let mut bytes_downloaded = 0;

    for library in &version.libraries {
        if !rules_allow(library.rules.as_deref()) {
            continue;
        }

        if let Some((path, url)) = library_artifact_path_url(library) {
            let downloaded = download_to_file(client, &url, &storage_dir.join("libraries").join(&path)).await?;
            if downloaded > 0 {
                files_downloaded += 1;
                bytes_downloaded += downloaded;
            }
        }

        if let Some(native_artifact) = native_artifact(library) {
            if let Some(url) = &native_artifact.url {
                let downloaded = download_to_file(client, url, &storage_dir.join("libraries").join(&native_artifact.path)).await?;
                if downloaded > 0 {
                    files_downloaded += 1;
                    bytes_downloaded += downloaded;
                }
            }
        }
    }

    Ok((files_downloaded, bytes_downloaded))
}

fn expand_path(path: &str) -> Result<PathBuf, String> {
    let mut expanded = path.to_string();
    for (key, value) in env::vars() {
        expanded = expanded.replace(&format!("%{key}%"), &value);
        expanded = expanded.replace(&format!("${key}"), &value);
    }
    Ok(PathBuf::from(expanded))
}

fn find_version_json(instance: &Instance, game_dir: &Path, storage_dir: &Path) -> Option<(String, PathBuf)> {
    for version_id in version_candidates(instance) {
        for root in [game_dir, storage_dir] {
            let path = root.join("versions").join(&version_id).join(format!("{version_id}.json"));
            if path.exists() {
                return Some((version_id, path));
            }
        }
    }

    if instance.loader_type != "vanilla" && !instance.loader_version.trim().is_empty() {
        for root in [game_dir, storage_dir] {
            let versions_dir = root.join("versions");
            let Ok(entries) = fs::read_dir(&versions_dir) else {
                continue;
            };

            for entry in entries.flatten() {
                let version_id = entry.file_name().to_string_lossy().to_string();
                let lowered = version_id.to_lowercase();
                if lowered.contains(&instance.loader_type) && lowered.contains(&instance.loader_version.to_lowercase()) {
                    let path = entry.path().join(format!("{version_id}.json"));
                    if path.exists() {
                        return Some((version_id, path));
                    }
                }
            }
        }
    }

    None
}

fn version_candidates(instance: &Instance) -> Vec<String> {
    let mut candidates = Vec::new();
    if instance.loader_type != "vanilla" && !instance.loader_version.trim().is_empty() {
        candidates.push(format!("{}-loader-{}-{}", instance.loader_type, instance.loader_version, instance.minecraft_version));
        candidates.push(format!("{}-{}-{}", instance.loader_type, instance.loader_version, instance.minecraft_version));
        candidates.push(format!("{}-{}-{}", instance.minecraft_version, instance.loader_type, instance.loader_version));
        candidates.push(format!("{}-{}-{}", instance.minecraft_version, instance.loader_version, instance.loader_type));
        candidates.push(format!("{}-{}", instance.loader_type, instance.loader_version));
        if instance.loader_type == "forge" {
            candidates.push(format!("{}-forge-{}", instance.minecraft_version, instance.loader_version));
        }
        if instance.loader_type == "neoforge" {
            candidates.push(format!("neoforge-{}", instance.loader_version));
            candidates.push(format!("{}-neoforge-{}", instance.minecraft_version, instance.loader_version));
        }
    }
    candidates.push(instance.minecraft_version.clone());
    candidates
}

fn read_version_json(path: &Path) -> Result<VersionJson, String> {
    let version_raw = fs::read_to_string(path).map_err(|error| format!("Cannot read version JSON {}: {error}", path.display()))?;
    serde_json::from_str(&version_raw).map_err(|error| format!("Cannot parse version JSON {}: {error}", path.display()))
}

fn find_parent_version(version: &VersionJson, game_dir: &Path, storage_dir: &Path) -> Result<Option<VersionJson>, String> {
    let Some(parent_id) = &version.inherits_from else {
        return Ok(None);
    };

    let path = first_existing_path(&[
        game_dir.join("versions").join(parent_id).join(format!("{parent_id}.json")),
        storage_dir.join("versions").join(parent_id).join(format!("{parent_id}.json")),
    ])
    .ok_or_else(|| format!("Parent Minecraft version JSON {parent_id} was not found."))?;
    Ok(Some(read_version_json(&path)?))
}

fn find_client_jar(version_id: &str, game_dir: &Path, storage_dir: &Path) -> Option<PathBuf> {
    first_existing_path(&[
        game_dir.join("versions").join(version_id).join(format!("{version_id}.jar")),
        storage_dir.join("versions").join(version_id).join(format!("{version_id}.jar")),
    ])
}

fn first_existing_path(paths: &[PathBuf]) -> Option<PathBuf> {
    paths.iter().find(|path| path.exists()).cloned()
}

fn build_classpath(version: &VersionJson, parent: Option<&VersionJson>, client_jar: &Path, game_dir: &Path, storage_dir: &Path) -> Result<String, String> {
    let mut paths = Vec::new();
    let mut missing = Vec::new();
    let mut library_indexes = HashMap::new();

    if let Some(parent_version) = parent {
        collect_classpath_libraries(parent_version, game_dir, storage_dir, &mut paths, &mut library_indexes, &mut missing);
    }
    collect_classpath_libraries(version, game_dir, storage_dir, &mut paths, &mut library_indexes, &mut missing);

    if !missing.is_empty() {
        return Err(format!("Missing Minecraft libraries: {}", missing.into_iter().take(8).collect::<Vec<_>>().join(", ")));
    }

    paths.push(client_jar.to_path_buf());
    let separator = if cfg!(target_os = "windows") { ";" } else { ":" };
    Ok(paths
        .into_iter()
        .map(|path| path.to_string_lossy().to_string())
        .collect::<Vec<_>>()
        .join(separator))
}

fn collect_classpath_libraries(
    version: &VersionJson,
    game_dir: &Path,
    storage_dir: &Path,
    paths: &mut Vec<PathBuf>,
    library_indexes: &mut HashMap<String, usize>,
    missing: &mut Vec<String>,
) {
    for library in &version.libraries {
        if !rules_allow(library.rules.as_deref()) {
            continue;
        }

        if let Some((artifact_path, _url)) = library_artifact_path_url(library) {
            let library_key = library_identity(library, &artifact_path);
            let candidates = [
                game_dir.join("libraries").join(&artifact_path),
                storage_dir.join("libraries").join(&artifact_path),
            ];

            if let Some(path) = first_existing_path(&candidates) {
                if let Some(index) = library_indexes.get(&library_key).copied() {
                    paths[index] = path;
                } else if !paths.contains(&path) {
                    library_indexes.insert(library_key, paths.len());
                    paths.push(path);
                }
            } else {
                missing.push(artifact_path);
            }
        }
    }
}

fn library_identity(library: &Library, artifact_path: &str) -> String {
    if let Some(name) = &library.name {
        let parts = name.split(':').collect::<Vec<_>>();
        if parts.len() >= 2 {
            let classifier = parts.get(3).map(|value| format!(":{value}")).unwrap_or_default();
            return format!("{}:{}{}", parts[0], parts[1], classifier);
        }
    }

    let parts = artifact_path.split('/').collect::<Vec<_>>();
    if parts.len() >= 4 {
        let artifact_index = parts.len() - 3;
        let group = parts[..artifact_index].join(".");
        let artifact = parts[artifact_index];
        return format!("{group}:{artifact}");
    }

    artifact_path.to_string()
}

fn native_artifact(library: &Library) -> Option<&LibraryArtifact> {
    let native_key = library
        .natives
        .as_ref()
        .and_then(|natives| natives.get("windows"))
        .map(|value| value.replace("${arch}", "64"))?;

    library
        .downloads
        .as_ref()
        .and_then(|downloads| downloads.classifiers.as_ref())
        .and_then(|classifiers| classifiers.get(&native_key))
}

fn library_artifact_path_url(library: &Library) -> Option<(String, String)> {
    if let Some(artifact) = library.downloads.as_ref().and_then(|downloads| downloads.artifact.as_ref()) {
        if let Some(url) = &artifact.url {
            return Some((artifact.path.clone(), url.clone()));
        }
    }

    let name = library.name.as_ref()?;
    let path = maven_path_from_name(name)?;
    let base_url = library.url.as_deref().unwrap_or("");
    if base_url.trim().is_empty() {
        return None;
    }

    Some((path.clone(), format!("{}/{}", base_url.trim_end_matches('/'), path)))
}

fn maven_path_from_name(name: &str) -> Option<String> {
    let parts = name.split(':').collect::<Vec<_>>();
    if parts.len() < 3 {
        return None;
    }

    let group = parts[0].replace('.', "/");
    let artifact = parts[1];
    let version = parts[2];
    let classifier = parts.get(3).copied();
    let file = classifier
        .map(|classifier| format!("{artifact}-{version}-{classifier}.jar"))
        .unwrap_or_else(|| format!("{artifact}-{version}.jar"));

    Some(format!("{group}/{artifact}/{version}/{file}"))
}

fn extract_natives(version: &VersionJson, game_dir: &Path, storage_dir: &Path, natives_dir: &Path) -> Result<(), String> {
    for library in &version.libraries {
        if !rules_allow(library.rules.as_deref()) {
            continue;
        }

        let Some(artifact) = native_artifact(library) else {
            continue;
        };
        let Some(path) = first_existing_path(&[
            game_dir.join("libraries").join(&artifact.path),
            storage_dir.join("libraries").join(&artifact.path),
        ]) else {
            return Err(format!("Missing native library {}", artifact.path));
        };
        let file = fs::File::open(&path).map_err(|error| format!("Cannot open native jar {}: {error}", path.display()))?;
        let mut archive = ZipArchive::new(file).map_err(|error| format!("Cannot read native jar {}: {error}", path.display()))?;

        for index in 0..archive.len() {
            let mut entry = archive.by_index(index).map_err(|error| format!("Cannot read native jar entry: {error}"))?;
            let name = entry.name().replace('\\', "/");
            if entry.is_dir() || name.starts_with("META-INF/") {
                continue;
            }

            let Some(file_name) = Path::new(&name).file_name() else {
                continue;
            };
            let output_path = natives_dir.join(file_name);
            let mut output = fs::File::create(&output_path)
                .map_err(|error| format!("Cannot create native file {}: {error}", output_path.display()))?;
            io::copy(&mut entry, &mut output)
                .map_err(|error| format!("Cannot extract native file {}: {error}", output_path.display()))?;
        }
    }

    Ok(())
}

fn rules_allow(rules: Option<&[Rule]>) -> bool {
    let Some(rules) = rules else {
        return true;
    };
    let mut allowed = false;

    for rule in rules {
        let os_matches = rule.os.as_ref().and_then(|os| os.name.as_ref()).map(|name| name == "windows").unwrap_or(true);
        if os_matches {
            allowed = rule.action == "allow";
        }
    }

    allowed
}

fn minecraft_access_token(account: &Account) -> Result<String, String> {
    if account.r#type == "offline" {
        return Ok("0".to_string());
    }

    let raw = read_token_bundle(&account.id)?;
    let stored: Value = serde_json::from_str(&raw).map_err(|error| format!("Cannot parse stored token metadata: {error}"))?;
    stored
        .get("minecraftAccessToken")
        .and_then(|value| value.as_str())
        .map(ToString::to_string)
        .ok_or_else(|| "No Minecraft access token is stored for this account. Sign in again.".to_string())
}

fn read_token_bundle(account_id: &str) -> Result<String, String> {
    if let Ok(raw) = Entry::new(KEYRING_SERVICE, account_id)
        .map_err(|error| format!("Cannot access OS keyring: {error}"))
        .and_then(|entry| {
            entry
                .get_password()
                .map_err(|error| format!("Cannot read Minecraft token from OS keyring: {error}"))
        })
    {
        return Ok(raw);
    }

    fs::read_to_string(fallback_token_path(account_id)?)
        .map_err(|_| "Minecraft token is missing for this account. Remove the account and sign in again.".to_string())
}

fn fallback_token_path(account_id: &str) -> Result<PathBuf, String> {
    let base = std::env::var("APPDATA")
        .map(PathBuf::from)
        .or_else(|_| std::env::var("LOCALAPPDATA").map(PathBuf::from))
        .map_err(|_| "Cannot resolve AppData directory for token fallback storage.".to_string())?;
    let safe_id = account_id
        .chars()
        .filter(|character| character.is_ascii_alphanumeric() || *character == '-' || *character == '_')
        .collect::<String>();
    Ok(base.join("StellarLauncher").join("account-tokens").join(format!("{safe_id}.json")))
}

fn game_arguments(version: &VersionJson, parent: Option<&VersionJson>, replacements: &HashMap<String, String>) -> Vec<String> {
    if let Some(arguments) = &version.arguments {
        let mut args = Vec::new();
        for value in &arguments.game {
            collect_argument_value(value, replacements, &mut args);
        }
        if !args.is_empty() {
            return args;
        }
    }

    if version.minecraft_arguments.is_some() {
        return version
            .minecraft_arguments
            .as_deref()
            .map(split_args)
            .unwrap_or_default()
            .into_iter()
            .filter(|arg| !is_quick_play_argument(arg))
            .map(|arg| replace_placeholders(&arg, replacements))
            .collect();
    }

    if let Some(parent_version) = parent {
        return game_arguments(parent_version, None, replacements);
    }

    Vec::new()
}

fn collect_argument_value(value: &Value, replacements: &HashMap<String, String>, args: &mut Vec<String>) {
    if let Some(raw) = value.as_str() {
        if is_quick_play_argument(raw) {
            return;
        }
        args.push(replace_placeholders(raw, replacements));
        return;
    }

    let Some(object) = value.as_object() else {
        return;
    };

    if !object_rules_allow(object.get("rules")) {
        return;
    }

    match object.get("value") {
        Some(Value::String(raw)) => {
            if !is_quick_play_argument(raw) {
                args.push(replace_placeholders(raw, replacements));
            }
        }
        Some(Value::Array(values)) => {
            for item in values {
                collect_argument_value(item, replacements, args);
            }
        }
        _ => {}
    }
}

fn object_rules_allow(value: Option<&Value>) -> bool {
    let Some(Value::Array(rules)) = value else {
        return true;
    };
    let mut allowed = false;

    for rule in rules {
        let action = rule.get("action").and_then(|value| value.as_str()).unwrap_or("disallow");
        if rule.get("features").is_some() {
            continue;
        }
        let os_matches = rule
            .get("os")
            .and_then(|os| os.get("name"))
            .and_then(|name| name.as_str())
            .map(|name| name == "windows")
            .unwrap_or(true);

        if os_matches {
            allowed = action == "allow";
        }
    }

    allowed
}

fn replace_placeholders(value: &str, replacements: &HashMap<String, String>) -> String {
    replacements.iter().fold(value.to_string(), |current, (key, replacement)| {
        current.replace(&format!("${{{key}}}"), replacement)
    })
}

fn split_args(value: &str) -> Vec<String> {
    value.split_whitespace().map(ToString::to_string).collect()
}

fn is_quick_play_argument(value: &str) -> bool {
    value.contains("quickPlay") || value.starts_with("--quickPlay")
}
