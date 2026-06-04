import { Home, MonitorCog, Palette, Server, Users } from "lucide-react";
import { t, Language } from "../i18n";
import { PageKey } from "../models/launcher";
import Logo from "./Logo";

interface SidebarProps {
  activePage: PageKey;
  language: Language;
  onNavigate: (page: PageKey) => void;
}

const navItems: Array<{ key: PageKey; labelKey: "home" | "instances" | "accounts" | "theme" | "settings"; icon: typeof Home }> = [
  { key: "home", labelKey: "home", icon: Home },
  { key: "instances", labelKey: "instances", icon: Server },
  { key: "accounts", labelKey: "accounts", icon: Users },
  { key: "theme", labelKey: "theme", icon: Palette },
  { key: "settings", labelKey: "settings", icon: MonitorCog }
];

export default function Sidebar({ activePage, language, onNavigate }: SidebarProps) {
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
        <span>{t(language, "localMode")}</span>
        <strong>v1.0.1</strong>
      </div>
    </aside>
  );
}
