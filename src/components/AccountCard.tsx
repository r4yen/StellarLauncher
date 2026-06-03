import { ShieldCheck, Trash2, UserCheck } from "lucide-react";
import { Account } from "../models/launcher";
import Button from "./ui/Button";
import Card from "./ui/Card";
import StatusBadge from "./StatusBadge";

interface AccountCardProps {
  account: Account;
  onSelectAccount: (accountId: string) => void;
}

export default function AccountCard({ account, onSelectAccount }: AccountCardProps) {
  return (
    <Card className={account.isActive ? "account-card account-card-active" : "account-card"}>
      <div className="account-avatar" style={{ background: account.avatarColor }}>
        {account.username.slice(0, 1).toUpperCase()}
      </div>
      <div className="account-body">
        <div className="card-heading">
          <div>
            <h3>{account.username}</h3>
            <p>{account.type === "microsoft" ? "Microsoft account" : "Offline development account"}</p>
          </div>
          <StatusBadge state={account.isActive ? "online" : "offline"} label={account.isActive ? "active" : "stored"} />
        </div>
        <div className="account-meta">
          <span><ShieldCheck size={14} /> Token storage planned</span>
          <span>Last used {account.lastUsed}</span>
        </div>
        <div className="card-actions">
          <Button icon={<UserCheck size={16} />} variant={account.isActive ? "secondary" : "primary"} onClick={() => onSelectAccount(account.id)}>
            {account.isActive ? "Selected" : "Select"}
          </Button>
          <Button icon={<Trash2 size={16} />} variant="ghost">
            Remove
          </Button>
        </div>
      </div>
    </Card>
  );
}
