# Instance management

Instances use compact searchable rows with a launch/stop button, status and an action menu. The menu includes editing, mod management, duplication, backups, .mrpack export and profile removal.

Accounts use the same row layout. Both libraries support named folders with drag handles for moving entries between folders, out of folders, and into another position. Folder headers can also be dragged to reorder folders. Removing a folder keeps its entries outside folders. These are organizational folders only; game directories are never moved. Organization is saved separately in `organization.json`, with independent account and instance sections.

Folders start collapsed on each page visit. The Home account/instance selectors use the same folders and ordering; their folders start collapsed whenever the selector opens. Entries outside folders are immediately visible.

The saved accent color is loaded before React renders the loading screen. The new SVG logo is shared with the application icons and NSIS branding. The installer uses 24-bit BMP artwork at 150×57 and 164×314 pixels; English and German installer translations are enabled. Regenerate icons with Tauri's icon command and installer artwork with `scripts/generate-branding.mjs` (requires Playwright/Edge; `PLAYWRIGHT_MODULE` can point to an external installation).

The launcher importer uses a native select in both setup and Settings. Windows native file drag/drop interception is disabled so HTML drag-and-drop ordering works inside the launcher; file imports still use file dialogs.

Backups include the game directory and profile metadata. They are stored in the application data directory under `backups/<instance-id>`. Restoration first backs up the current state, stages the selected backup, then replaces the game directory. If saving the profile fails, the previous directory is restored. Shared or overlapping game directories cannot be restored in place. Duplicating creates an independent copy; originals remain intact.

Before changing Minecraft or modloader versions, Stellar creates a backup by default. This can be disabled in Settings → Advanced. Backups currently have no automatic retention policy.

Settings are grouped into General, Minecraft & Java, Downloads, Import and Advanced. Java installation is automatic before launch; advanced per-instance Java paths take precedence. Completed managed installations are reused. The initial setup only installs Java 21; other versions are installed when required.

Minecraft, Java, mod and .mrpack downloads can be cancelled and retried. Mod downloads use temporary files so cancellation does not replace an existing mod with an incomplete download. Retry actions are available for the current launcher session. Launcher-to-launcher copying and backup operations display progress or a busy indicator and must finish before further mutations.

Launch failures provide an actionable explanation and expandable technical details. Core interface labels follow the selected German/English language; technical logs and remote service errors retain their original text.

Validation covers native backup preservation/restore/rollback, cancellation registration, Java selection and installation reuse. Mocked desktop checks cover setup, settings, language, backup actions, duplicate, automatic Java preparation, download cancellation/retry and compact layouts. Live Microsoft authentication and full Java downloads require a desktop smoke test.
