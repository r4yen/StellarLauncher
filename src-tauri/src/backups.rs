use crate::storage::{self, Instance};
use serde::Serialize;
use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
};
use tauri::AppHandle;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Backup {
    id: String,
    created_at: String,
    minecraft_version: String,
    loader_type: String,
}
fn safe_id(id: &str) -> Result<(), String> {
    if id.is_empty()
        || id.contains("..")
        || !id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    {
        return Err("Invalid instance or backup ID.".into());
    }
    Ok(())
}
fn root(app: &AppHandle, id: &str) -> Result<PathBuf, String> {
    safe_id(id)?;
    Ok(storage::app_data_dir(app)?.join("backups").join(id))
}
fn find(app: &AppHandle, id: &str) -> Result<Instance, String> {
    storage::load_instances(app.clone())?
        .into_iter()
        .find(|i| i.id == id)
        .ok_or("Instance not found.".into())
}
fn snapshot(app: &AppHandle, instance: &Instance) -> Result<String, String> {
    let root = root(app, &instance.id)?;
    fs::create_dir_all(&root).map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    let source = storage::expand_path(&instance.game_directory)?;
    let directory = if source.is_dir() {
        crate::launcher_import::copy_directory(&source, &root, &id, false, &mut |_| {})?
    } else {
        let directory = root.join(&id);
        fs::create_dir(&directory).map_err(|e| e.to_string())?;
        directory
    };
    // Metadata is kept outside game data so user files cannot replace it.
    let metadata = root.join(format!("{id}.json"));
    fs::write(
        metadata,
        serde_json::to_vec_pretty(instance).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    fs::write(
        root.join(format!("{id}.time")),
        chrono::Utc::now().to_rfc3339(),
    )
    .map_err(|e| e.to_string())?;
    Ok(directory
        .file_name()
        .unwrap()
        .to_string_lossy()
        .into_owned())
}
fn persist(app: &AppHandle, instances: &[Instance]) -> Result<(), String> {
    let root = storage::app_data_dir(app)?;
    let mut temp = tempfile::NamedTempFile::new_in(&root).map_err(|e| e.to_string())?;
    temp.write_all(&serde_json::to_vec_pretty(instances).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;
    temp.as_file().sync_all().map_err(|e| e.to_string())?;
    temp.persist(root.join("instances.json"))
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn create_instance_backup(app: AppHandle, instance_id: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || snapshot(&app, &find(&app, &instance_id)?))
        .await
        .map_err(|e| e.to_string())?
}
#[tauri::command]
pub async fn list_instance_backups(
    app: AppHandle,
    instance_id: String,
) -> Result<Vec<Backup>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let root = root(&app, &instance_id)?;
        if !root.exists() {
            return Ok(Vec::new());
        }
        let mut result = Vec::new();
        for entry in fs::read_dir(&root).map_err(|e| e.to_string())? {
            let path = entry.map_err(|e| e.to_string())?.path();
            if path.extension().and_then(|v| v.to_str()) != Some("json") {
                continue;
            }
            let instance: Instance =
                serde_json::from_slice(&fs::read(&path).map_err(|e| e.to_string())?)
                    .map_err(|e| e.to_string())?;
            let id = path.file_stem().unwrap().to_string_lossy().into_owned();
            result.push(Backup {
                id: id.clone(),
                created_at: fs::read_to_string(root.join(format!("{id}.time"))).unwrap_or_default(),
                minecraft_version: instance.minecraft_version,
                loader_type: instance.loader_type,
            });
        }
        result.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        Ok(result)
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
pub async fn duplicate_instance(
    app: AppHandle,
    instance_id: String,
) -> Result<Vec<Instance>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut instance = find(&app, &instance_id)?;
        let settings = storage::load_settings(app.clone())?;
        let base = storage::expand_path(&settings.game_directory)?;
        let source = storage::expand_path(&instance.game_directory)?;
        // A shared base directory cannot contain its own duplicate. Put the copy beside it.
        let base =
            if source.exists() && fs::canonicalize(&base).ok() == fs::canonicalize(&source).ok() {
                source
                    .parent()
                    .ok_or("No parent directory")?
                    .join("StellarInstances")
            } else {
                base
            };
        instance.name = format!(
            "{} ({})",
            instance.name,
            if settings.language == "de" {
                "Kopie"
            } else {
                "Copy"
            }
        );
        let directory = if source.is_dir() {
            crate::launcher_import::copy_directory(
                &source,
                &base,
                &instance.name,
                false,
                &mut |_| {},
            )?
        } else {
            fs::create_dir_all(&base).map_err(|e| e.to_string())?;
            crate::mrpack::create_pack_directory(&base, &instance.name)?
        };
        instance.id = uuid::Uuid::new_v4().to_string();
        instance.game_directory = directory.to_string_lossy().into_owned();
        instance.created_at = chrono::Utc::now().to_rfc3339();
        instance.last_played_at = None;
        instance.playtime_seconds = Some(0);
        instance.is_favorite = Some(false);
        let mut instances = storage::load_instances(app.clone())?;
        instance.order = Some(instances.len() as u32);
        instances.push(instance);
        persist(&app, &instances)?;
        Ok(instances)
    })
    .await
    .map_err(|e| e.to_string())?
}

fn swap_directory(
    target: &Path,
    staged: &Path,
    old: &Path,
    save: impl FnOnce() -> Result<(), String>,
) -> Result<(), String> {
    let existed = target.exists();
    if existed {
        fs::rename(target, old).map_err(|e| format!("Cannot move existing game directory: {e}"))?;
    }
    if let Err(error) = fs::rename(staged, target) {
        if existed {
            let _ = fs::rename(old, target);
        }
        return Err(error.to_string());
    }
    if let Err(error) = save() {
        let moved = fs::rename(target, staged);
        if moved.is_ok() && existed {
            fs::rename(old, target).map_err(|rollback| {
                format!(
                    "{error}; recovery directory: {} ({rollback})",
                    old.display()
                )
            })?;
        }
        return Err(error);
    }
    Ok(())
}
#[tauri::command]
pub async fn restore_instance_backup(
    app: AppHandle,
    instance_id: String,
    backup_id: String,
) -> Result<Vec<Instance>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        safe_id(&backup_id)?;
        let current=find(&app,&instance_id)?; let root=root(&app,&instance_id)?;
        let mut restored:Instance=serde_json::from_slice(&fs::read(root.join(format!("{backup_id}.json"))).map_err(|e|e.to_string())?).map_err(|e|e.to_string())?;
        if restored.id!=current.id{return Err("Backup belongs to a different instance.".into());}
        let target=storage::expand_path(&current.game_directory)?;
        let canonical=fs::canonicalize(&target).map_err(|e|e.to_string())?;
        let mut instances=storage::load_instances(app.clone())?;
        for other in &instances {
            if other.id==instance_id{continue;}
            if let Ok(path)=storage::expand_path(&other.game_directory).and_then(|p|fs::canonicalize(p).map_err(|e|e.to_string())) {
                if path.starts_with(&canonical)||canonical.starts_with(&path){return Err("This game folder is shared with another instance. Duplicate the instance before restoring.".into());}
            }
        }
        snapshot(&app,&current)?;
        let parent=canonical.parent().ok_or("Cannot restore a drive root.")?;
        let staging=tempfile::Builder::new().prefix(".stellar-restore-").tempdir_in(parent).map_err(|e|e.to_string())?;
        let staged=crate::launcher_import::copy_directory(&root.join(&backup_id),staging.path(),"restored",false,&mut |_|{})?;
        restored.game_directory=current.game_directory;restored.name=current.name;
        *instances.iter_mut().find(|i|i.id==instance_id).unwrap()=restored;
        if let Err(error)=swap_directory(&canonical,&staged,&staging.path().join("previous"),||persist(&app,&instances)) {
            let recovery=staging.keep(); return Err(format!("{error}. Recovery files: {}",recovery.display()));
        }
        Ok(instances)
    }).await.map_err(|e|e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn backup_copy_preserves_game_metadata_and_restore_replaces_files() {
        let temp = tempfile::tempdir().unwrap();
        let source = temp.path().join("game");
        fs::create_dir(&source).unwrap();
        fs::write(source.join("instance.json"), "user configuration").unwrap();
        fs::write(source.join("world"), "saved world").unwrap();
        let backup = crate::launcher_import::copy_directory(
            &source,
            &temp.path().join("backups"),
            "snapshot",
            false,
            &mut |_| {},
        )
        .unwrap();
        assert_eq!(
            fs::read_to_string(backup.join("instance.json")).unwrap(),
            "user configuration"
        );
        fs::write(source.join("world"), "modified world").unwrap();
        swap_directory(&source, &backup, &temp.path().join("previous"), || Ok(())).unwrap();
        assert_eq!(
            fs::read_to_string(source.join("world")).unwrap(),
            "saved world"
        );
        assert_eq!(
            fs::read_to_string(temp.path().join("previous/world")).unwrap(),
            "modified world"
        );
    }
    #[test]
    fn rejects_backup_path_traversal() {
        assert!(safe_id("../other").is_err());
        assert!(safe_id("C:\\other").is_err());
    }
    #[test]
    fn failed_settings_save_restores_original_world() {
        let temp = tempfile::tempdir().unwrap();
        let target = temp.path().join("game");
        let stage = temp.path().join("stage");
        fs::create_dir(&target).unwrap();
        fs::create_dir(&stage).unwrap();
        fs::write(target.join("world"), "original").unwrap();
        fs::write(stage.join("world"), "snapshot").unwrap();
        assert!(
            swap_directory(&target, &stage, &temp.path().join("old"), || Err(
                "disk full".into()
            ))
            .is_err()
        );
        assert_eq!(
            fs::read_to_string(target.join("world")).unwrap(),
            "original"
        );
    }
}
