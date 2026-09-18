use crate::storage::{self, Instance};
use rusqlite::{Connection, OpenFlags};
use serde::Serialize;
use serde_json::Value;
use std::{
    collections::{HashMap, HashSet},
    env, fs,
    io::Write,
    path::{Path, PathBuf},
};
use tauri::{AppHandle, Emitter};
static IMPORT_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ForeignInstance {
    pub id: String,
    pub name: String,
    pub game_directory: String,
    pub minecraft_version: String,
    pub loader_type: String,
    pub loader_version: String,
    pub error: Option<String>,
}

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ScanResult {
    pub roots: Vec<String>,
    pub instances: Vec<ForeignInstance>,
    pub warnings: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportResult {
    pub instances: Vec<Instance>,
    pub imported_ids: Vec<String>,
    pub errors: Vec<String>,
}

fn json(path: &Path) -> Result<Value, String> {
    let bytes = fs::read(path).map_err(|e| format!("{}: {e}", path.display()))?;
    serde_json::from_slice(bytes.strip_prefix(&[239, 187, 191]).unwrap_or(&bytes))
        .map_err(|e| format!("{}: {e}", path.display()))
}
fn string(value: &Value, path: &str) -> String {
    value
        .pointer(path)
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_owned()
}
fn ini(path: &Path) -> HashMap<String, String> {
    fs::read_to_string(path)
        .unwrap_or_default()
        .lines()
        .filter_map(|line| {
            let (key, value) = line.split_once('=')?;
            Some((key.trim().to_owned(), value.trim().to_owned()))
        })
        .collect()
}
fn text_path(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}
fn roots(launcher: &str) -> Result<Vec<PathBuf>, String> {
    let home = env::var_os("USERPROFILE")
        .or_else(|| env::var_os("HOME"))
        .map(PathBuf::from)
        .unwrap_or_default();
    let data = env::var_os("APPDATA")
        .or_else(|| env::var_os("XDG_DATA_HOME"))
        .map(PathBuf::from)
        .unwrap_or_else(|| home.join(".local/share"));
    let names: &[&str] = match launcher {
        "modrinth" => &[
            "com.modrinth.theseus",
            "com.modrinth.ModrinthApp",
            "ModrinthApp",
        ],
        "curseforge" => &[],
        "prism" => &["PrismLauncher"],
        "multimc" => &["MultiMC", "multimc"],
        "polymc" => &["PolyMC"],
        "atlauncher" => &["ATLauncher"],
        "gdlauncher" => &["gdlauncher_next"],
        _ => return Err("Unsupported launcher.".into()),
    };
    let mut paths: Vec<_> = names.iter().map(|name| data.join(name)).collect();
    for name in names {
        paths.extend([
            home.join(name),
            home.join("Desktop").join(name),
            home.join("Downloads").join(name),
        ]);
        for variable in ["LOCALAPPDATA", "ProgramFiles", "ProgramFiles(x86)"] {
            if let Some(base) = env::var_os(variable) {
                paths.push(PathBuf::from(base).join(name));
            }
        }
    }
    match launcher {
        "curseforge" => paths.extend([
            home.join("curseforge/minecraft"),
            home.join("Documents/curseforge/minecraft"),
            home.join("Documents/Curse/Minecraft"),
            home.join("Twitch/Minecraft"),
        ]),
        "prism" => paths.extend([
            home.join("scoop/persist/prismlauncher"),
            home.join(".var/app/org.prismlauncher.PrismLauncher/data/PrismLauncher"),
        ]),
        "polymc" => paths.push(home.join(".var/app/org.polymc.PolyMC/data/PolyMC")),
        "atlauncher" => paths.push(home.join(".var/app/com.atlauncher.ATLauncher/data/ATLauncher")),
        "modrinth" => {
            paths
                .push(home.join(".var/app/com.modrinth.ModrinthApp/data/com.modrinth.ModrinthApp"));
            if let Some(path) = env::var_os("THESEUS_CONFIG_DIR") {
                paths.push(PathBuf::from(path));
            }
        }
        _ => {}
    }
    Ok(paths)
}

fn validate(instance: &mut ForeignInstance) {
    // Foreign launcher IDs can contain the Minecraft version or a loader prefix.
    let prefix = format!("{}-", instance.minecraft_version);
    if instance.loader_type == "forge" {
        instance.loader_version = instance
            .loader_version
            .strip_prefix(&prefix)
            .unwrap_or(&instance.loader_version)
            .to_owned();
    }
    for prefix in [
        format!("{}-loader-", instance.loader_type),
        format!("{}-", instance.loader_type),
    ] {
        if let Some(version) = instance.loader_version.strip_prefix(&prefix) {
            instance.loader_version = version
                .strip_suffix(&format!("-{}", instance.minecraft_version))
                .unwrap_or(version)
                .to_owned();
            break;
        }
    }
    if !Path::new(&instance.game_directory).is_dir() {
        instance.error = Some("Game folder is missing.".into());
    } else if instance.minecraft_version.is_empty() {
        instance.error = Some("Minecraft version could not be read.".into());
    } else if !["vanilla", "fabric", "forge", "neoforge", "quilt"]
        .contains(&instance.loader_type.as_str())
    {
        instance.error = Some(format!("Unsupported loader: {}", instance.loader_type));
    } else if instance.loader_type != "vanilla" && instance.loader_version.is_empty() {
        instance.error = Some("Loader version is missing.".into());
    } else if [&instance.minecraft_version, &instance.loader_version]
        .iter()
        .any(|value| {
            value.contains("..")
                || !value
                    .chars()
                    .all(|c| c.is_ascii_alphanumeric() || "._+-".contains(c))
        })
    {
        instance.error = Some("Invalid Minecraft or loader version.".into());
    }
}

fn parse_instance(launcher: &str, folder: &Path) -> Result<ForeignInstance, String> {
    let mut item = ForeignInstance {
        id: text_path(folder),
        name: folder
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .into_owned(),
        game_directory: text_path(folder),
        minecraft_version: String::new(),
        loader_type: "vanilla".into(),
        loader_version: String::new(),
        error: None,
    };
    match launcher {
        "prism" | "multimc" | "polymc" => {
            let config = ini(&folder.join("instance.cfg"));
            if let Some(name) = config.get("name") {
                item.name = name.clone();
            }
            let pack = json(&folder.join("mmc-pack.json"))?;
            let components = pack["components"]
                .as_array()
                .ok_or("Missing Minecraft components")?;
            for component in components {
                if component["disabled"] == true {
                    continue;
                }
                let uid = string(component, "/uid");
                let version = string(component, "/version");
                match uid.as_str() {
                    "net.minecraft" => item.minecraft_version = version,
                    "org.lwjgl" | "org.lwjgl3" | "net.fabricmc.intermediary" => {}
                    _ => {
                        let loader = match uid.as_str() {
                            "net.fabricmc.fabric-loader" => "fabric",
                            "net.minecraftforge" => "forge",
                            "net.neoforged" => "neoforge",
                            "org.quiltmc.quilt-loader" => "quilt",
                            _ => {
                                item.error = Some(format!("Unsupported component: {uid}"));
                                continue;
                            }
                        };
                        if item.loader_type != "vanilla" {
                            item.error = Some("Multiple loaders are not supported.".into());
                        }
                        item.loader_type = loader.into();
                        item.loader_version = version;
                    }
                }
            }
            item.game_directory = text_path(&if folder.join(".minecraft").is_dir() {
                folder.join(".minecraft")
            } else {
                folder.join("minecraft")
            });
        }
        "curseforge" => {
            let value = json(&folder.join("minecraftinstance.json"))?;
            item.name = string(&value, "/name");
            item.minecraft_version = string(&value, "/gameVersion");
            let loader = string(&value, "/baseModLoader/name");
            if !loader.is_empty() {
                let (kind, version) = loader
                    .split_once('-')
                    .ok_or("Unknown CurseForge loader format")?;
                item.loader_type = kind.to_lowercase();
                item.loader_version = version
                    .strip_suffix(&format!("-{}", item.minecraft_version))
                    .unwrap_or(version)
                    .to_owned();
            }
        }
        "atlauncher" => {
            let value = json(&folder.join("instance.json"))?;
            item.name = string(&value, "/launcher/name");
            item.minecraft_version = string(&value, "/id");
            let kind = string(&value, "/launcher/loaderVersion/type");
            if !kind.is_empty() {
                item.loader_type = kind.to_lowercase();
                item.loader_version = string(&value, "/launcher/loaderVersion/version");
            }
        }
        "gdlauncher" => {
            let value = json(&folder.join("config.json"))?;
            item.minecraft_version = string(&value, "/loader/mcVersion");
            item.loader_type = string(&value, "/loader/loaderType").to_lowercase();
            item.loader_version = string(&value, "/loader/loaderVersion");
        }
        "modrinth" => {
            let value = json(&folder.join("profile.json"))?;
            let metadata = value.get("metadata").unwrap_or(&value);
            item.name = string(metadata, "/name");
            item.minecraft_version = string(metadata, "/game_version");
            item.loader_type = string(metadata, "/loader").to_lowercase();
            item.loader_version = string(metadata, "/loader_version/id");
            if item.loader_version.is_empty() {
                item.loader_version = string(metadata, "/loader_version");
            }
        }
        _ => return Err("Unsupported launcher".into()),
    }
    if item.name.trim().is_empty() {
        item.name = folder
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .into_owned();
    }
    validate(&mut item);
    Ok(item)
}

fn scan_modrinth_database(root: &Path) -> Result<Vec<ForeignInstance>, String> {
    let connection =
        Connection::open_with_flags(root.join("app.db"), OpenFlags::SQLITE_OPEN_READ_ONLY)
            .map_err(|e| e.to_string())?;
    let custom: Option<String> = connection
        .query_row("SELECT custom_dir FROM settings LIMIT 1", [], |row| {
            row.get(0)
        })
        .map_err(|e| e.to_string())?;
    let data_root = custom
        .filter(|p| !p.is_empty())
        .map(PathBuf::from)
        .unwrap_or_else(|| root.to_path_buf());
    let modern = connection
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='instances'",
            [],
            |row| row.get::<_, i64>(0),
        )
        .map_err(|e| e.to_string())?
        > 0;
    let sql = if modern {
        "SELECT i.path,i.name,c.game_version,c.loader,c.loader_version FROM instances i LEFT JOIN instance_content_sets c ON c.id=i.applied_content_set_id"
    } else {
        "SELECT path,name,game_version,mod_loader,mod_loader_version FROM profiles"
    };
    let mut query = connection
        .prepare(sql)
        .map_err(|e| format!("Unsupported Modrinth database: {e}"))?;
    let rows = query
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, Option<String>>(3)?,
                row.get::<_, Option<String>>(4)?,
            ))
        })
        .map_err(|e| e.to_string())?;
    let mut items = Vec::new();
    for row in rows {
        let (path, name, game, loader, version) = row.map_err(|e| e.to_string())?;
        if Path::new(&path)
            .components()
            .any(|c| !matches!(c, std::path::Component::Normal(_)))
        {
            return Err("Invalid Modrinth profile path.".into());
        }
        let directory = data_root.join("profiles").join(path);
        let mut item = ForeignInstance {
            id: text_path(&directory),
            name,
            game_directory: text_path(&directory),
            minecraft_version: game.unwrap_or_default(),
            loader_type: loader.unwrap_or_default().to_lowercase(),
            loader_version: version.unwrap_or_default(),
            error: None,
        };
        validate(&mut item);
        // Do not silently import an incomplete content-store profile as a complete pack.
        if modern {
            let mut files = connection.prepare("SELECT f.relative_path,f.enabled FROM instance_files f JOIN instances i ON i.id=f.instance_id WHERE i.path=?1 AND f.missing=0").map_err(|e| e.to_string())?;
            let relative = directory.file_name().unwrap_or_default().to_string_lossy();
            let paths = files
                .query_map([relative.as_ref()], |r| {
                    Ok((r.get::<_, String>(0)?, r.get::<_, bool>(1)?))
                })
                .map_err(|e| e.to_string())?;
            for path in paths {
                let (path, enabled) = path.map_err(|e| e.to_string())?;
                let path = if enabled {
                    path
                } else {
                    format!("{}.disabled", path.trim_end_matches(".disabled"))
                };
                if !directory.join(path).is_file() {
                    item.error = Some("Some Modrinth content is not present in the game folder. Restore/download it in Modrinth or export a .mrpack first.".into());
                    break;
                }
            }
        }
        items.push(item);
    }
    Ok(items)
}

fn scan(launcher: &str, custom_root: Option<String>) -> Result<ScanResult, String> {
    let candidates = roots(launcher)?;
    let explicit = custom_root.is_some();
    let candidates = match custom_root {
        Some(path) => vec![storage::expand_path(&path)?],
        None => candidates,
    };
    let mut result = ScanResult::default();
    let mut seen_roots = HashSet::new();
    let mut seen_instances = HashSet::new();
    for root in candidates {
        if !root.is_dir() {
            if explicit {
                result
                    .warnings
                    .push(format!("Folder not found: {}", root.display()));
            }
            continue;
        }
        let root = fs::canonicalize(root).map_err(|e| e.to_string())?;
        if !seen_roots.insert(root.clone()) {
            continue;
        }
        result.roots.push(text_path(&root));
        if launcher == "modrinth" && root.join("app.db").is_file() {
            match scan_modrinth_database(&root) {
                Ok(items) => {
                    for item in items {
                        if seen_instances.insert(item.id.clone()) {
                            result.instances.push(item);
                        }
                    }
                }
                Err(error) => result.warnings.push(format!("{}: {error}", root.display())),
            }
            continue;
        }
        let config_name = match launcher {
            "prism" => "prismlauncher.cfg",
            "multimc" => "multimc.cfg",
            "polymc" => "polymc.cfg",
            _ => "",
        };
        let config = ini(&root.join(config_name));
        let subfolder = config.get("InstanceDir").cloned().unwrap_or_else(|| {
            match launcher {
                "curseforge" => "Instances",
                "modrinth" => "profiles",
                _ => "instances",
            }
            .into()
        });
        let directory = if root.join(&subfolder).is_dir() {
            root.join(&subfolder)
        } else {
            root.clone()
        };
        let entries = match fs::read_dir(&directory) {
            Ok(entries) => entries,
            Err(e) => {
                result.warnings.push(e.to_string());
                continue;
            }
        };
        for entry in entries {
            let entry = entry.map_err(|e| e.to_string())?;
            if !entry.file_type().map_err(|e| e.to_string())?.is_dir() {
                continue;
            }
            let path = entry.path();
            let marker = match launcher {
                "prism" | "multimc" | "polymc" => "instance.cfg",
                "curseforge" => "minecraftinstance.json",
                "atlauncher" => "instance.json",
                "gdlauncher" => "config.json",
                _ => "profile.json",
            };
            if !path.join(marker).is_file() {
                continue;
            }
            let item = parse_instance(launcher, &path).unwrap_or_else(|error| ForeignInstance {
                id: text_path(&path),
                name: entry.file_name().to_string_lossy().into_owned(),
                game_directory: text_path(&path),
                minecraft_version: String::new(),
                loader_type: String::new(),
                loader_version: String::new(),
                error: Some(error),
            });
            if seen_instances.insert(item.id.clone()) {
                result.instances.push(item);
            }
        }
    }
    result.instances.sort_by_key(|i| i.name.to_lowercase());
    Ok(result)
}

#[tauri::command]
pub async fn scan_launcher_instances(
    launcher: String,
    root: Option<String>,
) -> Result<ScanResult, String> {
    tauri::async_runtime::spawn_blocking(move || scan(&launcher, root))
        .await
        .map_err(|e| e.to_string())?
}

fn copy_contents(
    source: &Path,
    target: &Path,
    top_level: bool,
    progress: &mut impl FnMut(u64),
) -> Result<(), String> {
    for entry in fs::read_dir(source).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let kind = entry.file_type().map_err(|e| e.to_string())?;
        let name = entry.file_name();
        if top_level
            && [
                "instance.cfg",
                "mmc-pack.json",
                "minecraftinstance.json",
                "instance.json",
                "profile.json",
                "launcher_accounts.json",
                "accounts.json",
            ]
            .iter()
            .any(|n| name == *n)
        {
            continue;
        }
        if name == "session.lock" {
            continue;
        }
        let from = entry.path();
        let to = target.join(name);
        if kind.is_symlink() {
            return Err(format!(
                "Linked file or folder cannot be imported: {}",
                from.display()
            ));
        }
        // Junctions on Windows are reparse points too; never walk out of the source tree.
        #[cfg(windows)]
        {
            use std::os::windows::fs::MetadataExt;
            if entry
                .metadata()
                .map_err(|e| e.to_string())?
                .file_attributes()
                & 0x400
                != 0
            {
                return Err(format!(
                    "Linked folder cannot be imported: {}",
                    from.display()
                ));
            }
        }
        if kind.is_dir() {
            fs::create_dir(&to).map_err(|e| e.to_string())?;
            copy_contents(&from, &to, false, progress)?;
        } else if kind.is_file() {
            let bytes =
                fs::copy(&from, &to).map_err(|e| format!("Cannot copy {}: {e}", from.display()))?;
            progress(bytes);
        } else {
            return Err(format!("Unsupported file: {}", from.display()));
        }
    }
    Ok(())
}

pub(super) fn copy_instance(
    source: &Path,
    base: &Path,
    name: &str,
    progress: &mut impl FnMut(u64),
) -> Result<PathBuf, String> {
    copy_directory(source, base, name, true, progress)
}

pub(super) fn copy_directory(
    source: &Path,
    base: &Path,
    name: &str,
    exclude_launcher_metadata: bool,
    progress: &mut impl FnMut(u64),
) -> Result<PathBuf, String> {
    let source = fs::canonicalize(source).map_err(|e| e.to_string())?;
    if let Some(existing) = base.ancestors().find(|path| path.exists()) {
        if fs::canonicalize(existing)
            .map_err(|e| e.to_string())?
            .starts_with(&source)
        {
            return Err("Import destination must be outside the source instance.".into());
        }
    }
    fs::create_dir_all(base).map_err(|e| e.to_string())?;
    let base = fs::canonicalize(base).map_err(|e| e.to_string())?;
    if base.starts_with(&source) {
        return Err("Import destination must be outside the source instance.".into());
    }
    let stage = tempfile::Builder::new()
        .prefix(".stellar-import-")
        .tempdir_in(&base)
        .map_err(|e| e.to_string())?;
    copy_contents(&source, stage.path(), exclude_launcher_metadata, progress)?;
    let target = crate::mrpack::create_pack_directory(&base, name)?;
    // The reservation is empty and was created by this operation.
    fs::remove_dir(&target).map_err(|e| e.to_string())?;
    fs::rename(stage.path(), &target).map_err(|e| e.to_string())?;
    Ok(target)
}

#[tauri::command]
pub async fn import_launcher_instances(
    app: AppHandle,
    launcher: String,
    root: Option<String>,
    selected_ids: Vec<String>,
) -> Result<ImportResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let _lock = IMPORT_LOCK
            .try_lock()
            .map_err(|_| "An instance import is already running.")?;
        let scan = scan(&launcher, root)?;
        let settings = storage::load_settings(app.clone())?;
        let base = storage::expand_path(&settings.game_directory)?;
        let mut result = ImportResult {
            instances: storage::load_instances(app.clone())?,
            imported_ids: Vec::new(),
            errors: Vec::new(),
        };
        let selected: HashSet<_> = selected_ids.into_iter().collect();
        let mut copied = 0u64;
        let mut last_progress = std::time::Instant::now();
        for id in selected {
            let item = match scan.instances.iter().find(|item| item.id == id) {
                Some(item) => item,
                None => {
                    result
                        .errors
                        .push(format!("Instance is no longer available: {id}"));
                    continue;
                }
            };
            if let Some(error) = &item.error {
                result.errors.push(format!("{}: {error}", item.name));
                continue;
            }
            let _ = app.emit(
                "launcher-import-progress",
                serde_json::json!({"name":item.name,"copiedBytes":copied}),
            );
            let outcome = copy_instance(
                Path::new(&item.game_directory),
                &base,
                &item.name,
                &mut |bytes| {
                    copied += bytes;
                    if last_progress.elapsed().as_millis() >= 100 {
                        let _ = app.emit(
                            "launcher-import-progress",
                            serde_json::json!({"name":item.name,"copiedBytes":copied}),
                        );
                        last_progress = std::time::Instant::now();
                    }
                },
            );
            match outcome {
                Ok(target) => {
                    let instance = Instance {
                        id: uuid::Uuid::new_v4().to_string(),
                        name: item.name.clone(),
                        minecraft_version: item.minecraft_version.clone(),
                        loader_type: item.loader_type.clone(),
                        loader_version: item.loader_version.clone(),
                        game_directory: text_path(&target),
                        java_path: String::new(),
                        ram_mb: settings.default_ram_mb,
                        jvm_args: settings.jvm_args.clone(),
                        created_at: chrono::Utc::now().to_rfc3339(),
                        last_played_at: None,
                        playtime_seconds: Some(0),
                        status: "ready".into(),
                        icon: "/default-instance-block.svg".into(),
                        is_favorite: Some(false),
                        order: Some(result.instances.len() as u32),
                        notes: Some(format!("Imported from {launcher}")),
                    };
                    result.instances.push(instance);
                    // Persist each successful copy atomically so partial failures remain recoverable.
                    let saved = (|| -> Result<(), String> {
                        let dir = storage::app_data_dir(&app)?;
                        let mut file =
                            tempfile::NamedTempFile::new_in(&dir).map_err(|e| e.to_string())?;
                        file.write_all(
                            &serde_json::to_vec_pretty(&result.instances)
                                .map_err(|e| e.to_string())?,
                        )
                        .map_err(|e| e.to_string())?;
                        file.as_file().sync_all().map_err(|e| e.to_string())?;
                        file.persist(dir.join("instances.json"))
                            .map_err(|e| e.to_string())?;
                        Ok(())
                    })();
                    if let Err(error) = saved {
                        result.instances.pop();
                        result.errors.push(format!(
                            "{}: could not save instance ({error}). Copied files remain at {}.",
                            item.name,
                            target.display()
                        ));
                    } else {
                        result.imported_ids.push(item.id.clone());
                    }
                }
                Err(error) => result.errors.push(format!("{}: {error}", item.name)),
            }
        }
        Ok(result)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn write(path: &Path, value: Value) {
        fs::write(path, serde_json::to_vec(&value).unwrap()).unwrap();
    }
    fn prism(folder: &Path, loader: &str, version: &str) {
        fs::create_dir_all(folder.join(".minecraft/mods")).unwrap();
        fs::write(folder.join("instance.cfg"), "[General]\nname=Test Pack\n").unwrap();
        write(
            &folder.join("mmc-pack.json"),
            json!({"components":[{"uid":"net.minecraft","version":"1.21.1"},{"uid":loader,"version":version}]}),
        );
    }

    #[test]
    fn prism_family_reads_components_and_custom_instance_path() {
        let temp = tempfile::tempdir().unwrap();
        prism(
            &temp.path().join("custom/Pack"),
            "net.fabricmc.fabric-loader",
            "0.16.9",
        );
        for (launcher, config) in [
            ("prism", "prismlauncher.cfg"),
            ("multimc", "multimc.cfg"),
            ("polymc", "polymc.cfg"),
        ] {
            fs::write(temp.path().join(config), "[General]\nInstanceDir=custom").unwrap();
            let result = scan(launcher, Some(text_path(temp.path()))).unwrap();
            assert_eq!(result.instances.len(), 1);
            let item = &result.instances[0];
            assert_eq!(
                (&*item.name, &*item.loader_type, &*item.loader_version),
                ("Test Pack", "fabric", "0.16.9")
            );
            assert!(item.error.is_none());
            assert!(Path::new(&item.game_directory).ends_with(".minecraft"));
        }
    }

    #[test]
    fn unsupported_prism_components_remain_visible_but_disabled() {
        let temp = tempfile::tempdir().unwrap();
        prism(
            &temp.path().join("instances/Pack"),
            "com.mumfrey.liteloader",
            "1.12",
        );
        let result = scan("prism", Some(text_path(temp.path()))).unwrap();
        assert!(result.instances[0]
            .error
            .as_ref()
            .unwrap()
            .contains("Unsupported component"));
    }

    #[test]
    fn curseforge_atlauncher_and_gdlauncher_metadata() {
        let temp = tempfile::tempdir().unwrap();
        write(
            &temp.path().join("minecraftinstance.json"),
            json!({"name":"CF","gameVersion":"1.21.1","baseModLoader":{"name":"fabric-0.16.9-1.21.1"}}),
        );
        let item = parse_instance("curseforge", temp.path()).unwrap();
        assert_eq!(item.loader_version, "0.16.9");
        assert!(item.error.is_none());
        write(
            &temp.path().join("instance.json"),
            json!({"id":"1.21.1","launcher":{"name":"AT","loaderVersion":{"type":"NeoForge","version":"21.1.90"}}}),
        );
        let item = parse_instance("atlauncher", temp.path()).unwrap();
        assert_eq!(item.loader_type, "neoforge");
        assert!(item.error.is_none());
        write(
            &temp.path().join("config.json"),
            json!({"loader":{"mcVersion":"1.20.1","loaderType":"forge","loaderVersion":"47.3.0"}}),
        );
        assert!(parse_instance("gdlauncher", temp.path())
            .unwrap()
            .error
            .is_none());
    }

    #[test]
    fn malformed_metadata_is_listed_with_an_error() {
        let temp = tempfile::tempdir().unwrap();
        fs::create_dir_all(temp.path().join("Instances/Broken")).unwrap();
        fs::write(
            temp.path().join("Instances/Broken/minecraftinstance.json"),
            "{broken",
        )
        .unwrap();
        let result = scan("curseforge", Some(text_path(temp.path()))).unwrap();
        assert_eq!(result.instances.len(), 1);
        assert!(result.instances[0].error.is_some());
    }

    #[test]
    fn legacy_modrinth_profile_normalizes_loader_id() {
        let temp = tempfile::tempdir().unwrap();
        write(
            &temp.path().join("profile.json"),
            json!({"metadata":{"name":"Old Modrinth","game_version":"1.21.1","loader":"fabric","loader_version":{"id":"fabric-loader-0.16.9-1.21.1"}}}),
        );
        let item = parse_instance("modrinth", temp.path()).unwrap();
        assert_eq!(item.loader_version, "0.16.9");
        assert!(item.error.is_none());
    }

    #[test]
    fn modrinth_database_reads_custom_directory_without_modifying_database() {
        let temp = tempfile::tempdir().unwrap();
        let data = tempfile::tempdir().unwrap();
        fs::create_dir_all(data.path().join("profiles/Test")).unwrap();
        let database = temp.path().join("app.db");
        let db = Connection::open(&database).unwrap();
        db.execute_batch("CREATE TABLE settings(custom_dir TEXT); CREATE TABLE profiles(path TEXT,name TEXT,game_version TEXT,mod_loader TEXT,mod_loader_version TEXT);").unwrap();
        db.execute("INSERT INTO settings VALUES (?1)", [text_path(data.path())])
            .unwrap();
        db.execute(
            "INSERT INTO profiles VALUES ('Test','Pack','1.21.1','fabric','0.16.9')",
            [],
        )
        .unwrap();
        drop(db);
        let before = fs::read(&database).unwrap();
        let items = scan_modrinth_database(temp.path()).unwrap();
        assert_eq!(items.len(), 1);
        assert!(items[0].error.is_none());
        assert_eq!(
            Path::new(&items[0].game_directory),
            data.path().join("profiles/Test")
        );
        assert_eq!(fs::read(database).unwrap(), before);
    }

    #[test]
    fn modern_modrinth_handles_disabled_materialized_files_and_missing_files() {
        let temp = tempfile::tempdir().unwrap();
        fs::create_dir_all(temp.path().join("profiles/Test/mods")).unwrap();
        fs::write(
            temp.path().join("profiles/Test/mods/test.jar.disabled"),
            b"mod",
        )
        .unwrap();
        let db = Connection::open(temp.path().join("app.db")).unwrap();
        db.execute_batch("CREATE TABLE settings(custom_dir TEXT); INSERT INTO settings VALUES (NULL);
            CREATE TABLE instances(id TEXT,path TEXT,name TEXT,applied_content_set_id TEXT);
            CREATE TABLE instance_content_sets(id TEXT,game_version TEXT,loader TEXT,loader_version TEXT);
            CREATE TABLE instance_files(instance_id TEXT,relative_path TEXT,enabled INTEGER,missing INTEGER);
            INSERT INTO instances VALUES ('a','Test','Modern Pack','b');
            INSERT INTO instance_content_sets VALUES ('b','1.21.1','fabric','0.16.9');
            INSERT INTO instance_files VALUES ('a','mods/test.jar',0,0);").unwrap();
        assert!(scan_modrinth_database(temp.path()).unwrap()[0]
            .error
            .is_none());
        db.execute(
            "INSERT INTO instance_files VALUES ('a','mods/missing.jar',1,0)",
            [],
        )
        .unwrap();
        assert!(scan_modrinth_database(temp.path()).unwrap()[0]
            .error
            .as_ref()
            .unwrap()
            .contains("not present"));
    }

    #[test]
    fn copies_preserve_source_worlds_and_configs_and_never_merge_collisions() {
        let temp = tempfile::tempdir().unwrap();
        let source = temp.path().join("source");
        let base = temp.path().join("dest");
        fs::create_dir_all(source.join("saves/World")).unwrap();
        fs::create_dir_all(source.join("config")).unwrap();
        fs::write(source.join("saves/World/level.dat"), b"world").unwrap();
        fs::write(source.join("config/instance.json"), b"game config").unwrap();
        fs::write(source.join("instance.json"), b"launcher metadata").unwrap();
        let first = copy_instance(&source, &base, "Pack", &mut |_| {}).unwrap();
        let second = copy_instance(&source, &base, "Pack", &mut |_| {}).unwrap();
        assert_ne!(first, second);
        assert_eq!(
            fs::read(source.join("saves/World/level.dat")).unwrap(),
            b"world"
        );
        assert_eq!(
            fs::read(first.join("config/instance.json")).unwrap(),
            b"game config"
        );
        assert!(!first.join("instance.json").exists());
        fs::write(first.join("saves/World/level.dat"), b"changed copy").unwrap();
        assert_eq!(
            fs::read(source.join("saves/World/level.dat")).unwrap(),
            b"world"
        );
    }

    #[test]
    fn destination_inside_source_is_rejected() {
        let temp = tempfile::tempdir().unwrap();
        assert!(copy_instance(
            temp.path(),
            &temp.path().join("nested"),
            "Pack",
            &mut |_| {}
        )
        .unwrap_err()
        .contains("outside"));
        assert!(!temp.path().join("nested").exists());
    }

    #[test]
    fn version_paths_are_rejected() {
        let temp = tempfile::tempdir().unwrap();
        write(
            &temp.path().join("minecraftinstance.json"),
            json!({"name":"Bad","gameVersion":"../../other"}),
        );
        assert!(parse_instance("curseforge", temp.path())
            .unwrap()
            .error
            .is_some());
    }
}

#[tauri::command]
pub async fn prepare_setup_directories(app: AppHandle) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let settings = storage::load_settings(app)?;
        for path in [
            &settings.launcher_folder,
            &settings.game_directory,
            &settings.minecraft_storage_directory,
        ] {
            let path = storage::expand_path(path)?;
            if !path.is_absolute() {
                return Err("Setup directories must be absolute paths.".into());
            }
            fs::create_dir_all(&path)
                .map_err(|e| format!("Cannot create {}: {e}", path.display()))?;
            tempfile::NamedTempFile::new_in(&path)
                .map_err(|e| format!("Folder is not writable: {}: {e}", path.display()))?;
        }
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}
