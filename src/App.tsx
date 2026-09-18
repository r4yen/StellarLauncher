import { translateUi } from "./uiTranslation";
import LocalizedError from "./components/LocalizedError";
import { UiLanguage } from "./uiLanguage";
import { useEffect, useMemo, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import AppShell from "./components/AppShell";
import FirstTimeGuide from "./components/FirstTimeGuide";
import LauncherImportSection from "./components/LauncherImportSection";
import LaunchErrorHelp from "./components/LaunchErrorHelp";
import {hasDownloadRetry,retryDownload,forgetDownload} from "./services/downloadOperations";
import { invoke } from "@tauri-apps/api/core";
import LoadingScreen from "./components/LoadingScreen";
import { useAutoUpdater } from "./hooks/useAutoUpdater";
import { defaultLauncherSettings, defaultLauncherStatus, defaultThemeSettings } from "./data/mockData";
import { Account } from "./models/account";
import { DownloadTask } from "./models/download";
import { CreateInstanceInput, Instance, LaunchState, LaunchStatus, RunningInstance } from "./models/instance";
import { PageKey } from "./models/launcher";
import { ModFile } from "./models/mod";
import { LauncherSettings, ThemeSettings } from "./models/settings";
import { SkinLibraryItem } from "./models/skin";
import Accounts from "./pages/Accounts";
import HomePage from "./pages/HomePage";
import Instances from "./pages/Instances";
import SettingsPage from "./pages/SettingsPage";
import ThemeEditorPage from "./pages/ThemeEditorPage";
import {
  addOfflinePlayerAccount,
  moveAccount,
  persistAccounts,
  removeAccount,
  setActiveAccount,
  setAccountSkin,
  sortAccounts,
  toggleAccountFavorite,
  upsertAccount
} from "./services/accountService";
import { refreshMinecraftAccount } from "./services/authService";
import { buildDiscordRpcActivity, updateDiscordRpc } from "./services/discordRpcService";
import { createInstance, deleteInstance, moveInstance, persistInstances, sortInstances, toggleInstanceFavorite, updateInstance } from "./services/instanceService";
import { JavaSetupProgress, setupAdoptiumJava } from "./services/javaSetupService";
import { isMinecraftProcessRunning, startMinecraftProcess, stopMinecraftProcess, validateLaunch } from "./services/launchService";
import { ModDownloadProgress, listMods } from "./services/modService";
import { enrichModsWithModrinth } from "./services/modrinthService";
import { ensureMinecraftFiles, MinecraftDownloadProgress } from "./services/minecraftDownloaderService";
import { getMinecraftCacheKey, getMinecraftLocalPath, loadLocalMinecraftCache, saveLocalMinecraftCache } from "./services/minecraftStorageService";
import {
  addPlayerNameSkin,
  getSkinLibrary,
  moveSkin,
  persistSkinLibrary,
  renameSkin,
  removeSkin,
  sortSkinLibrary,
  toggleSkinFavorite
} from "./services/skinLibraryService";
import {
  loadAccounts,
  loadInstances,
  loadRunningInstancesLocal,
  loadSettings,
  loadTheme,
  renameGameDirectory,
  saveRunningInstancesLocal,
  saveSettings,
  saveTheme
} from "./services/storageService";
import { joinDisplayPath } from "./utils/path";

const idleStatus: LaunchStatus = {
  state: "idle",
  message: "Ready",
  updatedAt: new Date().toISOString()
};

const delay = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

interface StartupLoadingState {
  active: boolean;
  message: string;
  progress: number;
}

export default function App() {
  const [activePage, setActivePage] = useState<PageKey>("home");
  const [storedInstances, setStoredInstances] = useState<Instance[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [skinLibrary, setSkinLibrary] = useState<SkinLibraryItem[]>([]);
  const [theme, setTheme] = useState<ThemeSettings>(defaultThemeSettings);
  const [settings, setSettings] = useState<LauncherSettings>(defaultLauncherSettings);
  const [launchStatus, setLaunchStatus] = useState<LaunchStatus>(idleStatus);
  const [runningInstances, setRunningInstances] = useState<RunningInstance[]>([]);
  const [downloadTasks, setDownloadTasks] = useState<DownloadTask[]>([]);
  const [downloadsOpen, setDownloadsOpen] = useState(false);
  const [minecraftCache, setMinecraftCache] = useState<string[]>([]);
  const [storageError, setStorageError] = useState<string | undefined>();
  const [javaSetupBusy, setJavaSetupBusy] = useState(false);
  const [setupReady, setSetupReady] = useState(false);
  const [instanceMutationBusy, setInstanceMutationBusy] = useState(false);
  const instanceMutationRef = useRef(false);
  const setupStartedRef = useRef(false);
  const javaSetupRef = useRef(false);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const [directoryRenameBusy, setDirectoryRenameBusy] = useState(false);
  const [packOperationMessage, setPackOperationMessage] = useState<string>();
  const [packOperationId, setPackOperationId] = useState<string>();
  const packOperationRef = useRef(false);
  const cancelledDownloads = useRef(new Set<string>());
  const launchRequests = useRef(new Set<string>());
  const settingsSaveRef = useRef<Promise<unknown>>(Promise.resolve());
  const directoryRenameRef = useRef(false);
  const [javaSetupStatus, setJavaSetupStatus] = useState<string | undefined>();
  const [modrinthModsByInstance, setModrinthModsByInstance] = useState<Record<string, ModFile[]>>({});
  const [playtimeTick, setPlaytimeTick] = useState(Date.now());
  const [startupLoading, setStartupLoading] = useState<StartupLoadingState>({
    active: true,
    message: "Starting Stellar Launcher",
    progress: 0
  });
  const storedInstancesRef = useRef<Instance[]>(storedInstances);
  const accountsRef = useRef<Account[]>(accounts);
  const skinLibraryRef = useRef<SkinLibraryItem[]>(skinLibrary);
  const runningInstancesRef = useRef<RunningInstance[]>(runningInstances);
  const discordRpcActivityKeyRef = useRef("");
  const downloadProgressStatsRef = useRef(new Map<string, { downloadedMb: number; updatedAtMs: number; speedMbPerSecond: number }>());
  const autoUpdateStatus = useAutoUpdater(
    !startupLoading.active && settings.initialSetupCompleted,
    settings.autoUpdateEnabled,
    directoryRenameBusy || javaSetupBusy || Boolean(packOperationMessage) ||
      runningInstances.some((running) => running.state !== "error") ||
      downloadTasks.some((task) => task.status === "pending" || task.status === "downloading") ||
      ["preparing", "downloading", "launching"].includes(launchStatus.state)
  );
  const installingUpdate = autoUpdateStatus.phase === "installing" || autoUpdateStatus.phase === "restarting";
  const packDownloadTask = downloadTasks.find((task) => task.id === packOperationId);

  useEffect(() => {
    document.documentElement.style.setProperty("--accent", theme.accentColor);
  }, [theme.accentColor]);

  useEffect(() => {
    let mounted = true;

    const setLoadingStep = (progress: number, message: string) => {
      if (mounted) setStartupLoading({ active: true, progress, message });
    };

    const loadStartupData = async () => {
      try {
        const loadedSettings = await loadSettings(defaultLauncherSettings);
        if (mounted) setSettings(loadedSettings);
        setLoadingStep(4, "Loading accounts");
        const loadedAccounts = await loadAccounts([]);

        setLoadingStep(10, "Loading skin library");
        const loadedSkinLibrary = await getSkinLibrary([]);

        setLoadingStep(16, "Loading instances");
        const loadedInstances = await loadInstances([]);
        const sortedInstances = sortInstances(loadedInstances);

        setLoadingStep(26, "Loading theme");
        const loadedTheme = await loadTheme(defaultThemeSettings);

        setLoadingStep(36, "Loading settings");

        setLoadingStep(46, "Loading local Minecraft cache");
        const loadedMinecraftCache = await loadLocalMinecraftCache();

        setLoadingStep(54, "Restoring running instances");
        const storedRunningInstances = loadRunningInstancesLocal();
        const loadedRunningInstances = (
          await Promise.all(
            storedRunningInstances.map(async (running) => {
              if (!running.processId) return undefined;

              try {
                return (await isMinecraftProcessRunning(running.processId)) ? running : undefined;
              } catch {
                return undefined;
              }
            })
          )
        ).filter((running): running is RunningInstance => running !== undefined);
        saveRunningInstancesLocal(loadedRunningInstances);

        const loadedModrinthMods: Record<string, ModFile[]> = {};
        if (sortedInstances.length > 0) {
          for (let index = 0; index < sortedInstances.length; index += 1) {
            const instance = sortedInstances[index];
            const progress = 58 + (index / sortedInstances.length) * 34;
            setLoadingStep(progress, `Loading mods for ${instance.name}`);

            try {
              const localMods = await listMods(instance);
              loadedModrinthMods[instance.id] = await enrichModsWithModrinth(localMods, instance);
            } catch {
              loadedModrinthMods[instance.id] = [];
            }
          }
        }

        setLoadingStep(95, "Preparing interface");
        if (!mounted) return;

        const sortedAccounts = sortAccounts(loadedAccounts);

        setAccounts(
          sortedAccounts.some((account) => account.isFavorite)
            ? sortedAccounts.map((account, index) => ({ ...account, isActive: index === 0 }))
            : sortedAccounts
        );
        setSkinLibrary(loadedSkinLibrary);
        setStoredInstances(sortedInstances);
        setTheme(loadedTheme);
        setSettings(loadedSettings);
        setMinecraftCache(loadedMinecraftCache);
        setRunningInstances(loadedRunningInstances);
        setModrinthModsByInstance(loadedModrinthMods);

        setStartupLoading({ active: true, progress: 100, message: "Ready" });
        window.setTimeout(() => {
          if (mounted) setStartupLoading((current) => ({ ...current, active: false }));
        }, 220);
      } catch (error) {
        if (mounted) setStorageError(error instanceof Error ? error.message : String(error));
        setStartupLoading({ active: false, progress: 100, message: "Ready" });
      }
    };

    loadStartupData();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    accountsRef.current = accounts;
  }, [accounts]);

  useEffect(() => {
    storedInstancesRef.current = storedInstances;
  }, [storedInstances]);

  useEffect(() => {
    skinLibraryRef.current = skinLibrary;
  }, [skinLibrary]);

  useEffect(() => {
    if (runningInstances.length === 0) {
      setPlaytimeTick(Date.now());
      return undefined;
    }

    const intervalId = window.setInterval(() => setPlaytimeTick(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, [runningInstances.length]);

  const handleSetCachedMods = (instanceId: string, mods: ModFile[]) => {
    setModrinthModsByInstance((current) => ({ ...current, [instanceId]: mods }));
  };

  const handleRefreshModrinthMods = async (instance: Instance): Promise<ModFile[]> => {
    const localMods = await listMods(instance);
    const enrichedMods = await enrichModsWithModrinth(localMods, instance);
    handleSetCachedMods(instance.id, enrichedMods);
    return enrichedMods;
  };

  const handleDismissDownloadTask = (taskId: string) => {
    forgetDownload(taskId);
    cancelledDownloads.current.delete(taskId);
    setDownloadTasks((current) => current.filter((task) => task.id !== taskId));
    downloadProgressStatsRef.current.delete(taskId);
  };

  useEffect(() => {
    let cancelled = false;
    let refreshing = false;

    const refreshExpiringAccounts = async () => {
      if (refreshing) return;
      refreshing = true;
      try {
        const now = Date.now();
        const refreshBeforeMs = 45 * 60 * 1000;
        const targets = accountsRef.current.filter((account) => {
          if (account.type !== "microsoft" || !account.tokenExpiresAt) return false;
          const expiresAt = new Date(account.tokenExpiresAt).getTime();
          return Number.isFinite(expiresAt) && expiresAt - now <= refreshBeforeMs;
        });

        for (const account of targets) {
          const result = await refreshMinecraftAccount(account.id);
          if (cancelled) return;
          if (result.status !== "complete" || !result.account) continue;

          setAccounts((current) => {
            const next = sortAccounts(
              current.map((existing) =>
                existing.id === account.id
                  ? {
                      ...result.account!,
                      isActive: existing.isActive,
                      isFavorite: existing.isFavorite,
                      order: existing.order
                    }
                  : existing
              )
            );
            persistAccounts(next).catch(() => undefined);
            return next;
          });
        }
      } finally {
        refreshing = false;
      }
    };

    refreshExpiringAccounts();
    const intervalId = window.setInterval(refreshExpiringAccounts, 5 * 60 * 1000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  const activeAccount = useMemo(() => accounts.find((account) => account.isActive) ?? accounts[0], [accounts]);
  const runningInstanceIds = useMemo(
    () => new Set(runningInstances.filter((running) => running.state !== "error").map((running) => running.instance.id)),
    [runningInstances]
  );
  const totalPlaytimeSeconds = useMemo(() => {
    const storedSeconds = storedInstances.reduce((sum, instance) => sum + (instance.playtimeSeconds ?? 0), 0);
    const liveSeconds = runningInstances.reduce((sum, running) => {
      if (running.state === "error") return sum;
      const startedAt = new Date(running.startedAt).getTime();
      if (!Number.isFinite(startedAt)) return sum;
      return sum + Math.max(0, Math.floor((playtimeTick - startedAt) / 1000));
    }, 0);
    return storedSeconds + liveSeconds;
  }, [playtimeTick, runningInstances, storedInstances]);

  const addPlaytimeForRuns = async (runs: RunningInstance[]) => {
    const increments = new Map<string, number>();
    const now = new Date();

    for (const run of runs) {
      const startedAt = new Date(run.startedAt).getTime();
      if (!Number.isFinite(startedAt)) continue;
      const elapsedSeconds = Math.max(0, Math.floor((now.getTime() - startedAt) / 1000));
      increments.set(run.instance.id, (increments.get(run.instance.id) ?? 0) + elapsedSeconds);
    }

    if (increments.size === 0) return;

    const endedAt = now.toISOString();
    const nextInstances = sortInstances(
      storedInstancesRef.current.map((instance) => {
        const increment = increments.get(instance.id);
        return increment
          ? {
              ...instance,
              playtimeSeconds: (instance.playtimeSeconds ?? 0) + increment,
              lastPlayedAt: endedAt
            }
          : instance;
      })
    );

    storedInstancesRef.current = nextInstances;
    setStoredInstances(nextInstances);
    await persistInstances(nextInstances);
  };

  const updateRunningInstance = (runId: string, state: LaunchState, message: string, log: string) => {
    setRunningInstances((current) =>
      current.map((running) =>
        running.id === runId
          ? {
              ...running,
              state,
              message,
              logs: [...running.logs, `[${new Date().toLocaleTimeString()}] ${log}`],
              updatedAt: new Date().toISOString()
            }
          : running
      )
    );
  };

  useEffect(() => {
    runningInstancesRef.current = runningInstances;
    const timeoutId = window.setTimeout(() => {
      saveRunningInstancesLocal(runningInstances);
    }, 700);
    return () => window.clearTimeout(timeoutId);
  }, [runningInstances]);

  useEffect(() => {
    const activity = buildDiscordRpcActivity(runningInstances, settings.discordRichPresenceEnabled);
    const activityKey = JSON.stringify(activity);
    if (activityKey === discordRpcActivityKeyRef.current) return;

    discordRpcActivityKeyRef.current = activityKey;
    const timeoutId = window.setTimeout(() => {
      updateDiscordRpc(activity).catch(() => undefined);
    }, 900);
    return () => window.clearTimeout(timeoutId);
  }, [runningInstances, settings.discordRichPresenceEnabled]);

  useEffect(() => {
    let unlistenMod: (() => void) | undefined;
    let unlistenMinecraft: (() => void) | undefined;
    listen<ModDownloadProgress>("mod-download-progress", (event) => {
      applyModDownloadProgress(event.payload);
    }).then((dispose) => {
      unlistenMod = dispose;
    });
    listen<MinecraftDownloadProgress>("minecraft-download-progress", (event) => {
      applyMinecraftDownloadProgress(event.payload);
    }).then((dispose) => {
      unlistenMinecraft = dispose;
    });

    return () => {
      unlistenMod?.();
      unlistenMinecraft?.();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let inspecting = false;
    const inspectRunningInstances = async () => {
      if (inspecting || packOperationRef.current) return;
      const snapshot = runningInstancesRef.current;
      if (snapshot.length === 0) return;

      inspecting = true;
      const checks = await Promise.all(
        snapshot.map(async (running) => {
          if (!running.processId) return { running, alive: running.state !== "error" };

          try {
            const alive = await isMinecraftProcessRunning(running.processId);
            return { running, alive };
          } catch {
            // An entry that cannot be verified must not remain as an unstoppable ghost.
            return { running, alive: false };
          }
        })
      );
      inspecting = false;

      if (cancelled || packOperationRef.current) return;

      const endedRuns = checks.filter((check) => !check.alive).map((check) => check.running);
      if (endedRuns.length > 0) {
        addPlaytimeForRuns(endedRuns).catch(() => undefined);
      }

      setRunningInstances((current) => {
        const byId = new Map(checks.map((check) => [check.running.id, check]));
        let changed = false;
        const next = current
          .filter((running) => {
            const alive = byId.get(running.id)?.alive ?? true;
            if (!alive) changed = true;
            return alive;
          })
          .map((running): RunningInstance => {
            const check = byId.get(running.id);
            if (!check) return running;
            if (!running.processId || (running.state === "running" && running.message === "Minecraft is running")) {
              return running;
            }
            changed = true;
            return {
              ...running,
              state: "running",
              message: "Minecraft is running",
              updatedAt: new Date().toISOString()
            };
          });
        return changed ? next : current;
      });
    };

    inspectRunningInstances();
    const intervalId = window.setInterval(inspectRunningInstances, 7000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  const createMinecraftDownloadTasks = (instance: Instance): DownloadTask[] => {
    const now = new Date().toISOString();
    const basePath = getMinecraftLocalPath(instance, settings);
    const commonTasks = [
      { label: "Minecraft client", totalMb: 48.5, targetPath: `${basePath}\\client.jar` },
      { label: "Libraries", totalMb: 92.2, targetPath: `${basePath}\\libraries` },
      { label: "Assets", totalMb: 138.6, targetPath: `${basePath}\\assets` }
    ];
    const loaderTasks =
      instance.loaderType === "vanilla"
        ? []
        : [
            {
              label: `${instance.loaderType} loader ${instance.loaderVersion || "latest"}`,
              totalMb: 24.4,
              targetPath: `${basePath}\\loader`
            }
          ];

    return [...commonTasks, ...loaderTasks].map((task, index) => ({
      id: `${instance.id}-${Date.now().toString(36)}-${index}`,
      instanceId: instance.id,
      instanceName: instance.name,
      label: task.label,
      targetPath: task.targetPath,
      status: "pending",
      downloadedMb: 0,
      totalMb: task.totalMb,
      percent: 0,
      etaSeconds: undefined,
      startedAt: now,
      updatedAt: now
    }));
  };

  const simulateDownloadTasks = async (tasks: DownloadTask[]) => {
    if (tasks.length === 0) return;

    if (settingsRef.current.openDownloadsAutomatically) setDownloadsOpen(true);
    setDownloadTasks((current) => [...tasks, ...current]);

    await new Promise<void>((resolve) => {
      let completedCount = 0;

      tasks.forEach((task, index) => {
        let downloadedMb = 0;
        const speedMbPerTick = 7.4 + index * 1.8;

        window.setTimeout(() => {
          const intervalId = window.setInterval(() => {
            downloadedMb = Math.min(task.totalMb, downloadedMb + speedMbPerTick);
            const remainingMb = Math.max(task.totalMb - downloadedMb, 0);
            const percent = task.totalMb > 0 ? (downloadedMb / task.totalMb) * 100 : 100;
            const isComplete = downloadedMb >= task.totalMb;
            const etaSeconds = isComplete ? 0 : Math.max(1, Math.round((remainingMb / speedMbPerTick) * 0.5));

            setDownloadTasks((current) =>
              current.map((currentTask) =>
                currentTask.id === task.id
                  ? {
                      ...currentTask,
                      status: isComplete ? "completed" : "downloading",
                      downloadedMb,
                      percent,
                      etaSeconds,
                      updatedAt: new Date().toISOString()
                    }
                  : currentTask
              )
            );

            if (isComplete) {
              window.clearInterval(intervalId);
              completedCount += 1;

              if (completedCount === tasks.length) {
                resolve();
              }
            }
          }, 500);
        }, index * 220);
      });
    });
  };

  const beginDownloadTasks = (tasks: DownloadTask[]) => {
    if (tasks.length === 0) {
      return {
        finish: () => undefined,
        fail: () => undefined
      };
    }

    const progress = new Map(
      tasks.map((task, index) => [
        task.id,
        {
          percent: 0,
          speed: 2.8 + index * 1.45 + (task.totalMb % 9) * 0.16
        }
      ])
    );
    if (settingsRef.current.openDownloadsAutomatically) setDownloadsOpen(true);
    setDownloadTasks((current) => [...tasks, ...current]);

    const intervalId = window.setInterval(() => {
      setDownloadTasks((current) =>
        current.map((task) => {
          if (!progress.has(task.id) || task.status === "completed" || task.status === "error") return task;
          const taskProgress = progress.get(task.id);
          if (!taskProgress) return task;
          const nextPercent = Math.min(taskProgress.percent + taskProgress.speed, 95);
          progress.set(task.id, { ...taskProgress, percent: nextPercent });
          return {
            ...task,
            status: "downloading",
            downloadedMb: (task.totalMb * nextPercent) / 100,
            percent: nextPercent,
            etaSeconds: Math.max(1, Math.round((100 - nextPercent) / Math.max(taskProgress.speed, 1))),
            updatedAt: new Date().toISOString()
          };
        })
      );
    }, 900);

    const completeTasks = (status: "completed" | "error") => {
      window.clearInterval(intervalId);
      setDownloadTasks((current) =>
        current.map((task) =>
          progress.has(task.id)
            ? {
                ...task,
                status,
                downloadedMb: status === "completed" ? task.totalMb : task.downloadedMb,
                percent: status === "completed" ? 100 : task.percent,
                etaSeconds: status === "completed" ? 0 : undefined,
                updatedAt: new Date().toISOString()
              }
            : task
        )
      );
    };

    return {
      finish: () => completeTasks("completed"),
      fail: () => completeTasks("error")
    };
  };

  const minecraftDownloadTaskId = (instanceId: string) => `minecraft-files-${instanceId}`;

  const startMinecraftDownloadTask = (instance: Instance, targetPath: string): string => {
    const now = new Date().toISOString();
    const taskId = minecraftDownloadTaskId(instance.id);
    cancelledDownloads.current.delete(taskId);
    const task: DownloadTask = {
      id: taskId,
      cancelOperationId: `minecraft-${instance.id}`,
      instanceId: instance.id,
      instanceName: instance.name,
      label: "Preparing Minecraft files",
      targetPath,
      status: "pending",
      downloadedMb: 0,
      totalMb: 1,
      percent: 0,
      etaSeconds: undefined,
      startedAt: now,
      updatedAt: now
    };

    if (settingsRef.current.openDownloadsAutomatically) setDownloadsOpen(true);
    setDownloadTasks((current) => [task, ...current.filter((existing) => existing.id !== taskId)]);
    return taskId;
  };

  const finishMinecraftDownloadTask = (taskId: string, status: "completed" | "error", label?: string) => {
    setDownloadTasks((current) =>
      current.map((task) =>
        task.id === taskId
          ? {
              ...task,
              label: label ?? task.label,
              status: status === "error" && cancelledDownloads.current.has(taskId) ? "cancelled" : status,
              downloadedMb: status === "completed" ? task.totalMb : task.downloadedMb,
              percent: status === "completed" ? 100 : task.percent,
              etaSeconds: status === "completed" ? 0 : undefined,
              updatedAt: new Date().toISOString()
            }
          : task
      )
    );
  };

  const applyMinecraftDownloadProgress = (progress: MinecraftDownloadProgress) => {
    const taskId = minecraftDownloadTaskId(progress.instanceId);
    const now = new Date().toISOString();
    const totalMb = progress.totalBytes ? Math.max(progress.totalBytes / 1024 / 1024, 0.01) : undefined;
    const downloadedMb = progress.downloadedBytes / 1024 / 1024;
    const isCompleted = progress.status === "completed";
    const nowMs = Date.now();
    const previousStats = downloadProgressStatsRef.current.get(taskId);
    const elapsedSeconds = previousStats ? Math.max((nowMs - previousStats.updatedAtMs) / 1000, 0.001) : 0;
    const instantSpeed = previousStats && downloadedMb > previousStats.downloadedMb ? (downloadedMb - previousStats.downloadedMb) / elapsedSeconds : 0;
    const speedMbPerSecond =
      instantSpeed > 0
        ? previousStats?.speedMbPerSecond
          ? previousStats.speedMbPerSecond * 0.65 + instantSpeed * 0.35
          : instantSpeed
        : previousStats?.speedMbPerSecond ?? 0;
    downloadProgressStatsRef.current.set(taskId, { downloadedMb, updatedAtMs: nowMs, speedMbPerSecond });

    if (settingsRef.current.openDownloadsAutomatically) setDownloadsOpen(true);
    setDownloadTasks((current) => {
      const existing = current.find((task) => task.id === taskId);
      const nextTotalMb = isCompleted ? Math.max(downloadedMb, existing?.totalMb ?? 1) : (totalMb ?? existing?.totalMb ?? Math.max(downloadedMb, 1));
      const percent = isCompleted ? 100 : totalMb ? Math.min((downloadedMb / totalMb) * 100, 99) : existing?.percent ?? 0;
      const remainingMb = Math.max(nextTotalMb - downloadedMb, 0);
      const nextTask: DownloadTask = {
        id: taskId,
        cancelOperationId: `minecraft-${progress.instanceId}`,
        instanceId: progress.instanceId,
        instanceName: progress.instanceName,
        label: progress.fileName || existing?.label || "Minecraft files",
        targetPath: progress.targetPath || existing?.targetPath || "",
        status: isCompleted ? "completed" : "downloading",
        downloadedMb: isCompleted ? nextTotalMb : Math.min(downloadedMb, nextTotalMb),
        totalMb: nextTotalMb,
        percent,
        etaSeconds: isCompleted ? 0 : speedMbPerSecond > 0 ? Math.max(1, Math.round(remainingMb / speedMbPerSecond)) : existing?.etaSeconds,
        startedAt: existing?.startedAt ?? now,
        updatedAt: now
      };

      return existing ? current.map((task) => (task.id === taskId ? nextTask : task)) : [nextTask, ...current];
    });
  };

  const createJavaSetupDownloadTasks = (): DownloadTask[] => {
    const now = new Date().toISOString();
    const estimates: Record<JavaSetupProgress["version"], number> = {
      8: 190,
      16: 195,
      17: 195,
      21: 205,
      25: 215
    };

    return ([21] as JavaSetupProgress["version"][]).map((version) => ({
      id: `java-setup-${version}-${Date.now().toString(36)}`,
      cancelOperationId: "java-setup",
      instanceId: `java-${version}`,
      instanceName: `Adoptium Java ${version}`,
      label: `Eclipse Temurin JDK ${version}`,
      targetPath: joinDisplayPath(settings.launcherFolder, "java", `jdk-${version}`),
      status: "pending",
      downloadedMb: 0,
      totalMb: estimates[version],
      percent: 0,
      etaSeconds: undefined,
      startedAt: now,
      updatedAt: now
    }));
  };

  const applyJavaSetupProgress = (taskIds: Map<number, string>, progress: JavaSetupProgress) => {
    const taskId = taskIds.get(progress.version);
    if (!taskId) return;

    setDownloadTasks((current) =>
      current.map((task) => {
        if (task.id !== taskId) return task;

        const totalMb = progress.totalBytes ? progress.totalBytes / 1024 / 1024 : task.totalMb;
        const downloadedMb = progress.downloadedBytes / 1024 / 1024;
        const isCompleted = progress.status === "completed";
        const isError = progress.status === "error";
        const nowMs = Date.now();
        const previousStats = downloadProgressStatsRef.current.get(task.id);
        const elapsedSeconds = previousStats ? Math.max((nowMs - previousStats.updatedAtMs) / 1000, 0.001) : 0;
        const instantSpeed = previousStats && downloadedMb > previousStats.downloadedMb ? (downloadedMb - previousStats.downloadedMb) / elapsedSeconds : 0;
        const speedMbPerSecond =
          instantSpeed > 0
            ? previousStats?.speedMbPerSecond
              ? previousStats.speedMbPerSecond * 0.65 + instantSpeed * 0.35
              : instantSpeed
            : previousStats?.speedMbPerSecond ?? 0;
        downloadProgressStatsRef.current.set(task.id, { downloadedMb, updatedAtMs: nowMs, speedMbPerSecond });
        const percent = isCompleted
          ? 100
          : progress.status === "extracting"
            ? Math.max(task.percent, 96)
            : progress.totalBytes
              ? Math.min((progress.downloadedBytes / progress.totalBytes) * 100, 95)
              : task.percent;
        const remainingMb = Math.max(totalMb - downloadedMb, 0);
        const etaSeconds =
          isCompleted
            ? 0
            : progress.status === "extracting"
              ? 1
              : speedMbPerSecond > 0
                ? Math.max(1, Math.round(remainingMb / speedMbPerSecond))
                : task.etaSeconds;

        return {
          ...task,
          label: progress.message || task.label,
          targetPath: progress.targetPath || task.targetPath,
          status: isCompleted ? "completed" : isError ? "error" : "downloading",
          downloadedMb: isCompleted ? totalMb : Math.min(downloadedMb, totalMb),
          totalMb,
          percent,
          etaSeconds,
          updatedAt: new Date().toISOString()
        };
      })
    );
  };

  const createModDownloadTask = (instanceName: string, label: string, targetPath: string): string => {
    const now = new Date().toISOString();
    const operationId = `mod-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    if (settingsRef.current.openDownloadsAutomatically) setDownloadsOpen(true);
    setDownloadTasks((current) => [
      {
        id: operationId,
        cancelOperationId: operationId,
        instanceId: operationId,
        instanceName,
        label,
        targetPath,
        status: "pending",
        downloadedMb: 0,
        totalMb: 1,
        percent: 0,
        etaSeconds: undefined,
        startedAt: now,
        updatedAt: now
      },
      ...current
    ]);
    return operationId;
  };

  const failTrackedDownloadTask = (operationId: string) => {
    setDownloadTasks((current) =>
      current.map((task) =>
        task.id === operationId
          ? {
              ...task,
              status: cancelledDownloads.current.has(operationId) ? "cancelled" : "error",
              updatedAt: new Date().toISOString()
            }
          : task
      )
    );
  };

  const applyModDownloadProgress = (progress: ModDownloadProgress) => {
    setDownloadTasks((current) =>
      current.map((task) => {
        if (task.id !== progress.operationId) return task;

        const totalMb = progress.totalBytes ? progress.totalBytes / 1024 / 1024 : task.totalMb;
        const downloadedMb = progress.downloadedBytes / 1024 / 1024;
        const isCompleted = progress.status === "completed";
        const nowMs = Date.now();
        const previousStats = downloadProgressStatsRef.current.get(task.id);
        const elapsedSeconds = previousStats ? Math.max((nowMs - previousStats.updatedAtMs) / 1000, 0.001) : 0;
        const instantSpeed = previousStats && downloadedMb > previousStats.downloadedMb ? (downloadedMb - previousStats.downloadedMb) / elapsedSeconds : 0;
        const speedMbPerSecond =
          instantSpeed > 0
            ? previousStats?.speedMbPerSecond
              ? previousStats.speedMbPerSecond * 0.65 + instantSpeed * 0.35
              : instantSpeed
            : previousStats?.speedMbPerSecond ?? 0;
        downloadProgressStatsRef.current.set(task.id, { downloadedMb, updatedAtMs: nowMs, speedMbPerSecond });
        const percent = isCompleted ? 100 : progress.totalBytes ? Math.min((progress.downloadedBytes / progress.totalBytes) * 100, 99) : task.percent;
        const remainingMb = Math.max(totalMb - downloadedMb, 0);

        return {
          ...task,
          label: progress.fileName || task.label,
          targetPath: progress.targetPath || task.targetPath,
          status: isCompleted ? "completed" : "downloading",
          downloadedMb: isCompleted ? totalMb : Math.min(downloadedMb, totalMb),
          totalMb,
          percent,
          etaSeconds: isCompleted ? 0 : speedMbPerSecond > 0 ? Math.max(1, Math.round(remainingMb / speedMbPerSecond)) : task.etaSeconds,
          updatedAt: new Date().toISOString()
        };
      })
    );
  };

  const handleSetupJava = async () => {
    if (javaSetupRef.current) return;
    if (storageError) { setJavaSetupStatus(storageError); return; }
    javaSetupRef.current = true;
    setSetupReady(false);

    const tasks = createJavaSetupDownloadTasks();
    const taskIds = new Map(tasks.map((task) => [Number(task.instanceId.replace("java-", "")), task.id]));

    tasks.forEach((task) => downloadProgressStatsRef.current.delete(task.id));
    setJavaSetupBusy(true);
    setJavaSetupStatus("Downloading Eclipse Temurin Java runtimes...");
    if (settingsRef.current.initialSetupCompleted) if (settingsRef.current.openDownloadsAutomatically) setDownloadsOpen(true);
    setDownloadTasks((current) => [...tasks, ...current]);

    let unlisten: (() => void) | undefined;
    try {
      unlisten = await listen<JavaSetupProgress>("java-setup-progress", (event) => {
        if (event.payload.operationId && event.payload.operationId !== "java-setup") return;
        applyJavaSetupProgress(taskIds, event.payload);
        setJavaSetupStatus(`Java ${event.payload.version}: ${event.payload.message}`);
      });
      await settingsSaveRef.current.catch(() => undefined);
      if (!settingsRef.current.initialSetupCompleted) {
        // Persist an unfinished first run before starting work, so closing resumes it.
        await saveSettings(settingsRef.current);
        await invoke("prepare_setup_directories");
      }
      const installedPaths = await setupAdoptiumJava(settingsRef.current.launcherFolder);
      await settingsSaveRef.current.catch(() => undefined);
      const nextSettings = {
        ...settingsRef.current,
        java8Path: installedPaths.java8Path,
        java17Path: installedPaths.java17Path,
        java21Path: installedPaths.java21Path,
        java25Path: installedPaths.java25Path
      };
      settingsRef.current = nextSettings;
      setSettings(nextSettings);
      settingsSaveRef.current = settingsSaveRef.current.catch(() => undefined).then(() => saveSettings(nextSettings));
      await settingsSaveRef.current;
      setJavaSetupStatus("Adoptium Java setup completed.");
      setSetupReady(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setJavaSetupStatus(message);
      setDownloadTasks((current) =>
        current.map((task) =>
          taskIds.has(Number(task.instanceId.replace("java-", "")))
            ? {
                ...task,
                status: task.status === "completed" ? task.status : cancelledDownloads.current.has(task.id) ? "cancelled" : "error",
                updatedAt: new Date().toISOString()
              }
            : task
        )
      );
    } finally {
      unlisten?.();
      javaSetupRef.current = false;
      tasks.forEach((task) => downloadProgressStatsRef.current.delete(task.id));
      setJavaSetupBusy(false);
    }
  };

  useEffect(() => {
    if (startupLoading.active || settings.initialSetupCompleted || setupStartedRef.current) return;
    setupStartedRef.current = true;
    void handleSetupJava();
  }, [startupLoading.active, settings.initialSetupCompleted]);

  const finishSetup = async () => {
    if (!setupReady || javaSetupRef.current || packOperationRef.current) return;
    const next = { ...settingsRef.current, initialSetupCompleted: true };
    await settingsSaveRef.current;
    await saveSettings(next);
    settingsRef.current = next;
    setSettings(next);
    setActivePage("home");
  };

  const ui = (text: string) => translateUi(text, settings.language);
  useEffect(() => { document.documentElement.lang = settings.language; }, [settings.language]);

  const handleLaunch = async (instance: Instance, account = activeAccount) => {
    if (launchRequests.current.has(instance.id)) return;
    launchRequests.current.add(instance.id);
    try { await launchInstance(instance,account); } finally {launchRequests.current.delete(instance.id);}
  };
  const launchInstance = async (instance: Instance, account = activeAccount) => {
    if (!settingsRef.current.initialSetupCompleted || directoryRenameRef.current || installingUpdate || packOperationMessage) return;
    if (runningInstanceIds.has(instance.id)) {
      setLaunchStatus({
        state: "error",
        message: `${instance.name} is already running.`,
        instanceId: instance.id,
        updatedAt: new Date().toISOString()
      });
      return;
    }

    setLaunchStatus({
      state: "preparing",
      message: `Preparing ${instance.name}`,
      instanceId: instance.id,
      updatedAt: new Date().toISOString()
    });

    if (account && (account.type === "offline" || account.loginStatus === "active")) {
      const id=`java-runtime-${instance.id}`;
      cancelledDownloads.current.delete(id);
      const now=new Date().toISOString();
      setDownloadTasks(current=>[{id,instanceId:instance.id,instanceName:instance.name,targetPath:settings.launcherFolder,cancelOperationId:`java-${instance.id}`,label:"Preparing Java automatically",status:"pending",downloadedMb:0,totalMb:0,percent:0,startedAt:now,updatedAt:now},...current.filter(task=>task.id!==id)]);
      let unlisten:(()=>void)|undefined;
      try {
        unlisten=await listen<JavaSetupProgress>("java-setup-progress",({payload})=>{if(payload.operationId===`java-${instance.id}`) applyJavaSetupProgress(new Map([[payload.version,id]]),payload);});
        const javaPath = await invoke<string>("ensure_instance_java", { instance });
        instance = { ...instance, javaPath };
        setDownloadTasks(current=>current.map(task=>task.id===id?{...task,status:"completed",percent:100}:task));
      } catch (error) {
        setDownloadTasks(current=>current.map(task=>task.id===id?{...task,status:cancelledDownloads.current.has(id)?"cancelled":"error"}:task));
        setLaunchStatus({state:"error", message:String(error), instanceId:instance.id, updatedAt:new Date().toISOString()});
        return;
      } finally {unlisten?.();}
    }
    const commandStatus = await validateLaunch(instance, account, settings);
    setLaunchStatus(commandStatus);

    if (commandStatus.state === "error" || !account) return;

    const runId = `${instance.id}-${Date.now().toString(36)}`;
    setRunningInstances((current) => [
      {
        id: runId,
        instance,
        account,
        state: "preparing",
        message: `Preparing ${instance.name}`,
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        logs: [`[${new Date().toLocaleTimeString()}] Preparing launch for ${instance.name} with ${account.username}`]
      },
      ...current
    ]);

    const cacheKey = getMinecraftCacheKey(instance);
    const localPath = getMinecraftLocalPath(instance, settings);

    setLaunchStatus({
      state: "downloading",
      message: minecraftCache.includes(cacheKey) ? `Checking local Minecraft files for ${instance.name}` : `Downloading local Minecraft files for ${instance.name}`,
      instanceId: instance.id,
      updatedAt: new Date().toISOString()
    });
    updateRunningInstance(runId, "downloading", `Preparing Minecraft files for ${instance.name}`, `Checking local storage at ${localPath}`);

    const downloadTaskId = startMinecraftDownloadTask(instance, localPath);

    try {
      const downloadResult = await ensureMinecraftFiles(instance, settings);
      finishMinecraftDownloadTask(downloadTaskId, "completed", "Minecraft files ready");
      const nextCache = Array.from(new Set([...minecraftCache, cacheKey]));
      setMinecraftCache(nextCache);
      await saveLocalMinecraftCache(nextCache);
      updateRunningInstance(
        runId,
        "downloading",
        `Minecraft files ready for ${instance.name}`,
        `Ready at ${downloadResult.storagePath}; downloaded ${downloadResult.filesDownloaded} files (${(downloadResult.bytesDownloaded / 1024 / 1024).toFixed(1)} MB)`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      finishMinecraftDownloadTask(downloadTaskId, "error", message);
      setLaunchStatus({
        state: "error",
        message,
        instanceId: instance.id,
        updatedAt: new Date().toISOString()
      });
      updateRunningInstance(runId, "error", "Download failed", message);
      return;
    }

    await delay(650);

    setLaunchStatus({
      state: "launching",
      message: `Launching ${instance.name}`,
      instanceId: instance.id,
      updatedAt: new Date().toISOString()
    });
    updateRunningInstance(runId, "launching", `Launching ${instance.name}`, "Starting Java process from local Minecraft files");

    const processStatus = await startMinecraftProcess(instance, account, settings);
    setLaunchStatus(processStatus);

    if (processStatus.state === "error") {
      updateRunningInstance(runId, "error", processStatus.message || "Launch failed", `Launch failed: ${processStatus.message || "Unknown error"}`);
      return;
    }

    setRunningInstances((current) =>
      current.map((running) =>
        running.id === runId
          ? {
              ...running,
              state: "running",
              message: processStatus.message,
              processId: processStatus.processId,
              logPath: processStatus.logPath,
              logs: [
                ...running.logs,
                ...(processStatus.debugLines ?? []).map((line) => `[${new Date().toLocaleTimeString()}] ${line}`),
                `[${new Date().toLocaleTimeString()}] Minecraft process started with pid ${processStatus.processId}`
              ],
              updatedAt: new Date().toISOString()
            }
          : running
      )
    );
  };

  const handleStopRunningInstance = async (runId: string) => {
    const runningInstance = runningInstances.find((running) => running.id === runId);

    if (runningInstance?.processId) {
      try {
        await stopMinecraftProcess(runningInstance.processId);
      } catch (error) {
        updateRunningInstance(runId, "error", "Stopped from launcher", error instanceof Error ? error.message : String(error));
      }
    }

    if (runningInstance) {
      await addPlaytimeForRuns([runningInstance]);
    }

    setLaunchStatus(idleStatus);
    updateRunningInstance(runId, "error", "Stopped from launcher", "Process stopped by user");
    window.setTimeout(() => {
      setRunningInstances((current) => current.filter((running) => running.id !== runId));
    }, 500);
  };

  const handleSelectAccount = async (accountId: string) => {
    setAccounts(sortAccounts(await setActiveAccount(accounts, accountId)));
  };

  const handleRemoveAccount = async (accountId: string) => {
    setAccounts(sortAccounts(await removeAccount(accounts, accountId)));
  };

  const handleAccountLoggedIn = async (account: Account) => {
    const next = sortAccounts(await upsertAccount(accountsRef.current, account));
    accountsRef.current = next;
    setAccounts(next);
  };

  const handleCreateOfflineAccount = async (name: string) => {
    setAccounts(sortAccounts(await addOfflinePlayerAccount(accounts, name)));
  };

  const handleToggleAccountFavorite = async (accountId: string) => {
    setAccounts(await toggleAccountFavorite(accounts, accountId));
  };

  const handleMoveAccount = async (accountId: string, direction: -1 | 1) => {
    setAccounts(await moveAccount(accounts, accountId, direction));
  };

  const handleChangeAccountSkin = async (accountId: string, skinId: string) => {
    const skin = skinLibrary.find((item) => item.id === skinId);
    if (!skin) return;
    setAccounts(sortAccounts(await setAccountSkin(accounts, accountId, skin)));
  };

  const updateSkinLibrary = async (nextSkinLibrary: SkinLibraryItem[]) => {
    const normalized = sortSkinLibrary(nextSkinLibrary);
    setSkinLibrary(normalized);
    setSkinLibrary(await persistSkinLibrary(normalized));
  };

  const handleAddSkin = async (name: string) => {
    await updateSkinLibrary(addPlayerNameSkin(skinLibrary, name));
  };

  const handleRemoveSkin = async (skinId: string) => {
    if (accounts.some((account) => account.selectedSkinId === skinId)) {
      const nextAccounts = sortAccounts(
        accounts.map((account) =>
          account.selectedSkinId === skinId
            ? {
                ...account,
                selectedSkinId: undefined,
                skinHeadUrl: undefined
              }
            : account
        )
      );
      setAccounts(await persistAccounts(nextAccounts));
    }

    await updateSkinLibrary(removeSkin(skinLibrary, skinId));
  };

  const handleRenameSkin = async (skinId: string, name: string) => {
    await updateSkinLibrary(renameSkin(skinLibrary, skinId, name));
  };

  const handleToggleSkinFavorite = async (skinId: string) => {
    await updateSkinLibrary(toggleSkinFavorite(skinLibrary, skinId));
  };

  const handleMoveSkin = async (skinId: string, direction: -1 | 1) => {
    await updateSkinLibrary(moveSkin(skinLibrary, skinId, direction));
  };

  const handleCreateInstance = async (input: CreateInstanceInput) => {
    if (packOperationRef.current) throw new Error("Wait for the import to finish.");
    if (instanceMutationRef.current) throw new Error("An instance is already being saved.");
    instanceMutationRef.current = true;
    setInstanceMutationBusy(true);
    try {
      const next = sortInstances(await createInstance(storedInstancesRef.current, input));
      storedInstancesRef.current = next;
      setStoredInstances(next);
    } finally { instanceMutationRef.current = false; setInstanceMutationBusy(false); }
  };

  const handleUpdateInstance = async (instanceId: string, input: CreateInstanceInput) => {
    if(packOperationRef.current||runningInstances.some(item=>item.instance.id===instanceId&&item.state!=="error"))throw new Error("Stop the instance and wait for active operations before editing.");
    const old=storedInstancesRef.current.find(item=>item.id===instanceId);
    const changed=old&&(old.minecraftVersion!==input.minecraftVersion||old.loaderType!==input.loaderType||old.loaderVersion!==input.loaderVersion);
    if(changed&&settings.autoBackupBeforeChanges){
      packOperationRef.current=true;setPackOperationMessage(settings.language==="de"?"Sicherung vor Versionswechsel…":"Backing up before version change…");
      try{await invoke("create_instance_backup",{instanceId});}finally{packOperationRef.current=false;setPackOperationMessage(undefined);}
    }
    const next=sortInstances(await updateInstance(storedInstancesRef.current,instanceId,input));storedInstancesRef.current=next;setStoredInstances(next);
  };

  const handleDeleteInstance = async (instanceId: string) => {
    if (packOperationRef.current || launchRequests.current.size) return;
    setStoredInstances(await deleteInstance(storedInstances, instanceId));
  };

  const handleToggleInstanceFavorite = async (instanceId: string) => {
    if (packOperationRef.current || launchRequests.current.size) return;
    setStoredInstances(await toggleInstanceFavorite(storedInstances, instanceId));
  };

  const handleMoveInstance = async (instanceId: string, direction: -1 | 1) => {
    if (packOperationRef.current || launchRequests.current.size) return;
    setStoredInstances(await moveInstance(storedInstances, instanceId, direction));
  };

  const handleThemeChange = async (nextTheme: ThemeSettings) => {
    setTheme(nextTheme);
    await saveTheme(nextTheme);
  };

  const handleSettingsSave = async (nextSettings: LauncherSettings) => {
    if (directoryRenameRef.current || packOperationMessage) return;
    settingsRef.current = nextSettings;
    setSettings(nextSettings);
    settingsSaveRef.current = settingsSaveRef.current.catch(() => undefined).then(() => saveSettings(nextSettings));
    try { await settingsSaveRef.current; setStorageError(undefined); }
    catch (error) { setStorageError(String(error)); }
  };

  const handleRenameGameDirectory = async (newName: string) => {
    if (directoryRenameRef.current || packOperationMessage) return;
    if (runningInstances.some((running) => running.state !== "error") || javaSetupBusy ||
        downloadTasks.some((task) => task.status === "pending" || task.status === "downloading") ||
        launchStatus.state === "preparing") {
      throw new Error("Stop Minecraft and wait for active downloads to finish before renaming the folder.");
    }
    directoryRenameRef.current = true;
    setDirectoryRenameBusy(true);
    try {
      await settingsSaveRef.current;
      const result = await renameGameDirectory(settings.gameDirectory, newName);
      setSettings(result.settings);
      storedInstancesRef.current = result.instances;
      setStoredInstances(sortInstances(result.instances));
      setModrinthModsByInstance({});
    } finally {
      directoryRenameRef.current = false;
      setDirectoryRenameBusy(false);
    }
  };

  const importerProps = {
    disabled: directoryRenameBusy || instanceMutationBusy || runningInstances.some((item) => item.state !== "error"),
    onImported: (instances: Instance[]) => { storedInstancesRef.current = instances; setStoredInstances(sortInstances(instances)); },
    onBusyChange: (message?: string) => { packOperationRef.current = Boolean(message); setPackOperationMessage(message); setPackOperationId(undefined); }
  };
  const cancelDownloadTask = async (id:string) => {
    const task=downloadTasks.find(item=>item.id===id);if(!task?.cancelOperationId)return;
    cancelledDownloads.current.add(id);
    try{await invoke("cancel_operation",{operationId:task.cancelOperationId});}catch(error){setJavaSetupStatus(String(error));}
  };
  const canRetryDownload = (task:DownloadTask) => hasDownloadRetry(task.id)||task.id.startsWith("java-setup-")||Boolean(storedInstances.find(item=>item.id===task.instanceId));
  const retryDownloadTask = async (id:string) => {
    const task=downloadTasks.find(item=>item.id===id);if(!task||packOperationRef.current||runningInstances.some(item=>item.state!=="error"))return;
    cancelledDownloads.current.delete(id);
    if(task.id.startsWith("java-setup-")){void handleSetupJava();return;}
    if(!hasDownloadRetry(id)){const instance=storedInstances.find(item=>item.id===task.instanceId);if(instance)void handleLaunch(instance);return;}
    packOperationRef.current=true;setPackOperationMessage(settings.language==="de"?"Download wird wiederholt…":"Retrying download…");setPackOperationId(id);
    setDownloadTasks(current=>current.map(item=>item.id===id?{...item,status:"pending",percent:0,downloadedMb:0}:item));
    try{
      const result=await retryDownload(id);
      if(result.command==="import_mrpack"){const instances=result.result as Instance[];storedInstancesRef.current=instances;setStoredInstances(sortInstances(instances));}
      else setModrinthModsByInstance({});
      window.dispatchEvent(new CustomEvent("stellar-download-retried",{detail:result.command}));
    }catch(error){failTrackedDownloadTask(id);setDownloadTasks(current=>current.map(item=>item.id===id?{...item,label:String(error)}:item));}
    finally{packOperationRef.current=false;setPackOperationMessage(undefined);setPackOperationId(undefined);}
  };
  const setupGuideDisabled = javaSetupBusy || directoryRenameBusy || Boolean(packOperationMessage) ||
    runningInstances.some((item) => item.state !== "error") || downloadTasks.some((task) => task.status === "pending" || task.status === "downloading");
  const reopenSetup = async () => {
    if (setupGuideDisabled) return;
    try {
      await settingsSaveRef.current;
      const next = { ...settingsRef.current, initialSetupCompleted: false };
      await saveSettings(next);
      setupStartedRef.current = false;
      setSetupReady(false);
      settingsRef.current = next;
      setSettings(next);
    } catch (reason) { setJavaSetupStatus(String(reason)); }
  };
  const pages = {
    home: (
      <HomePage
        account={activeAccount}
        instances={storedInstances}
        accounts={accounts}
        language={settings.language}
        launcherStatus={defaultLauncherStatus}
        launchStatus={launchStatus}
        runningInstances={runningInstances}
        onLaunch={handleLaunch}
        onStopRunningInstance={handleStopRunningInstance}
      />
    ),
    instances: (
      <Instances
        instances={storedInstances}
        language={settings.language}
        launchStatus={launchStatus}
        modrinthModsByInstance={modrinthModsByInstance}
        runningInstances={runningInstances}
        settings={settings}
        onCreateInstance={handleCreateInstance}
        onImportedInstances={(instances) => { storedInstancesRef.current = instances; setStoredInstances(sortInstances(instances)); }}
        onPackOperationChange={(message, operationId) => { packOperationRef.current = Boolean(message); setPackOperationMessage(message); setPackOperationId(operationId); }}
        onUpdateInstance={handleUpdateInstance}
        onDeleteInstance={handleDeleteInstance}
        onToggleFavorite={handleToggleInstanceFavorite}
        onMoveInstance={handleMoveInstance}
        onLaunch={(instance) => handleLaunch(instance)}
        onStopRunningInstance={handleStopRunningInstance}
        onCreateDownloadTask={createModDownloadTask}
        onFailDownloadTask={failTrackedDownloadTask}
        onSetCachedMods={handleSetCachedMods}
        onRefreshModrinthMods={handleRefreshModrinthMods}
      />
    ),
    accounts: (
      <Accounts
        onboarding={!settings.initialSetupCompleted}
        accounts={accounts}
        skins={skinLibrary}
        language={settings.language}
        storageError={storageError}
        onAddSkin={handleAddSkin}
        onAccountLoggedIn={handleAccountLoggedIn}
        onChangeAccountSkin={handleChangeAccountSkin}
        onCreateOfflineAccount={handleCreateOfflineAccount}
        onMoveSkin={handleMoveSkin}
        onRemoveSkin={handleRemoveSkin}
        onRenameSkin={handleRenameSkin}
        onToggleSkinFavorite={handleToggleSkinFavorite}
        onToggleFavorite={handleToggleAccountFavorite}
        onMoveAccount={handleMoveAccount}
        onRemoveAccount={handleRemoveAccount}
        onSelectAccount={handleSelectAccount}
      />
    ),
    theme: <ThemeEditorPage theme={theme} onThemeChange={handleThemeChange} />,
    settings: <SettingsPage javaSetupBusy={javaSetupBusy} javaSetupStatus={javaSetupStatus} settings={settings} onSave={handleSettingsSave} onSetupJava={handleSetupJava} onRenameGameDirectory={handleRenameGameDirectory} autoUpdateStatus={autoUpdateStatus.message} importer={importerProps} onSetupGuide={reopenSetup} setupGuideDisabled={setupGuideDisabled} onAccounts={()=>setActivePage("accounts")} />
  };

  return (
    <UiLanguage.Provider value={settings.language}><div style={{ "--accent": theme.accentColor } as React.CSSProperties}>
      {installingUpdate ? (
        <LoadingScreen message={autoUpdateStatus.message} progress={autoUpdateStatus.progress ?? 0} />
      ) : startupLoading.active ? (
        <LoadingScreen message={startupLoading.message} progress={startupLoading.progress} />
      ) : (
        <AppShell
          setupMode={!settings.initialSetupCompleted}
          activePage={activePage}
          downloadsOpen={downloadsOpen}
          downloadTasks={downloadTasks}
          settings={settings}
          totalPlaytimeSeconds={totalPlaytimeSeconds}
          onDismissDownloadTask={handleDismissDownloadTask}
          onCancelDownloadTask={cancelDownloadTask}
          onRetryDownloadTask={retryDownloadTask}
          canRetryDownload={canRetryDownload}
          onSettingsChange={handleSettingsSave}
          onToggleDownloads={() => setDownloadsOpen((current) => !current)}
          onNavigate={setActivePage}
        >
          {storageError && settings.initialSetupCompleted && <div role="alert" className="error-panel"><LocalizedError message={storageError}/></div>}
          {settings.initialSetupCompleted&&<LaunchErrorHelp status={launchStatus} language={settings.language} onRetry={()=>{const instance=storedInstances.find(item=>item.id===launchStatus.instanceId);if(instance)void handleLaunch(instance);}} onAccounts={()=>setActivePage("accounts")} onSettings={()=>setActivePage("settings")} onDismiss={()=>setLaunchStatus(idleStatus)}/>}
          {settings.initialSetupCompleted ? pages[activePage] : <FirstTimeGuide settings={settings} accounts={pages.accounts} importer={<LauncherImportSection compact settings={settings} {...importerProps} />} instances={storedInstances} tasks={downloadTasks} busy={javaSetupBusy} ready={setupReady} operationBusy={Boolean(packOperationMessage)} status={javaSetupStatus} onRetry={handleSetupJava} onFinish={finishSetup} onCreate={handleCreateInstance} />}
          {packOperationMessage ? (
            <div className="modal-backdrop pack-operation-overlay" role="dialog" aria-modal="true" aria-label={ui("Modpack operation")}>
              <div className="card">
                <p role="status">{ui(packOperationMessage)}</p>
                {packDownloadTask ? <>
                  <p>{ui(packDownloadTask.label)}</p>
                  {packDownloadTask.cancelOperationId&&<button className="button button-secondary" onClick={()=>void cancelDownloadTask(packDownloadTask.id)}>{settings.language==="de"?"Abbrechen":"Cancel"}</button>}
                  <div className="download-progress-track"><div className="download-progress-fill" style={{ width: `${packDownloadTask.percent}%` }} /></div>
                  <p>{packDownloadTask.percent.toFixed(0)}% · {packDownloadTask.downloadedMb.toFixed(1)} / {packDownloadTask.totalMb.toFixed(1)} MB</p>
                </> : <p>{ui("Please wait until the operation finishes.")}</p>}
              </div>
            </div>
          ) : null}
          {directoryRenameBusy ? <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={ui("Renaming game directory")}><p role="status">{ui("Renaming game directory...")}</p></div> : null}
        </AppShell>
      )}
    </div></UiLanguage.Provider>
  );
}
