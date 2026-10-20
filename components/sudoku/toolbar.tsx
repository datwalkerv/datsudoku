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
        label={props.notesMode ? "Notes On" : "Notes"}
        name="Notes"
        shortcut="N"
        onClick={props.onToggleNotes}
        disabled={props.disabled}
        pressed={props.notesMode}
      />
      <Tool icon={Lightbulb} label="Hint" shortcut="H" onClick={props.onHint} disabled={props.disabled || props.hintBusy} />
    </div>
  );
}

/** A round tool button; feedback happens on press, and "Notes" fills with the tint when on. */
function Tool({
  icon: Icon,
  label,
  name = label,
  shortcut,
  onClick,
  disabled,
  pressed,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  /** Stable accessible name (the visible label may change). */
  name?: string;
  shortcut: string;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={name}
      aria-pressed={pressed}
      aria-keyshortcuts={shortcut}
      title={`${name} (${shortcut})`}
      className="group flex flex-col items-center gap-1.5 py-1 touch-manipulation select-none disabled:opacity-35"
    >
      <span
        className={cn(
          "flex size-[52px] items-center justify-center rounded-full transition-[background-color,color,transform] duration-150",
          "group-active:scale-90 group-disabled:group-active:scale-100",
          pressed ? "bg-primary text-primary-foreground" : "bg-card text-foreground",
        )}
      >
        <Icon className="size-[22px]" strokeWidth={1.9} aria-hidden />
      </span>
      <span className={cn("type-caption font-medium", pressed ? "text-tint" : "text-foreground")}>{label}</span>
    </button>
  );
}
