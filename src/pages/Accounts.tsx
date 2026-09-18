import LocalizedError from "../components/LocalizedError";
import { useUiText } from "../uiLanguage";
import { Check, ExternalLink, KeyRound, Loader2, Plus, ShieldCheck, Trash2, UserRound, UserRoundPlus, X } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import AccountCard from "../components/AccountCard";
import AccountSkinLibraryModal from "../components/AccountSkinLibraryModal";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import { Language, t } from "../i18n";
import { Account, DeviceLoginStart } from "../models/account";
import { SkinLibraryItem } from "../models/skin";
import { beginMicrosoftDeviceLogin, openExternalUrl, pollMicrosoftDeviceLogin } from "../services/authService";
import { canMoveAccount } from "../services/accountService";
import { minecraftHeadUrl } from "../services/avatarService";

interface AccountsProps {
  onboarding?: boolean;
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
  onboarding = false,
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
  const ui = useUiText();
  const [loginStart, setLoginStart] = useState<DeviceLoginStart | undefined>();
  const [loginError, setLoginError] = useState<string | undefined>();
  const [offlineFormOpen, setOfflineFormOpen] = useState(false);
  const [offlineName, setOfflineName] = useState("Player");
  const [offlineError, setOfflineError] = useState<string | undefined>();
  const [polling, setPolling] = useState(false);
  const loggedInRef = useRef(onAccountLoggedIn);
  loggedInRef.current = onAccountLoggedIn;
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
      let result;
      try { result = await pollMicrosoftDeviceLogin(loginStart.sessionId); }
      catch (error) {
        if (!cancelled) { setLoginError(String(error)); setPolling(false); }
        return;
      }
      if (cancelled) return;

      if (result.status === "complete" && result.account) {
        loggedInRef.current(result.account);
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
  }, [loginStart]);

  if (onboarding) {
    const de = language === "de";
    return <section className="setup-pane setup-accounts-pane" aria-label="Accounts">
      <header className="setup-pane-heading"><span className="setup-pane-icon"><UserRound size={21} /></span><div><h2>Accounts</h2><p>{de ? "Melde dich an und mach es dir zu Hause." : ui("Sign in and make yourself at home.")}</p></div><span className="setup-count">{accounts.length}</span></header>
      <div className="setup-pane-actions"><Button icon={<Plus size={16} />} disabled={Boolean(loginStart)} onClick={() => { setOfflineFormOpen(false); void startLogin(); }}>{t(language, "microsoftLogin")}</Button><Button variant="secondary" icon={<UserRoundPlus size={16} />} onClick={() => setOfflineFormOpen((current) => !current)}>{de ? "Offline-Account" : ui("Offline account")}</Button></div>
      {offlineFormOpen && <form className="setup-offline-form" onSubmit={createOfflineAccount}><label><span>{de ? "Spielername" : ui("Player name")}</span><input autoFocus maxLength={16} value={offlineName} onChange={(event) => { setOfflineName(event.target.value); setOfflineError(undefined); }} /></label><Button type="submit" aria-label={de ? "Account hinzufügen" : ui("Add account")} icon={<Plus size={16} />} /><button className="icon-button" type="button" aria-label={de ? "Abbrechen" : ui("Cancel")} onClick={() => setOfflineFormOpen(false)}><X size={16} /></button></form>}
      {loginStart && <div className="setup-login-code"><div><small>{de ? "Dein Microsoft-Code" : ui("Your Microsoft code")}</small><strong>{loginStart.userCode}</strong></div><Button variant="secondary" icon={<ExternalLink size={14} />} onClick={() => openExternalUrl(loginStart.directVerificationUri)}>{de ? "Im Browser" : ui("Open browser")}</Button><button className="icon-button" type="button" aria-label={de ? "Anmeldung abbrechen" : ui("Cancel sign-in")} onClick={() => { setLoginStart(undefined); setPolling(false); }}><X size={16} /></button></div>}
      {(loginError || storageError || offlineError) && <p className="setup-inline-error" role="alert" title={loginError ?? storageError ?? offlineError}><LocalizedError message={loginError ?? storageError ?? offlineError} /></p>}
      <div className="setup-list" aria-label={de ? "Accountliste" : ui("Account list")}>
        {accounts.length ? accounts.map((account) => <div className={`setup-list-row ${account.isActive ? "setup-list-row-selected" : ""}`} key={account.id}><button type="button" className="setup-account-select" onClick={() => onSelectAccount(account.id)} aria-label={`${de ? "Account auswählen" : ui("Select account")}: ${account.username}`}><span className="setup-row-image setup-avatar-fallback" style={{ background: account.avatarColor }}>{account.username.slice(0, 1)}{minecraftHeadUrl(account) && <img src={minecraftHeadUrl(account)} alt="" onError={(event) => { event.currentTarget.style.display = "none"; }} />}</span><div className="setup-row-copy"><strong>{account.username}</strong><small>{account.type === "microsoft" ? "Microsoft" : de ? "Offline-Account" : ui("Offline account")}</small></div>{account.isActive && <span className="setup-row-ready"><Check size={14} />{de ? "Aktiv" : ui("Active")}</span>}</button><button className="icon-button setup-remove-account" type="button" onClick={() => onRemoveAccount(account.id)} aria-label={`${de ? "Account entfernen" : ui("Remove account")}: ${account.username}`}><Trash2 size={15} /></button></div>) : <div className="setup-empty"><span className="setup-empty-icon"><UserRound size={30} /></span><h3>{de ? "Hier beginnt dein Abenteuer" : ui("Your adventure starts here")}</h3><p>{de ? "Verbinde deinen Minecraft-Account. Du kannst weitere Accounts jederzeit hinzufügen." : ui("Connect your Minecraft account. You can add more accounts whenever you like.")}</p></div>}
      </div>
      <div className="setup-pane-note"><ShieldCheck size={14} />{de ? "Sichere Anmeldung direkt über Microsoft." : ui("Secure sign-in directly with Microsoft.")}</div>
    </section>;
  }

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <span>{ui("Identity")}</span>
          <h1>{t(language, "accounts")}</h1>
          <p>{language === "de" ? "Melde dich mit Microsoft an oder füge einen Offline-Spieler hinzu." : ui("Sign in with Microsoft or add an offline player.")}</p>
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
              <span>{ui("Offline profile")}</span>
              <h3>{ui("Add Offline Player")}</h3>
              <p>{ui("This creates a local offline profile for testing and local play. No Microsoft token is stored.")}</p>
            </div>
            <label>
              {ui("Player name")}<input
                autoFocus
                maxLength={16}
                value={offlineName}
                onChange={(event) => {
                  setOfflineName(event.target.value);
                  setOfflineError(undefined);
                }}
              />
            </label>
            {offlineError ? <p className="error-text"><LocalizedError message={offlineError} /></p> : null}
            <div className="card-actions">
              <Button icon={<UserRoundPlus size={16} />} type="submit">
                {ui("Create Offline Player")}</Button>
              <Button icon={<X size={16} />} variant="ghost" onClick={() => setOfflineFormOpen(false)} type="button">
                {ui("Cancel")}</Button>
            </div>
          </form>
        </Card>
      ) : null}

      {loginStart ? (
        <Card className="login-panel" tone="bright">
          <div>
            <span>{ui("Device code")}</span>
            <strong>{loginStart.userCode}</strong>
            <p>{ui("Complete sign-in in your browser using this code.")}</p>
          </div>
          <div className="card-actions">
            <Button icon={<ExternalLink size={16} />} onClick={() => openExternalUrl(loginStart.directVerificationUri)}>
              {t(language, "openMicrosoft")}
            </Button>
            <Button icon={polling ? <Loader2 className="spin" size={16} /> : <KeyRound size={16} />} variant="secondary" onClick={() => setPolling(false)}>
              {ui("Waiting for login")}</Button>
          </div>
        </Card>
      ) : null}

      {loginError || storageError ? <div className="error-panel"><LocalizedError message={loginError ?? storageError} /></div> : null}

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
            <h3>{ui("No account signed in")}</h3>
            <p>{ui("Start the Microsoft Device Code Flow or add a local offline player.")}</p>
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
