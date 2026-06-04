import { Play, Square } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Language, t } from "../i18n";
import { Account } from "../models/account";
import { Instance, RunningInstance } from "../models/instance";
import { minecraftHeadUrl } from "../services/avatarService";
import Button from "./ui/Button";
import Card from "./ui/Card";
import CustomSelect from "./ui/CustomSelect";

interface LaunchControlProps {
  accounts: Account[];
  instances: Instance[];
  language: Language;
  runningInstances: RunningInstance[];
  onLaunch: (instance: Instance, account: Account) => void;
  onStopRunningInstance: (runId: string) => void;
}

export default function LaunchControl({ accounts, instances, language, runningInstances, onLaunch, onStopRunningInstance }: LaunchControlProps) {
  const activeAccount = useMemo(() => accounts.find((account) => account.isActive) ?? accounts[0], [accounts]);
  const [instanceId, setInstanceId] = useState(instances[0]?.id ?? "");
  const [accountId, setAccountId] = useState(activeAccount?.id ?? "");

  useEffect(() => {
    if (!instances.some((instance) => instance.id === instanceId)) {
      setInstanceId(instances[0]?.id ?? "");
    }
  }, [instanceId, instances]);

  useEffect(() => {
    if (!accounts.some((account) => account.id === accountId)) {
      setAccountId(activeAccount?.id ?? "");
    }
  }, [accountId, accounts, activeAccount]);

  const selectedInstance = instances.find((instance) => instance.id === instanceId);
  const selectedAccount = accounts.find((account) => account.id === accountId);
  const runningInstance = runningInstances.find((running) => running.instance.id === selectedInstance?.id);
  const canLaunch = Boolean(
    selectedInstance && selectedAccount && (selectedAccount.loginStatus === "active" || selectedAccount.type === "offline")
  );
  const canRunAction = runningInstance ? Boolean(selectedInstance) : canLaunch;
  const instanceOptions = instances.map((instance) => ({
    value: instance.id,
    label: instance.name,
    description: runningInstances.some((running) => running.instance.id === instance.id)
      ? `${instance.minecraftVersion} - ${instance.loaderType} - Running`
      : `${instance.minecraftVersion} - ${instance.loaderType}`
  }));
  const accountOptions = accounts.map((account) => ({
    value: account.id,
    label: account.username,
    description: account.uuid,
    imageUrl: minecraftHeadUrl(account),
    imageAlt: `${account.username} skin head`
  }));

  return (
    <Card className="launch-control" tone="bright">
      <div>
        <span>Start</span>
        <h2>Launch Minecraft</h2>
      </div>
      <div className="launch-fields">
        <label>
          Instance
          <CustomSelect
            disabled={instances.length === 0}
            options={instanceOptions}
            placeholder="No instance created"
            value={instanceId}
            onChange={setInstanceId}
          />
        </label>
        <label>
          Account
          <CustomSelect
            disabled={accounts.length === 0}
            options={accountOptions}
            placeholder="No account signed in"
            value={accountId}
            onChange={setAccountId}
          />
        </label>
      </div>
      <Button
        icon={runningInstance ? <Square size={17} /> : <Play size={17} />}
        disabled={!canRunAction}
        variant={runningInstance ? "secondary" : "primary"}
        onClick={() => {
          if (runningInstance) {
            onStopRunningInstance(runningInstance.id);
            return;
          }

          if (selectedInstance && selectedAccount) {
            onLaunch(selectedInstance, selectedAccount);
          }
        }}
      >
        {runningInstance ? t(language, "stop") : t(language, "launch")}
      </Button>
    </Card>
  );
}
