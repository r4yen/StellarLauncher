import { existsSync } from "node:fs";
import { join, delimiter } from "node:path";
import { spawn } from "node:child_process";
import { homedir } from "node:os";

const root = process.cwd();
const cargoBin = join(process.env.USERPROFILE || process.env.HOME || "", ".cargo", "bin");
const localTauriCli = join(root, "node_modules", "@tauri-apps", "cli", "tauri.js");
const command = existsSync(localTauriCli) ? process.execPath : "tauri";
const args = existsSync(localTauriCli) ? [localTauriCli, ...process.argv.slice(2)] : process.argv.slice(2);

const env = {
  ...process.env,
  PATH: [process.env.PATH || "", cargoBin].filter(Boolean).join(delimiter)
};

const signingKey = join(homedir(), ".tauri", "stellarlauncher.key");
if (!env.TAURI_SIGNING_PRIVATE_KEY && existsSync(signingKey)) {
  env.TAURI_SIGNING_PRIVATE_KEY = signingKey;
  env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD ??= "";
}

const child = spawn(command, args, {
  cwd: root,
  env,
  stdio: "inherit",
  shell: false
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
