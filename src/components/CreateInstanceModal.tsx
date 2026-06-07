import { ImagePlus, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { CreateInstanceInput, Instance, LoaderType } from "../models/instance";
import { LauncherSettings } from "../models/settings";
import { getLoaderVersions, loaderLabels, LoaderVersion } from "../services/loaderServices";
import { getMinecraftVersions, MinecraftVersion } from "../services/minecraftVersionService";
import { validateInstanceInput } from "../services/instanceService";
import Button from "./ui/Button";
import Card from "./ui/Card";
import CustomSelect from "./ui/CustomSelect";
import InstanceImagePickerModal from "./InstanceImagePickerModal";

interface CreateInstanceModalProps {
  editingInstance?: Instance;
  open: boolean;
  settings: LauncherSettings;
  onClose: () => void;
  onCreate: (input: CreateInstanceInput) => void;
  onUpdate?: (instanceId: string, input: CreateInstanceInput) => void;
}

const loaderTypes: LoaderType[] = ["vanilla", "fabric", "forge", "neoforge", "quilt"];
const defaultInstanceIcon = "#64748b";

function defaultProfileDirectory(instanceName: string): string {
  const profileName = instanceName.trim().replace(/[<>:"/\\|?*]/g, "-") || "<Instance Name>";
  return `%APPDATA%\\StellarLauncher\\profiles\\${profileName}`;
}

export default function CreateInstanceModal({ editingInstance, open, settings, onClose, onCreate, onUpdate }: CreateInstanceModalProps) {
  const [versions, setVersions] = useState<MinecraftVersion[]>([]);
  const [loaderVersions, setLoaderVersions] = useState<LoaderVersion[]>([]);
  const [loaderVersionsLoading, setLoaderVersionsLoading] = useState(false);
  const [loaderVersionsError, setLoaderVersionsError] = useState<string | undefined>();
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [form, setForm] = useState<CreateInstanceInput>({
    name: "",
    minecraftVersion: "1.21.5",
    loaderType: "vanilla",
    loaderVersion: "",
    gameDirectory: "",
    javaPath: "",
    ramMb: settings.defaultRamMb,
    jvmArgs: settings.jvmArgs,
    icon: defaultInstanceIcon,
    notes: ""
  });

  useEffect(() => {
    if (!open) return;

    setErrors([]);
    setForm(
      editingInstance
        ? {
            name: editingInstance.name,
            minecraftVersion: editingInstance.minecraftVersion,
            loaderType: editingInstance.loaderType,
            loaderVersion: editingInstance.loaderVersion,
            gameDirectory: editingInstance.gameDirectory,
            javaPath: editingInstance.javaPath,
            ramMb: editingInstance.ramMb,
            jvmArgs: editingInstance.jvmArgs,
            icon: editingInstance.icon,
            notes: editingInstance.notes ?? ""
          }
        : {
            name: "",
            minecraftVersion: "1.21.5",
            loaderType: "vanilla",
            loaderVersion: "",
            gameDirectory: "",
            javaPath: "",
            ramMb: settings.defaultRamMb,
            jvmArgs: settings.jvmArgs,
            icon: defaultInstanceIcon,
            notes: ""
          }
    );
  }, [editingInstance, open, settings]);

  useEffect(() => {
    if (!open) return;
    getMinecraftVersions().then(setVersions);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    const requestedLoaderType = form.loaderType;
    const requestedMinecraftVersion = form.minecraftVersion;

    if (requestedLoaderType === "vanilla") {
      setLoaderVersions([]);
      setLoaderVersionsError(undefined);
      setLoaderVersionsLoading(false);
      setForm((current) => ({ ...current, loaderVersion: "" }));
      return;
    }

    setLoaderVersionsLoading(true);
    setLoaderVersionsError(undefined);

    getLoaderVersions(requestedLoaderType, requestedMinecraftVersion)
      .then((loadedVersions) => {
        if (cancelled) return;
        setLoaderVersions(loadedVersions);
        setForm((current) => {
          if (current.loaderType !== requestedLoaderType || current.minecraftVersion !== requestedMinecraftVersion) return current;
          const currentStillAvailable = loadedVersions.some((version) => version.id === current.loaderVersion);
          return {
            ...current,
            loaderVersion: currentStillAvailable ? current.loaderVersion : loadedVersions[0]?.id || ""
          };
        });
      })
      .catch((error) => {
        if (cancelled) return;
        setLoaderVersions([]);
        setLoaderVersionsError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (!cancelled) setLoaderVersionsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [form.loaderType, form.minecraftVersion, open]);

  const submitInput = useMemo(
    () => ({
      ...form,
      gameDirectory: form.gameDirectory.trim() || defaultProfileDirectory(form.name)
    }),
    [form]
  );
  const canSubmit = useMemo(() => validateInstanceInput(submitInput).length === 0, [submitInput]);
  const versionOptions = (versions.length ? versions : [{ id: form.minecraftVersion, type: "release" as const }]).map((version) => ({
    value: version.id,
    label: version.id,
    description: version.type
  }));
  const loaderVersionOptions = loaderVersions.map((loaderVersion) => ({
    value: loaderVersion.id,
    label: loaderVersion.id,
    description: loaderVersion.stable ? "Stable" : "Experimental"
  }));

  const updateField = <K extends keyof CreateInstanceInput>(field: K, value: CreateInstanceInput[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const validationErrors = validateInstanceInput(submitInput);
    setErrors(validationErrors);
    if (validationErrors.length > 0) return;
    if (editingInstance && onUpdate) onUpdate(editingInstance.id, submitInput);
    else onCreate(submitInput);
    onClose();
  };

  if (!open) return null;

  return createPortal(
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Create new instance">
      <Card className="create-modal" tone="bright">
        <div className="modal-header">
          <div>
            <span>New profile</span>
            <h2>{editingInstance ? "Edit instance" : "New instance"}</h2>
          </div>
          <button className="icon-button" onClick={onClose} type="button" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <form className="create-instance-form" onSubmit={handleSubmit}>
          <label>
            Instance name
            <input value={form.name} onChange={(event) => updateField("name", event.target.value)} />
          </label>
          <div className="form-row">
            <label>
              Minecraft version
              <CustomSelect
                value={form.minecraftVersion}
                placeholder="Select Minecraft version"
                options={versionOptions}
                onChange={(value) => updateField("minecraftVersion", value)}
              />
            </label>
            <label>
              RAM
              <input
                min={1024}
                step={512}
                type="number"
                value={form.ramMb}
                onChange={(event) => updateField("ramMb", Number(event.target.value))}
              />
            </label>
          </div>
          <div className="loader-picker">
            {loaderTypes.map((loaderType) => (
              <button
                key={loaderType}
                className={form.loaderType === loaderType ? "loader-pill loader-pill-active" : "loader-pill"}
                onClick={() => updateField("loaderType", loaderType)}
                type="button"
              >
                {loaderLabels[loaderType]}
              </button>
            ))}
          </div>
          {form.loaderType !== "vanilla" ? (
            <label>
              Modloader version
              <CustomSelect
                disabled={loaderVersionsLoading || loaderVersions.length === 0}
                value={form.loaderVersion}
                placeholder={loaderVersionsLoading ? "Loading live versions..." : "Select loader version"}
                options={loaderVersionOptions}
                onChange={(value) => updateField("loaderVersion", value)}
              />
              {loaderVersionsError ? <small>Live versions could not be loaded. Using fallback data if available.</small> : null}
            </label>
          ) : null}
          <label>
            Game Directory override
            <input
              placeholder={defaultProfileDirectory(form.name)}
              value={form.gameDirectory}
              onChange={(event) => updateField("gameDirectory", event.target.value)}
            />
            <small>Leave empty to use the default profile folder.</small>
          </label>
          <label>
            Java path override
            <input
              placeholder="Automatically uses Java 8, 17, 21, or 25 from Settings"
              value={form.javaPath}
              onChange={(event) => updateField("javaPath", event.target.value)}
            />
            <small>Leave empty to let the launcher choose the Java path from the Minecraft version.</small>
          </label>
          <label>
            JVM arguments
            <textarea rows={3} value={form.jvmArgs} onChange={(event) => updateField("jvmArgs", event.target.value)} />
          </label>
          <label>
            Notes
            <textarea rows={2} value={form.notes} onChange={(event) => updateField("notes", event.target.value)} />
          </label>
          {editingInstance ? (
            <div className="image-picker-launch-row">
              <span>Instance image</span>
              <Button icon={<ImagePlus size={16} />} variant="secondary" type="button" onClick={() => setImagePickerOpen(true)}>
                Choose instance image
              </Button>
            </div>
          ) : null}
          {errors.length > 0 ? (
            <div className="error-panel">
              {errors.map((error) => (
                <span key={error}>{error}</span>
              ))}
            </div>
          ) : null}
          <div className="form-footer">
            <span>{canSubmit ? "Ready to create local instance profile." : "Fill in the required fields."}</span>
            <Button type="submit">{editingInstance ? "Save instance" : "Create instance"}</Button>
          </div>
        </form>
      </Card>
      <InstanceImagePickerModal
        currentIcon={form.icon}
        instance={editingInstance}
        open={imagePickerOpen}
        onClose={() => setImagePickerOpen(false)}
        onSelect={(icon) => updateField("icon", icon)}
      />
    </div>,
    document.body
  );
}
