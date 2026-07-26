import { existsSync } from "node:fs";
import { join, delimiter } from "node:path";
import { spawn } from "node:child_process";

const root = process.cwd();
const cargoBin = join(process.env.USERPROFILE || process.env.HOME || "", ".cargo", "bin");
const localTauriCli = join(root, "node_modules", "@tauri-apps", "cli", "tauri.js");
const command = existsSync(localTauriCli) ? process.execPath : "tauri";
const args = existsSync(localTauriCli) ? [localTauriCli, ...process.argv.slice(2)] : process.argv.slice(2);

const env = {
  ...process.env,
  PATH: [process.env.PATH || "", cargoBin].filter(Boolean).join(delimiter)
};

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
