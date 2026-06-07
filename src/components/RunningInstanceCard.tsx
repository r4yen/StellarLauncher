import { FileText, Square, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { RunningInstance } from "../models/instance";
import { minecraftHeadUrl } from "../services/avatarService";
import { isColorInstanceIcon, resolveInstanceIconSrc } from "../services/instanceIconService";
import { readLaunchLogTail } from "../services/launchService";
import StatusBadge from "./StatusBadge";
import Button from "./ui/Button";
import Card from "./ui/Card";

interface RunningInstanceCardProps {
  runningInstance: RunningInstance;
  onStop: (runId: string) => void;
}

export default function RunningInstanceCard({ runningInstance, onStop }: RunningInstanceCardProps) {
  const [logOpen, setLogOpen] = useState(false);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [logError, setLogError] = useState<string | undefined>();
  const consoleRef = useRef<HTMLDivElement>(null);
  const shouldStickToBottomRef = useRef(true);
  const iconSrc = resolveInstanceIconSrc(runningInstance.instance.icon);
  const accountAvatarUrl = minecraftHeadUrl(runningInstance.account);

  const scrollLogToBottom = () => {
    window.requestAnimationFrame(() => {
      const element = consoleRef.current;
      if (element) element.scrollTop = element.scrollHeight;
    });
  };

  useEffect(() => {
    if (!logOpen || !runningInstance.logPath) return;

    let cancelled = false;
    const loadLog = async () => {
      try {
        const lines = await readLaunchLogTail(runningInstance.logPath ?? "", 180);
        if (!cancelled) {
          setLogLines(lines);
          setLogError(undefined);
        }
      } catch (error) {
        if (!cancelled) setLogError(error instanceof Error ? error.message : String(error));
      }
    };

    loadLog();
    scrollLogToBottom();
    const intervalId = window.setInterval(loadLog, 1200);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [logOpen, runningInstance.logPath]);

  useEffect(() => {
    if (logOpen && shouldStickToBottomRef.current) {
      scrollLogToBottom();
    }
  }, [logLines, logError, logOpen]);

  return (
    <Card className="running-card">
      <div className="card-heading running-heading">
        <div className="running-title-cluster">
          {iconSrc ? (
            <img className="instance-image" src={iconSrc} alt={`${runningInstance.instance.name} icon`} />
          ) : (
            <div
              className="instance-image instance-image-color"
              style={{ background: isColorInstanceIcon(runningInstance.instance.icon) ? runningInstance.instance.icon : "#64748b" }}
            />
          )}
          <div>
            <h3>{runningInstance.instance.name}</h3>
            <p className="running-account-line">
              {accountAvatarUrl ? (
                <img src={accountAvatarUrl} alt={`${runningInstance.account.username} skin head`} />
              ) : (
                <span className="running-account-fallback" style={{ background: runningInstance.account.avatarColor }}>
                  {runningInstance.account.username.slice(0, 1)}
                </span>
              )}
              <strong>{runningInstance.account.username}</strong>
            </p>
          </div>
        </div>
        <StatusBadge state={runningInstance.state} label={runningInstance.message} />
      </div>
      <div className="running-meta">
        <span>Version <strong>{runningInstance.instance.minecraftVersion}</strong></span>
        <span>RAM <strong>{Math.round(runningInstance.instance.ramMb / 1024)} GB</strong></span>
        <span>Process <strong>{runningInstance.processId ? `PID ${runningInstance.processId}` : "Pending"}</strong></span>
      </div>
      <div className="card-actions">
        <Button icon={<Square size={15} />} variant="danger" onClick={() => onStop(runningInstance.id)}>
          {runningInstance.state === "error" ? "Remove from active" : "Stop"}
        </Button>
        <Button
          icon={<FileText size={15} />}
          variant="secondary"
          disabled={!runningInstance.logPath}
          onClick={() => {
            shouldStickToBottomRef.current = true;
            setLogOpen(true);
          }}
        >
          Show log
        </Button>
      </div>
      {logOpen
        ? createPortal(
        <div className="modal-backdrop modal-backdrop-subwindow" role="dialog" aria-modal="true" aria-label={`${runningInstance.instance.name} log`}>
          <Card className="log-modal" tone="bright">
            <div className="modal-header">
              <div>
                <span>Live output</span>
                <h2>{runningInstance.instance.name}</h2>
              </div>
              <button className="icon-button" onClick={() => setLogOpen(false)} type="button" aria-label="Close log">
                <X size={18} />
              </button>
            </div>
            <div
              className="console-panel console-panel-modal"
              ref={consoleRef}
              onScroll={(event) => {
                const element = event.currentTarget;
                shouldStickToBottomRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 24;
              }}
            >
              {logError ? <code>{logError}</code> : null}
              {!logError && logLines.length > 0 ? logLines.map((line, index) => <code key={`${index}-${line}`}>{line}</code>) : null}
              {!logError && logLines.length === 0 ? <code>Waiting for log output...</code> : null}
            </div>
          </Card>
        </div>,
            document.body
          )
        : null}
    </Card>
  );
}
