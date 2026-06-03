import { Database, Gauge, HardDrive, Play, Users } from "lucide-react";
import AccountCard from "../components/AccountCard";
import InstanceCard from "../components/InstanceCard";
import Logo from "../components/Logo";
import StatusBadge from "../components/StatusBadge";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import { Account, Instance, LauncherStatusSummary, LaunchStatus } from "../models/launcher";

interface HomePageProps {
  account: Account;
  instances: Instance[];
  latestInstance: Instance;
  launcherStatus: LauncherStatusSummary;
  launchStatus: LaunchStatus;
  onLaunch: (instance: Instance) => void;
}

export default function HomePage({ account, instances, latestInstance, launcherStatus, launchStatus, onLaunch }: HomePageProps) {
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
        <div className="hero-actions">
          <Button icon={<Play size={17} />} onClick={() => onLaunch(latestInstance)}>
            Launch {latestInstance.name}
          </Button>
          <StatusBadge state={launchStatus.state} label={launchStatus.message} />
        </div>
      </section>

      <section className="stats-grid">
        <Card>
          <div className="stat-card">
            <Users size={20} />
            <span>Accounts</span>
            <strong>2 configured</strong>
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
            <span>Storage</span>
            <strong>{launcherStatus.storageReady ? "Ready" : "Pending"}</strong>
          </div>
        </Card>
      </section>

      <section className="content-grid">
        <div className="section-stack">
          <div className="section-heading">
            <span>Quick start</span>
            <h2>Latest instance</h2>
          </div>
          <InstanceCard instance={latestInstance} launchStatus={launchStatus} onLaunch={onLaunch} />
        </div>
        <div className="section-stack">
          <div className="section-heading">
            <span>Active identity</span>
            <h2>Account</h2>
          </div>
          <AccountCard account={account} onSelectAccount={() => undefined} />
        </div>
      </section>
    </div>
  );
}
