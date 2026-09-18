import { useUiText } from "../uiLanguage";
import LocalizedError from "./LocalizedError";
import { ReactNode, useState } from "react";
import { ArrowLeft, ArrowRight, Box, Check, CheckCheck, Download, Import, Loader2, Plus, ShieldCheck } from "lucide-react";
import { LauncherSettings } from "../models/settings";
import { CreateInstanceInput, Instance } from "../models/instance";
import { DownloadTask } from "../models/download";
import CreateInstanceModal from "./CreateInstanceModal";
import Button from "./ui/Button";
import { resolveInstanceIconSrc } from "../services/instanceIconService";

interface Props {
  settings: LauncherSettings;
  accounts: ReactNode;
  importer: ReactNode;
  instances: Instance[];
  tasks: DownloadTask[];
  busy: boolean;
  ready: boolean;
  operationBusy: boolean;
  status?: string;
  onRetry: () => void;
  onFinish: () => Promise<void>;
  onCreate: (input: CreateInstanceInput) => Promise<void>;
}
export default function FirstTimeGuide({ settings, accounts, importer, instances, tasks, busy, ready, operationBusy, status, onRetry, onFinish, onCreate }: Props) {
  const ui = useUiText();
  const de = settings.language === "de";
  const [importOpen, setImportOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const javaTasks = [21].map((version) => tasks.find((task) => task.instanceId === `java-${version}`));
  const percent = ready ? 100 : javaTasks.reduce((sum, task) => sum + (task?.percent ?? 0), 0) / Math.max(javaTasks.length, 1);
  const finish = async () => {
    setSaving(true); setError(undefined);
    try { await onFinish(); } catch (reason) { setError(String(reason)); } finally { setSaving(false); }
  };
  const create = async (input: CreateInstanceInput) => {
    setSaving(true); setError(undefined);
    try { await onCreate(input); } finally { setSaving(false); }
  };
  return <div className="first-time-guide">
    <header className="setup-welcome"><div><span className="setup-eyebrow">{de ? "DEIN START MIT STELLAR" : ui("GET STARTED WITH STELLAR")}</span><h1>{de ? "Willkommen an Bord." : ui("Welcome aboard.")}</h1><p>{de ? "Deine Accounts. Deine Welten. Wir kümmern uns um den Rest." : ui("Your accounts. Your worlds. We’ll take care of the rest.")}</p></div><span className="setup-background-label"><ShieldCheck size={16} />{de ? "Einrichtung im Hintergrund" : ui("Setting up in the background")}</span></header>
    <div className="setup-workspace">
      {accounts}
      <section className={`setup-pane ${importOpen ? "setup-pane-importing" : ""}`} aria-label={de ? "Instanzen" : ui("Instances")}>
        <header className="setup-pane-heading"><span className="setup-pane-icon"><Box size={21} /></span><div><h2>{de ? "Instanzen" : ui("Instances")}</h2><p>{importOpen ? (de ? "Wähle einen Launcher und deine Instanzen." : ui("Choose a launcher and the instances to bring over.")) : (de ? "Ein neuer Start oder deine bisherigen Modpacks." : ui("A fresh start, or the modpacks you already love."))}</p></div>{importOpen ? <Button variant="ghost" icon={<ArrowLeft size={16} />} aria-label={de ? "Deine Instanzen" : ui("Your instances")} title={de ? "Deine Instanzen" : ui("Your instances")} disabled={operationBusy} onClick={() => setImportOpen(false)} /> : <span className="setup-count">{instances.length}</span>}</header>
        {!importOpen && <div className="setup-pane-actions"><Button icon={<Plus size={16} />} disabled={saving || operationBusy} onClick={() => setCreateOpen(true)}>{de ? "Instanz erstellen" : ui("Create instance")}</Button><Button variant="secondary" icon={<Import size={16} />} disabled={saving || operationBusy} onClick={() => setImportOpen(true)}>{de ? "Importieren" : ui("Import instances")}</Button></div>}
        <div className="setup-import-view" hidden={!importOpen}>{importer}</div>
        <div className="setup-list" hidden={importOpen} aria-label={de ? "Instanzenliste" : ui("Instance list")}>
          {instances.length ? instances.map((item) => <div className="setup-list-row" key={item.id}><img className="setup-row-image" src={resolveInstanceIconSrc(item.icon)} alt="" /><div className="setup-row-copy"><strong>{item.name}</strong><small>{item.minecraftVersion} · {item.loaderType}</small></div><span className="setup-row-ready"><Check size={14} />{de ? "Bereit" : ui("Ready")}</span></div>) : <div className="setup-empty"><span className="setup-empty-icon"><Box size={30} /></span><h3>{de ? "Platz für deine nächste Welt" : ui("Room for your next world")}</h3><p>{de ? "Erstelle deine erste Instanz oder bring deine Modpacks aus einem anderen Launcher mit." : ui("Create your first instance or bring your modpacks over from another launcher.")}</p></div>}
        </div>
        <div className="setup-pane-note"><CheckCheck size={14} />{de ? "Importe sind Kopien. Deine Originale bleiben erhalten." : ui("Imports are copies. Your originals stay untouched.")}</div>
      </section>
    </div>
    <footer className="setup-dock">
      <div className="setup-dock-main"><div className={`setup-dock-icon ${ready ? "is-ready" : ""}`}>{ready ? <Check size={22} /> : busy ? <Loader2 size={22} className="spin" /> : <Download size={22} />}</div><div className="setup-dock-copy"><h2>{ready ? (de ? "Alles bereit für dich" : ui("You’re all set")) : (de ? "Wir richten Java für dich ein" : ui("We’re getting Java ready for you"))}</h2><p role="status" title={status ? ui(status) : undefined}>{error ? <LocalizedError message={error}/> : !busy && !ready && status ? <LocalizedError message={status}/> : ui(status ?? "Preparing setup…")}</p></div><div className="setup-runtime-tags">{javaTasks.map((task, index) => <span className={task?.status === "completed" ? "is-ready" : ""} key={index}>{task?.status === "completed" && <Check size={12} />} Java {[21][index]}</span>)}</div><span className="setup-percent">{percent.toFixed(0)}%</span></div>
      <div className="download-progress-track" role="progressbar" aria-label={ui("Setup")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)}><div className="download-progress-fill" style={{ width: `${percent}%` }} /></div>
      <div className="setup-dock-footer"><small>{ready ? (de ? "Starte, wenn du bereit bist. Du kannst später weitere Accounts und Instanzen hinzufügen." : ui("Start when you’re ready. You can always add more accounts and instances later.")) : (de ? "Melde dich schon an und bereite deine Instanzen vor. Stellar wird danach freigeschaltet." : ui("Sign in and prepare your instances while we finish. Stellar unlocks when setup is complete."))}</small>{!busy && !ready ? <Button variant="secondary" onClick={onRetry}>{de ? "Erneut versuchen" : ui("Retry setup")}</Button> : <Button icon={<ArrowRight size={16} />} disabled={!ready || busy || saving || operationBusy || createOpen} onClick={finish}>{de ? "Stellar öffnen" : ui("Open Stellar")}</Button>}</div>
    </footer>
    <CreateInstanceModal open={createOpen} settings={settings} onClose={() => setCreateOpen(false)} onCreate={create} />
  </div>;
}
