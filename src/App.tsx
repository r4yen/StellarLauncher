import { useEffect, useMemo, useRef, useState } from "react";
import AppShell from "./components/AppShell";
import { defaultLauncherSettings, defaultLauncherStatus, defaultThemeSettings } from "./data/mockData";
import { Account } from "./models/account";
import { DownloadTask } from "./models/download";
import { CreateInstanceInput, Instance, LaunchState, LaunchStatus, RunningInstance } from "./models/instance";
import { PageKey } from "./models/launcher";
import { LauncherSettings, ThemeSettings } from "./models/settings";
import Accounts from "./pages/Accounts";
import HomePage from "./pages/HomePage";
import Instances from "./pages/Instances";
import SettingsPage from "./pages/SettingsPage";
import ThemeEditorPage from "./pages/ThemeEditorPage";
import {
  addOfflinePlayerAccount,
  moveAccount,
  removeAccount,
  setActiveAccount,
  sortAccounts,
  toggleAccountFavorite,
  upsertAccount
} from "./services/accountService";
import { createInstance, deleteInstance, moveInstance, sortInstances, toggleInstanceFavorite, updateInstance } from "./services/instanceService";
import { isMinecraftProcessRunning, readLaunchLogTail, startMinecraftProcess, stopMinecraftProcess, validateLaunch } from "./services/launchService";
import { ensureMinecraftFiles } from "./services/minecraftDownloaderService";
import { getMinecraftCacheKey, getMinecraftLocalPath, loadLocalMinecraftCache, saveLocalMinecraftCache } from "./services/minecraftStorageService";
import {
  loadAccounts,
  loadInstances,
  loadRunningInstancesLocal,
  loadSettings,
  loadTheme,
  saveRunningInstancesLocal,
  saveSettings,
  saveTheme
} from "./services/storageService";

const idleStatus: LaunchStatus = {
  state: "idle",
  message: "Ready",
  updatedAt: new Date().toISOString()
};

const delay = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

export default function App() {
  const [activePage, setActivePage] = useState<PageKey>("home");
  const [storedInstances, setStoredInstances] = useState<Instance[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [theme, setTheme] = useState<ThemeSettings>(defaultThemeSettings);
  const [settings, setSettings] = useState<LauncherSettings>(defaultLauncherSettings);
  const [launchStatus, setLaunchStatus] = useState<LaunchStatus>(idleStatus);
  const [runningInstances, setRunningInstances] = useState<RunningInstance[]>(() => loadRunningInstancesLocal());
  const [downloadTasks, setDownloadTasks] = useState<DownloadTask[]>([]);
  const [downloadsOpen, setDownloadsOpen] = useState(false);
  const [minecraftCache, setMinecraftCache] = useState<string[]>([]);
  const [storageError, setStorageError] = useState<string | undefined>();
  const runningInstancesRef = useRef<RunningInstance[]>(runningInstances);

  useEffect(() => {
    let mounted = true;

    Promise.all([
      loadAccounts([]),
      loadInstances([]),
      loadTheme(defaultThemeSettings),
      loadSettings(defaultLauncherSettings),
      loadLocalMinecraftCache()
    ])
      .then(([loadedAccounts, loadedInstances, loadedTheme, loadedSettings, loadedMinecraftCache]) => {
        if (!mounted) return;
        const sortedAccounts = sortAccounts(loadedAccounts);
        setAccounts(
          sortedAccounts.some((account) => account.isFavorite)
            ? sortedAccounts.map((account, index) => ({ ...account, isActive: index === 0 }))
            : sortedAccounts
        );
        setStoredInstances(sortInstances(loadedInstances));
        setTheme(loadedTheme);
        setSettings(loadedSettings);
        setMinecraftCache(loadedMinecraftCache);
      })
      .catch((error) => {
        if (mounted) setStorageError(error instanceof Error ? error.message : String(error));
      });

    return () => {
      mounted = false;
    };
  }, []);

  const activeAccount = useMemo(() => accounts.find((account) => account.isActive) ?? accounts[0], [accounts]);
  const runningInstanceIds = useMemo(
    () => new Set(runningInstances.filter((running) => running.state !== "error").map((running) => running.instance.id)),
    [runningInstances]
  );

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
    saveRunningInstancesLocal(runningInstances);
    runningInstancesRef.current = runningInstances;
  }, [runningInstances]);

  useEffect(() => {
    let cancelled = false;
    const inspectRunningInstances = async () => {
      const snapshot = runningInstancesRef.current;
      if (snapshot.length === 0) return;

      const checks = await Promise.all(
        snapshot.map(async (running) => {
          if (!running.processId) return { running, alive: running.state !== "error", logs: running.logs };

          try {
            const alive = await isMinecraftProcessRunning(running.processId);
            const logs = alive && running.logPath ? await readLaunchLogTail(running.logPath, 180) : running.logs;
            return { running, alive, logs };
          } catch {
            return { running, alive: true, logs: running.logs };
          }
        })
      );

      if (cancelled) return;

      setRunningInstances((current) => {
        const byId = new Map(checks.map((check) => [check.running.id, check]));
        return current
          .filter((running) => byId.get(running.id)?.alive ?? true)
          .map((running) => {
            const check = byId.get(running.id);
            if (!check) return running;
            return {
              ...running,
              logs: check.logs.length > 0 ? check.logs : running.logs,
              state: running.processId ? "running" : running.state,
              message: running.processId ? "Minecraft is running" : running.message,
              updatedAt: new Date().toISOString()
            };
          });
      });
    };

    inspectRunningInstances();
    const intervalId = window.setInterval(inspectRunningInstances, 1800);

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

    setDownloadsOpen(true);
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

    const progress = new Map(tasks.map((task) => [task.id, 0]));
    setDownloadsOpen(true);
    setDownloadTasks((current) => [...tasks, ...current]);

    const intervalId = window.setInterval(() => {
      setDownloadTasks((current) =>
        current.map((task) => {
          if (!progress.has(task.id) || task.status === "completed" || task.status === "error") return task;
          const nextPercent = Math.min((progress.get(task.id) ?? 0) + 3.5, 95);
          progress.set(task.id, nextPercent);
          return {
            ...task,
            status: "downloading",
            downloadedMb: (task.totalMb * nextPercent) / 100,
            percent: nextPercent,
            etaSeconds: Math.max(1, Math.round((100 - nextPercent) / 7)),
            updatedAt: new Date().toISOString()
          };
        })
      );
    }, 500);

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

  const handleLaunch = async (instance: Instance, account = activeAccount) => {
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
    const tasks = createMinecraftDownloadTasks(instance);

    setLaunchStatus({
      state: "downloading",
      message: minecraftCache.includes(cacheKey) ? `Checking local Minecraft files for ${instance.name}` : `Downloading local Minecraft files for ${instance.name}`,
      instanceId: instance.id,
      updatedAt: new Date().toISOString()
    });
    updateRunningInstance(runId, "downloading", `Preparing Minecraft files for ${instance.name}`, `Checking local storage at ${localPath}`);

    const downloadIndicator = beginDownloadTasks(tasks);

    try {
      const downloadResult = await ensureMinecraftFiles(instance, settings);
      downloadIndicator.finish();
      const nextCache = Array.from(new Set([...minecraftCache, cacheKey]));
      setMinecraftCache(nextCache);
      await saveLocalMinecraftCache(nextCache);
      window.setTimeout(() => {
        setDownloadTasks((current) => current.filter((currentTask) => !tasks.some((finished) => finished.id === currentTask.id)));
      }, 2800);
      updateRunningInstance(
        runId,
        "downloading",
        `Minecraft files ready for ${instance.name}`,
        `Ready at ${downloadResult.storagePath}; downloaded ${downloadResult.filesDownloaded} files (${(downloadResult.bytesDownloaded / 1024 / 1024).toFixed(1)} MB)`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      downloadIndicator.fail();
      setLaunchStatus({
        state: "error",
        message,
        instanceId: instance.id,
        updatedAt: new Date().toISOString()
      });
      updateRunningInstance(runId, "error", "Download failed", message);
      window.setTimeout(() => {
        setDownloadTasks((current) => current.filter((currentTask) => !tasks.some((finished) => finished.id === currentTask.id)));
      }, 4200);
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
      updateRunningInstance(runId, "error", "Launch failed", processStatus.message);
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
                `[${new Date().toLocaleTimeString()}] Minecraft process started with pid ${processStatus.processId}`,
                `[${new Date().toLocaleTimeString()}] Process log: ${processStatus.logPath}`
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
    setAccounts(sortAccounts(await upsertAccount(accounts, account)));
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

  const handleCreateInstance = async (input: CreateInstanceInput) => {
    setStoredInstances(sortInstances(await createInstance(storedInstances, input)));
  };

  const handleUpdateInstance = async (instanceId: string, input: CreateInstanceInput) => {
    setStoredInstances(sortInstances(await updateInstance(storedInstances, instanceId, input)));
  };

  const handleDeleteInstance = async (instanceId: string) => {
    setStoredInstances(await deleteInstance(storedInstances, instanceId));
  };

  const handleToggleInstanceFavorite = async (instanceId: string) => {
    setStoredInstances(await toggleInstanceFavorite(storedInstances, instanceId));
  };

  const handleMoveInstance = async (instanceId: string, direction: -1 | 1) => {
    setStoredInstances(await moveInstance(storedInstances, instanceId, direction));
  };

  const handleThemeChange = async (nextTheme: ThemeSettings) => {
    setTheme(nextTheme);
    await saveTheme(nextTheme);
  };

  const handleSettingsSave = async (nextSettings: LauncherSettings) => {
    setSettings(nextSettings);
    await saveSettings(nextSettings);
  };

  const page = {
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
        runningInstances={runningInstances}
        settings={settings}
        onCreateInstance={handleCreateInstance}
        onUpdateInstance={handleUpdateInstance}
        onDeleteInstance={handleDeleteInstance}
        onToggleFavorite={handleToggleInstanceFavorite}
        onMoveInstance={handleMoveInstance}
        onLaunch={(instance) => handleLaunch(instance)}
        onStopRunningInstance={handleStopRunningInstance}
      />
    ),
    accounts: (
      <Accounts
        accounts={accounts}
        language={settings.language}
        storageError={storageError}
        onAccountLoggedIn={handleAccountLoggedIn}
        onCreateOfflineAccount={handleCreateOfflineAccount}
        onToggleFavorite={handleToggleAccountFavorite}
        onMoveAccount={handleMoveAccount}
        onRemoveAccount={handleRemoveAccount}
        onSelectAccount={handleSelectAccount}
      />
    ),
    theme: <ThemeEditorPage theme={theme} onThemeChange={handleThemeChange} />,
    settings: <SettingsPage settings={settings} onSave={handleSettingsSave} />
  }[activePage];

  return (
    <div style={{ "--accent": theme.accentColor } as React.CSSProperties}>
      <AppShell
        activePage={activePage}
        downloadsOpen={downloadsOpen}
        downloadTasks={downloadTasks}
        settings={settings}
        onSettingsChange={handleSettingsSave}
        onToggleDownloads={() => setDownloadsOpen((current) => !current)}
        onNavigate={setActivePage}
      >
        {page}
      </AppShell>
    </div>
  );
}
