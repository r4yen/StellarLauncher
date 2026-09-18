import LocalizedError from "./LocalizedError";
import { hasUiMessage } from "../uiTranslation";
import { useUiText } from "../uiLanguage";
import { useEffect, useState } from "react";
import { LauncherSettings } from "../models/settings";
import Button from "./ui/Button";
import Card from "./ui/Card";
export type SettingsSection = "general" | "minecraft" | "downloads" | "advanced";
interface Props {
  section: SettingsSection;
  javaSetupBusy?: boolean; javaSetupStatus?: string;
  settings: LauncherSettings; onSave: (settings: LauncherSettings) => void;
  onSetupJava?: () => void; onRenameGameDirectory: (name:string)=>Promise<void>; autoUpdateStatus:string;
}
export default function SettingsForm({section,settings,onSave,onRenameGameDirectory,javaSetupBusy,javaSetupStatus,autoUpdateStatus}:Props) {
  const ui = useUiText();
  const de=settings.language==="de";
  const text=(en:string,_deText:string)=>ui(en);
  const [form,setForm]=useState(settings);
  const [name,setName]=useState(""); const [busy,setBusy]=useState(false); const [status,setStatus]=useState("");
  useEffect(()=>setForm(settings),[settings]);
  const update=<K extends keyof LauncherSettings>(key:K,value:LauncherSettings[K])=>{const next={...form,[key]:value};setForm(next);onSave(next);};
  const rename=async()=>{setBusy(true);try{await onRenameGameDirectory(name.trim());setName("");setStatus("Folder renamed.");}catch(e){setStatus(String(e));}finally{setBusy(false);}};
  return <Card className="settings-form settings-section-card"><div className="settings-form-fields">
    {section==="general" && <>
      <div className="settings-section-heading"><h2>{text("General","Allgemein")}</h2><p>{text("Make Stellar feel at home.","Richte Stellar so ein, wie du es magst.")}</p></div>
      <label>{text("Language","Sprache")}<select value={form.language} onChange={e=>update("language",e.target.value as "en"|"de")}><option value="de">Deutsch</option><option value="en">English</option></select></label>
      <div className="settings-subsection"><h3>{text("Automatic updates","Automatische Updates")}</h3><p>{text("Check GitHub on startup. New versions install when games and downloads have finished; Stellar then restarts.","Beim Start auf GitHub prüfen. Neue Versionen werden installiert, sobald Spiele und Downloads beendet sind. Danach startet Stellar neu.")}</p><label className="toggle-row"><input type="checkbox" checked={form.autoUpdateEnabled} onChange={e=>update("autoUpdateEnabled",e.target.checked)}/>{text("Keep Stellar up to date","Stellar aktuell halten")}</label><details><summary>{text("Update details","Update-Details")}</summary><small>{hasUiMessage(autoUpdateStatus) ? ui(autoUpdateStatus) : <LocalizedError message={autoUpdateStatus}/>}</small></details></div>
      <div className="settings-subsection"><h3>Discord</h3><label className="toggle-row"><input type="checkbox" checked={form.discordRichPresenceEnabled} onChange={e=>update("discordRichPresenceEnabled",e.target.checked)}/>{text("Show your running instance in Discord","Laufende Instanz in Discord anzeigen")}</label></div>
    </>}
    {section==="minecraft" && <>
      <div className="settings-section-heading"><h2>Minecraft & Java</h2><p>{text("Defaults for new instances. Individual instances can use their own settings.","Standardwerte für neue Instanzen. Jede Instanz kann eigene Einstellungen verwenden.")}</p></div>
      <div className="settings-info"><strong>{text("Java installs automatically","Java installiert sich automatisch")}</strong><p>{text("Stellar installs the matching Adoptium Java runtime before launching. No version selection or installation button needed.","Stellar installiert vor dem Start automatisch die passende Adoptium-Java-Version. Du musst keine Version auswählen oder eine Installation anstoßen.")}</p>{javaSetupBusy&&<small>{text("Installing Java…","Java wird installiert…")}</small>}{javaSetupStatus&&<details><summary>{text("Java details","Java-Details")}</summary><small>{hasUiMessage(javaSetupStatus) ? ui(javaSetupStatus) : <LocalizedError message={javaSetupStatus}/>}</small></details>}</div>
      <label>{text("Default memory (MB)","Standard-Arbeitsspeicher (MB)")}<input type="number" min={1024} step={512} value={form.defaultRamMb} onChange={e=>{const value=Number(e.target.value);if(value>=1024)update("defaultRamMb",value);}}/></label>
      <label>{ui("Game Directory")}<input value={form.gameDirectory} onChange={e=>update("gameDirectory",e.target.value)}/><small>{text("Used when an instance has no Custom Game Directory.","Wird verwendet, wenn kein Custom Game Directory für die Instanz gesetzt ist.")}</small></label>
      <details className="advanced-settings"><summary>{text("Advanced Java configuration","Erweiterte Java-Konfiguration")}</summary><p>{text("A Java path set directly on an instance takes precedence over automatic installation.","Ein direkt in der Instanz gesetzter Java-Pfad hat Vorrang vor der automatischen Installation.")}</p><label>{text("Default JVM arguments","Standard-JVM-Argumente")}<textarea rows={3} value={form.jvmArgs} onChange={e=>update("jvmArgs",e.target.value)}/></label></details>
    </>}
    {section==="downloads" && <>
      <div className="settings-section-heading"><h2>Downloads</h2><p>{text("Track downloads from the title bar. Cancel active transfers or retry failed ones.","Verfolge Downloads in der Titelleiste. Du kannst Übertragungen abbrechen oder fehlgeschlagene Downloads wiederholen.")}</p></div>
      <label className="toggle-row"><input type="checkbox" checked={form.openDownloadsAutomatically} onChange={e=>update("openDownloadsAutomatically",e.target.checked)}/>{text("Open download panel automatically","Downloadanzeige automatisch öffnen")}</label>
      <label>{text("Minecraft download storage","Speicherort für Minecraft-Downloads")}<input value={form.minecraftStorageDirectory} onChange={e=>update("minecraftStorageDirectory",e.target.value)}/><small>{text("Shared game files, libraries and assets. Worlds stay in each Game Directory.","Gemeinsame Spieldateien, Bibliotheken und Assets. Welten bleiben im jeweiligen Game Directory.")}</small></label>
    </>}
    {section==="advanced" && <>
      <div className="settings-section-heading"><h2>{text("Advanced","Erweitert")}</h2><p>{text("Backups and storage locations.","Sicherungen und Speicherorte.")}</p></div>
      <label className="toggle-row"><input type="checkbox" checked={form.autoBackupBeforeChanges} onChange={e=>update("autoBackupBeforeChanges",e.target.checked)}/>{text("Back up before changing Minecraft or mod loader versions","Vor Änderungen an Minecraft-Version oder Modloader sichern")}</label>
      <label>{text("Launcher folder","Launcher-Ordner")}<input value={form.launcherFolder} onChange={e=>update("launcherFolder",e.target.value)}/></label>
      <details className="advanced-settings"><summary>{text("Rename Game Directory","Game Directory umbenennen")}</summary><p>{text("Rename the existing folder in place. Its contents stay intact and saved paths are updated.","Benennt den bestehenden Ordner am gleichen Ort um. Inhalte bleiben erhalten, gespeicherte Pfade werden angepasst.")}</p><label>{text("New folder name","Neuer Ordnername")}<input value={name} disabled={busy} onChange={e=>setName(e.target.value)}/></label><Button variant="secondary" disabled={busy||!name.trim()} onClick={rename}>{busy?text("Renaming…","Wird umbenannt…"):text("Rename folder","Ordner umbenennen")}</Button>{status&&<p role="status">{status === "Folder renamed." ? ui(status) : <LocalizedError message={status}/>}</p>}</details>
    </>}
  </div></Card>;
}
