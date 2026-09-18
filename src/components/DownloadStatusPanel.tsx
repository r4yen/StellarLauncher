import LocalizedError from "./LocalizedError";
import { useUiText } from "../uiLanguage";
import { ChevronDown, DownloadCloud, RotateCcw, X, Trash2 } from "lucide-react";
import { DownloadTask } from "../models/download";

interface DownloadStatusPanelProps {
  language?:"en"|"de";
  onCancelTask?:(id:string)=>void;
  onRetryTask?:(id:string)=>void;
  canRetry?:(task:DownloadTask)=>boolean;
  open: boolean;
  panelOnly?: boolean;
  tasks: DownloadTask[];
  onDismissTask?: (taskId: string) => void;
  onToggleOpen: () => void;
}

function formatEta(seconds?: number) {
  if (seconds === undefined || !Number.isFinite(seconds)) return "ETA unknown";
  if (seconds <= 0) return "Finishing";
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes > 0 ? `${minutes}m ${rest}s` : `${rest}s`;
}

export default function DownloadStatusPanel({ open, panelOnly = false, tasks, onDismissTask, onToggleOpen, language="en", onCancelTask,onRetryTask,canRetry }: DownloadStatusPanelProps) {
  const ui = useUiText();
  const de=language==="de";
  const labels={pending:de?"Wartet":"Queued",downloading:de?"Lädt":"Downloading",completed:de?"Fertig":"Completed",error:de?"Fehlgeschlagen":"Failed",cancelled:de?"Abgebrochen":"Cancelled"};
  const activeTasks = tasks.filter((task) => task.status === "pending"||task.status==="downloading").length;

  if (panelOnly && !open) return null;

  return (
    <aside className={open ? "download-status-panel download-status-panel-open" : "download-status-panel"} data-download-panel aria-label={ui("Download status")}>
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
                    <span>{task.status === "error" ? <LocalizedError message={task.label}/> : ui(task.label)}</span>
                  </div>
                  <div className="download-task-status">
                    <small>{labels[task.status]}</small>
                    {(task.status==="downloading"||task.status==="pending")&&task.cancelOperationId&&<button title={de?"Abbrechen":ui("Cancel")} aria-label={de?"Download abbrechen":ui("Cancel download")} onClick={()=>onCancelTask?.(task.id)}><X size={14}/></button>}
                    {(task.status==="error"||task.status==="cancelled")&&canRetry?.(task)&&<button title={de?"Wiederholen":ui("Retry")} aria-label={de?"Download wiederholen":ui("Retry download")} onClick={()=>onRetryTask?.(task.id)}><RotateCcw size={14}/></button>}
                    {task.status !== "pending"&&task.status!=="downloading" ? (
                      <button type="button" aria-label={ui("Remove {name} from downloads", {name: task.label})} onClick={() => onDismissTask?.(task.id)}>
                        <Trash2 size={13} />
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="download-progress-track">
                  <div className="download-progress-fill" style={{ width: `${task.percent}%` }} />
                </div>
                <div className="download-task-meta">
                  <span>
                    {task.downloadedMb.toFixed(1)} MB{task.totalMb>0?` / ${task.totalMb.toFixed(1)} MB`:""}
                  </span>
                  <span>{task.percent.toFixed(0)}%</span>
                  <span>{task.status==="completed"?(de?"Fertig":ui("Done")):task.etaSeconds===undefined?(de?"Dauer wird ermittelt":ui("Calculating time")):ui(formatEta(task.etaSeconds))}</span>
                </div>
              </article>
            ))
          ) : (
            <div className="download-empty">{de?"Keine aktiven Downloads":ui("No active downloads")}</div>
          )}
        </div>
      ) : null}
    </aside>
  );
}
