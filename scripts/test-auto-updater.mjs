import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

// Test the actual controller with fake downloads/installers; never modify the installed app.
const source = readFileSync(new URL("../src/services/autoUpdater.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { AutoUpdater } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const flush = () => new Promise((resolve) => setImmediate(resolve));

function fixture(overrides = {}) {
  const calls = { checks: 0, installs: 0, restarts: 0, closes: 0, statuses: [] };
  const update = {
    version: "1.0.5",
    async downloadAndInstall(progress) {
      calls.installs++;
      progress({ event: "Started", data: { contentLength: 100 } });
      progress({ event: "Progress", data: { chunkLength: 50 } });
      progress({ event: "Finished" });
    },
    async close() { calls.closes++; }
  };
  const controller = new AutoUpdater({
    async check() { calls.checks++; return update; },
    async restart() { calls.restarts++; },
    publish(status) { calls.statuses.push(status); },
    ...overrides
  });
  return { controller, calls, update };
}

test("disabled updater never checks or installs", async () => {
  const { controller, calls } = fixture();
  controller.setEnabled(false);
  await flush();
  assert.equal(calls.checks, 0);
  assert.equal(calls.installs, 0);
  assert.match(calls.statuses.at(-1).message, /disabled/);
});

test("enabled updater checks once, installs and restarts with progress", async () => {
  const { controller, calls } = fixture();
  controller.setEnabled(true);
  controller.setEnabled(true);
  await flush();
  assert.equal(calls.checks, 1);
  assert.equal(calls.installs, 1);
  assert.equal(calls.restarts, 1);
  assert.ok(calls.statuses.some((status) => status.progress === 50));
});

test("running games or downloads defer installation until idle", async () => {
  const { controller, calls } = fixture();
  controller.setBlocked(true);
  controller.setEnabled(true);
  await flush();
  assert.equal(calls.installs, 0);
  assert.equal(calls.statuses.at(-1).phase, "available");
  controller.setBlocked(false);
  await flush();
  assert.equal(calls.installs, 1);
  assert.equal(calls.restarts, 1);
});

test("disabling while blocked discards the update", async () => {
  const { controller, calls } = fixture();
  controller.setBlocked(true);
  controller.setEnabled(true);
  await flush();
  controller.setEnabled(false);
  controller.setBlocked(false);
  await flush();
  assert.equal(calls.installs, 0);
  assert.equal(calls.closes, 1);
});

test("disabling during a network check prevents installation", async () => {
  let resolveCheck;
  const { controller, calls, update } = fixture({ check: () => new Promise((resolve) => { resolveCheck = resolve; }) });
  controller.setEnabled(true);
  controller.setEnabled(false);
  resolveCheck(update);
  await flush();
  assert.equal(calls.installs, 0);
  assert.equal(calls.closes, 1);
});

test("no newer version means no download or restart", async () => {
  const { controller, calls } = fixture({ check: async () => null });
  controller.setEnabled(true);
  await flush();
  assert.equal(calls.statuses.at(-1).phase, "current");
  assert.equal(calls.installs, 0);
  assert.equal(calls.restarts, 0);
});

test("network failures keep the launcher usable without retries in a loop", async () => {
  const { controller, calls } = fixture({ check: async () => { throw new Error("offline"); } });
  controller.setEnabled(true);
  await flush();
  controller.setBlocked(false);
  controller.setEnabled(true);
  assert.equal(calls.statuses.at(-1).phase, "error");
  assert.equal(calls.installs, 0);
  assert.equal(calls.restarts, 0);
});

test("failed signature or installation never restarts the app", async () => {
  const { controller, calls, update } = fixture();
  update.downloadAndInstall = async () => { throw new Error("signature mismatch"); };
  controller.setEnabled(true);
  await flush();
  assert.equal(calls.statuses.at(-1).phase, "error");
  assert.equal(calls.restarts, 0);
  assert.equal(calls.closes, 1);
});

test("disposing ignores an in-flight response and closes its resource", async () => {
  let resolveCheck;
  const { controller, calls, update } = fixture({ check: () => new Promise((resolve) => { resolveCheck = resolve; }) });
  controller.setEnabled(true);
  controller.dispose();
  resolveCheck(update);
  await flush();
  assert.equal(calls.installs, 0);
  assert.equal(calls.closes, 1);
});
