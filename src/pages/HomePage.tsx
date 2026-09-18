import { useUiText } from "../uiLanguage";
import { Database, Gauge, HardDrive, Users } from "lucide-react";
import LaunchControl from "../components/LaunchControl";
import RunningInstanceCard from "../components/RunningInstanceCard";
import Card from "../components/ui/Card";
import { Language } from "../i18n";
import { Account } from "../models/account";
import { Instance, LaunchStatus, RunningInstance } from "../models/instance";
import { LauncherStatusSummary } from "../models/settings";

interface HomePageProps {
  account?: Account;
  accounts: Account[];
  language: Language;
  instances: Instance[];
  launcherStatus: LauncherStatusSummary;
  launchStatus: LaunchStatus;
  runningInstances: RunningInstance[];
  onLaunch: (instance: Instance, account: Account) => void;
  onStopRunningInstance: (runId: string) => void;
}

export default function HomePage({
  account,
  accounts,
  language,
  instances,
  launcherStatus,
  runningInstances,
  onLaunch,
  onStopRunningInstance
}: HomePageProps) {
  const ui = useUiText();
  return (
    <div className="page-stack">
      <LaunchControl
        accounts={accounts}
        instances={instances}
        language={language}
        runningInstances={runningInstances}
        onLaunch={onLaunch}
        onStopRunningInstance={onStopRunningInstance}
      />

      <section className="stats-grid">
        <Card>
          <div className="stat-card">
            <Users size={20} />
            <span>Account</span>
            <strong>{account ? account.username : ui("None")}</strong>
          </div>
        </Card>
        <Card>
          <div className="stat-card">
            <Database size={20} />
            <span>{ui("Instances")}</span>
            <strong>{ui(instances.length === 1 ? "1 profile" : "{count} profiles", { count: instances.length })}</strong>
          </div>
        </Card>
        <Card>
          <div className="stat-card">
            <Gauge size={20} />
            <span>Launcher</span>
            <strong>{launcherStatus.version}</strong>
          </div>
        </Card>
        <Card>
          <div className="stat-card">
            <HardDrive size={20} />
            <span>{ui("Running")}</span>
            <strong>{runningInstances.length} {language === "de" ? (runningInstances.length === 1 ? "Instanz" : "Instanzen") : (runningInstances.length === 1 ? "instance" : "instances")}</strong>
          </div>
        </Card>
      </section>

      <section className="section-stack">
        <div className="section-heading">
          <span>{ui("Live sessions")}</span>
          <h2>{ui("Running instances")}</h2>
        </div>
        {runningInstances.length > 0 ? (
          <div className="running-list">
            {runningInstances.map((runningInstance) => (
              <RunningInstanceCard key={runningInstance.id} runningInstance={runningInstance} onStop={onStopRunningInstance} />
            ))}
          </div>
        ) : (
          <Card className="empty-state">
            <h3>{ui("No running instance")}</h3>
            <p>{ui("Select an instance and an account, then press Play.")}</p>
          </Card>
        )}
      </section>
    </div>
  );
}
