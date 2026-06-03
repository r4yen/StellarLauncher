import { Save } from "lucide-react";
import { ThemeSettings } from "../models/launcher";
import ThemePreview from "../components/ThemePreview";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";

interface ThemeEditorPageProps {
  theme: ThemeSettings;
  onThemeChange: (theme: ThemeSettings) => void;
}

const swatches = ["#39d5ff", "#7c3aed", "#2dd4bf", "#60a5fa", "#c084fc"];

export default function ThemeEditorPage({ theme, onThemeChange }: ThemeEditorPageProps) {
  const updateTheme = (patch: Partial<ThemeSettings>) => onThemeChange({ ...theme, ...patch });

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <span>Appearance</span>
          <h1>Theme Editor</h1>
          <p>Dark mode is the default surface. Accent color, glow and layout density are saved locally.</p>
        </div>
        <Button icon={<Save size={17} />} onClick={() => onThemeChange(theme)}>
          Save theme
        </Button>
      </div>
      <section className="content-grid">
        <Card className="theme-controls">
          <label>
            Accent color
            <input type="color" value={theme.accentColor} onChange={(event) => updateTheme({ accentColor: event.target.value })} />
          </label>
          <div className="swatch-row">
            {swatches.map((color) => (
              <button
                key={color}
                aria-label={`Use ${color}`}
                className={theme.accentColor === color ? "swatch swatch-active" : "swatch"}
                onClick={() => updateTheme({ accentColor: color })}
                style={{ backgroundColor: color }}
                type="button"
              />
            ))}
          </div>
          <label>
            Glow intensity
            <input
              max={100}
              min={0}
              type="range"
              value={theme.glowIntensity}
              onChange={(event) => updateTheme({ glowIntensity: Number(event.target.value) })}
            />
          </label>
          <label className="toggle-row">
            <span>
              Compact mode
              <small>Reduce vertical spacing across launcher surfaces.</small>
            </span>
            <input checked={theme.compactMode} type="checkbox" onChange={(event) => updateTheme({ compactMode: event.target.checked })} />
          </label>
        </Card>
        <ThemePreview theme={theme} />
      </section>
    </div>
  );
}
