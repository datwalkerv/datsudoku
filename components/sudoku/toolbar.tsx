"use client";

import { Eraser, Lightbulb, Pencil, Redo2, Undo2 } from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import { cn } from "@/lib/utils";

interface ToolbarProps {
  canUndo: boolean;
  canRedo: boolean;
  notesMode: boolean;
  disabled: boolean;
  hintBusy: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onErase: () => void;
  onToggleNotes: () => void;
  onHint: () => void;
}

export function Toolbar(props: ToolbarProps) {
  return (
    <div role="toolbar" aria-label="Game tools" className="grid grid-cols-5 gap-1">
      <Tool icon={Undo2} label="Undo" shortcut="⌘Z" onClick={props.onUndo} disabled={props.disabled || !props.canUndo} />
      <Tool icon={Redo2} label="Redo" shortcut="⇧⌘Z" onClick={props.onRedo} disabled={props.disabled || !props.canRedo} />
      <Tool icon={Eraser} label="Erase" shortcut="⌫" onClick={props.onErase} disabled={props.disabled} />
      <Tool
        icon={Pencil}
        label="Notes"
        shortcut="N"
        onClick={props.onToggleNotes}
        disabled={props.disabled}
        pressed={props.notesMode}
        badge={props.notesMode ? "On" : "Off"}
      />
      <Tool icon={Lightbulb} label="Hint" shortcut="H" onClick={props.onHint} disabled={props.disabled || props.hintBusy} />
    </div>
  );
}

function Tool({
  icon: Icon,
  label,
  shortcut,
  onClick,
  disabled,
  pressed,
  badge,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  shortcut: string;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed}
      aria-keyshortcuts={shortcut}
      title={`${label} (${shortcut})`}
      className={cn(
        "relative flex h-14 flex-col items-center justify-center gap-1 rounded-[10px] text-muted-foreground touch-manipulation select-none",
        "transition-[background-color,color,transform] duration-100 hover:bg-secondary/70 hover:text-foreground active:scale-[0.95]",
        "disabled:opacity-35 disabled:hover:bg-transparent",
        pressed && "text-tint hover:text-tint",
      )}
    >
      <span className="relative">
        <Icon className="size-[22px]" strokeWidth={1.6} aria-hidden />
        {badge && (
          <span
            className={cn(
              "absolute -top-1.5 -right-4 rounded-full px-1 text-[9px] leading-[14px] font-semibold uppercase",
              pressed ? "bg-tint text-primary-foreground" : "bg-secondary text-muted-foreground",
            )}
          >
            {badge}
          </span>
        )}
      </span>
      <span className="text-[11px] leading-none">{label}</span>
    </button>
  );
}
