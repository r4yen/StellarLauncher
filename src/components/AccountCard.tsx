import LocalizedError from "./LocalizedError";
import { useUiText, useUiLanguage } from "../uiLanguage";
import { ArrowDown, ArrowUp, Image, Star, Trash2, UserCheck } from "lucide-react";
import { Account } from "../models/account";
import { minecraftHeadUrl } from "../services/avatarService";
import Button from "./ui/Button";
import Card from "./ui/Card";
import StatusBadge from "./StatusBadge";

interface AccountCardProps {
  account: Account;
  onOpenSkinLibrary?: (accountId: string) => void;
  onRemoveAccount?: (accountId: string) => void;
  onToggleFavorite?: (accountId: string) => void;
  onMove?: (accountId: string, direction: -1 | 1) => void;
  onSelectAccount: (accountId: string) => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}

function formatDate(value: string, language: string): string {
  return new Intl.DateTimeFormat(language === "de" ? "de-DE" : "en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(value));
}

function formatUuid(value: string): string {
  const compact = value.replace(/-/g, "");
  if (compact.length !== 32) return value;
  return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`;
}

export default function AccountCard({
  account,
  onOpenSkinLibrary,
  onRemoveAccount,
  onToggleFavorite,
  onMove,
  onSelectAccount,
  canMoveUp = false,
  canMoveDown = false
}: AccountCardProps) {
  const ui = useUiText();
  const language = useUiLanguage();
  const avatarUrl = minecraftHeadUrl(account);
  const className = [
    "account-card",
    account.isActive ? "account-card-active" : "",
    account.isFavorite ? "account-card-favorite" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Card className={className}>
      <div className="order-tools card-side-order-tools">
        <button className="icon-button" disabled={!canMoveUp} onClick={() => onMove?.(account.id, -1)} type="button" aria-label={ui("Move account up")}>
          <ArrowUp size={16} />
        </button>
        <button className="icon-button" disabled={!canMoveDown} onClick={() => onMove?.(account.id, 1)} type="button" aria-label={ui("Move account down")}>
          <ArrowDown size={16} />
        </button>
      </div>
      {avatarUrl ? (
        <img className="account-avatar account-avatar-image" src={avatarUrl} alt={ui("{name} skin head", {name: account.username})} />
      ) : (
        <div className="account-avatar" style={{ background: account.avatarColor }}>
          {account.username.slice(0, 1)}
        </div>
      )}
      <div className="account-body">
        <div className="entity-title-row">
          <div>
            <h3>{account.username}</h3>
            {account.type === "microsoft" ? <p>{formatUuid(account.uuid)}</p> : null}
          </div>
          <div className="entity-title-actions">
            {account.isActive ? <StatusBadge state={account.loginStatus} label="active" /> : null}
            <button
              className={account.isFavorite ? "favorite-star favorite-star-active" : "favorite-star"}
              onClick={() => onToggleFavorite?.(account.id)}
              type="button"
              aria-label={account.isFavorite ? ui("Unfavorite account") : ui("Favorite account")}
            >
              <Star size={19} fill="currentColor" />
            </button>
          </div>
        </div>
        <div className="account-meta">
          <span>{account.tokenExpiresAt ? ui("Token expires {date}", {date: formatDate(account.tokenExpiresAt, language)}) : ui("No token expiry")}</span>
        </div>
        {account.errorMessage ? <p className="error-text"><LocalizedError message={account.errorMessage} /></p> : null}
        <div className="card-bottom-actions">
          <div className="card-action-left">
            <Button icon={<UserCheck size={16} />} variant={account.isActive ? "secondary" : "primary"} onClick={() => onSelectAccount(account.id)}>
              {account.isActive ? ui("Selected") : ui("Select")}
            </Button>
            <Button icon={<Image size={16} />} variant="secondary" onClick={() => onOpenSkinLibrary?.(account.id)}>
              Skin
            </Button>
          </div>
          <div className="card-action-right">
            <Button icon={<Trash2 size={16} />} variant="danger" onClick={() => onRemoveAccount?.(account.id)}>
              {ui("Remove")}</Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
