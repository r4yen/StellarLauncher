import SettingsForm from "../components/SettingsForm";
import { LauncherSettings } from "../models/settings";

interface SettingsPageProps {
  settings: LauncherSettings;
  onSave: (settings: LauncherSettings) => void;
}

export default function SettingsPage({ settings, onSave }: SettingsPageProps) {
  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <span>Configuration</span>
          <h1>Settings</h1>
          <p>Java, memory, directories and JVM arguments are centralized for later Rust-backed config persistence.</p>
        </div>
      </div>
      <section className="settings-grid">
        <SettingsForm settings={settings} onSave={onSave} />
      </section>
    </div>
  );
}
