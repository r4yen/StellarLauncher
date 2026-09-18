import { useEffect, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { AutoUpdater, AutoUpdateStatus } from "../services/autoUpdater";

export function useAutoUpdater(ready: boolean, enabled: boolean, blocked: boolean) {
  const [status, setStatus] = useState<AutoUpdateStatus>({ phase: "idle", message: "Updates are checked when the launcher starts." });
  const updater = useRef<AutoUpdater>();

  useEffect(() => {
    const controller = new AutoUpdater({
      check: () => check({ timeout: 15000, allowDowngrades: false }),
      restart: relaunch,
      publish: setStatus
    });
    updater.current = controller;
    return () => controller.dispose();
  }, []);

  useEffect(() => {
    if (!ready) { updater.current?.setBlocked(true); return; }
    if (!isTauri() || import.meta.env.DEV) {
      setStatus({ phase: "idle", message: "Automatic updates run in the installed desktop version." });
      return;
    }
    updater.current?.setEnabled(enabled);
    updater.current?.setBlocked(blocked);
  }, [ready, enabled, blocked]);

  return status;
}
