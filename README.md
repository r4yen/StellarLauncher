# StellarLauncher

StellarLauncher is a modern Minecraft launcher for Windows and Linux built with Tauri, React, TypeScript, and Rust.
It provides local account management, instance creation, mod handling, live launch status, and a dark galaxy-inspired desktop UI.

## Features

- Local Minecraft instance management
- Vanilla, Fabric, Forge, NeoForge, and Quilt support
- Microsoft account login architecture with local desktop OAuth flow
- Offline player accounts
- Custom dark theme with precise accent color selection
- Live Minecraft launch status and console log display
- Local Minecraft file preparation and downloader status panel
- Mod manager for loader instances
- Custom frameless desktop title bar
- Favorite instances and accounts with manual ordering

## Commands

- `npm run tauri dev`: Start the launcher in development mode
- `npm run build:frontend`: Build the frontend only
- `npm run build`: Build all configured desktop bundles. On Windows this builds the NSIS installer and then builds the Linux AppImage through WSL.
- `npm run build:windows`: Build the Windows NSIS installer
- `npm run build:linux`: Build the Linux AppImage. On Windows this runs the Linux build through WSL.
- `npm run tauri build`: Build through Tauri using the platform config

## Compatibility

- Windows (x64)
- Linux (x86-64)
- Tauri `2`
- React `18`
- TypeScript `5`
- Rust `1.77+`
- Minecraft local files prepared through Mojang and loader metadata APIs

## Arch Linux Build

Install the native Tauri/WebKit dependencies before building:

```bash
sudo pacman -Syu
sudo pacman -S --needed webkit2gtk-4.1 base-devel curl wget file openssl appmenu-gtk-module libappindicator-gtk3 librsvg xdotool
```

Then build the AppImage on Arch Linux:

```bash
npm install
npm run build
```

The AppImage is written under `src-tauri/target/release/bundle/appimage/`.

Windows can build both artifacts when WSL is installed and the project is accessible from WSL:

```powershell
wsl --list --online
wsl --install Ubuntu
npm install
npm run build
```

That builds the Windows installer under `src-tauri\target\release\bundle\nsis\` and then runs the AppImage build inside WSL.

After installing WSL for the first time, open the distribution once and complete its user setup. Then install Node.js, Rust and the Arch/Linux Tauri dependencies inside WSL before running the AppImage build.

## License

All rights reserved.
