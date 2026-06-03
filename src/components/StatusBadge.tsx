import { CheckCircle2, CircleDot, Loader2, Play, TriangleAlert } from "lucide-react";
import { LaunchState } from "../models/launcher";

interface StatusBadgeProps {
  state: LaunchState | "online" | "offline" | "ready";
  label?: string;
}

const iconMap = {
  idle: CircleDot,
  preparing: Loader2,
  launching: Play,
  running: CheckCircle2,
  error: TriangleAlert,
  online: CheckCircle2,
  offline: CircleDot,
  ready: CheckCircle2
};

export default function StatusBadge({ state, label }: StatusBadgeProps) {
  const Icon = iconMap[state];

  return (
    <span className={`status-badge status-${state}`}>
      <Icon size={14} className={state === "preparing" ? "spin" : ""} />
      {label ?? state}
    </span>
  );
}
