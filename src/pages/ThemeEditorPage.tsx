import { useEffect, useState } from "react";
import ColorPicker from "../components/ColorPicker";
import { ThemeSettings } from "../models/settings";
import ThemePreview from "../components/ThemePreview";
import Card from "../components/ui/Card";

interface ThemeEditorPageProps {
  theme: ThemeSettings;
  onThemeChange: (theme: ThemeSettings) => void;
}

const hexPattern = /^#[0-9a-fA-F]{6}$/;

function hexToRgb(hex: string) {
  const normalized = hexPattern.test(hex) ? hex : "#39d5ff";
  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16)
  };
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((value) => Math.max(0, Math.min(255, value)).toString(16).padStart(2, "0")).join("")}`;
}

export default function ThemeEditorPage({ theme, onThemeChange }: ThemeEditorPageProps) {
  const [hexDraft, setHexDraft] = useState(theme.accentColor);
  const updateTheme = (patch: Partial<ThemeSettings>) => onThemeChange({ ...theme, ...patch });
  const rgb = hexToRgb(theme.accentColor);

  useEffect(() => {
    setHexDraft(theme.accentColor);
  }, [theme.accentColor]);

  const normalizeHex = (value: string) => {
    const cleaned = value.replace(/[^0-9a-fA-F#]/g, "");
    return cleaned.startsWith("#") ? cleaned.slice(0, 7) : `#${cleaned.slice(0, 6)}`;
  };

  const updateHex = (value: string) => {
    const normalized = normalizeHex(value);
    setHexDraft(normalized);
    if (hexPattern.test(normalized)) updateTheme({ accentColor: normalized.toLowerCase() });
  };

  const commitHex = () => {
    if (hexPattern.test(hexDraft)) updateTheme({ accentColor: hexDraft.toLowerCase() });
    else setHexDraft(theme.accentColor);
  };

  const updateRgb = (channel: "r" | "g" | "b", value: number) => {
    const nextRgb = { ...rgb, [channel]: value };
    updateTheme({ accentColor: rgbToHex(nextRgb.r, nextRgb.g, nextRgb.b) });
  };

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <span>Appearance</span>
          <h1>Theme Editor</h1>
          <p>Dark mode is the default surface. Pick an exact accent color, enter a HEX code or tune RGB channels.</p>
        </div>
      </div>
      <section className="content-grid">
        <Card className="theme-controls">
          <label>
            Accent color
            <ColorPicker color={theme.accentColor} onChange={(accentColor) => updateTheme({ accentColor })} />
          </label>
          <label>
            Custom HEX code
            <input
              className="hex-input"
              maxLength={7}
              value={hexDraft}
              onBlur={commitHex}
              onChange={(event) => updateHex(event.target.value)}
              placeholder="#39d5ff"
            />
          </label>
          <div className="rgb-grid">
            <label>
              R
              <input min={0} max={255} type="number" value={rgb.r} onChange={(event) => updateRgb("r", Number(event.target.value))} />
            </label>
            <label>
              G
              <input min={0} max={255} type="number" value={rgb.g} onChange={(event) => updateRgb("g", Number(event.target.value))} />
            </label>
            <label>
              B
              <input min={0} max={255} type="number" value={rgb.b} onChange={(event) => updateRgb("b", Number(event.target.value))} />
            </label>
          </div>
        </Card>
        <ThemePreview theme={theme} />
      </section>
    </div>
  );
}
