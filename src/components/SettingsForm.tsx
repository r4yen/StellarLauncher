import { Save } from "lucide-react";
import { FormEvent, useState } from "react";
import { LauncherSettings } from "../models/launcher";
import Button from "./ui/Button";
import Card from "./ui/Card";

interface SettingsFormProps {
  settings: LauncherSettings;
  onSave: (settings: LauncherSettings) => void;
}

export default function SettingsForm({ settings, onSave }: SettingsFormProps) {
  const [form, setForm] = useState(settings);

  const updateField = (field: keyof LauncherSettings, value: string | number) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSave(form);
  };

  return (
    <Card className="settings-form">
      <form onSubmit={handleSubmit}>
        <label>
          Java path
          <input value={form.javaPath} onChange={(event) => updateField("javaPath", event.target.value)} />
        </label>
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
        <div className="form-footer">
          <span>Settings are persisted through the local storage service and ready for a Tauri config backend.</span>
          <Button icon={<Save size={16} />} type="submit">
            Save settings
          </Button>
        </div>
      </form>
    </Card>
  );
}
