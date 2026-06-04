import { ReactNode } from "react";
import { DownloadTask } from "../models/download";
import { PageKey } from "../models/launcher";
import { LauncherSettings } from "../models/settings";
import DownloadStatusPanel from "./DownloadStatusPanel";
import Sidebar from "./Sidebar";
import TitleBar from "./TitleBar";

interface AppShellProps {
  activePage: PageKey;
  children: ReactNode;
  downloadsOpen: boolean;
  downloadTasks: DownloadTask[];
  settings: LauncherSettings;
  onSettingsChange: (settings: LauncherSettings) => void;
  onToggleDownloads: () => void;
  onNavigate: (page: PageKey) => void;
}

export default function AppShell({
  activePage,
  children,
  downloadsOpen,
  downloadTasks,
  settings,
  onSettingsChange,
  onToggleDownloads,
  onNavigate
}: AppShellProps) {
  return (
    <div className="window-frame">
      <TitleBar
        downloadCount={downloadTasks.filter((task) => task.status !== "completed").length || downloadTasks.length}
        downloadsOpen={downloadsOpen}
        settings={settings}
        onToggleDownloads={onToggleDownloads}
        onSettingsChange={onSettingsChange}
      />
      <DownloadStatusPanel panelOnly open={downloadsOpen} tasks={downloadTasks} onToggleOpen={onToggleDownloads} />
      <div className="app-shell">
        <Sidebar activePage={activePage} language={settings.language} onNavigate={onNavigate} />
        <main className="main-content">{children}</main>
      </div>
    </div>
  );
}
