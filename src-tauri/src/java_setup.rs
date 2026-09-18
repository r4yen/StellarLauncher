use flate2::read::GzDecoder;
use futures_util::StreamExt;
use reqwest::Client;
use serde::Serialize;
use std::{
    env, fs,
    io::{self, Write},
    path::{Path, PathBuf},
};
use tauri::{AppHandle, Emitter};
use zip::ZipArchive;

const ADOPTIUM_BINARY_BASE_URL: &str = "https://api.adoptium.net/v3/binary/latest";
static JAVA_SETUP_LOCK: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);
struct SetupGuard;
impl Drop for SetupGuard {
    fn drop(&mut self) {
        JAVA_SETUP_LOCK.store(false, std::sync::atomic::Ordering::Release);
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JavaSetupProgress {
    pub operation_id: String,
    pub version: u8,
    pub status: String,
    pub downloaded_bytes: u64,
    pub total_bytes: Option<u64>,
    pub target_path: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JavaSetupResult {
    pub java_8_path: String,
    pub java_17_path: String,
    pub java_21_path: String,
    pub java_25_path: String,
}

#[tauri::command]
pub async fn setup_adoptium_java(
    app: AppHandle,
    launcher_folder: String,
    versions: Option<Vec<u8>>,
) -> Result<JavaSetupResult, String> {
    crate::operations::run(
        "java-setup".into(),
        setup_java_inner(
            app,
            launcher_folder,
            versions.unwrap_or_else(|| vec![21]),
            "java-setup".into(),
        ),
    )
    .await
}

async fn setup_java_inner(
    app: AppHandle,
    launcher_folder: String,
    versions: Vec<u8>,
    operation_id: String,
) -> Result<JavaSetupResult, String> {
    while JAVA_SETUP_LOCK
        .compare_exchange(
            false,
            true,
            std::sync::atomic::Ordering::AcqRel,
            std::sync::atomic::Ordering::Acquire,
        )
        .is_err()
    {
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
    }
    let _guard = SetupGuard;
    let launcher_dir = expand_path(&launcher_folder);
    if !launcher_dir.is_absolute() {
        return Err("Launcher folder must be an absolute path.".into());
    }
    let java_root = launcher_dir.join("java");
    fs::create_dir_all(&java_root).map_err(|error| {
        format!(
            "Cannot create Java directory {}: {error}",
            java_root.display()
        )
    })?;

    let java_root = fs::canonicalize(java_root).map_err(|error| error.to_string())?;
    let client = Client::builder()
        .connect_timeout(std::time::Duration::from_secs(30))
        .read_timeout(std::time::Duration::from_secs(90))
        .build()
        .map_err(|error| error.to_string())?;
    let settings = crate::storage::load_settings(app.clone())?;
    let mut result = JavaSetupResult {
        java_8_path: settings.java_8_path,
        java_17_path: settings.java_17_path,
        java_21_path: settings.java_21_path,
        java_25_path: settings.java_25_path,
    };
    for version in versions {
        if ![8, 16, 17, 21, 25].contains(&version) {
            return Err(format!("Unsupported Java version: {version}"));
        }
        let path = install_temurin_jdk(&app, &client, &java_root, version, &operation_id).await?;
        match version {
            8 => result.java_8_path = path,
            17 => result.java_17_path = path,
            21 => result.java_21_path = path,
            25 => result.java_25_path = path,
            _ => {}
        }
    }
    Ok(result)
}

fn release_java_version(version: &str) -> Option<u8> {
    let parts: Option<Vec<u32>> = version.split('.').map(|part| part.parse().ok()).collect();
    let parts = parts?;
    let major = *parts.first()?;
    if major >= 26 {
        Some(25)
    } else if major == 1 {
        let minor = *parts.get(1)?;
        Some(
            if minor > 20 || (minor == 20 && parts.get(2).copied().unwrap_or(0) >= 5) {
                21
            } else if minor >= 18 {
                17
            } else if minor == 17 {
                16
            } else {
                8
            },
        )
    } else {
        None
    }
}

#[tauri::command]
pub async fn ensure_instance_java(
    app: AppHandle,
    instance: crate::storage::Instance,
) -> Result<String, String> {
    crate::operations::run(format!("java-{}", instance.id), async {
        let settings = crate::storage::load_settings(app.clone())?;
        if !instance.java_path.trim().is_empty() {
            let custom = crate::storage::expand_path(&instance.java_path)?;
            if custom.is_file() {
                return Ok(custom.to_string_lossy().into_owned());
            }
        }
        let version = if let Some(version) = release_java_version(&instance.minecraft_version) {
            version
        } else {
            let client = Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .map_err(|e| e.to_string())?;
            let manifest: serde_json::Value = client
                .get("https://piston-meta.mojang.com/mc/game/version_manifest_v2.json")
                .send()
                .await
                .map_err(|e| e.to_string())?
                .error_for_status()
                .map_err(|e| e.to_string())?
                .json()
                .await
                .map_err(|e| e.to_string())?;
            let url = manifest["versions"]
                .as_array()
                .and_then(|items| {
                    items
                        .iter()
                        .find(|item| item["id"].as_str() == Some(&instance.minecraft_version))
                })
                .and_then(|item| item["url"].as_str())
                .ok_or("Minecraft version was not found.")?;
            let metadata: serde_json::Value = client
                .get(url)
                .send()
                .await
                .map_err(|e| e.to_string())?
                .error_for_status()
                .map_err(|e| e.to_string())?
                .json()
                .await
                .map_err(|e| e.to_string())?;
            metadata["javaVersion"]["majorVersion"]
                .as_u64()
                .unwrap_or(8)
                .try_into()
                .map_err(|_| "Invalid Java version")?
        };
        setup_java_inner(
            app,
            settings.launcher_folder.clone(),
            vec![version],
            format!("java-{}", instance.id),
        )
        .await?;
        Ok(expand_path(&settings.launcher_folder)
            .join("java")
            .join(format!("jdk-{version}"))
            .join("bin")
            .join(java_binary_name())
            .to_string_lossy()
            .into_owned())
    })
    .await
}

async fn install_temurin_jdk(
    app: &AppHandle,
    client: &Client,
    java_root: &Path,
    version: u8,
    operation_id: &str,
) -> Result<String, String> {
    let target_dir = java_root.join(format!("jdk-{version}"));
    let installed_java = target_dir.join("bin").join(java_binary_name());
    if reusable_installation(&target_dir, version) {
        emit_progress(
            app,
            operation_id,
            version,
            "completed",
            1,
            Some(1),
            &installed_java,
            "Using installed Eclipse Temurin JDK",
        );
        return Ok(installed_java.to_string_lossy().into_owned());
    }
    let archive_path = java_root.join(format!(
        "temurin-jdk-{version}.{}",
        java_archive_extension()
    ));
    let extract_dir = java_root.join(format!("jdk-{version}.extracting"));

    emit_progress(
        app,
        operation_id,
        version,
        "pending",
        0,
        None,
        &target_dir,
        "Resolving Adoptium download",
    );

    if archive_path.exists() {
        fs::remove_file(&archive_path).map_err(|error| {
            format!(
                "Cannot remove old archive {}: {error}",
                archive_path.display()
            )
        })?;
    }
    if extract_dir.exists() {
        remove_java_directory(java_root, &extract_dir).map_err(|error| {
            format!(
                "Cannot remove old extraction directory {}: {error}",
                extract_dir.display()
            )
        })?;
    }

    let url = format!(
        "{ADOPTIUM_BINARY_BASE_URL}/{version}/ga/{}/x64/jdk/hotspot/normal/eclipse",
        adoptium_os_segment()
    );
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|error| format!("Cannot download Adoptium Java {version}: {error}"))?
        .error_for_status()
        .map_err(|error| format!("Adoptium Java {version} request failed: {error}"))?;
    let total_bytes = response.content_length();
    let mut downloaded_bytes = 0_u64;
    let mut archive = fs::File::create(&archive_path)
        .map_err(|error| format!("Cannot create archive {}: {error}", archive_path.display()))?;
    let mut stream = response.bytes_stream();

    while let Some(chunk) = stream.next().await {
        let bytes = chunk
            .map_err(|error| format!("Cannot read Adoptium Java {version} download: {error}"))?;
        archive
            .write_all(&bytes)
            .map_err(|error| format!("Cannot write archive {}: {error}", archive_path.display()))?;
        downloaded_bytes += bytes.len() as u64;
        emit_progress(
            app,
            operation_id,
            version,
            "downloading",
            downloaded_bytes,
            total_bytes,
            &target_dir,
            "Downloading Eclipse Temurin JDK",
        );
    }

    emit_progress(
        app,
        operation_id,
        version,
        "extracting",
        downloaded_bytes,
        total_bytes,
        &target_dir,
        "Extracting Eclipse Temurin JDK",
    );
    extract_archive(&archive_path, &extract_dir)?;

    let java_exe = find_java_executable(&extract_dir).ok_or_else(|| {
        format!(
            "Downloaded Adoptium Java {version} archive did not contain bin/{}.",
            java_binary_name()
        )
    })?;
    let jdk_dir = java_exe
        .parent()
        .and_then(Path::parent)
        .ok_or_else(|| format!("Cannot resolve JDK root for Java {version}."))?
        .to_path_buf();

    if target_dir.exists() {
        remove_java_directory(java_root, &target_dir).map_err(|error| {
            format!(
                "Cannot replace old Java directory {}: {error}",
                target_dir.display()
            )
        })?;
    }
    fs::rename(&jdk_dir, &target_dir)
        .map_err(|error| format!("Cannot move JDK into {}: {error}", target_dir.display()))?;

    if extract_dir.exists() {
        remove_java_directory(java_root, &extract_dir).map_err(|error| {
            format!(
                "Cannot clean extraction directory {}: {error}",
                extract_dir.display()
            )
        })?;
    }
    let _ = fs::remove_file(&archive_path);

    let final_java = target_dir.join("bin").join(java_binary_name());
    fs::write(target_dir.join(".stellar-installed"), version.to_string())
        .map_err(|error| format!("Cannot record Java installation: {error}"))?;
    emit_progress(
        app,
        operation_id,
        version,
        "completed",
        downloaded_bytes,
        total_bytes,
        &final_java,
        "Java runtime installed",
    );
    Ok(final_java.to_string_lossy().to_string())
}

fn adoptium_os_segment() -> &'static str {
    if cfg!(target_os = "linux") {
        "linux"
    } else {
        "windows"
    }
}

fn reusable_installation(directory: &Path, version: u8) -> bool {
    fs::read_to_string(directory.join(".stellar-installed"))
        .ok()
        .as_deref()
        == Some(&version.to_string())
        && directory
            .join("bin")
            .join(java_binary_name())
            .metadata()
            .is_ok_and(|m| m.is_file() && m.len() > 0)
}

fn remove_java_directory(root: &Path, directory: &Path) -> Result<(), String> {
    let root = fs::canonicalize(root).map_err(|e| e.to_string())?;
    let target = fs::canonicalize(directory).map_err(|e| e.to_string())?;
    if target.parent() != Some(root.as_path())
        || directory
            .file_name()
            .map_or(true, |name| target != root.join(name))
    {
        return Err("Java cleanup target is outside the managed Java folder.".into());
    }
    fs::remove_dir_all(target).map_err(|e| e.to_string())
}

#[cfg(test)]
mod setup_tests {
    use super::*;
    #[test]
    fn chooses_java_for_minecraft_releases_and_defers_snapshots_to_metadata() {
        for (version, java) in [
            ("1.16.5", 8),
            ("1.17.1", 16),
            ("1.18.2", 17),
            ("1.20.4", 17),
            ("1.20.5", 21),
            ("1.21.5", 21),
            ("26.1", 25),
        ] {
            assert_eq!(release_java_version(version), Some(java));
        }
        assert_eq!(release_java_version("25w14a"), None);
    }
    #[test]
    fn only_completed_nonempty_java_installations_are_reused() {
        let temp = tempfile::tempdir().unwrap();
        fs::create_dir(temp.path().join("bin")).unwrap();
        fs::write(temp.path().join("bin").join(java_binary_name()), b"java").unwrap();
        assert!(!reusable_installation(temp.path(), 21));
        fs::write(temp.path().join(".stellar-installed"), "21").unwrap();
        assert!(reusable_installation(temp.path(), 21));
        assert!(!reusable_installation(temp.path(), 17));
        fs::write(temp.path().join("bin").join(java_binary_name()), b"").unwrap();
        assert!(!reusable_installation(temp.path(), 21));
    }
    #[test]
    fn cleanup_rejects_directories_outside_managed_java_root() {
        let managed = tempfile::tempdir().unwrap();
        let other = tempfile::tempdir().unwrap();
        assert!(remove_java_directory(managed.path(), other.path()).is_err());
        assert!(other.path().exists());
        assert!(remove_java_directory(managed.path(), managed.path()).is_err());
    }
}

fn java_archive_extension() -> &'static str {
    if cfg!(target_os = "linux") {
        "tar.gz"
    } else {
        "zip"
    }
}

fn java_binary_name() -> &'static str {
    if cfg!(target_os = "windows") {
        "java.exe"
    } else {
        "java"
    }
}

fn extract_archive(archive_path: &Path, extract_dir: &Path) -> Result<(), String> {
    if cfg!(target_os = "linux") {
        extract_tar_gz(archive_path, extract_dir)
    } else {
        extract_zip(archive_path, extract_dir)
    }
}

fn extract_tar_gz(archive_path: &Path, extract_dir: &Path) -> Result<(), String> {
    fs::create_dir_all(extract_dir).map_err(|error| {
        format!(
            "Cannot create extraction directory {}: {error}",
            extract_dir.display()
        )
    })?;
    let file = fs::File::open(archive_path)
        .map_err(|error| format!("Cannot open archive {}: {error}", archive_path.display()))?;
    let decoder = GzDecoder::new(file);
    let mut archive = tar::Archive::new(decoder);
    archive
        .unpack(extract_dir)
        .map_err(|error| format!("Cannot extract archive {}: {error}", archive_path.display()))
}

fn extract_zip(archive_path: &Path, extract_dir: &Path) -> Result<(), String> {
    fs::create_dir_all(extract_dir).map_err(|error| {
        format!(
            "Cannot create extraction directory {}: {error}",
            extract_dir.display()
        )
    })?;
    let file = fs::File::open(archive_path)
        .map_err(|error| format!("Cannot open archive {}: {error}", archive_path.display()))?;
    let mut archive = ZipArchive::new(file)
        .map_err(|error| format!("Cannot read archive {}: {error}", archive_path.display()))?;

    for index in 0..archive.len() {
        let mut entry = archive
            .by_index(index)
            .map_err(|error| format!("Cannot read archive entry: {error}"))?;
        let Some(enclosed_name) = entry.enclosed_name() else {
            continue;
        };
        let output_path = extract_dir.join(enclosed_name);

        if entry.is_dir() {
            fs::create_dir_all(&output_path).map_err(|error| {
                format!("Cannot create directory {}: {error}", output_path.display())
            })?;
            continue;
        }

        if let Some(parent) = output_path.parent() {
            fs::create_dir_all(parent).map_err(|error| {
                format!("Cannot create directory {}: {error}", parent.display())
            })?;
        }

        let mut output = fs::File::create(&output_path)
            .map_err(|error| format!("Cannot create file {}: {error}", output_path.display()))?;
        io::copy(&mut entry, &mut output)
            .map_err(|error| format!("Cannot extract file {}: {error}", output_path.display()))?;
    }

    Ok(())
}

fn find_java_executable(dir: &Path) -> Option<PathBuf> {
    let entries = fs::read_dir(dir).ok()?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            if let Some(found) = find_java_executable(&path) {
                return Some(found);
            }
            continue;
        }

        if path
            .file_name()
            .and_then(|value| value.to_str())
            .is_some_and(|file_name| file_name == java_binary_name())
            && path
                .parent()
                .and_then(|parent| parent.file_name())
                .and_then(|value| value.to_str())
                .is_some_and(|folder| folder.eq_ignore_ascii_case("bin"))
        {
            return Some(path);
        }
    }

    None
}

fn expand_path(path: &str) -> PathBuf {
    let mut expanded = path.to_string();
    for (key, value) in env::vars() {
        expanded = expanded.replace(&format!("%{key}%"), &value);
        expanded = expanded.replace(&format!("${key}"), &value);
    }
    PathBuf::from(expanded)
}

fn emit_progress(
    app: &AppHandle,
    operation_id: &str,
    version: u8,
    status: &str,
    downloaded_bytes: u64,
    total_bytes: Option<u64>,
    target_path: &Path,
    message: &str,
) {
    let _ = app.emit(
        "java-setup-progress",
        JavaSetupProgress {
            operation_id: operation_id.to_owned(),
            version,
            status: status.to_string(),
            downloaded_bytes,
            total_bytes,
            target_path: target_path.to_string_lossy().to_string(),
            message: message.to_string(),
        },
    );
}
