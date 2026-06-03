import { Plus } from "lucide-react";
import AccountCard from "../components/AccountCard";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import { Account } from "../models/launcher";

interface AccountsPageProps {
  accounts: Account[];
  onSelectAccount: (accountId: string) => void;
}

export default function AccountsPage({ accounts, onSelectAccount }: AccountsPageProps) {
  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <span>Identity</span>
          <h1>Accounts</h1>
          <p>Account selection is functional, while Microsoft authentication and encrypted token storage remain isolated for later backend work.</p>
        </div>
        <Button icon={<Plus size={17} />}>Add account</Button>
      </div>
      <div className="accounts-grid">
        {accounts.map((account) => (
          <AccountCard key={account.id} account={account} onSelectAccount={onSelectAccount} />
        ))}
        <Card tone="flat" className="storage-note">
          <h3>Secure storage plan</h3>
          <p>Future authentication commands should persist refresh tokens through Tauri-safe storage, never through plain browser storage.</p>
        </Card>
      </div>
    </div>
  );
}
