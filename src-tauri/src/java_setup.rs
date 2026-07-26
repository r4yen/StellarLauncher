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

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JavaSetupProgress {
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
) -> Result<JavaSetupResult, String> {
    let launcher_dir = expand_path(&launcher_folder);
    let java_root = launcher_dir.join("java");
    fs::create_dir_all(&java_root).map_err(|error| {
        format!(
            "Cannot create Java directory {}: {error}",
            java_root.display()
        )
    })?;

    let client = Client::new();
    let java_8_path = install_temurin_jdk(&app, &client, &java_root, 8).await?;
    let java_17_path = install_temurin_jdk(&app, &client, &java_root, 17).await?;
    let java_21_path = install_temurin_jdk(&app, &client, &java_root, 21).await?;
    let java_25_path = install_temurin_jdk(&app, &client, &java_root, 25).await?;

    Ok(JavaSetupResult {
        java_8_path,
        java_17_path,
        java_21_path,
        java_25_path,
    })
}

async fn install_temurin_jdk(
    app: &AppHandle,
    client: &Client,
    java_root: &Path,
    version: u8,
) -> Result<String, String> {
    let target_dir = java_root.join(format!("jdk-{version}"));
    let archive_path = java_root.join(format!(
        "temurin-jdk-{version}.{}",
        java_archive_extension()
    ));
    let extract_dir = java_root.join(format!("jdk-{version}.extracting"));

    emit_progress(
        app,
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
        fs::remove_dir_all(&extract_dir).map_err(|error| {
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
        fs::remove_dir_all(&target_dir).map_err(|error| {
            format!(
                "Cannot replace old Java directory {}: {error}",
                target_dir.display()
            )
        })?;
    }
    fs::rename(&jdk_dir, &target_dir)
        .map_err(|error| format!("Cannot move JDK into {}: {error}", target_dir.display()))?;

    if extract_dir.exists() {
        fs::remove_dir_all(&extract_dir).map_err(|error| {
            format!(
                "Cannot clean extraction directory {}: {error}",
                extract_dir.display()
            )
        })?;
    }
    let _ = fs::remove_file(&archive_path);

    let final_java = target_dir.join("bin").join(java_binary_name());
    emit_progress(
        app,
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
            version,
            status: status.to_string(),
            downloaded_bytes,
            total_bytes,
            target_path: target_path.to_string_lossy().to_string(),
            message: message.to_string(),
        },
    );
}
