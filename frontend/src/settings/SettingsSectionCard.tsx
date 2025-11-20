import React, { ReactNode } from "react";

interface SettingsSectionCardProps {
  id?: string; // used as data-settings-card for CSS hooks
  title: string;
  description?: string;
  children: ReactNode;
}

const SettingsSectionCard: React.FC<SettingsSectionCardProps> = ({
  id,
  title,
  description,
  children,
}) => {
  return (
    <section
      data-settings-card={id}
      className="rounded-md border border-[var(--tp-settings-card-border)] bg-[var(--tp-settings-card-bg)] px-4 py-3 space-y-2"
    >
      <header className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-200">
            {title}
          </h2>
          {description && (
            <p className="text-[11px] text-slate-400 mt-0.5">{description}</p>
          )}
        </div>
      </header>

      <div className="pt-1">{children}</div>
    </section>
  );
};

export default SettingsSectionCard;