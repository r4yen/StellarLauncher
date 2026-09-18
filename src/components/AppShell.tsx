import { ReactNode, useEffect, useState } from "react";
import { DownloadTask } from "../models/download";
import { PageKey } from "../models/launcher";
import { LauncherSettings } from "../models/settings";
import DownloadStatusPanel from "./DownloadStatusPanel";
import Sidebar from "./Sidebar";
import TitleBar from "./TitleBar";

interface AppShellProps {
  setupMode?: boolean;
  activePage: PageKey;
  children: ReactNode;
  downloadsOpen: boolean;
  downloadTasks: DownloadTask[];
  settings: LauncherSettings;
  totalPlaytimeSeconds: number;
  onDismissDownloadTask: (taskId: string) => void;
  onCancelDownloadTask: (taskId:string)=>void;
  onRetryDownloadTask: (taskId:string)=>void;
  canRetryDownload:(task:DownloadTask)=>boolean;
  onSettingsChange: (settings: LauncherSettings) => void;
  onToggleDownloads: () => void;
  onNavigate: (page: PageKey) => void;
}

export default function AppShell({
  setupMode = false,
  activePage,
  children,
  downloadsOpen,
  downloadTasks,
  settings,
  totalPlaytimeSeconds,
  onDismissDownloadTask,
  onCancelDownloadTask,onRetryDownloadTask,canRetryDownload,
  onSettingsChange,
  onToggleDownloads,
  onNavigate
}: AppShellProps) {
  const [languageOpen, setLanguageOpen] = useState(false);

  const toggleDownloads = () => {
    setLanguageOpen(false);
    onToggleDownloads();
  };

  const setLanguageMenuOpen = (open: boolean) => {
    setLanguageOpen(open);
    if (open && downloadsOpen) onToggleDownloads();
  };

  useEffect(() => {
    if (!downloadsOpen) return;

    const closeDownloadsOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest("[data-download-trigger]") || target.closest("[data-download-panel]")) return;
      onToggleDownloads();
    };

    document.addEventListener("mousedown", closeDownloadsOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeDownloadsOnOutsideClick);
  }, [downloadsOpen, onToggleDownloads]);

  return (
    <div className="window-frame">
      <TitleBar
        downloadCount={downloadTasks.filter((task) => task.status !== "completed").length || downloadTasks.length}
        downloadsOpen={downloadsOpen}
        languageOpen={languageOpen}
        settings={settings}
        onToggleDownloads={toggleDownloads}
        onLanguageOpenChange={setLanguageMenuOpen}
        onSettingsChange={onSettingsChange}
      />
      <DownloadStatusPanel language={settings.language} onCancelTask={onCancelDownloadTask} onRetryTask={onRetryDownloadTask} canRetry={canRetryDownload} panelOnly open={downloadsOpen} tasks={downloadTasks} onDismissTask={onDismissDownloadTask} onToggleOpen={toggleDownloads} />
      <div className={setupMode ? "app-shell setup-shell" : "app-shell"}>
        {!setupMode && <Sidebar activePage={activePage} language={settings.language} totalPlaytimeSeconds={totalPlaytimeSeconds} onNavigate={onNavigate} />}
        <main className="main-content">{children}</main>
      </div>
    </div>
  );
}
