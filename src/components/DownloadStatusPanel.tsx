import { ChevronDown, DownloadCloud } from "lucide-react";
import { DownloadTask } from "../models/download";

interface DownloadStatusPanelProps {
  open: boolean;
  panelOnly?: boolean;
  tasks: DownloadTask[];
  onToggleOpen: () => void;
}

function formatEta(seconds?: number) {
  if (seconds === undefined || !Number.isFinite(seconds)) return "ETA unknown";
  if (seconds <= 0) return "Finishing";
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes > 0 ? `${minutes}m ${rest}s` : `${rest}s`;
}

export default function DownloadStatusPanel({ open, panelOnly = false, tasks, onToggleOpen }: DownloadStatusPanelProps) {
  const activeTasks = tasks.filter((task) => task.status !== "completed").length;

  if (panelOnly && !open) return null;

  return (
    <aside className={open ? "download-status-panel download-status-panel-open" : "download-status-panel"} aria-label="Download status">
      {!panelOnly ? (
        <button className="download-status-header" onClick={onToggleOpen} type="button">
          <span>
            <DownloadCloud size={16} />
            Downloads
          </span>
          <div>
            <strong>{activeTasks || tasks.length}</strong>
            <ChevronDown size={15} />
          </div>
        </button>
      ) : null}
      {open ? (
        <div className="download-task-list">
          {tasks.length > 0 ? (
            tasks.map((task) => (
              <article className="download-task" key={task.id}>
                <div className="download-task-top">
                  <div>
                    <strong>{task.instanceName}</strong>
                    <span>{task.label}</span>
                  </div>
                  <small>{task.status}</small>
                </div>
                <div className="download-progress-track">
                  <div className="download-progress-fill" style={{ width: `${task.percent}%` }} />
                </div>
                <div className="download-task-meta">
                  <span>
                    {task.downloadedMb.toFixed(1)} MB / {task.totalMb.toFixed(1)} MB
                  </span>
                  <span>{task.percent.toFixed(0)}%</span>
                  <span>{formatEta(task.etaSeconds)}</span>
                </div>
              </article>
            ))
          ) : (
            <div className="download-empty">No active downloads</div>
          )}
        </div>
      ) : null}
    </aside>
  );
}
