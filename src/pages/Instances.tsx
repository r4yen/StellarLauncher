import { FileDown, Plus } from "lucide-react";
import { useState } from "react";
import CreateInstanceModal from "../components/CreateInstanceModal";
import InstanceCard from "../components/InstanceCard";
import ModsModal from "../components/ModsModal";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import { Language, t } from "../i18n";
import { CreateInstanceInput, Instance, LaunchStatus, RunningInstance } from "../models/instance";
import { ModFile } from "../models/mod";
import { LauncherSettings } from "../models/settings";
import { canMoveInstance } from "../services/instanceService";
import { exportStellarInstanceToFile, importStellarInstanceFromFile } from "../services/stellarInstanceFileService";

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
  onRefreshModrinthMods
}: InstancesProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editingInstance, setEditingInstance] = useState<Instance | undefined>();
  const [modsInstance, setModsInstance] = useState<Instance | undefined>();
  const [fileError, setFileError] = useState<string | undefined>();
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
      const input = await importStellarInstanceFromFile();
      if (input) onCreateInstance(input);
    } catch (error) {
      setFileError(error instanceof Error ? error.message : String(error));
    }
  };
  const exportToFile = async (instance: Instance) => {
    setFileError(undefined);
    try {
      await exportStellarInstanceToFile(instance);
    } catch (error) {
      setFileError(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <span>Profiles</span>
          <h1>{t(language, "instances")}</h1>
          <p>Local instance profiles are stored on disk through the Tauri storage layer and prepared for real downloader and launcher backends.</p>
        </div>
        <div className="page-header-actions">
          <Button icon={<FileDown size={17} />} variant="secondary" onClick={importFromFile}>
            From File
          </Button>
          <Button icon={<Plus size={17} />} onClick={openCreate}>
            {t(language, "newInstance")}
          </Button>
        </div>
      </div>
      {fileError ? <div className="error-panel">{fileError}</div> : null}
      {instances.length > 0 ? (
        <div className="instances-list">
          {instances.map((instance) => (
            <InstanceCard
              key={instance.id}
              instance={instance}
              launchStatus={launchStatus}
              runningInstance={runningInstances.find((running) => running.instance.id === instance.id)}
              onEdit={openEdit}
              onDelete={onDeleteInstance}
              onExport={exportToFile}
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
          <h3>No instance yet</h3>
          <p>Create your first Minecraft instance with the button above.</p>
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
