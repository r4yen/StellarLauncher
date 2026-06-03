import { Home, MonitorCog, Palette, Server, Users } from "lucide-react";
import { PageKey } from "../models/launcher";
import Logo from "./Logo";

interface SidebarProps {
  activePage: PageKey;
  onNavigate: (page: PageKey) => void;
}

const navItems: Array<{ key: PageKey; label: string; icon: typeof Home }> = [
  { key: "home", label: "Home", icon: Home },
  { key: "instances", label: "Instances", icon: Server },
  { key: "accounts", label: "Accounts", icon: Users },
  { key: "theme", label: "Theme", icon: Palette },
  { key: "settings", label: "Settings", icon: MonitorCog }
];

export default function Sidebar({ activePage, onNavigate }: SidebarProps) {
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
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
      <div className="sidebar-footer">
        <span>Local mock mode</span>
        <strong>v0.1.0</strong>
      </div>
    </aside>
  );
}
