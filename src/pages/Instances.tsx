import { Plus } from "lucide-react";
import { useState } from "react";
import CreateInstanceModal from "../components/CreateInstanceModal";
import InstanceCard from "../components/InstanceCard";
import ModsModal from "../components/ModsModal";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import { Language, t } from "../i18n";
import { CreateInstanceInput, Instance, LaunchStatus, RunningInstance } from "../models/instance";
import { LauncherSettings } from "../models/settings";
import { canMoveInstance } from "../services/instanceService";

interface InstancesProps {
  instances: Instance[];
  language: Language;
  launchStatus: LaunchStatus;
  runningInstances: RunningInstance[];
  settings: LauncherSettings;
  onCreateInstance: (input: CreateInstanceInput) => void;
  onUpdateInstance: (instanceId: string, input: CreateInstanceInput) => void;
  onDeleteInstance: (instanceId: string) => void;
  onToggleFavorite: (instanceId: string) => void;
  onMoveInstance: (instanceId: string, direction: -1 | 1) => void;
  onLaunch: (instance: Instance) => void;
  onStopRunningInstance: (runId: string) => void;
}

export default function Instances({
  instances,
  language,
  launchStatus,
  runningInstances,
  settings,
  onCreateInstance,
  onUpdateInstance,
  onDeleteInstance,
  onToggleFavorite,
  onMoveInstance,
  onLaunch,
  onStopRunningInstance
}: InstancesProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editingInstance, setEditingInstance] = useState<Instance | undefined>();
  const [modsInstance, setModsInstance] = useState<Instance | undefined>();
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

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <span>Profiles</span>
          <h1>{t(language, "instances")}</h1>
          <p>Local instance profiles are stored on disk through the Tauri storage layer and prepared for real downloader and launcher backends.</p>
        </div>
        <Button icon={<Plus size={17} />} onClick={openCreate}>
          {t(language, "newInstance")}
        </Button>
      </div>
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
      <ModsModal instance={modsInstance} open={Boolean(modsInstance)} onClose={() => setModsInstance(undefined)} />
    </div>
  );
}
