import { Download, Globe2, Minus, Square, X } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LauncherSettings } from "../models/settings";
import CustomSelect from "./ui/CustomSelect";
import Logo from "./Logo";

const appWindow = getCurrentWindow();

interface TitleBarProps {
  downloadCount: number;
  downloadsOpen: boolean;
  languageOpen: boolean;
  settings: LauncherSettings;
  onToggleDownloads: () => void;
  onLanguageOpenChange: (open: boolean) => void;
  onSettingsChange: (settings: LauncherSettings) => void;
}

export default function TitleBar({
  downloadCount,
  downloadsOpen,
  languageOpen,
  settings,
  onToggleDownloads,
  onLanguageOpenChange,
  onSettingsChange
}: TitleBarProps) {
  return (
    <header className="titlebar" data-tauri-drag-region>
      <div className="titlebar-brand" data-tauri-drag-region>
        <Logo size="sm" showText={false} />
        <span data-tauri-drag-region>Stellar Launcher</span>
      </div>
      <button
        className={downloadsOpen ? "titlebar-download titlebar-download-active" : "titlebar-download"}
        data-download-trigger
        onClick={onToggleDownloads}
        type="button"
        aria-label="Downloads"
      >
        <Download size={17} />
        {downloadCount > 0 ? <span>{downloadCount}</span> : null}
      </button>
      <div className="titlebar-language" data-language-trigger>
        <CustomSelect
          hideTriggerText
          menuWidth={164}
          open={languageOpen}
          triggerClassName={languageOpen ? "titlebar-download titlebar-download-active titlebar-language-button" : "titlebar-download titlebar-language-button"}
          triggerIcon={<Globe2 size={17} />}
          value={settings.language}
          placeholder="Language"
          options={[
            { value: "en", label: "\u{1F1EC}\u{1F1E7} English", description: "English" },
            { value: "de", label: "\u{1F1E9}\u{1F1EA} Deutsch", description: "Deutsch" }
          ]}
          onOpenChange={onLanguageOpenChange}
          onChange={(language) => onSettingsChange({ ...settings, language: language as LauncherSettings["language"] })}
        />
      </div>
      <div className="titlebar-controls">
        <button type="button" aria-label="Minimize" onClick={() => appWindow.minimize()}>
          <Minus size={15} />
        </button>
        <button type="button" aria-label="Maximize" onClick={() => appWindow.toggleMaximize()}>
          <Square size={13} />
        </button>
        <button type="button" aria-label="Close" className="titlebar-close" onClick={() => appWindow.close()}>
          <X size={16} />
        </button>
      </div>
    </header>
  );
}
