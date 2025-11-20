// src/lab-components/LabPanelShell.tsx
import React, { ReactNode } from "react";

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
}

const LabPanelShell: React.FC<LabPanelShellProps> = ({
  title,
  open,
  onToggle,
  children,
  containerClassName = "",
  headerClassName = "",
  bodyClassName = "",
}) => {
  return (
    <section
      className={`rounded-md flex flex-col ${containerClassName}`}
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