import { ChevronDown, ChevronRight, Folder } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

export interface SelectOption {
  folderId?: string;
  value: string;
  label: string;
  description?: string;
  color?: string;
  imageUrl?: string;
  imageAlt?: string;
}

interface CustomSelectProps {
  folders?: {id:string;name:string}[];
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
  folders = [],
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
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const open = controlledOpen ?? uncontrolledOpen;
  const [menuRect, setMenuRect] = useState({ left: 0, top: 0, width: 0 });
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);
  const setOpen = (nextOpen: boolean) => {
    if (!nextOpen) setExpanded(new Set());
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
      const width = Math.min(menuWidth ?? rect.width,window.innerWidth-24);
      const height = Math.min(260, menuRef.current?.scrollHeight ?? 260);
      setMenuRect({ left: Math.max(12,Math.min(rect.left,window.innerWidth-width-12)), top: window.innerHeight-rect.bottom>height+16?rect.bottom+8:Math.max(12,rect.top-height-8), width });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open,expanded,menuWidth]);

  const optionRow = (option:SelectOption) => <button key={option.value} className={option.value===value?"custom-select-option custom-select-option-active":"custom-select-option"} onClick={()=>{onChange(option.value);setOpen(false);}} type="button">
    {option.imageUrl?<img className="custom-select-image" src={option.imageUrl} alt={option.imageAlt??""}/>:option.color?<span className="custom-select-color" style={{background:option.color}}/>:null}<span><strong>{option.label}</strong>{option.description&&<small>{option.description}</small>}</span>
  </button>;

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
            {options.filter(option=>!folders.some(folder=>folder.id===option.folderId)).map(optionRow)}
            {folders.map(folder=><div className="select-folder" key={folder.id}><button className="custom-select-option select-folder-heading" type="button" aria-expanded={expanded.has(folder.id)} onClick={()=>setExpanded(current=>{const next=new Set(current);next.has(folder.id)?next.delete(folder.id):next.add(folder.id);return next;})}><ChevronRight size={14} className={expanded.has(folder.id)?"folder-chevron-open":""}/><Folder size={16}/><strong>{folder.name}</strong><small>{options.filter(option=>option.folderId===folder.id).length}</small></button>{expanded.has(folder.id)&&<div className="select-folder-options">{options.filter(option=>option.folderId===folder.id).map(optionRow)}</div>}</div>)}
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
        title={hideTriggerText ? placeholder : undefined}
        aria-label={hideTriggerText ? placeholder : undefined}
        aria-expanded={open}
        onKeyDown={event=>{if(event.key==="Escape")setOpen(false);}}
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
