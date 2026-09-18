import { useUiText } from "../uiLanguage";
import LocalizedError from "./LocalizedError";
import { FileArchive, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Instance } from "../models/instance";
import { listMrpackExportEntries, MrpackExportEntry, MrpackExportOptions } from "../services/mrpackService";
import Button from "./ui/Button";
import Card from "./ui/Card";

interface ExportInstanceModalProps {
  instance?: Instance;
  open: boolean;
  error?: string;
  onClose: () => void;
  onExport: (instance: Instance, options: MrpackExportOptions) => void;
}

const defaultEntries = new Set(["mods", "config", "resourcepacks", "shaderpacks", "datapacks", "options.txt"]);

export default function ExportInstanceModal({ instance, open, error, onClose, onExport }: ExportInstanceModalProps) {
  const ui = useUiText();
  const [entries, setEntries] = useState<MrpackExportEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string>();
  const [options, setOptions] = useState<MrpackExportOptions>({ name: "", versionId: "", summary: "", includedPaths: [] });

  useEffect(() => {
    if (!open || !instance) return;
    let cancelled = false;
    setOptions({ name: instance.name, versionId: "", summary: instance.notes ?? "", includedPaths: [] });
    setEntries([]);
    setLoadError(undefined);
    setLoading(true);
    listMrpackExportEntries(instance).then((loaded) => {
      if (cancelled) return;
      setEntries(loaded);
      setOptions((current) => ({ ...current, includedPaths: loaded.filter((entry) => defaultEntries.has(entry.path)).map((entry) => entry.path) }));
    }).catch((reason) => {
      if (!cancelled) setLoadError(String(reason));
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, instance]);

  if (!open || !instance) return null;
  const toggle = (path: string) => setOptions((current) => ({
    ...current,
    includedPaths: current.includedPaths.includes(path) ? current.includedPaths.filter((entry) => entry !== path) : [...current.includedPaths, path]
  }));

  return createPortal(
    <div className="modal-backdrop modal-backdrop-subwindow" role="dialog" aria-modal="true" aria-label={ui("{name} export", {name: instance.name})}>
      <Card className="export-instance-modal" tone="bright">
        <div className="modal-header">
          <div><span>{ui("Export .mrpack")}</span><h2>{instance.name}</h2></div>
          <button className="icon-button" onClick={onClose} type="button" aria-label={ui("Close export")}><X size={18} /></button>
        </div>
        <div className="export-instance-content">
          <label>{ui("Modpack name")}<input value={options.name} onChange={(event) => setOptions((current) => ({ ...current, name: event.target.value }))} /></label>
          <label>{ui("Modpack version")}<input placeholder={ui("e.g. 1.0.0")} value={options.versionId} onChange={(event) => setOptions((current) => ({ ...current, versionId: event.target.value }))} /></label>
          <label>{ui("Summary (optional)")}<textarea rows={2} value={options.summary} onChange={(event) => setOptions((current) => ({ ...current, summary: event.target.value }))} /></label>
          <p>{ui("Select the files and folders to include. Mods and packs available on Modrinth are linked for download; other selected files are included in the pack.")}</p>
          {loading ? <p>{ui("Loading instance files...")}</p> : null}
          <div className="export-folder-list">
            {entries.map((entry) => (
              <label className="export-folder-row" key={entry.path}>
                <input checked={options.includedPaths.includes(entry.path)} onChange={() => toggle(entry.path)} type="checkbox" />
                <div><strong>{entry.path}{entry.isDirectory ? "/" : ""}</strong></div>
              </label>
            ))}
          </div>
          {error || loadError ? <div className="error-panel" role="alert"><LocalizedError message={error ?? loadError}/></div> : null}
        </div>
        <div className="form-footer">
          <span>{ui(options.includedPaths.length === 1 ? "1 item selected" : "{count} items selected", {count: options.includedPaths.length})}</span>
          <div className="card-actions">
            <Button icon={<FileArchive size={16} />} disabled={loading || Boolean(loadError) || !options.name.trim() || !options.versionId.trim()} onClick={() => onExport(instance, options)} type="button">{ui("Export .mrpack")}</Button>
            <Button variant="ghost" onClick={onClose} type="button">{ui("Cancel")}</Button>
          </div>
        </div>
      </Card>
    </div>, document.body
  );
}
