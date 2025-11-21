// src/lab-components/LabPanelShell.tsx
import React, { CSSProperties, ReactNode } from "react";
import { useUiScopedTokens } from "../config/useUiScopedTokens";

interface LabPanelShellProps {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  /** Optional extra classes for outer section (border/bg/etc.) */
  containerClassName?: string;
  /** Optional extra classes for header bar (bg/border/etc.) */
  headerClassName?: string;
  /** Optional extra classes for body wrapper */
  bodyClassName?: string;
  /** Optional inline styles for the outer container */
  style?: CSSProperties;
}

const LabPanelShell: React.FC<LabPanelShellProps> = ({
  title,
  open,
  onToggle,
  children,
  containerClassName = "",
  headerClassName = "",
  bodyClassName = "",
  style,
}) => {
  const tokens = useUiScopedTokens([
    "global",
    "page:lab",
    "region:lab:ideaBuilder",
  ]);

  const mergedStyle = {
    ...(title === "Idea Builder"
      ? {
          background: tokens.surfaceMuted,
          borderColor: tokens.border,
          color: tokens.textPrimary,
        }
      : {}),
    ...style,
  };

  return (
    <section
      className={`rounded-md flex flex-col ${containerClassName}`}
      style={Object.keys(mergedStyle).length > 0 ? mergedStyle : undefined}
    >
      {/* Header bar with toggle */}
      <div
        className={`px-3 py-2 flex items-center justify-between cursor-pointer ${headerClassName}`}
        onClick={onToggle}
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-200">
          {title}
        </span>
        <span className="text-slate-400 text-sm">
          {open ? "▾" : "▸"}
        </span>
      </div>

      {/* Body */}
      {open && (
        <div className={`px-3 py-3 ${bodyClassName}`}>
          {children}
        </div>
      )}
    </section>
  );
};

export default LabPanelShell;