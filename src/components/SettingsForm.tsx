import { useEffect, useState } from "react";
import { LauncherSettings } from "../models/settings";
import Button from "./ui/Button";
import Card from "./ui/Card";

interface SettingsFormProps {
  javaSetupBusy?: boolean;
  javaSetupStatus?: string;
  settings: LauncherSettings;
  onSave: (settings: LauncherSettings) => void;
  onSetupJava?: () => void;
}

export default function SettingsForm({ javaSetupBusy = false, javaSetupStatus, settings, onSave, onSetupJava }: SettingsFormProps) {
  const [form, setForm] = useState(settings);

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  const updateField = (field: keyof LauncherSettings, value: string | number | boolean) => {
    setForm((current) => {
      const next = { ...current, [field]: value };
      onSave(next);
      return next;
    });
  };

  return (
    <Card className="settings-form">
      <div className="settings-form-fields">
        <div className="settings-subsection">
          <div>
            <h3>Discord Rich Presence</h3>
            <p>Show the currently running Minecraft instance in Discord. Enabled by default.</p>
          </div>
          <label className="toggle-row">
            <input
              checked={form.discordRichPresenceEnabled}
              type="checkbox"
              onChange={(event) => updateField("discordRichPresenceEnabled", event.target.checked)}
            />
            Enable Discord Rich Presence
          </label>
        </div>
        <div className="settings-subsection">
          <div>
            <h3>Default Java paths</h3>
            <p>The launcher automatically chooses the matching Java executable for each Minecraft version.</p>
          </div>
          <div className="settings-action-row">
            <div>
              <strong>Local Adoptium setup</strong>
              <span>Downloads Java 8, 17, 21 and 25 into the launcher folder.</span>
            </div>
            <Button disabled={javaSetupBusy} onClick={onSetupJava} type="button" variant="secondary">
              {javaSetupBusy ? "Installing Java..." : "Setup Adoptium Java"}
            </Button>
          </div>
          {javaSetupStatus ? <small>{javaSetupStatus}</small> : null}
          <div className="java-path-grid">
            <label>
              Java 8
              <input value={form.java8Path} onChange={(event) => updateField("java8Path", event.target.value)} />
            </label>
            <label>
              Java 17
              <input value={form.java17Path} onChange={(event) => updateField("java17Path", event.target.value)} />
            </label>
            <label>
              Java 21
              <input value={form.java21Path} onChange={(event) => updateField("java21Path", event.target.value)} />
            </label>
            <label>
              Java 25
              <input value={form.java25Path} onChange={(event) => updateField("java25Path", event.target.value)} />
            </label>
          </div>
        </div>
        <label>
          Default RAM
          <input
            min={1024}
            step={512}
            type="number"
            value={form.defaultRamMb}
            onChange={(event) => updateField("defaultRamMb", Number(event.target.value))}
          />
        </label>
        <label>
          Game directory
          <input value={form.gameDirectory} onChange={(event) => updateField("gameDirectory", event.target.value)} />
        </label>
        <label>
          JVM arguments
          <textarea rows={3} value={form.jvmArgs} onChange={(event) => updateField("jvmArgs", event.target.value)} />
        </label>
        <label>
          Launcher folder
          <input value={form.launcherFolder} onChange={(event) => updateField("launcherFolder", event.target.value)} />
        </label>
        <label>
          Minecraft storage directory
          <input
            value={form.minecraftStorageDirectory}
            onChange={(event) => updateField("minecraftStorageDirectory", event.target.value)}
          />
          <small>Local Minecraft files, version metadata, libraries and assets will be prepared under this folder.</small>
        </label>
      </div>
    </Card>
  );
}
