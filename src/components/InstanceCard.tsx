import { Edit3, FolderOpen, Play } from "lucide-react";
import { Instance, LaunchStatus } from "../models/launcher";
import Button from "./ui/Button";
import Card from "./ui/Card";
import StatusBadge from "./StatusBadge";

interface InstanceCardProps {
  instance: Instance;
  launchStatus: LaunchStatus;
  onLaunch: (instance: Instance) => void;
}

export default function InstanceCard({ instance, launchStatus, onLaunch }: InstanceCardProps) {
  const isActiveLaunch = launchStatus.instanceId === instance.id && launchStatus.state !== "idle";

  return (
    <Card className="instance-card">
      <div className="card-heading">
        <div>
          <h3>{instance.name}</h3>
          <p>{instance.notes}</p>
        </div>
        <StatusBadge state={isActiveLaunch ? launchStatus.state : "idle"} label={isActiveLaunch ? launchStatus.state : "ready"} />
      </div>

      <div className="instance-meta">
        <span>Version <strong>{instance.version}</strong></span>
        <span>Loader <strong>{instance.modloader}</strong></span>
        <span>RAM <strong>{Math.round(instance.ramMb / 1024)} GB</strong></span>
        <span>Last start <strong>{instance.lastLaunch}</strong></span>
      </div>

      <div className="path-line">
        <FolderOpen size={15} />
        <span>{instance.path}</span>
      </div>

      <div className="card-actions">
        <Button icon={<Play size={16} />} onClick={() => onLaunch(instance)}>
          Launch
        </Button>
        <Button icon={<Edit3 size={16} />} variant="secondary">
          Edit
        </Button>
      </div>
    </Card>
  );
}
