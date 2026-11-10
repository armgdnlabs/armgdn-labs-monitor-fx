import { type ReactNode, useEffect } from "react";
import { Icon } from "./Icon";

/** Dialog: a floating glass card with a red-dot title, same as the ARMGDN site's cards. */
export function Modal({ title, onClose, children, width = "max-w-md" }: { title: string; onClose: () => void; children: ReactNode; width?: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-void/60 backdrop-blur-sm" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`w-full ${width} max-h-[92vh] flex flex-col rounded-[22px] overflow-hidden`}
        style={{ background: "rgb(var(--panel) / 0.94)", backdropFilter: "blur(30px)", boxShadow: "inset 0 0 0 1px rgb(var(--fg) / 0.1), 0 40px 80px -30px rgb(0 0 0 / 0.7)" }}
      >
        <div className="flex items-center h-14 pl-5 pr-3 shrink-0">
          <span className="slash flex-1 truncate text-[16px] font-semibold tracking-[-0.02em]">{title}</span>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
        </div>
        <div className="px-5 pb-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
