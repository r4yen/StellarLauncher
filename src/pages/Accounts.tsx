import { ExternalLink, KeyRound, Loader2, Plus, UserRoundPlus, X } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import AccountCard from "../components/AccountCard";
import AccountSkinLibraryModal from "../components/AccountSkinLibraryModal";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import { Language, t } from "../i18n";
import { Account, DeviceLoginStart } from "../models/account";
import { SkinLibraryItem } from "../models/skin";
import { beginMicrosoftDeviceLogin, openExternalUrl, pollMicrosoftDeviceLogin } from "../services/authService";
import { canMoveAccount } from "../services/accountService";

interface AccountsProps {
  accounts: Account[];
  skins: SkinLibraryItem[];
  language: Language;
  storageError?: string;
  onAccountLoggedIn: (account: Account) => void;
  onCreateOfflineAccount: (name: string) => void;
  onAddSkin: (name: string) => void;
  onChangeAccountSkin: (accountId: string, skinId: string) => void;
  onMoveSkin: (skinId: string, direction: -1 | 1) => void;
  onRemoveSkin: (skinId: string) => void;
  onRenameSkin: (skinId: string, name: string) => void;
  onToggleSkinFavorite: (skinId: string) => void;
  onToggleFavorite: (accountId: string) => void;
  onMoveAccount: (accountId: string, direction: -1 | 1) => void;
  onRemoveAccount: (accountId: string) => void;
  onSelectAccount: (accountId: string) => void;
}

export default function Accounts({
  accounts,
  skins,
  language,
  storageError,
  onAccountLoggedIn,
  onCreateOfflineAccount,
  onAddSkin,
  onChangeAccountSkin,
  onMoveSkin,
  onRemoveSkin,
  onRenameSkin,
  onToggleSkinFavorite,
  onToggleFavorite,
  onMoveAccount,
  onRemoveAccount,
  onSelectAccount
}: AccountsProps) {
  const [loginStart, setLoginStart] = useState<DeviceLoginStart | undefined>();
  const [loginError, setLoginError] = useState<string | undefined>();
  const [offlineFormOpen, setOfflineFormOpen] = useState(false);
  const [offlineName, setOfflineName] = useState("Player");
  const [offlineError, setOfflineError] = useState<string | undefined>();
  const [polling, setPolling] = useState(false);
  const [skinAccountId, setSkinAccountId] = useState<string | undefined>();
  const skinAccount = accounts.find((account) => account.id === skinAccountId);

  const startLogin = async () => {
    setLoginError(undefined);
    setPolling(false);
    try {
      const started = await beginMicrosoftDeviceLogin();
      setLoginStart(started);
      await openExternalUrl(started.directVerificationUri);
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : String(error));
    }
  };

  const createOfflineAccount = (event: FormEvent) => {
    event.preventDefault();
    const name = offlineName.trim();

    if (name.length < 3) {
      setOfflineError("Offline player name must be at least 3 characters.");
      return;
    }

    onCreateOfflineAccount(name);
    setOfflineError(undefined);
    setOfflineFormOpen(false);
  };

  useEffect(() => {
    if (!loginStart) return;
    let cancelled = false;
    let timeoutId: number | undefined;

    const poll = async () => {
      setPolling(true);
      const result = await pollMicrosoftDeviceLogin(loginStart.sessionId);
      if (cancelled) return;

      if (result.status === "complete" && result.account) {
        onAccountLoggedIn(result.account);
        setLoginStart(undefined);
        setPolling(false);
        return;
      }

      if (result.status === "error") {
        setLoginError(result.message ?? "Microsoft login failed.");
        setPolling(false);
        return;
      }

      timeoutId = window.setTimeout(poll, loginStart.intervalSeconds * 1000);
      setPolling(false);
    };

    timeoutId = window.setTimeout(poll, loginStart.intervalSeconds * 1000);

    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [loginStart, onAccountLoggedIn]);

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <span>Identity</span>
          <h1>{t(language, "accounts")}</h1>
          <p>Microsoft login uses a local desktop Device Code Flow and stores token material through the Rust storage abstraction, not through an external backend.</p>
        </div>
        <div className="page-header-actions">
          <Button icon={<UserRoundPlus size={17} />} variant="secondary" onClick={() => setOfflineFormOpen((current) => !current)}>
            {t(language, "addOfflinePlayer")}
          </Button>
          <Button icon={<Plus size={17} />} onClick={startLogin}>
            {t(language, "microsoftLogin")}
          </Button>
        </div>
      </div>

      {offlineFormOpen ? (
        <Card className="offline-player-panel" tone="bright">
          <form onSubmit={createOfflineAccount}>
            <div>
              <span>Offline profile</span>
              <h3>Add Offline Player</h3>
              <p>This creates a local offline profile for testing and local play. No Microsoft token is stored.</p>
            </div>
            <label>
              Player name
              <input
                autoFocus
                maxLength={16}
                value={offlineName}
                onChange={(event) => {
                  setOfflineName(event.target.value);
                  setOfflineError(undefined);
                }}
              />
            </label>
            {offlineError ? <p className="error-text">{offlineError}</p> : null}
            <div className="card-actions">
              <Button icon={<UserRoundPlus size={16} />} type="submit">
                Create Offline Player
              </Button>
              <Button icon={<X size={16} />} variant="ghost" onClick={() => setOfflineFormOpen(false)} type="button">
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      {loginStart ? (
        <Card className="login-panel" tone="bright">
          <div>
            <span>Device code</span>
            <strong>{loginStart.userCode}</strong>
            <p>{loginStart.message}</p>
          </div>
          <div className="card-actions">
            <Button icon={<ExternalLink size={16} />} onClick={() => openExternalUrl(loginStart.directVerificationUri)}>
              {t(language, "openMicrosoft")}
            </Button>
            <Button icon={polling ? <Loader2 className="spin" size={16} /> : <KeyRound size={16} />} variant="secondary" onClick={() => setPolling(false)}>
              Waiting for login
            </Button>
          </div>
        </Card>
      ) : null}

      {loginError || storageError ? <div className="error-panel">{loginError ?? storageError}</div> : null}

      <div className="accounts-grid">
        {accounts.length > 0 ? (
          accounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              canMoveDown={canMoveAccount(accounts, account.id, 1)}
              canMoveUp={canMoveAccount(accounts, account.id, -1)}
              onOpenSkinLibrary={setSkinAccountId}
              onRemoveAccount={onRemoveAccount}
              onToggleFavorite={onToggleFavorite}
              onMove={onMoveAccount}
              onSelectAccount={onSelectAccount}
            />
          ))
        ) : (
          <Card className="empty-state">
            <h3>No account signed in</h3>
            <p>Start the Microsoft Device Code Flow or add a local offline player.</p>
          </Card>
        )}
      </div>

      <AccountSkinLibraryModal
        account={skinAccount}
        open={Boolean(skinAccount)}
        skins={skins}
        onAddSkin={onAddSkin}
        onChangeAccountSkin={onChangeAccountSkin}
        onClose={() => setSkinAccountId(undefined)}
        onMoveSkin={onMoveSkin}
        onRemoveSkin={onRemoveSkin}
        onRenameSkin={onRenameSkin}
        onToggleSkinFavorite={onToggleSkinFavorite}
      />
    </div>
  );
}
