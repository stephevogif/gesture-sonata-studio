/**
 * FloatingWindow — glass sheet used by every Seven Heavens / Night Sky panel.
 * Presentational only: it never touches audio or tracking state.
 *
 * It floats above the scene but always stops short of the bottom navigation,
 * so the nav is never covered and content never hides behind it.
 */

import { X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Props = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** dark = Night Sky, light = Seven Heavens */
  tone?: "light" | "dark";
  subtitle?: string;
};

export default function FloatingWindow({
  title,
  subtitle,
  onClose,
  children,
  tone = "light",
}: Props) {
  /** portal to <body>: nessun contenitore può più coprire il pannello */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const sheet = (
    <div className="fw-layer" role="dialog" aria-label={title}>
      <button className="fw-scrim" aria-label="Chiudi" onClick={onClose} />
      <section className={`fw-sheet ${tone === "dark" ? "fw-dark" : "fw-light"}`}>
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 pt-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold">{title}</h2>
            {subtitle && <p className="truncate text-[11px] opacity-70">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Chiudi pannello" className="fw-close shrink-0">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="fw-body">{children}</div>
      </section>
    </div>
  );

  if (!mounted) return null;
  return createPortal(sheet, document.body);
}
