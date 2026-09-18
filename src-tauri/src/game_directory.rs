use crate::storage::{self, Instance, LauncherSettings};
use serde::Serialize;
use std::{
    fs,
    path::{Path, PathBuf},
};
use tauri::AppHandle;

#[derive(Serialize)]
pub struct RenameResult {
    settings: LauncherSettings,
    instances: Vec<Instance>,
}

fn rename_target(source: &Path, name: &str) -> Result<PathBuf, String> {
    let name = name.trim();
    let stem = name.split('.').next().unwrap_or("").to_ascii_uppercase();
    if name.is_empty()
        || name == "."
        || name == ".."
        || name.ends_with('.')
        || name
            .chars()
            .any(|c| c.is_control() || "<>:\"/\\|?*".contains(c))
        || matches!(stem.as_str(), "CON" | "PRN" | "AUX" | "NUL")
        || (stem.len() == 4
            && (stem.starts_with("COM") || stem.starts_with("LPT"))
            && matches!(stem.as_bytes()[3], b'1'..=b'9'))
    {
        return Err("Enter a valid folder name, without a path.".into());
    }
    let metadata = fs::symlink_metadata(source)
        .map_err(|error| format!("Cannot access game directory: {error}"))?;
    if !metadata.is_dir() || metadata.file_type().is_symlink() {
        return Err("The game directory must be an existing folder, not a symbolic link.".into());
    }
    if !source.is_absolute() || source.file_name().is_none() {
        return Err("Select an absolute game directory below a parent folder.".into());
    }
    let target = source
        .parent()
        .ok_or("The game directory has no parent folder.")?
        .join(name);
    if fs::symlink_metadata(&target).is_ok() {
        return Err(
            "A file or folder with that name already exists. Choose a different name.".into(),
        );
    }
    Ok(target)
}

fn remap_path(value: &mut String, source: &Path, target: &Path) -> Result<(), String> {
    if value.trim().is_empty() {
        return Ok(());
    }
    let expanded = storage::expand_path(value.trim())?;
    // Canonicalize existing paths so environment variables, casing and aliases match.
    let mut ancestor = expanded.as_path();
    let mut suffix = Vec::new();
    let resolved = loop {
        if let Ok(mut resolved) = fs::canonicalize(ancestor) {
            for part in suffix.iter().rev() {
                resolved.push(part);
            }
            break resolved;
        }
        match (ancestor.file_name(), ancestor.parent()) {
            (Some(name), Some(parent)) => {
                suffix.push(name.to_os_string());
                ancestor = parent;
            }
            _ => break expanded.clone(),
        }
    };
    let source_parts: Vec<_> = source.components().collect();
    let resolved_parts: Vec<_> = resolved.components().collect();
    if resolved_parts.len() < source_parts.len() {
        return Ok(());
    }
    let matches = source_parts
        .iter()
        .zip(&resolved_parts)
        .all(|(left, right)| {
            if cfg!(windows) {
                left.as_os_str()
                    .to_string_lossy()
                    .eq_ignore_ascii_case(&right.as_os_str().to_string_lossy())
            } else {
                left == right
            }
        });
    if matches {
        let mut updated = target.to_path_buf();
        for part in &resolved_parts[source_parts.len()..] {
            updated.push(part.as_os_str());
        }
        *value = updated.to_string_lossy().into_owned();
    }
    Ok(())
}

fn rename_and_save(
    source: &Path,
    target: &Path,
    save: impl FnOnce() -> Result<(), String>,
) -> Result<(), String> {
    fs::rename(source, target).map_err(|error| format!("Cannot rename game directory: {error}"))?;
    if let Err(error) = save() {
        return match fs::rename(target, source) {
            Ok(()) => Err(error),
            Err(rollback) => Err(format!(
                "{error} Cannot restore the folder name: {rollback}. The folder is at {}.",
                target.display()
            )),
        };
    }
    Ok(())
}

#[tauri::command]
pub fn rename_game_directory(
    app: AppHandle,
    expected_directory: String,
    new_name: String,
) -> Result<RenameResult, String> {
    let old_settings = storage::load_settings(app.clone())?;
    if old_settings.game_directory != expected_directory {
        return Err("The game directory setting changed. Please try again.".into());
    }
    let expanded = storage::expand_path(old_settings.game_directory.trim())?;
    let target = rename_target(&expanded, &new_name)?;
    let source = fs::canonicalize(&expanded)
        .map_err(|error| format!("Cannot resolve game directory: {error}"))?;
    if source.file_name().is_none() {
        return Err("A filesystem root cannot be renamed.".into());
    }
    let config_dir = fs::canonicalize(storage::app_data_dir(&app)?)
        .map_err(|error| format!("Cannot resolve launcher configuration directory: {error}"))?;
    if config_dir.starts_with(&source) {
        return Err("This folder contains the launcher's configuration and cannot be renamed while the launcher is open.".into());
    }
    let old_instances = storage::load_instances(app.clone())?;
    let mut settings = old_settings.clone();
    let mut instances = old_instances.clone();
    for path in [
        &mut settings.game_directory,
        &mut settings.minecraft_storage_directory,
        &mut settings.launcher_folder,
        &mut settings.java_8_path,
        &mut settings.java_17_path,
        &mut settings.java_21_path,
        &mut settings.java_25_path,
    ] {
        remap_path(path, &source, &target)?;
    }
    for instance in &mut instances {
        remap_path(&mut instance.game_directory, &source, &target)?;
        remap_path(&mut instance.java_path, &source, &target)?;
        if let Some(path) = instance.icon.strip_prefix("local-file:") {
            let mut path = path.to_owned();
            remap_path(&mut path, &source, &target)?;
            instance.icon = format!("local-file:{path}");
        }
    }
    rename_and_save(&expanded, &target, || {
        let result = storage::write_json(&app, "instances.json", &instances)
            .and_then(|()| storage::write_json(&app, "settings.json", &settings));
        if let Err(error) = result {
            let restore_instances = storage::write_json(&app, "instances.json", &old_instances);
            let restore_settings = storage::write_json(&app, "settings.json", &old_settings);
            let mut message = format!("Could not save the renamed paths: {error}");
            for restore in [restore_instances, restore_settings] {
                if let Err(restore_error) = restore {
                    message.push_str(&format!(" Restore failed: {restore_error}"));
                }
            }
            return Err(message);
        }
        Ok(())
    })?;
    Ok(RenameResult {
        settings,
        instances,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    struct TestDirectory(PathBuf);
    impl TestDirectory {
        fn new() -> Self {
            let path =
                std::env::temp_dir().join(format!("stellar-rename-test-{}", uuid::Uuid::new_v4()));
            fs::create_dir(&path).unwrap();
            Self(path)
        }
    }
    impl Drop for TestDirectory {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn rename_keeps_contents_and_parent() {
        let temp = TestDirectory::new();
        let source = temp.0.join("old");
        fs::create_dir(&source).unwrap();
        fs::write(source.join("world.dat"), b"world").unwrap();
        let target = rename_target(&source, "New Game Folder").unwrap();
        rename_and_save(&source, &target, || Ok(())).unwrap();
        assert_eq!(target.parent(), source.parent());
        assert!(!source.exists());
        assert_eq!(fs::read(target.join("world.dat")).unwrap(), b"world");
    }

    #[test]
    fn rejects_paths_reserved_names_and_existing_targets() {
        let temp = TestDirectory::new();
        for name in [
            "",
            ".",
            "..",
            "../other",
            "a/b",
            "a\\b",
            "C:\\other",
            "CON",
            "NUL.txt",
            "COM1",
            "trailing.",
        ] {
            assert!(rename_target(&temp.0, name).is_err(), "{name}");
        }
        assert!(rename_target(&temp.0, temp.0.file_name().unwrap().to_str().unwrap()).is_err());
    }

    #[test]
    fn save_failure_restores_original_folder_and_contents() {
        let temp = TestDirectory::new();
        let source = temp.0.join("old");
        fs::create_dir(&source).unwrap();
        fs::write(source.join("world.dat"), b"world").unwrap();
        let target = rename_target(&source, "new").unwrap();
        assert!(rename_and_save(&source, &target, || Err("save failed".into())).is_err());
        assert!(!target.exists());
        assert_eq!(fs::read(source.join("world.dat")).unwrap(), b"world");
    }

    #[test]
    fn remaps_matching_paths_and_leaves_other_profiles_untouched() {
        let temp = TestDirectory::new();
        let source = fs::canonicalize(&temp.0).unwrap();
        let target = source.with_file_name("renamed");
        let mut same = format!("  {}  ", source.display());
        let mut child = temp.0.join("mods").to_string_lossy().into_owned();
        let mut other = format!("{}-other", source.display());
        let original_other = other.clone();
        remap_path(&mut same, &source, &target).unwrap();
        remap_path(&mut child, &source, &target).unwrap();
        remap_path(&mut other, &source, &target).unwrap();
        assert_eq!(PathBuf::from(same), target);
        assert_eq!(PathBuf::from(child), target.join("mods"));
        assert_eq!(other, original_other);
    }
}
