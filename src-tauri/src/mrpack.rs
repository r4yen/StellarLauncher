use crate::{
    mods::emit_mod_progress,
    storage::{self, Instance},
};
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use sha1::{Digest, Sha1};
use sha2::Sha512;
use std::io::Write;
use std::{
    collections::{BTreeMap, HashSet},
    fs,
    io::Read,
    path::{Path, PathBuf},
};
use tauri::AppHandle;
use zip::ZipArchive;
use zip::{write::SimpleFileOptions, CompressionMethod, ZipWriter};

const INDEX_FILE: &str = "modrinth.index.json";
const MAX_INDEX_SIZE: u64 = 16 * 1024 * 1024;
const DOWNLOAD_HOSTS: &[&str] = &[
    "cdn.modrinth.com",
    "github.com",
    "raw.githubusercontent.com",
    "gitlab.com",
];

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PackIndex {
    format_version: u32,
    game: String,
    version_id: String,
    name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    summary: Option<String>,
    files: Vec<PackFile>,
    dependencies: BTreeMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PackFile {
    path: String,
    hashes: FileHashes,
    #[serde(skip_serializing_if = "Option::is_none")]
    env: Option<FileEnvironment>,
    downloads: Vec<String>,
    file_size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct FileHashes {
    sha1: String,
    sha512: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct FileEnvironment {
    client: EnvironmentSupport,
    server: EnvironmentSupport,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
enum EnvironmentSupport {
    Required,
    Optional,
    Unsupported,
}

impl PackFile {
    fn client_support(&self) -> EnvironmentSupport {
        self.env
            .as_ref()
            .map(|env| env.client)
            .unwrap_or(EnvironmentSupport::Required)
    }
}

fn safe_relative_path(raw: &str) -> Result<PathBuf, String> {
    // Check both separators on every host, including Windows drive/UNC/ADS paths.
    let normalized = raw.replace('\\', "/");
    if normalized.is_empty() || normalized.starts_with('/') || normalized.contains(':') {
        return Err(format!("Unsafe modpack path: {raw}"));
    }
    let mut path = PathBuf::new();
    for part in normalized.split('/') {
        if part.is_empty()
            || part == "."
            || part == ".."
            || part.ends_with('.')
            || part.ends_with(' ')
            || part
                .chars()
                .any(|c| c.is_control() || "<>\"|?*".contains(c))
        {
            return Err(format!("Unsafe modpack path: {raw}"));
        }
        let stem = part.split('.').next().unwrap_or("").to_ascii_uppercase();
        if matches!(stem.as_str(), "CON" | "PRN" | "AUX" | "NUL")
            || (stem.len() == 4
                && (stem.starts_with("COM") || stem.starts_with("LPT"))
                && matches!(stem.as_bytes()[3], b'1'..=b'9'))
        {
            return Err(format!("Unsupported modpack filename: {raw}"));
        }
        path.push(part);
    }
    Ok(path)
}

fn path_key(raw: &str) -> Result<String, String> {
    let safe = safe_relative_path(raw)?;
    let normalized = safe.to_string_lossy().replace('\\', "/");
    Ok(if cfg!(windows) {
        normalized.to_lowercase()
    } else {
        normalized
    })
}

fn validate_download_url(raw: &str) -> Result<reqwest::Url, String> {
    let url =
        reqwest::Url::parse(raw).map_err(|_| format!("Invalid modpack download URL: {raw}"))?;
    if url.scheme() != "https"
        || !url.username().is_empty()
        || url.password().is_some()
        || url.port().is_some_and(|port| port != 443)
        || !url
            .host_str()
            .is_some_and(|host| DOWNLOAD_HOSTS.contains(&host))
        || raw.chars().any(|c| c.is_whitespace() || c.is_control())
    {
        return Err(format!(
            "Modpack downloads must use HTTPS on a supported Modrinth download host: {raw}"
        ));
    }
    Ok(url)
}

fn game_and_loader(index: &PackIndex) -> Result<(String, String, String), String> {
    let minecraft = index
        .dependencies
        .get("minecraft")
        .filter(|version| !version.trim().is_empty())
        .ok_or("The modpack does not specify a Minecraft version.")?;
    let mut loader = ("vanilla".to_string(), String::new());
    for (id, version) in &index.dependencies {
        if version.trim().is_empty() {
            return Err(format!("The modpack dependency {id} has no version."));
        }
        if safe_relative_path(version)?.components().count() != 1 {
            return Err(format!("Invalid version for modpack dependency {id}."));
        }
        let kind = match id.as_str() {
            "minecraft" => continue,
            "fabric-loader" => "fabric",
            "quilt-loader" => "quilt",
            "forge" => "forge",
            "neoforge" => "neoforge",
            _ => {
                return Err(format!(
                    "This launcher does not support the modpack dependency '{id}'."
                ))
            }
        };
        if loader.0 != "vanilla" {
            return Err("The modpack specifies multiple mod loaders.".into());
        }
        loader = (kind.to_owned(), version.clone());
    }
    Ok((minecraft.clone(), loader.0, loader.1))
}

fn validate_index(index: &PackIndex) -> Result<(), String> {
    if index.format_version != 1 {
        return Err(format!(
            "Unsupported .mrpack format version: {}",
            index.format_version
        ));
    }
    if index.game != "minecraft" {
        return Err(format!("Unsupported modpack game: {}", index.game));
    }
    if index.name.trim().is_empty() || index.version_id.trim().is_empty() {
        return Err("The modpack must have a name and versionId.".into());
    }
    game_and_loader(index)?;
    let mut paths = HashSet::new();
    for file in &index.files {
        if !paths.insert(path_key(&file.path)?) {
            return Err(format!("Duplicate modpack file: {}", file.path));
        }
        for (hash, length) in [(&file.hashes.sha1, 40), (&file.hashes.sha512, 128)] {
            if hash.len() != length || !hash.bytes().all(|c| c.is_ascii_hexdigit()) {
                return Err(format!("Invalid file hash for {}", file.path));
            }
        }
        if file.downloads.is_empty() {
            return Err(format!("No download URL for {}", file.path));
        }
        for download in &file.downloads {
            validate_download_url(download)?;
        }
    }
    Ok(())
}

fn read_index(archive: &mut ZipArchive<fs::File>) -> Result<PackIndex, String> {
    let entry = archive
        .by_name(INDEX_FILE)
        .map_err(|_| "This archive has no modrinth.index.json at its root.".to_string())?;
    if entry.size() > MAX_INDEX_SIZE {
        return Err("The modpack index is too large.".into());
    }
    let mut raw = Vec::new();
    entry
        .take(MAX_INDEX_SIZE + 1)
        .read_to_end(&mut raw)
        .map_err(|error| format!("Cannot read modpack index: {error}"))?;
    if raw.len() as u64 > MAX_INDEX_SIZE {
        return Err("The modpack index is too large.".into());
    }
    let index: PackIndex = serde_json::from_slice(&raw)
        .map_err(|error| format!("Invalid modrinth.index.json: {error}"))?;
    validate_index(&index)?;
    Ok(index)
}

fn open_pack(path: &Path) -> Result<ZipArchive<fs::File>, String> {
    if !path
        .extension()
        .is_some_and(|extension| extension.eq_ignore_ascii_case("mrpack"))
    {
        return Err("Select a .mrpack file.".into());
    }
    let file = fs::File::open(path).map_err(|error| format!("Cannot open modpack: {error}"))?;
    ZipArchive::new(file).map_err(|error| format!("Invalid .mrpack ZIP archive: {error}"))
}

fn verify_file(path: &Path, expected: &PackFile) -> Result<(), String> {
    let mut file = fs::File::open(path)
        .map_err(|error| format!("Cannot verify {}: {error}", expected.path))?;
    let mut sha1 = Sha1::new();
    let mut sha512 = Sha512::new();
    let mut size = 0_u64;
    let mut buffer = [0_u8; 65536];
    loop {
        let count = file
            .read(&mut buffer)
            .map_err(|error| format!("Cannot hash {}: {error}", expected.path))?;
        if count == 0 {
            break;
        }
        size += count as u64;
        sha1.update(&buffer[..count]);
        sha512.update(&buffer[..count]);
    }
    if size != expected.file_size
        || !format!("{:x}", sha1.finalize()).eq_ignore_ascii_case(&expected.hashes.sha1)
        || !format!("{:x}", sha512.finalize()).eq_ignore_ascii_case(&expected.hashes.sha512)
    {
        return Err(format!(
            "Size or SHA-1/SHA-512 verification failed for {}",
            expected.path
        ));
    }
    Ok(())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PackPreview {
    name: String,
    version_id: String,
    summary: Option<String>,
    minecraft_version: String,
    loader_type: String,
    loader_version: String,
    optional_files: Vec<String>,
}

fn validate_archive(archive: &mut ZipArchive<fs::File>) -> Result<(), String> {
    let mut entries = HashSet::new();
    for n in 0..archive.len() {
        let entry = archive
            .by_index(n)
            .map_err(|error| format!("Cannot read archive entry: {error}"))?;
        let name = entry.name().replace('\\', "/");
        if name == INDEX_FILE {
            if !entries.insert(name) {
                return Err("The archive contains duplicate modpack indexes.".into());
            }
            continue;
        }
        for prefix in ["overrides/", "client-overrides/", "server-overrides/"] {
            if let Some(relative) = name.strip_prefix(prefix) {
                if relative.is_empty() && entry.is_dir() {
                    break;
                }
                let relative = if entry.is_dir() {
                    relative.trim_end_matches('/')
                } else {
                    relative
                };
                let key = format!("{prefix}{}", path_key(relative)?);
                if !entries.insert(key) {
                    return Err(format!("Duplicate archive entry: {name}"));
                }
                if entry
                    .unix_mode()
                    .is_some_and(|mode| mode & 0o170000 == 0o120000)
                {
                    return Err(format!(
                        "Symbolic links are not supported in modpacks: {name}"
                    ));
                }
                break;
            }
        }
    }
    Ok(())
}

fn extract_client_overrides(
    archive: &mut ZipArchive<fs::File>,
    destination: &Path,
) -> Result<(), String> {
    // The order is specified by mrpack: common files, followed by client overrides.
    for prefix in ["overrides/", "client-overrides/"] {
        for n in 0..archive.len() {
            let mut entry = archive
                .by_index(n)
                .map_err(|error| format!("Cannot read archive entry: {error}"))?;
            if entry.is_dir() {
                continue;
            }
            let name = entry.name().replace('\\', "/");
            let Some(relative) = name.strip_prefix(prefix) else {
                continue;
            };
            let target = destination.join(safe_relative_path(relative)?);
            fs::create_dir_all(target.parent().ok_or("Invalid override path.")?)
                .map_err(|error| format!("Cannot create override directory: {error}"))?;
            let mut output = fs::File::create(&target)
                .map_err(|error| format!("Cannot create {relative}: {error}"))?;
            std::io::copy(&mut entry, &mut output)
                .map_err(|error| format!("Cannot extract {relative}: {error}"))?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn inspect_mrpack(path: String) -> Result<PackPreview, String> {
    let mut archive = open_pack(Path::new(&path))?;
    let index = read_index(&mut archive)?;
    validate_archive(&mut archive)?;
    let (minecraft_version, loader_type, loader_version) = game_and_loader(&index)?;
    Ok(PackPreview {
        name: index.name,
        version_id: index.version_id,
        summary: index.summary,
        minecraft_version,
        loader_type,
        loader_version,
        optional_files: index
            .files
            .iter()
            .filter(|file| file.client_support() == EnvironmentSupport::Optional)
            .map(|file| file.path.clone())
            .collect(),
    })
}

fn selected_files<'a>(
    index: &'a PackIndex,
    optional: &[String],
) -> Result<Vec<&'a PackFile>, String> {
    let optional: HashSet<_> = optional.iter().collect();
    for path in &optional {
        if !index.files.iter().any(|file| {
            &file.path == *path && file.client_support() == EnvironmentSupport::Optional
        }) {
            return Err(format!(
                "The selected optional file is not in this pack: {path}"
            ));
        }
    }
    Ok(index
        .files
        .iter()
        .filter(|file| match file.client_support() {
            EnvironmentSupport::Required => true,
            EnvironmentSupport::Optional => optional.contains(&file.path),
            EnvironmentSupport::Unsupported => false,
        })
        .collect())
}

fn http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .user_agent(concat!(
            "r4yen/StellarLauncher/",
            env!("CARGO_PKG_VERSION"),
            " (https://github.com/r4yen/StellarLauncher)"
        ))
        .https_only(true)
        .redirect(reqwest::redirect::Policy::limited(5))
        .connect_timeout(std::time::Duration::from_secs(30))
        .timeout(std::time::Duration::from_secs(600))
        .build()
        .map_err(|error| format!("Cannot create modpack download client: {error}"))
}

async fn download_file(
    client: &reqwest::Client,
    file: &PackFile,
    destination: &Path,
    progress: impl Fn(u64),
) -> Result<(), String> {
    let target = destination.join(safe_relative_path(&file.path)?);
    fs::create_dir_all(target.parent().ok_or("Invalid download path.")?)
        .map_err(|error| format!("Cannot create download directory: {error}"))?;
    let mut errors = Vec::new();
    for url in &file.downloads {
        let result = async {
            let response = client
                .get(validate_download_url(url)?)
                .send()
                .await
                .map_err(|error| format!("Download failed: {error}"))?
                .error_for_status()
                .map_err(|error| format!("Download failed: {error}"))?;
            let mut output = fs::File::create(&target)
                .map_err(|error| format!("Cannot create {}: {error}", file.path))?;
            let mut stream = response.bytes_stream();
            let mut received = 0_u64;
            while let Some(chunk) = stream.next().await {
                let chunk = chunk.map_err(|error| format!("Download interrupted: {error}"))?;
                received = received
                    .checked_add(chunk.len() as u64)
                    .ok_or("Download size overflow.")?;
                if received > file.file_size {
                    return Err("Download exceeds the file size declared in the modpack.".into());
                }
                output
                    .write_all(&chunk)
                    .map_err(|error| format!("Cannot write {}: {error}", file.path))?;
                progress(received);
            }
            output
                .flush()
                .map_err(|error| format!("Cannot finish {}: {error}", file.path))?;
            drop(output);
            verify_file(&target, file)
        }
        .await;
        match result {
            Ok(()) => return Ok(()),
            Err(error) => {
                errors.push(error);
                progress(0);
            }
        }
    }
    Err(format!(
        "Could not install {}: {}",
        file.path,
        errors.join("; ")
    ))
}

pub(super) fn create_pack_directory(base: &Path, name: &str) -> Result<PathBuf, String> {
    let stem: String = name
        .trim()
        .chars()
        .take(60)
        .map(|c| {
            if c.is_control() || "<>:\"/\\|?*".contains(c) {
                '-'
            } else {
                c
            }
        })
        .collect();
    let stem = stem.trim_end_matches(['.', ' ']);
    let stem = if safe_relative_path(stem).is_ok() {
        stem.to_owned()
    } else {
        "Modpack".to_owned()
    };
    for suffix in 0..10000 {
        let name = if suffix == 0 {
            stem.clone()
        } else {
            format!("{stem} ({suffix})")
        };
        let target = base.join(name);
        match fs::create_dir(&target) {
            Ok(()) => return Ok(target),
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(error) => return Err(format!("Cannot create modpack directory: {error}")),
        }
    }
    Err("Cannot find an unused modpack folder name.".into())
}

fn remove_created_directory(base: &Path, directory: &Path) {
    // Only remove a directory created exclusively for this import, directly below its base.
    if directory.parent() == Some(base)
        && fs::symlink_metadata(directory).is_ok_and(|metadata| !metadata.file_type().is_symlink())
    {
        let _ = fs::remove_dir_all(directory);
    }
}

#[tauri::command]
pub async fn import_mrpack(
    app: AppHandle,
    path: String,
    optional_files: Vec<String>,
    operation_id: String,
) -> Result<Vec<Instance>, String> {
    crate::operations::run(operation_id.clone(), import_mrpack_inner(app, path, optional_files, operation_id)).await
}

async fn import_mrpack_inner(app: AppHandle, path: String, optional_files: Vec<String>, operation_id: String) -> Result<Vec<Instance>, String> {
    let mut archive = open_pack(Path::new(&path))?;
    let index = read_index(&mut archive)?;
    validate_archive(&mut archive)?;
    let files = selected_files(&index, &optional_files)?;
    let settings = storage::load_settings(app.clone())?;
    let base = storage::expand_path(settings.game_directory.trim())?;
    if !base.is_absolute() {
        return Err("Set an absolute Game Directory in Settings before importing a pack.".into());
    }
    fs::create_dir_all(&base).map_err(|error| format!("Cannot create game directory: {error}"))?;
    let base = fs::canonicalize(base)
        .map_err(|error| format!("Cannot resolve game directory: {error}"))?;
    let staging = tempfile::Builder::new()
        .prefix(".mrpack-import-")
        .tempdir_in(&base)
        .map_err(|error| format!("Cannot prepare modpack import: {error}"))?;
    let total = files.iter().try_fold(0_u64, |sum, file| {
        sum.checked_add(file.file_size)
            .ok_or("Modpack size overflow.")
    })?;
    let client = http_client()?;
    let mut completed = 0_u64;
    for file in files {
        emit_mod_progress(
            &app,
            &operation_id,
            "downloading",
            completed,
            Some(total),
            &file.path,
            &base,
        );
        download_file(&client, file, staging.path(), |received| {
            emit_mod_progress(
                &app,
                &operation_id,
                "downloading",
                completed + received,
                Some(total),
                &file.path,
                &base,
            );
        })
        .await?;
        completed += file.file_size;
    }
    emit_mod_progress(
        &app,
        &operation_id,
        "downloading",
        completed,
        Some(total),
        "Extracting modpack files",
        &base,
    );
    extract_client_overrides(&mut archive, staging.path())?;
    let target = create_pack_directory(&base, &index.name)?;
    let result = (|| {
        for entry in fs::read_dir(staging.path()).map_err(|error| error.to_string())? {
            let entry = entry.map_err(|error| error.to_string())?;
            fs::rename(entry.path(), target.join(entry.file_name()))
                .map_err(|error| format!("Cannot finish modpack import: {error}"))?;
        }
        let (minecraft_version, loader_type, loader_version) = game_and_loader(&index)?;
        let instance = Instance {
            id: format!("mrpack-{}", uuid::Uuid::new_v4()),
            name: index.name.clone(),
            minecraft_version,
            loader_type,
            loader_version,
            game_directory: display_path(&target),
            java_path: String::new(),
            ram_mb: settings.default_ram_mb,
            jvm_args: settings.jvm_args,
            created_at: chrono::Utc::now().to_rfc3339(),
            last_played_at: None,
            playtime_seconds: Some(0),
            status: "ready".into(),
            icon: "/default-instance-block.svg".into(),
            is_favorite: Some(false),
            order: Some(0),
            notes: index.summary,
        };
        let mut instances = storage::load_instances(app.clone())?;
        instances.sort_by_key(|instance| instance.order.unwrap_or(u32::MAX));
        for (n, instance) in instances.iter_mut().enumerate() {
            instance.order = Some(n as u32 + 1);
        }
        instances.insert(0, instance);
        let config_dir = storage::app_data_dir(&app)?;
        let mut config = tempfile::NamedTempFile::new_in(&config_dir)
            .map_err(|error| format!("Cannot prepare instance storage: {error}"))?;
        serde_json::to_writer_pretty(&mut config, &instances)
            .map_err(|error| format!("Cannot save imported instance: {error}"))?;
        config
            .as_file()
            .sync_all()
            .map_err(|error| format!("Cannot save imported instance: {error}"))?;
        config
            .persist(config_dir.join("instances.json"))
            .map_err(|error| format!("Cannot save imported instance: {error}"))?;
        Ok(instances)
    })();
    if result.is_err() {
        remove_created_directory(&base, &target);
    } else {
        emit_mod_progress(
            &app,
            &operation_id,
            "completed",
            total,
            Some(total),
            "Modpack imported",
            &target,
        );
    }
    result
}

fn display_path(path: &Path) -> String {
    let raw = path.to_string_lossy();
    if cfg!(windows) {
        if let Some(unc) = raw.strip_prefix("\\\\?\\UNC\\") {
            return format!("\\\\{unc}");
        }
        if let Some(local) = raw.strip_prefix("\\\\?\\") {
            return local.to_owned();
        }
    }
    raw.into_owned()
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportEntry {
    path: String,
    is_directory: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportOptions {
    name: String,
    version_id: String,
    summary: String,
    included_paths: Vec<String>,
}

#[derive(Deserialize)]
struct ApiVersion {
    project_id: String,
    files: Vec<ApiFile>,
}

#[derive(Deserialize)]
struct ApiFile {
    url: String,
    hashes: FileHashes,
    size: u64,
}

#[derive(Deserialize)]
struct ApiProject {
    id: String,
    client_side: Option<String>,
    server_side: Option<String>,
}

fn environment_support(value: &str) -> Option<EnvironmentSupport> {
    match value {
        "required" => Some(EnvironmentSupport::Required),
        "optional" => Some(EnvironmentSupport::Optional),
        "unsupported" => Some(EnvironmentSupport::Unsupported),
        _ => None,
    }
}

#[tauri::command]
pub fn list_mrpack_export_entries(game_directory: String) -> Result<Vec<ExportEntry>, String> {
    let root = storage::expand_path(game_directory.trim())?;
    if !root.is_absolute() {
        return Err("The instance needs an absolute game directory.".into());
    }
    if !root.exists() {
        return Ok(Vec::new());
    }
    let mut entries = Vec::new();
    for entry in
        fs::read_dir(root).map_err(|error| format!("Cannot read instance files: {error}"))?
    {
        let entry = entry.map_err(|error| format!("Cannot read instance file: {error}"))?;
        let kind = entry.file_type().map_err(|error| error.to_string())?;
        if kind.is_symlink() || (!kind.is_dir() && !kind.is_file()) {
            continue;
        }
        let path = entry.file_name().to_string_lossy().into_owned();
        if safe_relative_path(&path).is_err() {
            continue;
        }
        entries.push(ExportEntry {
            path,
            is_directory: kind.is_dir(),
        });
    }
    entries.sort_by(|left, right| {
        right
            .is_directory
            .cmp(&left.is_directory)
            .then_with(|| left.path.cmp(&right.path))
    });
    Ok(entries)
}

fn gather_export_files(
    root: &Path,
    relative: &Path,
    files: &mut BTreeMap<String, PathBuf>,
) -> Result<(), String> {
    let path = root.join(relative);
    let metadata = fs::symlink_metadata(&path)
        .map_err(|error| format!("Cannot read {}: {error}", relative.display()))?;
    if metadata.file_type().is_symlink() {
        return Err(format!(
            "Cannot export symbolic link {}",
            relative.display()
        ));
    }
    let resolved = fs::canonicalize(&path)
        .map_err(|error| format!("Cannot resolve {}: {error}", relative.display()))?;
    if !resolved.starts_with(root) {
        return Err(format!(
            "Export path leaves the instance directory: {}",
            relative.display()
        ));
    }
    if metadata.is_dir() {
        for entry in fs::read_dir(&path).map_err(|error| error.to_string())? {
            let entry = entry.map_err(|error| error.to_string())?;
            gather_export_files(root, &relative.join(entry.file_name()), files)?;
        }
    } else if metadata.is_file() {
        let name = relative
            .to_str()
            .ok_or("Modpack filenames must use UTF-8.")?
            .replace('\\', "/");
        safe_relative_path(&name)?;
        files.insert(name, resolved);
    }
    Ok(())
}

fn hash_export_file(path: &Path) -> Result<(FileHashes, u64), String> {
    let mut input =
        fs::File::open(path).map_err(|error| format!("Cannot read {}: {error}", path.display()))?;
    let mut sha1 = Sha1::new();
    let mut sha512 = Sha512::new();
    let mut size = 0_u64;
    let mut buffer = [0_u8; 65536];
    loop {
        let count = input
            .read(&mut buffer)
            .map_err(|error| format!("Cannot hash {}: {error}", path.display()))?;
        if count == 0 {
            break;
        }
        size += count as u64;
        sha1.update(&buffer[..count]);
        sha512.update(&buffer[..count]);
    }
    Ok((
        FileHashes {
            sha1: format!("{:x}", sha1.finalize()),
            sha512: format!("{:x}", sha512.finalize()),
        },
        size,
    ))
}

fn dependencies_for_instance(instance: &Instance) -> Result<BTreeMap<String, String>, String> {
    if instance.minecraft_version.trim().is_empty() {
        return Err("The instance has no Minecraft version.".into());
    }
    let mut dependencies =
        BTreeMap::from([("minecraft".into(), instance.minecraft_version.clone())]);
    let loader_key = match instance.loader_type.as_str() {
        "vanilla" => None,
        "fabric" => Some("fabric-loader"),
        "quilt" => Some("quilt-loader"),
        "forge" => Some("forge"),
        "neoforge" => Some("neoforge"),
        loader => return Err(format!("Cannot export unsupported mod loader: {loader}")),
    };
    if let Some(key) = loader_key {
        if instance.loader_version.trim().is_empty() {
            return Err("Select a mod loader version before exporting.".into());
        }
        dependencies.insert(key.into(), instance.loader_version.clone());
    }
    Ok(dependencies)
}

fn write_pack(
    destination: &Path,
    index: &PackIndex,
    overrides: &BTreeMap<String, PathBuf>,
) -> Result<(), String> {
    validate_index(index)?;
    let parent = destination.parent().ok_or("Invalid export destination.")?;
    let mut output = tempfile::NamedTempFile::new_in(parent)
        .map_err(|error| format!("Cannot prepare modpack export: {error}"))?;
    {
        let mut archive = ZipWriter::new(output.as_file_mut());
        let options = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);
        archive
            .start_file(INDEX_FILE, options)
            .map_err(|error| error.to_string())?;
        serde_json::to_writer_pretty(&mut archive, index)
            .map_err(|error| format!("Cannot write modpack index: {error}"))?;
        for (relative, source) in overrides {
            safe_relative_path(relative)?;
            archive
                .start_file(format!("overrides/{relative}"), options)
                .map_err(|error| error.to_string())?;
            let mut input = fs::File::open(source)
                .map_err(|error| format!("Cannot read {relative}: {error}"))?;
            std::io::copy(&mut input, &mut archive)
                .map_err(|error| format!("Cannot pack {relative}: {error}"))?;
        }
        archive
            .finish()
            .map_err(|error| format!("Cannot finish modpack ZIP: {error}"))?;
    }
    output
        .as_file()
        .sync_all()
        .map_err(|error| format!("Cannot save modpack: {error}"))?;
    output
        .persist(destination)
        .map_err(|error| format!("Cannot save modpack: {error}"))?;
    Ok(())
}

#[tauri::command]
pub async fn export_mrpack(
    path: String,
    instance: Instance,
    options: ExportOptions,
) -> Result<String, String> {
    if options.name.trim().is_empty() || options.version_id.trim().is_empty() {
        return Err("Enter a modpack name and version.".into());
    }
    let mut destination = PathBuf::from(path);
    if !destination.is_absolute() {
        return Err("Choose an absolute export destination.".into());
    }
    if !destination
        .extension()
        .is_some_and(|extension| extension.eq_ignore_ascii_case("mrpack"))
    {
        destination.set_extension("mrpack");
    }
    let root = storage::expand_path(instance.game_directory.trim())?;
    if !root.is_absolute() {
        return Err("The instance needs an absolute game directory.".into());
    }
    let mut local_files = BTreeMap::new();
    if !options.included_paths.is_empty() {
        let root = fs::canonicalize(root)
            .map_err(|error| format!("Cannot open the instance directory: {error}"))?;
        for relative in &options.included_paths {
            gather_export_files(&root, &safe_relative_path(relative)?, &mut local_files)?;
        }
    }
    // Never include the old export archive itself when replacing it inside a selected folder.
    if let Ok(existing_destination) = fs::canonicalize(&destination) {
        local_files.retain(|_, source| source != &existing_destination);
    }
    let mut content_files = BTreeMap::new();
    for (relative, path) in &local_files {
        if ["mods/", "resourcepacks/", "shaderpacks/", "datapacks/"]
            .iter()
            .any(|prefix| relative.starts_with(prefix))
        {
            let (hashes, size) = hash_export_file(path)?;
            content_files.insert(relative.clone(), (hashes, size));
        }
    }
    let client = http_client()?;
    let hashes: Vec<_> = content_files
        .values()
        .map(|(hashes, _)| hashes.sha512.clone())
        .collect();
    let mut versions = BTreeMap::<String, ApiVersion>::new();
    for chunk in hashes.chunks(100) {
        let response = client
            .post("https://api.modrinth.com/v2/version_files")
            .json(&serde_json::json!({ "hashes": chunk, "algorithm": "sha512" }))
            .send()
            .await
            .map_err(|error| format!("Cannot look up Modrinth files: {error}"))?
            .error_for_status()
            .map_err(|error| format!("Cannot look up Modrinth files: {error}"))?
            .json::<BTreeMap<String, ApiVersion>>()
            .await
            .map_err(|error| format!("Invalid Modrinth file response: {error}"))?;
        versions.extend(response);
    }
    let project_ids: Vec<_> = versions
        .values()
        .map(|version| version.project_id.clone())
        .collect::<HashSet<_>>()
        .into_iter()
        .collect();
    let mut projects = BTreeMap::new();
    for chunk in project_ids.chunks(100) {
        let ids = serde_json::to_string(chunk).map_err(|error| error.to_string())?;
        let response = client
            .get("https://api.modrinth.com/v2/projects")
            .query(&[("ids", ids)])
            .send()
            .await
            .map_err(|error| format!("Cannot look up mod environments: {error}"))?
            .error_for_status()
            .map_err(|error| format!("Cannot look up mod environments: {error}"))?
            .json::<Vec<ApiProject>>()
            .await
            .map_err(|error| format!("Invalid Modrinth project response: {error}"))?;
        for project in response {
            projects.insert(project.id.clone(), project);
        }
    }
    let mut index = PackIndex {
        format_version: 1,
        game: "minecraft".into(),
        version_id: options.version_id.trim().into(),
        name: options.name.trim().into(),
        summary: (!options.summary.trim().is_empty()).then(|| options.summary.trim().to_owned()),
        files: Vec::new(),
        dependencies: dependencies_for_instance(&instance)?,
    };
    for (relative, (hashes, size)) in content_files {
        let Some(version) = versions.get(&hashes.sha512) else {
            continue;
        };
        // Match the actual file, not the version's primary JAR (versions may contain multiple files).
        let Some(file) = version.files.iter().find(|file| {
            file.hashes.sha512.eq_ignore_ascii_case(&hashes.sha512)
                && file.hashes.sha1.eq_ignore_ascii_case(&hashes.sha1)
                && file.size == size
        }) else {
            continue;
        };
        validate_download_url(&file.url)?;
        let env = projects.get(&version.project_id).and_then(|project| {
            Some(FileEnvironment {
                client: environment_support(project.client_side.as_deref()?)?,
                server: environment_support(project.server_side.as_deref()?)?,
            })
        });
        index.files.push(PackFile {
            path: relative.clone(),
            hashes,
            env,
            downloads: vec![file.url.clone()],
            file_size: size,
        });
        local_files.remove(&relative);
    }
    write_pack(&destination, &index, &local_files)?;
    Ok(display_path(&destination))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn index() -> PackIndex {
        PackIndex {
            format_version: 1,
            game: "minecraft".into(),
            version_id: "1.0.0".into(),
            name: "Test pack".into(),
            summary: Some("Test summary".into()),
            files: vec![],
            dependencies: BTreeMap::from([("minecraft".into(), "1.21.1".into())]),
        }
    }

    fn pack_file(path: &str, content: &[u8], support: EnvironmentSupport) -> PackFile {
        PackFile {
            path: path.into(),
            file_size: content.len() as u64,
            hashes: FileHashes {
                sha1: format!("{:x}", Sha1::digest(content)),
                sha512: format!("{:x}", Sha512::digest(content)),
            },
            downloads: vec!["https://cdn.modrinth.com/data/test/test.jar".into()],
            env: Some(FileEnvironment {
                client: support,
                server: EnvironmentSupport::Required,
            }),
        }
    }

    fn archive(path: &Path, files: &[(&str, &[u8])]) {
        let mut writer = ZipWriter::new(fs::File::create(path).unwrap());
        let options = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);
        writer.start_file(INDEX_FILE, options).unwrap();
        serde_json::to_writer(&mut writer, &index()).unwrap();
        for (name, bytes) in files {
            writer.start_file(*name, options).unwrap();
            writer.write_all(bytes).unwrap();
        }
        writer.finish().unwrap();
    }

    #[test]
    fn recognizes_all_documented_loader_dependencies() {
        for (id, loader) in [
            ("fabric-loader", "fabric"),
            ("quilt-loader", "quilt"),
            ("forge", "forge"),
            ("neoforge", "neoforge"),
        ] {
            let mut pack = index();
            pack.dependencies.insert(id.into(), "test-version".into());
            assert_eq!(
                game_and_loader(&pack).unwrap(),
                ("1.21.1".into(), loader.into(), "test-version".into())
            );
        }
        assert_eq!(game_and_loader(&index()).unwrap().1, "vanilla");
    }

    #[test]
    fn rejects_unknown_dependencies_versions_and_conflicting_loaders() {
        let mut pack = index();
        pack.dependencies.insert("future-loader".into(), "1".into());
        assert!(validate_index(&pack).unwrap_err().contains("future-loader"));
        let mut pack = index();
        pack.dependencies.insert("forge".into(), "1".into());
        pack.dependencies.insert("fabric-loader".into(), "1".into());
        assert!(validate_index(&pack).is_err());
        let mut pack = index();
        pack.format_version = 2;
        assert!(validate_index(&pack).is_err());
        let mut pack = index();
        pack.dependencies.clear();
        assert!(validate_index(&pack).is_err());
        let mut pack = index();
        pack.dependencies
            .insert("minecraft".into(), "../outside".into());
        assert!(validate_index(&pack).is_err());
    }

    #[test]
    fn client_selection_skips_server_only_and_respects_optional_files() {
        let mut pack = index();
        pack.files = vec![
            pack_file("mods/required.jar", b"a", EnvironmentSupport::Required),
            pack_file("mods/optional.jar", b"b", EnvironmentSupport::Optional),
            pack_file("mods/server.jar", b"c", EnvironmentSupport::Unsupported),
        ];
        assert_eq!(selected_files(&pack, &[]).unwrap().len(), 1);
        let selected = selected_files(&pack, &["mods/optional.jar".into()]).unwrap();
        assert_eq!(selected.len(), 2);
        assert!(selected.iter().all(|file| file.path != "mods/server.jar"));
        assert!(selected_files(&pack, &["mods/not-in-pack.jar".into()]).is_err());
        pack.files[0].env = None;
        assert_eq!(pack.files[0].client_support(), EnvironmentSupport::Required);
    }

    #[test]
    fn rejects_path_traversal_absolute_paths_and_windows_aliases() {
        for path in [
            "../outside",
            "config/../../outside",
            "/outside",
            "\\outside",
            "C:/outside",
            "C:\\outside",
            "mods/a.jar:stream",
            "mods/..\\outside",
            "mods/NUL.txt",
            "mods/a.",
            "mods/a ",
            "mods//a",
        ] {
            assert!(safe_relative_path(path).is_err(), "{path}");
        }
        assert_eq!(
            safe_relative_path("config\\nested\\test.json").unwrap(),
            PathBuf::from("config").join("nested").join("test.json")
        );
    }

    #[test]
    fn download_urls_require_https_and_documented_hosts() {
        for url in [
            "http://cdn.modrinth.com/file",
            "https://evil.example/file",
            "https://cdn.modrinth.com.evil.example/file",
            "https://user@github.com/file",
            "https://github.com/file with spaces",
            "https://github.com:444/file",
        ] {
            assert!(validate_download_url(url).is_err(), "{url}");
        }
        for host in DOWNLOAD_HOSTS {
            assert!(validate_download_url(&format!("https://{host}/file")).is_ok());
        }
    }

    #[test]
    fn verifies_both_hashes_and_size() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().join("file.jar");
        fs::write(&path, b"example").unwrap();
        let mut expected = pack_file("mods/file.jar", b"example", EnvironmentSupport::Required);
        verify_file(&path, &expected).unwrap();
        expected.hashes.sha512 = "0".repeat(128);
        assert!(verify_file(&path, &expected).is_err());
        expected = pack_file("mods/file.jar", b"example", EnvironmentSupport::Required);
        expected.hashes.sha1 = "0".repeat(40);
        assert!(verify_file(&path, &expected).is_err());
        expected = pack_file("mods/file.jar", b"example", EnvironmentSupport::Required);
        expected.file_size += 1;
        assert!(verify_file(&path, &expected).is_err());
    }

    #[test]
    fn applies_client_overrides_after_common_files_and_ignores_server_overrides() {
        let temp = tempfile::tempdir().unwrap();
        let pack = temp.path().join("test.mrpack");
        archive(
            &pack,
            &[
                ("client-overrides/config/test.txt", b"client"),
                ("server-overrides/config/test.txt", b"server"),
                ("server-overrides/server-only.txt", b"server"),
                ("overrides/config/test.txt", b"common"),
                ("overrides/options.txt", b"options"),
            ],
        );
        let mut archive = open_pack(&pack).unwrap();
        validate_archive(&mut archive).unwrap();
        let destination = temp.path().join("destination");
        fs::create_dir(&destination).unwrap();
        extract_client_overrides(&mut archive, &destination).unwrap();
        assert_eq!(
            fs::read(destination.join("config/test.txt")).unwrap(),
            b"client"
        );
        assert_eq!(
            fs::read(destination.join("options.txt")).unwrap(),
            b"options"
        );
        assert!(!destination.join("server-only.txt").exists());
    }

    #[test]
    fn rejects_malicious_zip_entries_before_extracting() {
        let temp = tempfile::tempdir().unwrap();
        let pack = temp.path().join("bad.mrpack");
        archive(&pack, &[("overrides/../../outside.txt", b"unsafe")]);
        assert!(validate_archive(&mut open_pack(&pack).unwrap()).is_err());
        let mut writer = ZipWriter::new(fs::File::create(&pack).unwrap());
        writer
            .add_symlink(
                "overrides/config/link",
                "../../outside",
                SimpleFileOptions::default(),
            )
            .unwrap();
        writer.finish().unwrap();
        assert!(validate_archive(&mut open_pack(&pack).unwrap()).is_err());
    }

    #[test]
    fn duplicate_manifest_paths_are_rejected() {
        let mut pack = index();
        pack.files.push(pack_file(
            "mods/test.jar",
            b"a",
            EnvironmentSupport::Required,
        ));
        pack.files.push(pack_file(
            "mods\\test.jar",
            b"a",
            EnvironmentSupport::Required,
        ));
        assert!(validate_index(&pack).is_err());
    }

    #[test]
    fn repeated_imports_create_separate_folders_without_overwriting() {
        let temp = tempfile::tempdir().unwrap();
        let first = create_pack_directory(temp.path(), "My Pack").unwrap();
        fs::write(first.join("world.dat"), b"keep").unwrap();
        let second = create_pack_directory(temp.path(), "My Pack").unwrap();
        assert_ne!(first, second);
        assert_eq!(first.parent(), second.parent());
        assert_eq!(fs::read(first.join("world.dat")).unwrap(), b"keep");
    }

    #[test]
    fn exported_pack_round_trips_without_stellar_metadata() {
        let temp = tempfile::tempdir().unwrap();
        let source = temp.path().join("options.txt");
        fs::write(&source, b"test options").unwrap();
        let output = temp.path().join("export.mrpack");
        let mut expected = index();
        expected.files.push(pack_file(
            "mods/reference.jar",
            b"download",
            EnvironmentSupport::Required,
        ));
        write_pack(
            &output,
            &expected,
            &BTreeMap::from([("options.txt".into(), source)]),
        )
        .unwrap();
        let mut zip = open_pack(&output).unwrap();
        let result = read_index(&mut zip).unwrap();
        validate_archive(&mut zip).unwrap();
        assert_eq!(result.name, expected.name);
        assert_eq!(result.files[0].path, "mods/reference.jar");
        assert!(zip.by_name("instance.json").is_err());
        let mut raw = String::new();
        zip.by_name(INDEX_FILE)
            .unwrap()
            .read_to_string(&mut raw)
            .unwrap();
        assert!(!raw.contains("gameDirectory"));
        assert!(!raw.contains("javaPath"));
        let destination = temp.path().join("import");
        fs::create_dir(&destination).unwrap();
        extract_client_overrides(&mut zip, &destination).unwrap();
        assert_eq!(
            fs::read(destination.join("options.txt")).unwrap(),
            b"test options"
        );
    }

    #[test]
    fn failed_export_does_not_replace_an_existing_archive() {
        let temp = tempfile::tempdir().unwrap();
        let output = temp.path().join("export.mrpack");
        fs::write(&output, b"existing archive").unwrap();
        assert!(write_pack(
            &output,
            &index(),
            &BTreeMap::from([("config/missing.txt".into(), temp.path().join("missing"))])
        )
        .is_err());
        assert_eq!(fs::read(output).unwrap(), b"existing archive");
    }

    #[test]
    #[ignore = "requires MRPACK_SMOKE_PATH and an Internet connection"]
    fn real_modrinth_pack_and_download_smoke() {
        let path = std::env::var("MRPACK_SMOKE_PATH")
            .expect("Set MRPACK_SMOKE_PATH to a downloaded .mrpack");
        let mut archive = open_pack(Path::new(&path)).unwrap();
        let index = read_index(&mut archive).unwrap();
        validate_archive(&mut archive).unwrap();
        let temp = tempfile::tempdir().unwrap();
        let file = index
            .files
            .iter()
            .filter(|file| {
                file.client_support() != EnvironmentSupport::Unsupported
                    && file.path.starts_with("mods/")
            })
            .min_by_key(|file| file.file_size)
            .unwrap();
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        runtime
            .block_on(download_file(
                &http_client().unwrap(),
                file,
                temp.path(),
                |_| {},
            ))
            .unwrap();
        verify_file(
            &temp.path().join(safe_relative_path(&file.path).unwrap()),
            file,
        )
        .unwrap();
        extract_client_overrides(&mut archive, temp.path()).unwrap();
        let (minecraft_version, loader_type, loader_version) = game_and_loader(&index).unwrap();
        let instance = Instance {
            id: "test".into(),
            name: index.name.clone(),
            minecraft_version,
            loader_type,
            loader_version,
            game_directory: display_path(temp.path()),
            java_path: String::new(),
            ram_mb: 4096,
            jvm_args: String::new(),
            created_at: String::new(),
            last_played_at: None,
            playtime_seconds: Some(0),
            status: "ready".into(),
            icon: String::new(),
            is_favorite: Some(false),
            order: Some(0),
            notes: None,
        };
        let export_path = temp.path().join("roundtrip.mrpack");
        runtime
            .block_on(export_mrpack(
                display_path(&export_path),
                instance,
                ExportOptions {
                    name: index.name.clone(),
                    version_id: index.version_id.clone(),
                    summary: String::new(),
                    included_paths: vec!["mods".into()],
                },
            ))
            .unwrap();
        let exported = read_index(&mut open_pack(&export_path).unwrap()).unwrap();
        assert!(exported
            .files
            .iter()
            .any(|exported| exported.hashes.sha512 == file.hashes.sha512));
        println!(
            "Verified {} {}: {} indexed files, a real download ({}) and export via Modrinth API",
            index.name,
            index.version_id,
            index.files.len(),
            file.path
        );
    }
}
