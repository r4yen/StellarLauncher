import { ArrowDown, ArrowUp, Star, Trash2, UserCheck } from "lucide-react";
import { Account } from "../models/account";
import { minecraftHeadUrl } from "../services/avatarService";
import Button from "./ui/Button";
import Card from "./ui/Card";
import StatusBadge from "./StatusBadge";

interface AccountCardProps {
  account: Account;
  onRemoveAccount?: (accountId: string) => void;
  onToggleFavorite?: (accountId: string) => void;
  onMove?: (accountId: string, direction: -1 | 1) => void;
  onSelectAccount: (accountId: string) => void;
}

export default function AccountCard({ account, onRemoveAccount, onToggleFavorite, onMove, onSelectAccount }: AccountCardProps) {
  const avatarUrl = minecraftHeadUrl(account);

  return (
    <Card className={account.isActive ? "account-card account-card-active" : "account-card"}>
      {avatarUrl ? (
        <img className="account-avatar account-avatar-image" src={avatarUrl} alt={`${account.username} skin head`} />
      ) : (
        <div className="account-avatar" style={{ background: account.avatarColor }}>
          {account.username.slice(0, 1)}
        </div>
      )}
      <div className="account-body">
        <div className="entity-title-row">
          <div>
            <h3>{account.username}</h3>
            {account.type === "microsoft" ? <p>UUID {account.uuid}</p> : null}
          </div>
          <div className="entity-title-actions">
            {account.isActive ? <StatusBadge state={account.loginStatus} label="active" /> : null}
            <button
              className={account.isFavorite ? "favorite-star favorite-star-active" : "favorite-star"}
              onClick={() => onToggleFavorite?.(account.id)}
              type="button"
              aria-label={account.isFavorite ? "Unfavorite account" : "Favorite account"}
            >
              <Star size={19} fill="currentColor" />
            </button>
          </div>
        </div>
        <div className="account-meta">
          <span>{account.tokenExpiresAt ? `Token expires ${new Date(account.tokenExpiresAt).toLocaleString()}` : "No token expiry"}</span>
        </div>
        {account.errorMessage ? <p className="error-text">{account.errorMessage}</p> : null}
        <div className="card-bottom-actions">
          <div className="card-action-left">
            <Button icon={<UserCheck size={16} />} variant={account.isActive ? "secondary" : "primary"} onClick={() => onSelectAccount(account.id)}>
              {account.isActive ? "Selected" : "Select"}
            </Button>
          </div>
          <div className="card-action-right">
            {!account.isFavorite ? (
              <div className="order-tools">
                <button className="icon-button" onClick={() => onMove?.(account.id, -1)} type="button" aria-label="Move account up">
                  <ArrowUp size={16} />
                </button>
                <button className="icon-button" onClick={() => onMove?.(account.id, 1)} type="button" aria-label="Move account down">
                  <ArrowDown size={16} />
                </button>
              </div>
            ) : null}
            <Button icon={<Trash2 size={16} />} variant="danger" onClick={() => onRemoveAccount?.(account.id)}>
              Remove
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
