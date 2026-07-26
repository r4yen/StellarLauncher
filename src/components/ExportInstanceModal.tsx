import { FileArchive, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Instance } from "../models/instance";
import Button from "./ui/Button";
import Card from "./ui/Card";

interface ExportInstanceModalProps {
  instance?: Instance;
  open: boolean;
  onClose: () => void;
  onExport: (instance: Instance, includedFolders: string[]) => void;
}

const exportFolders = [
  { id: "mods", label: "Mods", description: "Installed .jar files and disabled mods" },
  { id: "config", label: "Config", description: "Mod and game configuration files" },
  { id: "resourcepacks", label: "Resource Packs", description: "Resource pack folder" },
  { id: "shaderpacks", label: "Shader Packs", description: "Shader pack folder" },
  { id: "saves", label: "Saves", description: "Singleplayer worlds" },
  { id: "screenshots", label: "Screenshots", description: "Local screenshots" }
];

export default function ExportInstanceModal({ instance, open, onClose, onExport }: ExportInstanceModalProps) {
  const [selectedFolders, setSelectedFolders] = useState<string[]>(["mods"]);

  useEffect(() => {
    if (open) setSelectedFolders(["mods"]);
  }, [open, instance?.id]);

  if (!open || !instance) return null;

  const toggleFolder = (folder: string) => {
    setSelectedFolders((current) =>
      current.includes(folder) ? current.filter((item) => item !== folder) : [...current, folder]
    );
  };

  return createPortal(
    <div className="modal-backdrop modal-backdrop-subwindow" role="dialog" aria-modal="true" aria-label={`${instance.name} export`}>
      <Card className="export-instance-modal" tone="bright">
        <div className="modal-header">
          <div>
            <span>Export</span>
            <h2>{instance.name}</h2>
          </div>
          <button className="icon-button" onClick={onClose} type="button" aria-label="Close export">
            <X size={18} />
          </button>
        </div>

        <div className="export-instance-content">
          <p>Select which local instance folders should be packed into the `.stellarinstance` archive.</p>
          <div className="export-folder-list">
            {exportFolders.map((folder) => (
              <label className="export-folder-row" key={folder.id}>
                <input checked={selectedFolders.includes(folder.id)} onChange={() => toggleFolder(folder.id)} type="checkbox" />
                <div>
                  <strong>{folder.label}</strong>
                  <span>{folder.description}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="form-footer">
          <span>{selectedFolders.length} folders selected</span>
          <div className="card-actions">
            <Button icon={<FileArchive size={16} />} onClick={() => onExport(instance, selectedFolders)} type="button">
              Export .stellarinstance
            </Button>
            <Button variant="ghost" onClick={onClose} type="button">
              Cancel
            </Button>
          </div>
        </div>
      </Card>
    </div>,
    document.body
  );
}
