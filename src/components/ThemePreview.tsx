import { useUiText } from "../uiLanguage";
import { Moon, Sparkles } from "lucide-react";
import { ThemeSettings } from "../models/settings";
import Button from "./ui/Button";
import Card from "./ui/Card";
import StatusBadge from "./StatusBadge";

interface ThemePreviewProps {
  theme: ThemeSettings;
}

export default function ThemePreview({ theme }: ThemePreviewProps) {
  const ui = useUiText();
  return (
    <Card className="theme-preview" tone="bright" style={{ "--preview-accent": theme.accentColor } as React.CSSProperties}>
      <div className="preview-top">
        <span><Moon size={16} /> {ui("Dark Orbit")}</span>
        <StatusBadge state="running" label={ui("Preview")} />
      </div>
      <div className="preview-orbit">
        <div />
        <div />
        <div />
      </div>
      <div className="preview-copy">
        <h3>{ui("Galaxy control surface")}</h3>
        <p>{ui("Accent color is saved locally and applied across controls, cards and status highlights.")}</p>
      </div>
      <Button icon={<Sparkles size={16} />}>{ui("Primary action")}</Button>
    </Card>
  );
}
