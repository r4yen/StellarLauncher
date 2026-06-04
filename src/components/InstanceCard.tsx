import { ArrowDown, ArrowUp, Edit3, FolderOpen, Package, Play, Square, Star, Trash2 } from "lucide-react";
import { Instance, LaunchStatus, RunningInstance } from "../models/instance";
import { isColorInstanceIcon, resolveInstanceIconSrc } from "../services/instanceIconService";
import { loaderLabels } from "../services/loaderServices";
import Button from "./ui/Button";
import Card from "./ui/Card";
import StatusBadge from "./StatusBadge";

interface InstanceCardProps {
  instance: Instance;
  launchStatus: LaunchStatus;
  onEdit?: (instance: Instance) => void;
  onDelete?: (instanceId: string) => void;
  onToggleFavorite?: (instanceId: string) => void;
  onMove?: (instanceId: string, direction: -1 | 1) => void;
  onOpenMods?: (instance: Instance) => void;
  onLaunch: (instance: Instance) => void;
  onStop?: (runId: string) => void;
  runningInstance?: RunningInstance;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}

export default function InstanceCard({
  instance,
  launchStatus,
  onEdit,
  onDelete,
  onToggleFavorite,
  onMove,
  onOpenMods,
  onLaunch,
  onStop,
  runningInstance,
  canMoveUp = false,
  canMoveDown = false
}: InstanceCardProps) {
  const isActiveLaunch = launchStatus.instanceId === instance.id && launchStatus.state !== "idle";
  const isRunning = Boolean(runningInstance);
  const iconSrc = resolveInstanceIconSrc(instance.icon);

  return (
    <Card className={instance.isFavorite ? "instance-card instance-card-favorite" : "instance-card"}>
      <div className="entity-title-row">
        <div className="instance-title-cluster">
          {iconSrc ? (
            <img className="instance-image" src={iconSrc} alt={`${instance.name} icon`} />
          ) : (
            <div className="instance-image instance-image-color" style={{ background: isColorInstanceIcon(instance.icon) ? instance.icon : "#64748b" }} />
          )}
          <div>
            <h3>{instance.name}</h3>
            <p>{instance.notes}</p>
          </div>
        </div>
        <div className="entity-title-actions">
          <StatusBadge state={isActiveLaunch ? launchStatus.state : "idle"} label={isActiveLaunch ? launchStatus.state : "ready"} />
          <button
            className={instance.isFavorite ? "favorite-star favorite-star-active" : "favorite-star"}
            onClick={() => onToggleFavorite?.(instance.id)}
            type="button"
            aria-label={instance.isFavorite ? "Unfavorite instance" : "Favorite instance"}
          >
            <Star size={19} fill="currentColor" />
          </button>
        </div>
      </div>

      <div className="instance-meta">
        <span>Version <strong>{instance.minecraftVersion}</strong></span>
        <span>Loader <strong>{loaderLabels[instance.loaderType]}</strong></span>
        <span>Loader build <strong>{instance.loaderVersion || "Native"}</strong></span>
        <span>RAM <strong>{Math.round(instance.ramMb / 1024)} GB</strong></span>
        <span>Last start <strong>{instance.lastPlayedAt ? new Date(instance.lastPlayedAt).toLocaleString() : "Never"}</strong></span>
      </div>

      <div className="path-line">
        <FolderOpen size={15} />
        <span>{instance.gameDirectory}</span>
      </div>

      <div className="card-bottom-actions">
        <div className="card-action-left">
          {isRunning && runningInstance ? (
            <Button icon={<Square size={16} />} variant="secondary" onClick={() => onStop?.(runningInstance.id)}>
              Stop
            </Button>
          ) : (
            <Button icon={<Play size={16} />} onClick={() => onLaunch(instance)}>
              Launch
            </Button>
          )}
          <Button icon={<Edit3 size={16} />} variant="secondary" onClick={() => onEdit?.(instance)}>
            Edit
          </Button>
          {instance.loaderType !== "vanilla" ? (
            <Button icon={<Package size={16} />} variant="secondary" onClick={() => onOpenMods?.(instance)}>
              Mods
            </Button>
          ) : null}
        </div>
        <div className="card-action-right">
          <div className="order-tools">
            <button
              className="icon-button"
              disabled={!canMoveUp}
              onClick={() => onMove?.(instance.id, -1)}
              type="button"
              aria-label="Move instance up"
            >
              <ArrowUp size={16} />
            </button>
            <button
              className="icon-button"
              disabled={!canMoveDown}
              onClick={() => onMove?.(instance.id, 1)}
              type="button"
              aria-label="Move instance down"
            >
              <ArrowDown size={16} />
            </button>
          </div>
          <Button icon={<Trash2 size={16} />} variant="danger" onClick={() => onDelete?.(instance.id)}>
            Delete
          </Button>
        </div>
      </div>
    </Card>
  );
}
