# Modrinth modpacks

Instance import and export use the standard `.mrpack` ZIP format. The former `.stellarinstance` format has been removed.

## Import

Use **Instances → Import .mrpack**. The preview shows the pack version, Minecraft version and loader. Optional client files can be selected before importing. Each import creates a new folder under the Game Directory configured in Settings; an existing folder with the same name is preserved and a numbered folder is created instead.

The importer supports Minecraft, Fabric, Quilt, Forge and NeoForge dependencies. It reads `modrinth.index.json`, verifies both SHA-1 and SHA-512 plus file size, and tries the supplied download mirrors in order. As recommended by the format specification, initial download URLs must use HTTPS and the documented hosts: `cdn.modrinth.com`, `github.com`, `raw.githubusercontent.com`, or `gitlab.com`. HTTPS redirects are followed up to five times.

Required client files are installed, optional files follow the selection, and server-only files are skipped. After downloads, `overrides` is applied, then `client-overrides`; `server-overrides` is not installed. Files are prepared in a temporary directory before a new instance is saved. Java and RAM defaults come from the launcher's settings. Minecraft itself and its loader are prepared by the existing launcher on first launch.

Unknown format versions, games or dependencies are reported as unsupported. They are not silently replaced with a different loader or version. The importer rejects paths outside the instance directory, symbolic links and duplicate file paths.

## Export

Choose **Export** on an instance. Enter the pack name, pack version and optional summary, then select the files and folders to include. Mods, resource packs, shader packs and data packs are matched against Modrinth by file hash. Recognized files are stored as download references with both hashes, size and the available client/server metadata. Other selected files are placed in `overrides`.

The output contains only standard `.mrpack` metadata. Local Java paths, account information, instance icons and Stellar-specific settings are not added as custom format fields. Exporting a running instance is blocked to avoid capturing files while Minecraft is changing them. A failed export preserves any existing destination archive.

## Validation

Run `cargo test --manifest-path src-tauri/Cargo.toml mrpack::tests --lib` for offline checks covering loaders, environment selection, hashes, paths, override precedence, archive round trips and collisions. The ignored `real_modrinth_pack_and_download_smoke` test can also read a real pack from `MRPACK_SMOKE_PATH`, verify an actual Modrinth download and export it through the API. It does not launch Minecraft.

Sources: [official mrpack format](https://support.modrinth.com/en/articles/8802351-modrinth-modpack-format-mrpack), [Modrinth file lookup API](https://docs.modrinth.com/api/operations/versionsfromhashes/).
