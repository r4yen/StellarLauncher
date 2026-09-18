import { useUiText } from "../uiLanguage";
import LocalizedError from "./LocalizedError";
import { useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import { FolderOpen, Import, RefreshCw } from "lucide-react";
import { Instance } from "../models/instance";
import { LauncherSettings } from "../models/settings";
import { importLauncher, importLaunchers, LauncherScan, scanLauncher } from "../services/launcherImportService";
import Button from "./ui/Button";
import Card from "./ui/Card";

export interface LauncherImportSectionProps {
  compact?: boolean;
  settings: LauncherSettings;
  disabled?: boolean;
  onImported: (instances: Instance[]) => void;
  onBusyChange: (message?: string) => void;
}

export default function LauncherImportSection({ settings, disabled, onImported, onBusyChange, compact = false }: LauncherImportSectionProps) {
  const ui = useUiText();
  const de = settings.language === "de";
  const [launcher, setLauncher] = useState("modrinth");
  const [root, setRoot] = useState<string>();
  const [scan, setScan] = useState<LauncherScan>();
  const [selected, setSelected] = useState<string[]>([]);
  const [imported, setImported] = useState<string[]>([]);
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [revision, setRevision] = useState(0);
  const busyRef = useRef(false);

  useEffect(() => {
    let current = true;
    setScanning(true); setScan(undefined); setSelected([]); setError(undefined); setNotice(undefined);
    scanLauncher(launcher, root).then((result) => { if (current) setScan(result); })
      .catch((reason) => { if (current) setError(String(reason)); })
      .finally(() => { if (current) setScanning(false); });
    return () => { current = false; };
  }, [launcher, root, revision]);

  const chooseFolder = async () => {
    try {
      const folder = await open({ directory: true, multiple: false, title: de ? "Launcher- oder Instanzenordner auswählen" : "Choose launcher or instances folder" });
      if (typeof folder === "string") setRoot(folder);
    } catch (reason) { setError(String(reason)); }
  };
  const startImport = async () => {
    if (busyRef.current || disabled || !selected.length) return;
    busyRef.current = true; setBusy(true); setError(undefined); setNotice(undefined);
    onBusyChange(de ? "Instanzen werden kopiert…" : "Copying instances…");
    let unlisten: (() => void) | undefined;
    try {
      unlisten = await listen<{ name: string; copiedBytes: number }>("launcher-import-progress", ({ payload }) => {
        onBusyChange(`${payload.name} · ${(payload.copiedBytes / 1048576).toFixed(1)} MB copied`);
      });
      const result = await importLauncher(launcher, root, selected);
      onImported(result.instances);
      setImported((current) => [...current, ...result.importedIds]);
      setSelected((current) => current.filter((id) => !result.importedIds.includes(id)));
      setNotice(result.importedIds.length === 1 ? "1 instance imported." : `${result.importedIds.length} instances imported.`);
      if (result.errors.length) setError(result.errors.join("\n"));
    } catch (reason) { setError(String(reason)); }
    finally { unlisten?.(); busyRef.current = false; setBusy(false); onBusyChange(undefined); }
  };
  const available = scan?.instances.filter((item) => !item.error && !imported.includes(item.id)) ?? [];
  // Browsing sources is safe even while another operation blocks copying.
  const locked = busy;
  const importLocked = busy || disabled;
  const controls = <fieldset disabled={locked} className="import-controls">
    <select className="launcher-select" aria-label="Launcher" disabled={locked} value={launcher} onChange={(event) => {setLauncher(event.target.value);setRoot(undefined);}}>{importLaunchers.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select>
    <Button variant="secondary" icon={<FolderOpen size={16} />} title={de ? "Ordner auswählen" : ui("Choose folder")} aria-label={de ? "Ordner auswählen" : ui("Choose folder")} onClick={chooseFolder}>{compact ? undefined : de ? "Ordner auswählen" : ui("Choose folder")}</Button>
    <Button variant="ghost" icon={<RefreshCw size={16} />} title={de ? "Neu suchen" : ui("Rescan")} aria-label={de ? "Neu suchen" : ui("Rescan")} onClick={() => setRevision((value) => value + 1)} disabled={scanning}>{compact ? undefined : de ? "Neu suchen" : ui("Rescan")}</Button>
    {root && !compact && <Button variant="ghost" onClick={() => setRoot(undefined)}>{de ? "Automatisch erkennen" : ui("Detect automatically")}</Button>}
  </fieldset>;
  const selectAll = <label className="import-check"><input type="checkbox" disabled={locked || !available.length} checked={available.length > 0 && available.every((item) => selected.includes(item.id))} onChange={(event) => setSelected(event.target.checked ? available.map((item) => item.id) : [])} />{de ? "Alle verfügbaren auswählen" : ui("Select all available")}</label>;
  const rows = scan?.instances.map((item) => <label className="import-instance-row" title={item.gameDirectory} key={item.id}>
    <input type="checkbox" disabled={locked || !!item.error || imported.includes(item.id)} checked={selected.includes(item.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} />
    <div><strong>{item.name}</strong><small>{item.minecraftVersion} · {item.loaderType} {item.loaderVersion}</small><small className="import-path" title={item.gameDirectory}>{item.gameDirectory}</small>{item.error && <small className="import-warning"><LocalizedError message={item.error} /></small>}{imported.includes(item.id) && <small>{de ? "Importiert" : ui("Imported")}</small>}</div>
  </label>);
  const importButton = <Button disabled={importLocked || !selected.length || scanning} icon={<Import size={16} />} onClick={startImport}>{de ? `Auswahl importieren (${selected.length})` : `Import selected (${selected.length})`}</Button>;
  const blockedNotice = disabled && !busy && <p role="status" className="muted-text">{ui("You can choose a launcher and folder now. Stop running instances and wait for active operations to finish before importing.")}</p>;
  if (compact) return <div className="setup-compact-import">
    {controls}
    <div className="setup-import-location"><span title={root ?? scan?.roots.join(" · ")}>{(root ?? scan?.roots.join(" · ")) || (de ? "Automatische Pfaderkennung" : ui("Automatic path detection"))}</span>{root && <button type="button" disabled={locked} onClick={() => setRoot(undefined)}>{de ? "Automatisch" : ui("Automatic")}</button>}</div>
    {selectAll}
    <div className="setup-list import-instance-list" aria-label={de ? "Importierbare Instanzen" : ui("Importable instances")}>
      {scanning && <p className="setup-import-message" role="status">{de ? "Instanzen werden gesucht…" : ui("Looking for instances…")}</p>}
      {scan && !scan.instances.length && <p className="setup-import-message">{de ? "Keine Instanzen gefunden. Wähle bei einer portablen Installation den Ordner manuell. Für Modrinth: den Ordner mit app.db." : ui("No instances found. For portable installations, choose the folder manually. For Modrinth, choose the folder containing app.db.")}</p>}
      {rows}
      {scan?.warnings.map((warning) => <p className="setup-import-message import-warning" key={warning}><LocalizedError message={warning} /></p>)}
      {error && <p className="setup-import-message import-error import-warning" role="alert"><LocalizedError message={error} /></p>}
    </div>
    <div className="setup-import-submit">{importButton}{blockedNotice}{notice && <small role="status">{ui(notice)}</small>}</div>
  </div>;
  return <Card className="launcher-import-section">
    <div><span>{de ? "Migration" : "Migration"}</span><h2>{de ? "Instanzen aus anderen Launchern" : ui("Import from other launchers")}</h2>
      <p>{de ? "Wähle einen Launcher und die gewünschten Instanzen. Mods, Welten und Einstellungen werden in eigene Unterordner kopiert." : ui("Choose a launcher and the instances to import. Mods, worlds and settings are copied into separate folders.")}</p>
      <p className="muted-text">{de ? "Ziel:" : ui("Destination:")} {settings.gameDirectory}</p>
    </div>
    {controls}
    {blockedNotice}
    {root && <p className="import-path">{root}</p>}
    {scan?.roots.map((path) => <p className="import-path muted-text" key={path}>{path}</p>)}
    {scanning && <p role="status">{de ? "Instanzen werden gesucht…" : ui("Looking for instances…")}</p>}
    {scan && !scan.instances.length && <p>{de ? "Keine Instanzen gefunden. Bei einer portablen Installation oder einem eigenen Speicherort bitte den Ordner auswählen. Für Modrinth den Ordner mit app.db wählen." : ui("No instances found. For portable installations or custom locations, choose the folder manually. For Modrinth, select the folder containing app.db.")}</p>}
    {!!scan?.instances.length && <>
      {selectAll}
      <div className="import-instance-list">{rows}</div>
      {importButton}
    </>}
    {scan?.warnings.map((warning) => <p className="import-warning" key={warning}><LocalizedError message={warning} /></p>)}
    {notice && <p role="status">{ui(notice)}</p>}
    {error && <p className="error-panel import-error" role="alert"><LocalizedError message={error} /></p>}
    <small className="muted-text">{de ? "Schließe die Quellinstanzen vor dem Import. Die Originalordner bleiben erhalten. Konten werden separat angemeldet; Java und RAM verwenden die Stellar-Einstellungen." : ui("Close source instances before importing. Original folders are preserved. Sign in to accounts separately; Java and memory use your Stellar settings.")}</small>
  </Card>;
}
