import { useUiText } from "../uiLanguage";
import { Plus } from "lucide-react";
import InstanceCard from "../components/InstanceCard";
import Button from "../components/ui/Button";
import { Instance, LaunchStatus } from "../models/instance";

interface InstancesPageProps {
  instances: Instance[];
  launchStatus: LaunchStatus;
  onLaunch: (instance: Instance) => void;
}

export default function InstancesPage({ instances, launchStatus, onLaunch }: InstancesPageProps) {
  const ui = useUiText();
  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <span>{ui("Profiles")}</span>
          <h1>{ui("Instances")}</h1>
          <p>{ui("Mock profiles are wired to launch state handling and ready for real filesystem-backed management.")}</p>
        </div>
        <Button icon={<Plus size={17} />}>{ui("New instance")}</Button>
      </div>
      <div className="instances-list">
        {instances.map((instance) => (
          <InstanceCard key={instance.id} instance={instance} launchStatus={launchStatus} onLaunch={onLaunch} />
        ))}
      </div>
    </div>
  );
}
