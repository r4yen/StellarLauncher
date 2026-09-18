import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const keyPath = join(homedir(), ".tauri", "stellarlauncher.key");
const configPath = join(root, "src-tauri", "tauri.conf.json");
const config = JSON.parse(readFileSync(configPath, "utf8"));

if (!existsSync(keyPath)) {
  if (config.plugins?.updater?.pubkey) {
    throw new Error("An update public key is already configured. Restore the original private key instead of generating a replacement.");
  }
  mkdirSync(dirname(keyPath), { recursive: true });
  const generated = spawnSync(process.execPath, [
    join(root, "node_modules", "@tauri-apps", "cli", "tauri.js"),
    "signer", "generate", "--ci", "--write-keys", keyPath
  ], { cwd: root, encoding: "utf8" });
  // Do not print CLI output: signer output may contain private key material.
  if (generated.status !== 0) throw new Error("Could not generate the update signing key.");
}
const publicKey = readFileSync(`${keyPath}.pub`, "utf8").trim();
if (config.plugins?.updater?.pubkey && config.plugins.updater.pubkey !== publicKey) {
  throw new Error("The local key does not match the configured update public key.");
}
config.bundle.createUpdaterArtifacts = true;
config.plugins = {
  ...config.plugins,
  updater: {
    pubkey: publicKey,
    endpoints: ["https://github.com/r4yen/StellarLauncher/releases/latest/download/latest.json"],
    windows: { installMode: "passive" }
  }
};
writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
console.log(`Updater configured. Private signing key: ${keyPath}`);
console.log("Back up this key and add its file contents as the GitHub Actions secret TAURI_SIGNING_PRIVATE_KEY.");
