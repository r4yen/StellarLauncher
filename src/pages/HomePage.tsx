import { Database, Gauge, HardDrive, Users } from "lucide-react";
import LaunchControl from "../components/LaunchControl";
import Logo from "../components/Logo";
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
  return (
    <div className="page-stack">
      <section className="hero-panel">
        <div className="hero-glow" />
        <div className="hero-content">
          <Logo size="lg" />
          <div>
            <h1>Stellar Launcher</h1>
            <p>Manage accounts, profiles and future Minecraft launch flows from one polished Windows desktop app.</p>
          </div>
        </div>
      </section>

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
            <span>Accounts</span>
            <strong>{account ? account.username : "None"}</strong>
          </div>
        </Card>
        <Card>
          <div className="stat-card">
            <Database size={20} />
            <span>Instances</span>
            <strong>{instances.length} profiles</strong>
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
            <span>Running</span>
            <strong>{runningInstances.length} active</strong>
          </div>
        </Card>
      </section>

      <section className="section-stack">
        <div className="section-heading">
          <span>Live sessions</span>
          <h2>Running instances</h2>
        </div>
        {runningInstances.length > 0 ? (
          <div className="running-list">
            {runningInstances.map((runningInstance) => (
              <RunningInstanceCard key={runningInstance.id} runningInstance={runningInstance} onStop={onStopRunningInstance} />
            ))}
          </div>
        ) : (
          <Card className="empty-state">
            <h3>No running instance</h3>
            <p>Select an instance and an active account above to start a local mock launch.</p>
          </Card>
        )}
      </section>
    </div>
  );
}
