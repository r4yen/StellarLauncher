import SettingsForm from "../components/SettingsForm";
import Card from "../components/ui/Card";
import { LauncherSettings } from "../models/launcher";

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
      <section className="content-grid settings-grid">
        <SettingsForm settings={settings} onSave={onSave} />
        <Card tone="flat" className="settings-side">
          <h3>Backend command shape</h3>
          <p>Rust commands already expose launcher status and mock launch behavior. Settings can move from local storage into an app config file without changing page components.</p>
        </Card>
      </section>
    </div>
  );
}
