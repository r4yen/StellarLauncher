# StellarLauncher

Stellar Launcher is a Windows-first Minecraft launcher shell built with Tauri, React, TypeScript, Vite and Rust. The current implementation focuses on a complete polished UI, local mock data, local settings storage and prepared Tauri command boundaries for future authentication, instance management and Java process launch logic.

## Requirements

- Node.js 20 or newer
- npm
- Rust stable toolchain
- Windows build dependencies for Tauri

## Development

```powershell
npm install
npm run tauri dev
```

## Build

```powershell
npm run tauri build
```

The Windows installer target is configured in `src-tauri/tauri.conf.json` as NSIS, which produces a Windows installer `.exe`.

## Project Structure

```text
src/
  assets/              Logo and frontend assets
  components/          App shell, cards, launcher UI components
  components/ui/       Reusable base UI elements
  data/                Mock accounts, instances and defaults
  models/              TypeScript launcher domain types
  pages/               Home, instances, accounts, theme and settings screens
  services/            Storage and Tauri launch service boundaries
  styles/              Global app styling
src-tauri/
  src/                 Rust Tauri commands and app entrypoints
  icons/               Generated app icons based on logo.png
  tauri.conf.json      Tauri app and bundle configuration
```

## Logo And Icons

The existing `logo.png` is used as the official app logo. It is copied to:

- `src/assets/logo.png` for React components
- `public/logo.png` for static access
- `src-tauri/icons/` for generated Tauri app icons

If the icon files ever need to be regenerated manually, run:

```powershell
npm run tauri icon .\logo.png
```

or regenerate equivalent `32x32.png`, `128x128.png`, `128x128@2x.png` and `icon.ico` files from the same source logo.

## Current Features

- Dashboard with logo branding, quick launch and status overview
- Instances page with mock Minecraft profiles and launch buttons
- Accounts page with selectable mock accounts
- Theme editor with persisted accent color, glow and compact mode
- Settings page with persisted Java, RAM, directory and JVM argument values
- Rust Tauri commands prepared for launcher status and mock launch flow

## Planned Backend Work

- Microsoft/Minecraft authentication
- Secure token storage through a native Tauri-safe storage layer
- Real instance discovery, editing and persistence
- Minecraft metadata/download handling
- Java process launching, log streaming and process supervision
