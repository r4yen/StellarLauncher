import { PointerEvent, useRef } from "react";

interface ColorPickerProps {
  color: string;
  onChange: (hex: string) => void;
}

interface Hsv {
  h: number;
  s: number;
  v: number;
}

const hexPattern = /^#[0-9a-fA-F]{6}$/;

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function hexToRgb(hex: string) {
  const normalized = hexPattern.test(hex) ? hex : "#39d5ff";
  return {
    r: parseInt(normalized.slice(1, 3), 16) / 255,
    g: parseInt(normalized.slice(3, 5), 16) / 255,
    b: parseInt(normalized.slice(5, 7), 16) / 255
  };
}

function rgbToHsv(r: number, g: number, b: number): Hsv {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;

  if (delta !== 0) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
  }

  h = Math.round(h * 60);
  if (h < 0) h += 360;

  return {
    h,
    s: max === 0 ? 0 : delta / max,
    v: max
  };
}

function hsvToHex({ h, s, v }: Hsv) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;

  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  return `#${[r, g, b]
    .map((value) => Math.round((value + m) * 255).toString(16).padStart(2, "0"))
    .join("")}`;
}

export default function ColorPicker({ color, onChange }: ColorPickerProps) {
  const areaRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const rgb = hexToRgb(color);
  const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
  const hueColor = hsvToHex({ h: hsv.h, s: 1, v: 1 });

  const updateArea = (event: PointerEvent<HTMLDivElement>) => {
    const rect = areaRef.current?.getBoundingClientRect();
    if (!rect) return;
    const s = clamp((event.clientX - rect.left) / rect.width);
    const v = clamp(1 - (event.clientY - rect.top) / rect.height);
    onChange(hsvToHex({ ...hsv, s, v }));
  };

  const updateHue = (event: PointerEvent<HTMLDivElement>) => {
    const rect = hueRef.current?.getBoundingClientRect();
    if (!rect) return;
    const h = Math.round(clamp((event.clientY - rect.top) / rect.height) * 360);
    onChange(hsvToHex({ ...hsv, h }));
  };

  return (
    <div className="color-picker">
      <div
        className="color-area"
        onPointerDown={updateArea}
        onPointerMove={(event) => event.buttons === 1 && updateArea(event)}
        ref={areaRef}
        style={{ backgroundColor: hueColor }}
      >
        <span className="color-cursor" style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }} />
      </div>
      <div
        className="hue-slider"
        onPointerDown={updateHue}
        onPointerMove={(event) => event.buttons === 1 && updateHue(event)}
        ref={hueRef}
      >
        <span className="hue-cursor" style={{ top: `${(hsv.h / 360) * 100}%` }} />
      </div>
    </div>
  );
}
