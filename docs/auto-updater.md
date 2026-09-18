# GitHub AutoUpdater

The installed launcher checks for updates on startup when **Settings → AutoUpdater** is enabled (the default, including existing configurations). It downloads, verifies and installs newer versions, then restarts automatically. Running Minecraft instances and active downloads postpone installation. Offline checks and failed downloads show a status in Settings and leave the launcher usable. Browser previews and development builds do not install updates.

Updates are hosted entirely on the public GitHub repository:

`https://github.com/r4yen/StellarLauncher/releases/latest/download/latest.json`

## One-time setup

The public verification key is committed in `src-tauri/tauri.conf.json`. The private signing key is stored outside the repository at `~/.tauri/stellarlauncher.key`. Back up this file; future releases must use the same key. Never commit or publish the private key.

In the repository's **Settings → Secrets and variables → Actions**, add:

- `TAURI_SIGNING_PRIVATE_KEY`: the full contents of the private key file (not its filesystem path).
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: only needed if the signing key has a password. The generated local key uses an empty password.

`npm run setup:updater` configures an initial key, or checks the existing local public key. It refuses to generate a replacement when the app already has a configured key. On another development machine, restore the original private key and its `.pub` companion.

## Publish an update

1. Increment the app version consistently in the npm and Cargo manifests, lockfiles, Tauri configuration and version labels.
2. Commit and push the changes, then push the matching tag, for example `v1.0.5`. Alternatively, run **Build release** from GitHub Actions for the current version.
3. The workflow builds Windows NSIS and Linux AppImage bundles, signs them, and uploads the bundles, `.sig` files and `latest.json` to a draft release. Both platform entries are collected before publication.
4. After both builds succeed, publish the draft release. Enabled clients discover it on their next startup.

The first version containing this updater must be installed normally. Older versions without updater support cannot acquire that feature automatically. Prereleases and drafts are not served by the latest-release endpoint. The repository and release assets must stay publicly accessible; no GitHub token is embedded in the launcher.

## Local builds

The Tauri wrapper uses `~/.tauri/stellarlauncher.key` automatically if present. Alternatively, provide `TAURI_SIGNING_PRIVATE_KEY` and, if needed, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` as environment variables. WSL/Linux builds need the same original key in that environment, or the signing environment variables supplied there. `npm run build:frontend` does not need a signing key.

`npm run test:updater` tests the update controller with fake installers, including disabled checks, waiting for running games, download progress, network failures and failed signature/installation handling.

References: [Tauri updater](https://v2.tauri.app/plugin/updater/), [Tauri GitHub Action](https://github.com/tauri-apps/tauri-action).
