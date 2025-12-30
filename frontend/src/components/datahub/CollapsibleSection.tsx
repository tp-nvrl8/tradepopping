// frontend/src/components/datahub/CollapsibleSection.tsx
import React, { ReactNode, useState } from 'react';

interface CollapsibleSectionProps {
  storageKey: string;
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  storageKey,
  title,
  defaultOpen = true,
  children,
}) => {
  const [open, setOpen] = useState<boolean>(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw === 'true') return true;
      if (raw === 'false') return false;
      return defaultOpen;
    } catch {
      return defaultOpen;
    }
  });

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(storageKey, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  return (
    <section className="rounded-md border border-slate-700 bg-slate-800/30">
      <button
        type="button"
        onClick={toggle}
        className="w-full flex items-center justify-between px-3 py-2 text-left"
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-sky-200/70">
          {title}
        </span>
        <span className="text-slate-400 text-xs font-mono">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="px-3 pb-3 pt-1 space-y-2">{children}</div>}
    </section>
  );
};

export default CollapsibleSection;
