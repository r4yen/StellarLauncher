# Launcher import and first-time setup

Settings contains a separate **Import from other launchers** section. Select a launcher, then check the instances to copy. Standard Windows and Linux locations are detected automatically. Portable/custom installations can be selected with **Choose folder**; Prism-family `InstanceDir` and Modrinth's database `custom_dir` are followed automatically.

Supported formats:

- Modrinth: legacy `profile.json`, SQLite `profiles`, and newer `instances` / `instance_content_sets`. Select the folder containing `app.db` for database-based installations. Disabled content files retain their `.disabled` suffix. Profiles whose recorded content is absent must be repaired in Modrinth or exported as `.mrpack` first.
- CurseForge: `Instances/*/minecraftinstance.json`.
- Prism Launcher, MultiMC and PolyMC: `instance.cfg`, `mmc-pack.json`, and `.minecraft` / `minecraft`.
- ATLauncher: `instances/*/instance.json`.
- GDLauncher Legacy: `instances/*/config.json`; GDLauncher Carbon is not supported by this adapter.

Imports are independent copies under the configured Game Directory. Existing folders are never merged; repeated names receive a numeric suffix. Game data, including worlds, mods, resource packs and game configurations, is retained. Launcher metadata and accounts are not migrated; Stellar's Java, memory and JVM defaults are used. Close the source game before copying. Unsupported loaders/components, broken metadata and symbolic links/junctions cause visible errors rather than silent incomplete imports. Each successful instance is saved separately and errors are reported per instance. A disk/storage failure may leave copied files at the path reported in the error.

The first-time guide creates and checks the configured directories, installs managed Eclipse Adoptium Java 21 and saves its path. Before each game launch, Stellar automatically installs the matching Java runtime (8, 16, 17, 21 or 25) if needed. Account login, launcher import and instance creation remain available while Java installs. There is no navigation into the main launcher or game launch until setup succeeds and **Open Stellar** is selected. Closing the app is still possible; unfinished setup resumes next start. Completed runtimes are reused on retry. Auto-updates remain blocked during setup.

The guide uses two fixed panes, **Accounts** and **Instances**, with a compact setup status and finish button below. Only the account and instance lists scroll. Importing replaces the instance list with a launcher selector and checklist inside the same pane; the back arrow returns to the prepared instances. This layout also fits the minimum 980 × 680 window size.

Existing settings without the new completion flag are treated as an existing installation. The guide can be opened manually at **Settings → First-time setup → Open setup guide**. A fresh settings file begins with `initialSetupCompleted: false` and is only marked complete after successful setup and confirmation in the guide.

Validation: Rust fixture tests cover launcher schemas, both database layouts, custom paths, unsupported instances, copy isolation, collisions and Java retry markers. Frontend builds and a mocked desktop UI smoke test cover the first-run gate, restart, background login/import/create, Java failure/retry and completion persistence. Live Microsoft login and full Java downloads are not automated by these tests.

Format references:

- [Prism data locations](https://prismlauncher.org/wiki/getting-started/data-location/)
- [Modrinth import adapters](https://github.com/modrinth/code/tree/main/packages/app-lib/src/api/pack/import)
- [Modrinth database migrations](https://github.com/modrinth/code/tree/main/packages/app-lib/migrations)
- [Modrinth managed content paths](https://github.com/modrinth/code/blob/main/packages/app-lib/src/state/content_store/domain/paths.rs)
