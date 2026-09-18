import LocalizedError from "./LocalizedError";
import { useEffect,useState } from "react";
import { createPortal } from "react-dom";
import { invoke } from "@tauri-apps/api/core";
import { X } from "lucide-react";
import { Instance } from "../models/instance";
import Button from "./ui/Button";
interface Backup{id:string;createdAt:string;minecraftVersion:string;loaderType:string}
export default function BackupsModal({instance,language,onClose,onImported,onBusy}:{instance?:Instance;language:"en"|"de";onClose:()=>void;onImported:(items:Instance[])=>void;onBusy:(message?:string)=>void}){
  const [items,setItems]=useState<Backup[]>([]);const [error,setError]=useState("");const [busy,setBusy]=useState(false);const [restore,setRestore]=useState<string>();
  const de=language==="de";const text=(en:string,deText:string)=>de?deText:en;
  const reload=()=>instance?invoke<Backup[]>("list_instance_backups",{instanceId:instance.id}).then(setItems):Promise.resolve();
  useEffect(()=>{setItems([]);setError("");setRestore(undefined);void reload().catch(e=>setError(String(e)));},[instance?.id]);
  const run=async(restoring=false)=>{if(!instance||busy)return;setBusy(true);setError("");onBusy(text("Preparing backup…","Sicherung wird vorbereitet…"));try{if(restoring){onImported(await invoke<Instance[]>("restore_instance_backup",{instanceId:instance.id,backupId:restore}));setRestore(undefined);}else await invoke("create_instance_backup",{instanceId:instance.id});await reload();}catch(e){setError(String(e));}finally{setBusy(false);onBusy(undefined);}};
  if(!instance)return null;
  return createPortal(<div className="modal-backdrop"><section className="card maintenance-modal" role="dialog" aria-modal="true" aria-label={text("Backups","Sicherungen")}><header className="modal-header"><div><h2>{text("Backups","Sicherungen")}</h2><p>{instance.name}</p></div><button className="icon-button" disabled={busy} aria-label={text("Close","Schließen")} onClick={onClose}><X size={18}/></button></header><Button disabled={busy} onClick={()=>run()}>{text("Create backup","Sicherung erstellen")}</Button><p>{text("Includes worlds, mods, game configuration and the instance profile.","Enthält Welten, Mods, Spieleinstellungen und das Instanzprofil.")}</p><div className="maintenance-list">{items.map(item=><div className="backup-row" key={item.id}><div><strong>{new Date(item.createdAt).toLocaleString(language)}</strong><small>{item.minecraftVersion} · {item.loaderType}</small></div><Button variant="secondary" disabled={busy} onClick={()=>setRestore(item.id)}>{text("Restore","Wiederherstellen")}</Button></div>)}{!items.length&&<p>{text("No backups yet.","Noch keine Sicherungen vorhanden.")}</p>}</div>{restore&&<div className="settings-info"><p>{text("Replace this instance with the selected backup? Its current state is backed up first. Other instances remain unchanged.","Diese Instanz durch die gewählte Sicherung ersetzen? Der aktuelle Stand wird vorher gesichert. Andere Instanzen bleiben unverändert.")}</p><Button disabled={busy} onClick={()=>run(true)}>{text("Restore backup","Sicherung wiederherstellen")}</Button><Button variant="ghost" disabled={busy} onClick={()=>setRestore(undefined)}>{text("Cancel","Abbrechen")}</Button></div>}{error&&<p role="alert" className="error-panel"><LocalizedError message={error} /></p>}</section></div>,document.body);
}
