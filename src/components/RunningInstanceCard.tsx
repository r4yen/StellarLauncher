import { Square } from "lucide-react";
import { RunningInstance } from "../models/instance";
import StatusBadge from "./StatusBadge";
import Button from "./ui/Button";
import Card from "./ui/Card";

interface RunningInstanceCardProps {
  runningInstance: RunningInstance;
  onStop: (runId: string) => void;
}

export default function RunningInstanceCard({ runningInstance, onStop }: RunningInstanceCardProps) {
  return (
    <Card className="running-card">
      <div className="card-heading">
        <div>
          <h3>{runningInstance.instance.name}</h3>
          <p>
            Account {runningInstance.account.username} - Started {new Date(runningInstance.startedAt).toLocaleTimeString()}
          </p>
        </div>
        <StatusBadge state={runningInstance.state} label={runningInstance.message} />
      </div>
      <div className="running-meta">
        <span>Version <strong>{runningInstance.instance.minecraftVersion}</strong></span>
        <span>RAM <strong>{Math.round(runningInstance.instance.ramMb / 1024)} GB</strong></span>
        <span>Process <strong>{runningInstance.processId ? `PID ${runningInstance.processId}` : "Pending"}</strong></span>
      </div>
      {runningInstance.logPath ? <p className="path-line">Log file <span>{runningInstance.logPath}</span></p> : null}
      <div className="console-heading">Minecraft log</div>
      <div className="console-panel">
        {runningInstance.logs.length > 0 ? (
          runningInstance.logs.map((line, index) => <code key={`${index}-${line}`}>{line}</code>)
        ) : (
          <code>Waiting for Minecraft log output...</code>
        )}
      </div>
      <div className="card-actions">
        <Button icon={<Square size={15} />} variant={runningInstance.state === "error" ? "danger" : "secondary"} onClick={() => onStop(runningInstance.id)}>
          {runningInstance.state === "error" ? "Remove from active" : "Stop"}
        </Button>
      </div>
    </Card>
  );
}
