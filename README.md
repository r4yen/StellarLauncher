# StellarLauncher

StellarLauncher is a modern Windows Minecraft launcher built with Tauri, React, TypeScript, and Rust.
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
- Custom frameless Windows title bar
- Favorite instances and accounts with manual ordering

## Commands

- `npm run tauri dev`: Start the launcher in development mode
- `npm run build`: Build the frontend
- `npm run tauri build`: Build the Windows installer

## Compatibility

- Windows
- Tauri `2`
- React `18`
- TypeScript `5`
- Rust `1.77+`
- Minecraft local files prepared through Mojang and loader metadata APIs

## License

All rights reserved.
