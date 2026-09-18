export interface UpdateProgress {
  event: "Started" | "Progress" | "Finished";
  data?: { contentLength?: number; chunkLength?: number };
}

export interface LauncherUpdate {
  version: string;
  downloadAndInstall: (onProgress: (event: UpdateProgress) => void) => Promise<void>;
  close: () => Promise<void>;
}

export interface AutoUpdateStatus {
  phase: "idle" | "checking" | "available" | "installing" | "restarting" | "current" | "error";
  message: string;
  progress?: number;
}

interface UpdaterDependencies {
  check: () => Promise<LauncherUpdate | null>;
  restart: () => Promise<void>;
  publish: (status: AutoUpdateStatus) => void;
}

export class AutoUpdater {
  private enabled?: boolean;
  private blocked = false;
  private disposed = false;
  private installing = false;
  private generation = 0;
  private pending?: LauncherUpdate;

  constructor(private readonly dependencies: UpdaterDependencies) {}

  setBlocked(blocked: boolean) {
    this.blocked = blocked;
    if (!blocked) void this.installPending();
  }

  setEnabled(enabled: boolean) {
    if (enabled === this.enabled || this.disposed) return;
    this.enabled = enabled;
    const generation = ++this.generation;
    if (!enabled) {
      this.releasePending();
      if (!this.installing) this.publish({ phase: "idle", message: "Automatic updates are disabled." });
      return;
    }
    if (!this.installing) void this.check(generation);
  }

  dispose() {
    this.disposed = true;
    ++this.generation;
    this.releasePending();
  }

  private publish(status: AutoUpdateStatus) {
    if (!this.disposed) this.dependencies.publish(status);
  }

  private releasePending() {
    if (this.pending) void this.pending.close().catch(() => {});
    this.pending = undefined;
  }

  private async check(generation: number) {
    this.publish({ phase: "checking", message: "Checking GitHub for updates..." });
    try {
      const update = await this.dependencies.check();
      if (this.disposed || !this.enabled || generation !== this.generation) {
        if (update) await update.close();
        return;
      }
      if (!update) {
        this.publish({ phase: "current", message: "Stellar Launcher is up to date." });
        return;
      }
      this.pending = update;
      this.publish({ phase: "available", message: `Update ${update.version} found. Waiting for Minecraft and active tasks to finish.` });
      await this.installPending();
    } catch (error) {
      if (this.disposed || generation !== this.generation) return;
      this.publish({ phase: "error", message: `Could not check for updates. The launcher can still be used. ${String(error)}` });
    }
  }

  private async installPending() {
    if (!this.pending || !this.enabled || this.blocked || this.installing || this.disposed) return;
    const update = this.pending;
    this.pending = undefined;
    this.installing = true;
    let downloaded = 0;
    let total = 0;
    this.publish({ phase: "installing", message: `Downloading update ${update.version}...`, progress: 0 });
    try {
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") total = event.data?.contentLength ?? 0;
        if (event.event === "Progress") downloaded += event.data?.chunkLength ?? 0;
        this.publish({
          phase: "installing",
          message: event.event === "Finished" ? `Installing update ${update.version}...` : `Downloading update ${update.version}...`,
          progress: event.event === "Finished" ? 100 : total > 0 ? Math.min(100, downloaded / total * 100) : undefined
        });
      });
      this.publish({ phase: "restarting", message: "Update installed. Restarting Stellar Launcher...", progress: 100 });
      await this.dependencies.restart();
    } catch (error) {
      this.publish({ phase: "error", message: `Automatic update could not finish. ${String(error)}` });
    } finally {
      this.installing = false;
      await update.close().catch(() => {});
    }
  }
}
