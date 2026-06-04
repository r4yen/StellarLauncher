import { useEffect, useState } from "react";
import { LauncherSettings } from "../models/settings";
import Card from "./ui/Card";

interface SettingsFormProps {
  settings: LauncherSettings;
  onSave: (settings: LauncherSettings) => void;
}

export default function SettingsForm({ settings, onSave }: SettingsFormProps) {
  const [form, setForm] = useState(settings);

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  const updateField = (field: keyof LauncherSettings, value: string | number) => {
    setForm((current) => {
      const next = { ...current, [field]: value };
      onSave(next);
      return next;
    });
  };

  return (
    <Card className="settings-form">
      <div className="settings-form-fields">
        <label>
          Java path
          <input value={form.javaPath} onChange={(event) => updateField("javaPath", event.target.value)} />
        </label>
        <div className="settings-subsection">
          <div>
            <h3>Default Java paths</h3>
            <p>Store the Java executables used by different Minecraft generations.</p>
          </div>
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
