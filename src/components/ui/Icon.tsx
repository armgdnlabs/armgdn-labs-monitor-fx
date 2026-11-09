import { ICONS, type IconName } from "../../brand/icons";

export type { IconName };

/** Pixel icon from the ARMGDN kit (16-cell grid): crisp at 16, 32 or 48 px. */
export function Icon({ name, size = 16, className = "", flip = false }: { name: IconName; size?: number; className?: string; flip?: boolean }) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
      style={{ shapeRendering: "crispEdges", transform: flip ? "scaleX(-1)" : undefined }}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d={ICONS[name]} />
    </svg>
  );
}
