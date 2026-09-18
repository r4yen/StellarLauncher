import LocalizedError from "./LocalizedError";
import { useUiText } from "../uiLanguage";
import { FileDown, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { MrpackSelection } from "../services/mrpackService";
import { loaderLabels } from "../services/loaderServices";
import Button from "./ui/Button";
import Card from "./ui/Card";

interface ImportMrpackModalProps {
  selection?: MrpackSelection;
  gameDirectory: string;
  error?: string;
  onClose: () => void;
  onImport: (selection: MrpackSelection, optionalFiles: string[]) => void;
}

export default function ImportMrpackModal({ selection, gameDirectory, error, onClose, onImport }: ImportMrpackModalProps) {
  const ui = useUiText();
  const [optionalFiles, setOptionalFiles] = useState<string[]>([]);
  useEffect(() => setOptionalFiles(selection?.pack.optionalFiles ?? []), [selection]);
  if (!selection) return null;
  const { pack } = selection;
  return createPortal(
    <div className="modal-backdrop modal-backdrop-subwindow" role="dialog" aria-modal="true" aria-label={ui("Import Modrinth modpack")}>
      <Card className="export-instance-modal" tone="bright">
        <div className="modal-header">
          <div><span>{ui("Import .mrpack")}</span><h2>{pack.name}</h2></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label={ui("Close import")}><X size={18} /></button>
        </div>
        <div className="export-instance-content">
          <p>{ui("Pack version")} {pack.versionId} · Minecraft {pack.minecraftVersion} · {loaderLabels[pack.loaderType]} {pack.loaderVersion}</p>
          {pack.summary ? <p>{pack.summary}</p> : null}
          <p>{ui("A new folder for this pack will be created inside")} <strong>{gameDirectory}</strong>.</p>
          {pack.optionalFiles.length > 0 ? <>
            <h3>{ui("Optional files")}</h3>
            <div className="export-folder-list">
              {pack.optionalFiles.map((path) => (
                <label className="export-folder-row" key={path}>
                  <input type="checkbox" checked={optionalFiles.includes(path)} onChange={() => setOptionalFiles((current) => current.includes(path) ? current.filter((file) => file !== path) : [...current, path])} />
                  <div><strong>{path}</strong></div>
                </label>
              ))}
            </div>
          </> : null}
          {error ? <div className="error-panel" role="alert"><LocalizedError message={error} /></div> : null}
        </div>
        <div className="form-footer">
          <Button icon={<FileDown size={16} />} type="button" onClick={() => onImport(selection, optionalFiles)}>{ui("Import modpack")}</Button>
          <Button variant="ghost" type="button" onClick={onClose}>{ui("Cancel")}</Button>
        </div>
      </Card>
    </div>, document.body
  );
}
