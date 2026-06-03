import { useMemo, useState } from "react";
import AppShell from "./components/AppShell";
import { defaultLauncherSettings, defaultLauncherStatus, defaultThemeSettings, mockAccounts, mockInstances } from "./data/mockData";
import { Account, Instance, LauncherSettings, LaunchStatus, PageKey, ThemeSettings } from "./models/launcher";
import AccountsPage from "./pages/AccountsPage";
import HomePage from "./pages/HomePage";
import InstancesPage from "./pages/InstancesPage";
import SettingsPage from "./pages/SettingsPage";
import ThemeEditorPage from "./pages/ThemeEditorPage";
import { requestMockLaunch } from "./services/launchService";
import { loadLauncherSettings, loadThemeSettings, saveLauncherSettings, saveThemeSettings } from "./services/storage";

const idleStatus: LaunchStatus = {
  state: "idle",
  message: "Ready",
  updatedAt: new Date().toISOString()
};

export default function App() {
  const [activePage, setActivePage] = useState<PageKey>("home");
  const [instances] = useState<Instance[]>(mockInstances);
  const [accounts, setAccounts] = useState<Account[]>(mockAccounts);
  const [theme, setTheme] = useState<ThemeSettings>(() => loadThemeSettings(defaultThemeSettings));
  const [settings, setSettings] = useState<LauncherSettings>(() => loadLauncherSettings(defaultLauncherSettings));
  const [launchStatus, setLaunchStatus] = useState<LaunchStatus>(idleStatus);

  const activeAccount = useMemo(() => accounts.find((account) => account.isActive) ?? accounts[0], [accounts]);
  const latestInstance = instances[0];

  const handleLaunch = async (instance: Instance) => {
    setLaunchStatus({
      state: "preparing",
      message: `Preparing ${instance.name}`,
      instanceId: instance.id,
      updatedAt: new Date().toISOString()
    });

    const commandStatus = await requestMockLaunch(instance.id);
    setLaunchStatus(commandStatus);

    window.setTimeout(() => {
      setLaunchStatus({
        state: "launching",
        message: `Launching ${instance.name}`,
        instanceId: instance.id,
        updatedAt: new Date().toISOString()
      });
    }, 800);

    window.setTimeout(() => {
      setLaunchStatus({
        state: "running",
        message: `${instance.name} is running`,
        instanceId: instance.id,
        updatedAt: new Date().toISOString()
      });
    }, 1900);
  };

  const handleSelectAccount = (accountId: string) => {
    setAccounts((current) =>
      current.map((account) => ({
        ...account,
        isActive: account.id === accountId
      }))
    );
  };

  const handleThemeChange = (nextTheme: ThemeSettings) => {
    setTheme(nextTheme);
    saveThemeSettings(nextTheme);
  };

  const handleSettingsSave = (nextSettings: LauncherSettings) => {
    setSettings(nextSettings);
    saveLauncherSettings(nextSettings);
  };

  const page = {
    home: (
      <HomePage
        account={activeAccount}
        instances={instances}
        latestInstance={latestInstance}
        launcherStatus={defaultLauncherStatus}
        launchStatus={launchStatus}
        onLaunch={handleLaunch}
      />
    ),
    instances: <InstancesPage instances={instances} launchStatus={launchStatus} onLaunch={handleLaunch} />,
    accounts: <AccountsPage accounts={accounts} onSelectAccount={handleSelectAccount} />,
    theme: <ThemeEditorPage theme={theme} onThemeChange={handleThemeChange} />,
    settings: <SettingsPage settings={settings} onSave={handleSettingsSave} />
  }[activePage];

  return (
    <div style={{ "--accent": theme.accentColor, "--glow-strength": `${theme.glowIntensity}%` } as React.CSSProperties}>
      <AppShell activePage={activePage} onNavigate={setActivePage} compact={theme.compactMode}>
        {page}
      </AppShell>
    </div>
  );
}
