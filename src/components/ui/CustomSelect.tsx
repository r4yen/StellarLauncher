import { ChevronDown } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  color?: string;
  imageUrl?: string;
  imageAlt?: string;
}

interface CustomSelectProps {
  compact?: boolean;
  disabled?: boolean;
  hideTriggerText?: boolean;
  open?: boolean;
  menuWidth?: number;
  options: SelectOption[];
  placeholder: string;
  triggerClassName?: string;
  triggerIcon?: ReactNode;
  value: string;
  onChange: (value: string) => void;
  onOpenChange?: (open: boolean) => void;
}

export default function CustomSelect({
  compact = false,
  disabled = false,
  hideTriggerText = false,
  open: controlledOpen,
  menuWidth,
  options,
  placeholder,
  triggerClassName,
  triggerIcon,
  value,
  onChange,
  onOpenChange
}: CustomSelectProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const [menuRect, setMenuRect] = useState({ left: 0, top: 0, width: 0 });
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);
  const setOpen = (nextOpen: boolean) => {
    if (controlledOpen === undefined) setUncontrolledOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };

  useEffect(() => {
    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };

    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;
      setMenuRect({
        left: rect.left,
        top: rect.bottom + 8,
        width: menuWidth ?? rect.width
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  const menu =
    open && !disabled
      ? createPortal(
          <div
            className="custom-select-menu"
            ref={menuRef}
            style={{
              left: menuRect.left,
              top: menuRect.top,
              width: menuRect.width
            }}
          >
            {options.map((option) => (
              <button
                key={option.value}
                className={option.value === value ? "custom-select-option custom-select-option-active" : "custom-select-option"}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                type="button"
              >
                {option.imageUrl ? <img className="custom-select-image" src={option.imageUrl} alt={option.imageAlt ?? ""} /> : null}
                {!option.imageUrl && option.color ? <span className="custom-select-color" style={{ background: option.color }} /> : null}
                <span>
                  <strong>{option.label}</strong>
                  {option.description ? <small>{option.description}</small> : null}
                </span>
              </button>
            ))}
          </div>,
          document.body
        )
      : null;

  const className = [
    "custom-select",
    compact ? "custom-select-compact" : "",
    disabled ? "custom-select-disabled" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className} ref={rootRef}>
      <button
        className={["custom-select-trigger", triggerClassName ?? ""].filter(Boolean).join(" ")}
        disabled={disabled}
        onClick={() => setOpen(!open)}
        type="button"
      >
        {triggerIcon}
        {selected?.imageUrl ? <img className="custom-select-image" src={selected.imageUrl} alt={selected.imageAlt ?? ""} /> : null}
        {!selected?.imageUrl && selected?.color ? <span className="custom-select-color" style={{ background: selected.color }} /> : null}
        {!hideTriggerText ? (
          <span>
            <strong>{selected?.label ?? placeholder}</strong>
            {selected?.description ? <small>{selected.description}</small> : null}
          </span>
        ) : null}
        {!hideTriggerText ? <ChevronDown size={16} /> : null}
      </button>
      {menu}
    </div>
  );
}
