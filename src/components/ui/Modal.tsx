import { type ReactNode, useEffect } from "react";
import { Icon } from "./Icon";

/** Terminal-window dialog (UI kit 16:5): title bar, hairline frame, no rounding or shadow. */
export function Modal({ title, onClose, children, width = "max-w-md" }: { title: string; onClose: () => void; children: ReactNode; width?: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-void/80" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={title} className={`panel w-full ${width} max-h-[92vh] flex flex-col`} style={{ background: "rgb(var(--bg))" }}>
        <div className="flex items-center h-7 px-2 hair-b shrink-0">
          <span className="text-[10px] caps text-fg-muted flex-1 truncate">monitor@armgdn:~/{title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}</span>
          <button className="icon-btn w-5 h-5" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
        </div>
        <div className="ph slash">{title}</div>
        <div className="px-4 pb-4 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
