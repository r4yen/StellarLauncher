import { Moon, Sparkles } from "lucide-react";
import { ThemeSettings } from "../models/launcher";
import Button from "./ui/Button";
import Card from "./ui/Card";
import StatusBadge from "./StatusBadge";

interface ThemePreviewProps {
  theme: ThemeSettings;
}

export default function ThemePreview({ theme }: ThemePreviewProps) {
  return (
    <Card className="theme-preview" tone="bright" style={{ "--preview-accent": theme.accentColor } as React.CSSProperties}>
      <div className="preview-top">
        <span><Moon size={16} /> Dark Orbit</span>
        <StatusBadge state="running" label="preview" />
      </div>
      <div className="preview-orbit">
        <div />
        <div />
        <div />
      </div>
      <div className="preview-copy">
        <h3>Galaxy control surface</h3>
        <p>Accent color, glow and density are wired for local storage.</p>
      </div>
      <Button icon={<Sparkles size={16} />}>Primary action</Button>
    </Card>
  );
}
