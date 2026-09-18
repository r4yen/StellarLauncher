import { useUiText } from "../uiLanguage";
import { Plus } from "lucide-react";
import AccountCard from "../components/AccountCard";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import { Account } from "../models/account";

interface AccountsPageProps {
  accounts: Account[];
  onSelectAccount: (accountId: string) => void;
}

export default function AccountsPage({ accounts, onSelectAccount }: AccountsPageProps) {
  const ui = useUiText();
  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <span>{ui("Identity")}</span>
          <h1>Accounts</h1>
          <p>{ui("Account selection is functional, while Microsoft authentication and encrypted token storage remain isolated for later backend work.")}</p>
        </div>
        <Button icon={<Plus size={17} />}>{ui("Add account")}</Button>
      </div>
      <div className="accounts-grid">
        {accounts.map((account) => (
          <AccountCard key={account.id} account={account} onSelectAccount={onSelectAccount} />
        ))}
        <Card tone="flat" className="storage-note">
          <h3>{ui("Secure storage plan")}</h3>
          <p>{ui("Future authentication commands should persist refresh tokens through Tauri-safe storage, never through plain browser storage.")}</p>
        </Card>
      </div>
    </div>
  );
}
