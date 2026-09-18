import LocalizedError from "../components/LocalizedError";
import { useUiText } from "../uiLanguage";
import { FileDown, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import BackupsModal from "../components/BackupsModal";
import CreateInstanceModal from "../components/CreateInstanceModal";
import ExportInstanceModal from "../components/ExportInstanceModal";
import ImportMrpackModal from "../components/ImportMrpackModal";
import InstanceCard from "../components/InstanceCard";
import ModsModal from "../components/ModsModal";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import { Language, t } from "../i18n";
import { CreateInstanceInput, Instance, LaunchStatus, RunningInstance } from "../models/instance";
import { ModFile } from "../models/mod";
import { LauncherSettings } from "../models/settings";
import { canMoveInstance } from "../services/instanceService";
import { exportMrpack, importMrpack, selectMrpack, MrpackSelection, MrpackExportOptions } from "../services/mrpackService";

interface InstancesProps {
  instances: Instance[];
  language: Language;
  launchStatus: LaunchStatus;
  modrinthModsByInstance: Record<string, ModFile[]>;
  runningInstances: RunningInstance[];
  settings: LauncherSettings;
  onCreateInstance: (input: CreateInstanceInput) => void;
  onUpdateInstance: (instanceId: string, input: CreateInstanceInput) => void;
  onDeleteInstance: (instanceId: string) => void;
  onToggleFavorite: (instanceId: string) => void;
  onMoveInstance: (instanceId: string, direction: -1 | 1) => void;
  onLaunch: (instance: Instance) => void;
  onStopRunningInstance: (runId: string) => void;
  onCreateDownloadTask: (instanceName: string, label: string, targetPath: string) => string;
  onFailDownloadTask: (operationId: string) => void;
  onSetCachedMods: (instanceId: string, mods: ModFile[]) => void;
  onRefreshModrinthMods: (instance: Instance) => Promise<ModFile[]>;
  onImportedInstances: (instances: Instance[]) => void;
  onPackOperationChange: (message?: string, operationId?: string) => void;
}

export default function Instances({
  instances,
  language,
  launchStatus,
  modrinthModsByInstance,
  runningInstances,
  settings,
  onCreateInstance,
  onUpdateInstance,
  onDeleteInstance,
  onToggleFavorite,
  onMoveInstance,
  onLaunch,
  onStopRunningInstance,
  onCreateDownloadTask,
  onFailDownloadTask,
  onSetCachedMods,
  onRefreshModrinthMods,
  onImportedInstances,
  onPackOperationChange
}: InstancesProps) {
  const ui = useUiText();
  const [createOpen, setCreateOpen] = useState(false);
  const [search,setSearch]=useState("");
  const [backupInstance,setBackupInstance]=useState<Instance>();
  const de=language==="de";
  const filtered=instances.filter(item=>`${item.name} ${item.minecraftVersion} ${item.loaderType}`.toLowerCase().includes(search.toLowerCase()));
  const maintenance=async(instance:Instance,duplicate=false)=>{
    if(runningInstances.some(item=>item.state!=="error")){setFileError(de?"Beende laufende Instanzen vor einer Sicherung oder Kopie.":"Stop running instances before backing up or copying.");return;}
    if(!duplicate){setBackupInstance(instance);return;}
    onPackOperationChange(de?"Instanz wird kopiert…":"Copying instance…");
    try{onImportedInstances(await invoke<Instance[]>("duplicate_instance",{instanceId:instance.id}));}catch(error){setFileError(String(error));}finally{onPackOperationChange(undefined);}
  };
  const [editingInstance, setEditingInstance] = useState<Instance | undefined>();
  const [exportInstance, setExportInstance] = useState<Instance | undefined>();
  const [modsInstance, setModsInstance] = useState<Instance | undefined>();
  const [fileError, setFileError] = useState<string | undefined>();
  const [importSelection, setImportSelection] = useState<MrpackSelection>();
  useEffect(()=>{const listener=(event:Event)=>{if((event as CustomEvent).detail==="import_mrpack"){setImportSelection(undefined);setFileError(undefined);}};window.addEventListener("stellar-download-retried",listener);return()=>window.removeEventListener("stellar-download-retried",listener);},[]);
  const openCreate = () => {
    setEditingInstance(undefined);
    setCreateOpen(true);
  };
  const openEdit = (instance: Instance) => {
    setEditingInstance(instance);
    setCreateOpen(true);
  };
  const closeModal = () => {
    setCreateOpen(false);
    setEditingInstance(undefined);
  };
  const importFromFile = async () => {
    setFileError(undefined);
    try {
      setImportSelection(await selectMrpack(language));
    } catch (error) {
      setFileError(error instanceof Error ? error.message : String(error));
    }
  };
  const importPack = async (selection: MrpackSelection, optionalFiles: string[]) => {
    setFileError(undefined);
    const operationId = onCreateDownloadTask(selection.pack.name, "Import .mrpack", settings.gameDirectory);
    onPackOperationChange(`Importing ${selection.pack.name}...`, operationId);
    try {
      onImportedInstances(await importMrpack(selection, optionalFiles, operationId));
      setImportSelection(undefined);
    } catch (error) {
      onFailDownloadTask(operationId);
      setFileError(error instanceof Error ? error.message : String(error));
    } finally {
      onPackOperationChange(undefined);
    }
  };
  const exportToFile = async (instance: Instance, options: MrpackExportOptions) => {
    setFileError(undefined);
    if (runningInstances.some((running) => running.instance.id === instance.id && running.state !== "error")) {
      setFileError("Stop this instance before exporting its files.");
      return;
    }
    onPackOperationChange(`Exporting ${instance.name}...`);
    try {
      if (await exportMrpack(instance, options, language)) setExportInstance(undefined);
    } catch (error) {
      setFileError(error instanceof Error ? error.message : String(error));
    } finally {
      onPackOperationChange(undefined);
    }
  };

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <span>Stellar Launcher</span>
          <h1>{t(language, "instances")}</h1>
          <p>{de?"Deine Welten und Modpacks. Starten, verwalten und sichern.":ui("Your worlds and modpacks. Play, manage and back up.")}</p>
        </div>
        <div className="page-header-actions">
          <Button icon={<FileDown size={17} />} variant="secondary" onClick={importFromFile}>
            {ui("Import .mrpack")}</Button>
          <Button icon={<Plus size={17} />} onClick={openCreate}>
            {t(language, "newInstance")}
          </Button>
        </div>
      </div>
      {fileError ? <div className="error-panel"><LocalizedError message={fileError} /></div> : null}
      <label className="instance-search">{de?"Instanzen suchen":ui("Find instances")}<input type="search" value={search} onChange={event=>setSearch(event.target.value)} placeholder={de?"Name, Minecraft-Version oder Modloader":ui("Name, Minecraft version or mod loader")}/></label>
      {instances.length > 0 ? (
        <div className="instances-list">
          {filtered.map((instance) => (
            <InstanceCard
              key={instance.id}
              instance={instance}
              language={language}
              updateAvailable={modrinthModsByInstance[instance.id]?.some(mod=>mod.modrinth?.updateAvailable)}
              onDuplicate={instance=>void maintenance(instance,true)}
              onBackups={instance=>void maintenance(instance)}
              launchStatus={launchStatus}
              runningInstance={runningInstances.find((running) => running.instance.id === instance.id)}
              onEdit={openEdit}
              onDelete={onDeleteInstance}
              onExport={(instance) => { setFileError(undefined); setExportInstance(instance); }}
              onToggleFavorite={onToggleFavorite}
              onMove={onMoveInstance}
              canMoveUp={canMoveInstance(instances, instance.id, -1)}
              canMoveDown={canMoveInstance(instances, instance.id, 1)}
              onOpenMods={setModsInstance}
              onLaunch={onLaunch}
              onStop={onStopRunningInstance}
            />
          ))}
        </div>
      ) : (
        <Card className="empty-state">
          <h3>{de?"Noch keine Instanz":ui("No instance yet")}</h3>
          <p>{de?"Erstelle eine Instanz oder importiere ein Modpack.":ui("Create an instance or import a modpack.")}</p>
        </Card>
      )}
      <CreateInstanceModal
        editingInstance={editingInstance}
        open={createOpen}
        settings={settings}
        onClose={closeModal}
        onCreate={onCreateInstance}
        onUpdate={onUpdateInstance}
      />
      <ExportInstanceModal

        instance={exportInstance}
        open={Boolean(exportInstance)}
        onClose={() => setExportInstance(undefined)}
        onExport={exportToFile}
        error={fileError}
      />
      <ImportMrpackModal selection={importSelection} gameDirectory={settings.gameDirectory} error={fileError} onClose={() => setImportSelection(undefined)} onImport={importPack} />
      <BackupsModal instance={backupInstance} language={language} onClose={()=>setBackupInstance(undefined)} onImported={onImportedInstances} onBusy={onPackOperationChange}/>
      <ModsModal
        instance={modsInstance}
        open={Boolean(modsInstance)}
        cachedMods={modsInstance ? modrinthModsByInstance[modsInstance.id] : undefined}
        onClose={() => setModsInstance(undefined)}
        onCreateDownloadTask={onCreateDownloadTask}
        onFailDownloadTask={onFailDownloadTask}
        onSetCachedMods={onSetCachedMods}
        onRefreshModrinthMods={onRefreshModrinthMods}
      />
    </div>
  );
}
