import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { Plus, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Instance } from "../models/instance";
import { ModFile } from "../models/mod";
import { addModFile, deleteMod, listMods, setModEnabled } from "../services/modService";
import Button from "./ui/Button";
import Card from "./ui/Card";

interface ModsModalProps {
  instance?: Instance;
  open: boolean;
  onClose: () => void;
}

export default function ModsModal({ instance, open, onClose }: ModsModalProps) {
  const [mods, setMods] = useState<ModFile[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | undefined>();

  const filteredMods = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return mods;
    return mods.filter((mod) =>
      [mod.name, mod.fileName, mod.version, mod.authors.join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(normalized)
    );
  }, [mods, query]);

  const refresh = async () => {
    if (!instance) return;
    setError(undefined);
    try {
      setMods(await listMods(instance));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    }
  };

  useEffect(() => {
    if (open) refresh();
  }, [open, instance?.id]);

  const toggleEnabled = async (mod: ModFile) => {
    try {
      const updated = await setModEnabled(mod.path, !mod.enabled);
      setMods((current) => current.map((item) => (item.path === mod.path ? updated : item)));
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : String(toggleError));
    }
  };

  const removeMod = async (mod: ModFile) => {
    try {
      await deleteMod(mod.path);
      setMods((current) => current.filter((item) => item.path !== mod.path));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : String(deleteError));
    }
  };

  const addMod = async () => {
    if (!instance) return;

    try {
      const selected = await openDialog({
        multiple: false,
        title: "Select mod file",
        filters: [{ name: "Minecraft Mod", extensions: ["jar", "disabled"] }]
      });

      if (!selected || Array.isArray(selected)) return;

      const added = await addModFile(instance.gameDirectory, selected);
      setMods((current) => [added, ...current]);
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : String(addError));
    }
  };

  if (!open || !instance) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Mods">
      <Card className="create-modal mods-modal" tone="bright">
        <div className="mods-modal-top">
          <div className="modal-header">
            <div>
              <span>Mods</span>
              <h2>{instance.name}</h2>
            </div>
            <button className="icon-button" onClick={onClose} type="button" aria-label="Close">
              <X size={18} />
            </button>
          </div>
          <div className="mods-toolbar">
            <label className="mods-search">
              <Search size={16} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search mods" />
            </label>
            <Button icon={<Plus size={16} />} onClick={addMod} type="button">
              Add
            </Button>
          </div>
        </div>
        {error ? <div className="error-panel">{error}</div> : null}
        <div className="mods-list">
          {filteredMods.length > 0 ? (
            filteredMods.map((mod) => (
              <div className={mod.enabled ? "mod-row" : "mod-row mod-row-disabled"} key={mod.path}>
                <input checked={mod.enabled} onChange={() => toggleEnabled(mod)} type="checkbox" />
                <div className="mod-icon">
                  {mod.iconDataUrl ? <img src={mod.iconDataUrl} alt="" /> : <span>{mod.name.slice(0, 1)}</span>}
                </div>
                <div className="mod-main">
                  <strong>{mod.name}</strong>
                  <span>{mod.fileName}</span>
                </div>
                <div className="mod-meta">
                  <strong>{mod.version}</strong>
                  <span>{mod.authors.length ? mod.authors.join(", ") : "Unknown author"}</span>
                </div>
                <button className="icon-button" onClick={() => removeMod(mod)} type="button" aria-label="Delete mod">
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          ) : (
            <Card className="empty-state">
              <h3>{mods.length > 0 ? "No matching mods" : "No mods found"}</h3>
              <p>{mods.length > 0 ? "Try a different search term." : "Add .jar files to the mods folder for this instance."}</p>
            </Card>
          )}
        </div>
      </Card>
    </div>
  );
}
