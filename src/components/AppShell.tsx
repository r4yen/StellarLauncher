import { ReactNode } from "react";
import { PageKey } from "../models/launcher";
import Sidebar from "./Sidebar";

interface AppShellProps {
  activePage: PageKey;
  children: ReactNode;
  compact: boolean;
  onNavigate: (page: PageKey) => void;
}

export default function AppShell({ activePage, children, compact, onNavigate }: AppShellProps) {
  return (
    <div className={compact ? "app-shell compact-shell" : "app-shell"}>
      <Sidebar activePage={activePage} onNavigate={onNavigate} />
      <main className="main-content">{children}</main>
    </div>
  );
}
