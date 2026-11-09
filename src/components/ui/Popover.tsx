import { type ReactNode, useEffect, useRef, useState } from "react";

interface PopoverProps {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "left" | "right" | "center";
  side?: "top" | "bottom";
  className?: string;
}

/** Click-to-open popover that closes on outside click or Escape. */
export function Popover({ trigger, children, align = "left", side = "bottom", className = "" }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("pointerdown", onDown); window.removeEventListener("keydown", onKey); };
  }, [open]);

  const pos = [
    side === "top" ? "bottom-full mb-1" : "top-full mt-1",
    align === "right" ? "right-0" : align === "center" ? "left-1/2 -translate-x-1/2" : "left-0",
  ].join(" ");

  return (
    <div ref={ref} className="relative">
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && <div className={`absolute ${pos} menu ${className}`}>{children(() => setOpen(false))}</div>}
    </div>
  );
}
