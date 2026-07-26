import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = join(scriptDir, "..");
const runTauri = join(scriptDir, "run-tauri.mjs");
const requestedPlatform = process.argv[2] || "all";

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: "inherit",
      shell: false,
      ...options
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`${command} exited with signal ${signal}`));
        return;
      }
      if (code !== 0) {
        reject(new Error(`${command} exited with code ${code ?? 1}`));
        return;
      }
      resolve();
    });
  });
}

function commandAvailable(command, args = ["--version"]) {
  const result = spawnSync(command, args, { stdio: "ignore", shell: false });
  return !result.error && result.status === 0;
}

function wslHasDistribution() {
  const result = spawnSync("wsl", ["--list", "--quiet"], {
    encoding: "utf16le",
    shell: false
  });
  const output = result.stdout.replace(/\0/g, "").trim();
  return result.status === 0 && output.length > 0;
}

function wslProjectPath() {
  const result = spawnSync("wsl", ["wslpath", "-a", root], {
    encoding: "utf8",
    shell: false
  });

  if (result.status === 0 && result.stdout.trim()) {
    return result.stdout.trim();
  }

  const normalized = root.replace(/\\/g, "/");
  const match = normalized.match(/^([A-Za-z]):\/(.*)$/);
  if (!match) return normalized;
  return `/mnt/${match[1].toLowerCase()}/${match[2]}`;
}

function shellQuote(value) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

async function buildWindows() {
  if (process.platform !== "win32") {
    throw new Error("Windows NSIS bundles must be built on Windows.");
  }
  await run(process.execPath, [runTauri, "build", "--bundles", "nsis"]);
}

async function buildLinuxAppImage() {
  if (process.platform === "linux") {
    await run(process.execPath, [runTauri, "build", "--bundles", "appimage"]);
    return;
  }

  if (process.platform !== "win32" || !commandAvailable("wsl", ["--status"])) {
    throw new Error("Linux AppImage bundles must be built on Linux or through WSL on Windows.");
  }

  if (!wslHasDistribution()) {
    throw new Error(
      [
        "WSL is installed, but no Linux distribution is configured.",
        "Install one first, for example:",
        "  wsl --list --online",
        "  wsl --install Ubuntu",
        "",
        "After the distribution setup, install the Linux build dependencies inside WSL and run npm run build again."
      ].join("\n")
    );
  }

  const linuxPath = wslProjectPath();
  await run("wsl", ["bash", "-lc", `cd ${shellQuote(linuxPath)} && npm install && npm run build:linux`]);
}

async function main() {
  if (requestedPlatform === "windows") {
    await buildWindows();
    return;
  }

  if (requestedPlatform === "linux") {
    await buildLinuxAppImage();
    return;
  }

  if (requestedPlatform !== "all") {
    throw new Error(`Unknown build target "${requestedPlatform}". Use all, windows, or linux.`);
  }

  if (process.platform === "win32") {
    if (!commandAvailable("wsl", ["--status"]) || !wslHasDistribution()) {
      throw new Error(
        [
          "npm run build is configured to build both Windows and Linux artifacts.",
          "The Linux AppImage part needs a configured WSL distribution, but none is installed.",
          "",
          "Install one first:",
          "  wsl --list --online",
          "  wsl --install Ubuntu",
          "",
          "Or build only the Windows installer with:",
          "  npm run build:windows"
        ].join("\n")
      );
    }
    await buildWindows();
    await buildLinuxAppImage();
    return;
  }

  if (process.platform === "linux") {
    await buildLinuxAppImage();
    throw new Error("The Linux AppImage was built. Build the Windows NSIS installer on Windows.");
  }

  throw new Error("Unsupported build host. Use Windows with WSL or Arch Linux.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
