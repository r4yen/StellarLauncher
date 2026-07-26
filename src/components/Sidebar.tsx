import { ExternalLink, Github, Home, MessageCircle, MonitorCog, Palette, Server, Users } from "lucide-react";
import { t, Language } from "../i18n";
import { PageKey } from "../models/launcher";
import { openExternalUrl } from "../services/authService";
import { formatCompactPlaytime } from "../services/instanceService";
import Logo from "./Logo";

interface SidebarProps {
  activePage: PageKey;
  language: Language;
  totalPlaytimeSeconds: number;
  onNavigate: (page: PageKey) => void;
}

const navItems: Array<{ key: PageKey; labelKey: "home" | "instances" | "accounts" | "theme" | "settings"; icon: typeof Home }> = [
  { key: "home", labelKey: "home", icon: Home },
  { key: "instances", labelKey: "instances", icon: Server },
  { key: "accounts", labelKey: "accounts", icon: Users },
  { key: "theme", labelKey: "theme", icon: Palette },
  { key: "settings", labelKey: "settings", icon: MonitorCog }
];

export default function Sidebar({ activePage, language, totalPlaytimeSeconds, onNavigate }: SidebarProps) {
  return (
    <aside className="sidebar">
      <Logo size="sm" />
      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              className={activePage === item.key ? "nav-item nav-item-active" : "nav-item"}
              onClick={() => onNavigate(item.key)}
              type="button"
            >
              <Icon size={18} />
              <span>{t(language, item.labelKey)}</span>
            </button>
          );
        })}
      </nav>
      <div className="sidebar-footer">
        <div className="sidebar-links">
          <button type="button" onClick={() => openExternalUrl("https://github.com/r4yen/StellarLauncher/")}>
            <Github size={15} />
            GitHub
            <ExternalLink className="sidebar-link-indicator" size={12} />
          </button>
          <button type="button" onClick={() => openExternalUrl("https://discord.gg/8kMmj8Vb9Q")}>
            <MessageCircle size={15} />
            Discord
            <ExternalLink className="sidebar-link-indicator" size={12} />
          </button>
        </div>
        <div className="sidebar-version">
          <span>{t(language, "localMode")}</span>
          <strong>v1.0.2</strong>
          <span>Total Playtime</span>
          <strong>{formatCompactPlaytime(totalPlaytimeSeconds)}</strong>
        </div>
      </div>
    </aside>
  );
}
