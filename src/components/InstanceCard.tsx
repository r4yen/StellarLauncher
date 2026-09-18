import { ArrowDown, ArrowUp, Copy, Edit3, FileUp, MoreHorizontal, Package, Play, ShieldCheck, Square, Star, Trash2 } from "lucide-react";
import { Instance, LaunchStatus, RunningInstance } from "../models/instance";
import { resolveInstanceIconSrc } from "../services/instanceIconService";
import { formatPlaytime } from "../services/instanceService";
import Button from "./ui/Button";
import StatusBadge from "./StatusBadge";
interface Props {
  instance:Instance; launchStatus:LaunchStatus; language?:"en"|"de"; updateAvailable?:boolean;
  onEdit?:(instance:Instance)=>void; onDelete?:(id:string)=>void; onExport?:(instance:Instance)=>void;
  onDuplicate?:(instance:Instance)=>void; onBackups?:(instance:Instance)=>void;
  onToggleFavorite?:(id:string)=>void; onMove?:(id:string,direction:-1|1)=>void;
  onOpenMods?:(instance:Instance)=>void;onLaunch:(instance:Instance)=>void;
  onStop?:(id:string)=>void;runningInstance?:RunningInstance;canMoveUp?:boolean;canMoveDown?:boolean;
}
export default function InstanceCard({instance,launchStatus,language="en",updateAvailable,onEdit,onDelete,onExport,onDuplicate,onBackups,onToggleFavorite,onMove,onOpenMods,onLaunch,onStop,runningInstance,canMoveUp,canMoveDown}:Props){
  const de=language==="de";const text=(en:string,deText:string)=>de?deText:en;
  const active=runningInstance&&runningInstance.state!=="error"?runningInstance.state:launchStatus.instanceId===instance.id&&launchStatus.state!=="running"?launchStatus.state:instance.status;
  const busy=["preparing","downloading","launching"].includes(active);
  const running=active==="running";
  const labels:Record<string,string>={ready:text("Ready","Bereit"),idle:text("Ready","Bereit"),running:text("Running","Läuft"),preparing:text("Preparing","Wird vorbereitet"),downloading:text("Downloading","Wird heruntergeladen"),launching:text("Starting","Startet"),error:text("Error","Fehler"),incomplete:text("Incomplete","Unvollständig"),needsAccount:text("Select account","Account auswählen")};
  const action=(callback:()=>void)=>(event:React.MouseEvent)=>{event.currentTarget.closest("details")?.removeAttribute("open");callback();};
  return <article className={`instance-row ${instance.isFavorite?"instance-row-favorite":""}`}>
    <img className="instance-row-icon" src={resolveInstanceIconSrc(instance.icon)} alt=""/>
    <div className="instance-row-main"><h3>{instance.name}</h3><p>{instance.minecraftVersion}<span>·</span>{instance.loaderType}{instance.loaderVersion?` ${instance.loaderVersion}`:""}<span>·</span>{Math.round(instance.ramMb/1024)} GB</p><small title={instance.gameDirectory}>{instance.notes||instance.gameDirectory}</small></div>
    <div className="instance-row-state"><StatusBadge state={active} label={labels[active]??active}/>{updateAvailable&&!busy&&!running&&<button className="text-action" onClick={()=>onOpenMods?.(instance)}>{text("Mod updates available","Mod-Updates verfügbar")}</button>}<small>{formatPlaytime(instance.playtimeSeconds,language)}</small></div>
    <button className={instance.isFavorite?"favorite-star favorite-star-active":"favorite-star"} aria-label={text("Toggle favorite","Favorit umschalten")} onClick={()=>onToggleFavorite?.(instance.id)}><Star size={17} fill={instance.isFavorite?"currentColor":"none"}/></button>
    {running&&runningInstance?<Button variant="danger" icon={<Square size={15}/>} onClick={()=>onStop?.(runningInstance.id)}>{text("Stop","Stoppen")}</Button>:<Button disabled={busy} icon={<Play size={15}/>} onClick={()=>onLaunch(instance)}>{busy?text("Preparing…","Vorbereitung…"):text("Play","Spielen")}</Button>}
    <details className="instance-more"><summary aria-label={text("Instance actions","Instanzaktionen")}><MoreHorizontal size={20}/></summary><div className="instance-menu">
      <button disabled={busy||running} onClick={action(()=>onEdit?.(instance))}><Edit3 size={15}/>{text("Edit","Bearbeiten")}</button>
      {instance.loaderType!=="vanilla"&&<button disabled={busy||running} onClick={action(()=>onOpenMods?.(instance))}><Package size={15}/>Mods</button>}
      <button disabled={busy||running} onClick={action(()=>onDuplicate?.(instance))}><Copy size={15}/>{text("Duplicate","Duplizieren")}</button>
      <button disabled={busy||running} onClick={action(()=>onBackups?.(instance))}><ShieldCheck size={15}/>{text("Backups","Sicherungen")}</button>
      <button disabled={busy||running} onClick={action(()=>onExport?.(instance))}><FileUp size={15}/>{text("Export .mrpack",".mrpack exportieren")}</button>
      <button disabled={!canMoveUp} onClick={action(()=>onMove?.(instance.id,-1))}><ArrowUp size={15}/>{text("Move up","Nach oben")}</button>
      <button disabled={!canMoveDown} onClick={action(()=>onMove?.(instance.id,1))}><ArrowDown size={15}/>{text("Move down","Nach unten")}</button>
      <button disabled={busy||running} className="danger-text" onClick={action(()=>onDelete?.(instance.id))}><Trash2 size={15}/>{text("Remove profile","Profil entfernen")}</button>
    </div></details>
  </article>;
}
