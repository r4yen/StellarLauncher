import { useUiText } from "../uiLanguage";
import { useState } from "react";
import SettingsForm, {SettingsSection} from "../components/SettingsForm";
import { LauncherSettings } from "../models/settings";
import LauncherImportSection, { LauncherImportSectionProps } from "../components/LauncherImportSection";
import Button from "../components/ui/Button";

interface SettingsPageProps {
  javaSetupBusy?: boolean;
  javaSetupStatus?: string;
  settings: LauncherSettings;
  onSave: (settings: LauncherSettings) => void;
  onSetupJava?: () => void;
  onRenameGameDirectory: (newName: string) => Promise<void>;
  autoUpdateStatus: string;
  importer: Omit<LauncherImportSectionProps, "settings">;
  onSetupGuide: () => void;
  setupGuideDisabled: boolean;
  onAccounts: () => void;
}

export default function SettingsPage({ javaSetupBusy = false, javaSetupStatus, settings, onSave, onSetupJava, onRenameGameDirectory, autoUpdateStatus, importer, onSetupGuide, setupGuideDisabled, onAccounts }: SettingsPageProps) {
  const ui = useUiText();
  const [section,setSection]=useState<SettingsSection|"accounts"|"import">("general");
  const de=settings.language==="de";
  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <span>Stellar Launcher</span>
          <h1>{de?"Einstellungen":ui("Settings")}</h1>
          <p>{de?"Alles an einem Ort. Änderungen werden automatisch gespeichert.":ui("Everything in one place. Changes are saved automatically.")}</p>
        </div>
      </div>
      <nav className="settings-tabs" aria-label={de?"Einstellungsbereiche":ui("Settings categories")}>{([['general',de?'Allgemein':ui("General")],['minecraft','Minecraft & Java'],['downloads','Downloads'],['accounts','Accounts'],['import','Import'],['advanced',de?'Erweitert':ui("Advanced")]] as const).map(([id,label])=><Button key={id} variant={section===id?'primary':'secondary'} onClick={()=>setSection(id)}>{label}</Button>)}</nav>
      {section!=="accounts"&&section!=="import"&&<section className="settings-grid"><SettingsForm section={section} javaSetupBusy={javaSetupBusy} javaSetupStatus={javaSetupStatus} settings={settings} onSave={onSave} onSetupJava={onSetupJava} onRenameGameDirectory={onRenameGameDirectory} autoUpdateStatus={autoUpdateStatus} /></section>}
      {section==="accounts"&&<section className="card launcher-import-section"><h2>Accounts</h2><p>{de?"Microsoft-Accounts anmelden, Offline-Spieler hinzufügen und den aktiven Account auswählen.":ui("Sign in, add offline players and choose your active account.")}</p><Button onClick={onAccounts}>{de?"Accounts verwalten":ui("Manage accounts")}</Button></section>}
      {section==="import"&&<LauncherImportSection settings={settings} {...importer} />}
      {section==="general"&&<div>
      <section className="card launcher-import-section"><h2>{settings.language === "de" ? "Ersteinrichtung" : ui("First-time setup")}</h2><p>{settings.language === "de" ? "Öffnet den Assistenten für Java, Konten und Instanzen. Bereits installierte Stellar-Java-Versionen werden wiederverwendet." : ui("Open the guide for Java, accounts and instances. Existing Stellar Java installations are reused.")}</p><Button variant="secondary" disabled={setupGuideDisabled} onClick={onSetupGuide}>{settings.language === "de" ? "Einrichtungsassistent öffnen" : ui("Open setup guide")}</Button></section>
      </div>}
    </div>
  );
}
