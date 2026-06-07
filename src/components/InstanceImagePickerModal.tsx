import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { FolderOpen, Link2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Instance } from "../models/instance";
import { ModFile } from "../models/mod";
import { copyInstanceIcon, localInstanceIcon, resolveInstanceIconSrc } from "../services/instanceIconService";
import { listMods } from "../services/modService";
import Button from "./ui/Button";
import Card from "./ui/Card";

interface InstanceImagePickerModalProps {
  instance?: Instance;
  open: boolean;
  currentIcon: string;
  onClose: () => void;
  onSelect: (icon: string) => void;
}

export default function InstanceImagePickerModal({ instance, open, currentIcon, onClose, onSelect }: InstanceImagePickerModalProps) {
  const [url, setUrl] = useState("");
  const [mods, setMods] = useState<ModFile[]>([]);
  const [modsLoading, setModsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const currentSrc = resolveInstanceIconSrc(currentIcon);

  useEffect(() => {
    if (!open || !instance || instance.loaderType === "vanilla") {
      setMods([]);
      return;
    }

    let cancelled = false;
    setModsLoading(true);
    setError(undefined);

    listMods(instance)
      .then((loadedMods) => {
        if (!cancelled) setMods(loadedMods.filter((mod) => mod.iconDataUrl));
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : String(loadError));
      })
      .finally(() => {
        if (!cancelled) setModsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [instance, open]);

  if (!open) return null;

  const applyUrl = () => {
    const nextUrl = url.trim();
    if (!/^https?:\/\/.+/i.test(nextUrl) && !nextUrl.startsWith("data:image/")) {
      setError("Enter a valid image URL.");
      return;
    }

    onSelect(nextUrl);
    onClose();
  };

  const chooseFile = async () => {
    const selected = await openDialog({
      multiple: false,
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif"] }]
    });
    if (typeof selected !== "string") return;
    try {
      const copiedPath = await copyInstanceIcon(selected);
      onSelect(localInstanceIcon(copiedPath));
      onClose();
    } catch (copyError) {
      setError(copyError instanceof Error ? copyError.message : String(copyError));
    }
  };

  return createPortal(
    <div className="modal-backdrop modal-backdrop-subwindow" role="dialog" aria-modal="true" aria-label="Choose instance image">
      <Card className="image-picker-modal" tone="bright">
        <div className="modal-header">
          <div>
            <span>Instance image</span>
            <h2>Choose instance image</h2>
          </div>
          <button className="icon-button" onClick={onClose} type="button" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="image-picker-preview">
          {currentSrc ? <img src={currentSrc} alt="Current instance icon" /> : <div style={{ background: currentIcon || "#64748b" }} />}
          <span>Current image</span>
        </div>

        <div className="image-picker-section">
          <label>
            From URL
            <div className="inline-input-action">
              <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com/icon.png" />
              <Button icon={<Link2 size={16} />} type="button" onClick={applyUrl}>
                Use URL
              </Button>
            </div>
          </label>
        </div>

        <div className="image-picker-section">
          <span>From File</span>
          <Button icon={<FolderOpen size={16} />} variant="secondary" type="button" onClick={chooseFile}>
            Choose local image
          </Button>
        </div>

        {instance?.loaderType !== "vanilla" ? (
          <div className="image-picker-section">
            <span>From Mods</span>
            {modsLoading ? <p>Loading mod images...</p> : null}
            {!modsLoading && mods.length === 0 ? <p>No mod images found.</p> : null}
            <div className="mod-image-grid">
              {mods.map((mod) => (
                <button key={mod.path} type="button" onClick={() => mod.iconDataUrl && (onSelect(mod.iconDataUrl), onClose())}>
                  {mod.iconDataUrl ? <img src={mod.iconDataUrl} alt={`${mod.name} icon`} /> : null}
                  <span>{mod.name}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {error ? <div className="error-panel">{error}</div> : null}
      </Card>
    </div>,
    document.body
  );
}
