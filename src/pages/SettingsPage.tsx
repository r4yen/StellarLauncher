import SettingsForm from "../components/SettingsForm";
import { LauncherSettings } from "../models/settings";

interface SettingsPageProps {
  javaSetupBusy?: boolean;
  javaSetupStatus?: string;
  settings: LauncherSettings;
  onSave: (settings: LauncherSettings) => void;
  onSetupJava?: () => void;
}

export default function SettingsPage({ javaSetupBusy = false, javaSetupStatus, settings, onSave, onSetupJava }: SettingsPageProps) {
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
        <SettingsForm javaSetupBusy={javaSetupBusy} javaSetupStatus={javaSetupStatus} settings={settings} onSave={onSave} onSetupJava={onSetupJava} />
      </section>
    </div>
  );
}
