// Small decorative inline SVG icons for Users Management (matches the attachments /
// quick-replies convention: 20x20 viewBox, 1.6 stroke, aria-hidden, non-focusable,
// direction-neutral artwork that must not be mirrored in RTL). No icon dependency.

type IconProps = { className?: string };

const base = (className = "size-4") => ({
  className,
  viewBox: "0 0 20 20",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": "true" as const,
  focusable: "false" as const,
});

/** Pencil icon for the row Edit action. */
export function PencilIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M13.5 3.5l3 3L7 16H4v-3l9.5-9.5Z" />
      <path d="M12 5l3 3" />
    </svg>
  );
}

/** Person with an "x" — deactivate a user account. */
export function UserRoundXIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <circle cx="8.5" cy="6.5" r="3" />
      <path d="M3 16c0-2.8 2.5-4.5 5.5-4.5 1 0 1.9.2 2.7.5" />
      <path d="M13.5 12.5l4 4M17.5 12.5l-4 4" />
    </svg>
  );
}

/** Person with a check — reactivate a user account. */
export function UserRoundCheckIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <circle cx="8.5" cy="6.5" r="3" />
      <path d="M3 16c0-2.8 2.5-4.5 5.5-4.5 1 0 1.9.2 2.7.5" />
      <path d="M13 15l1.8 1.8L18 13.5" />
    </svg>
  );
}

/** Down chevron for custom-styled native selects. Direction-neutral — never rotated in RTL. */
export function ChevronDownIcon({ className = "size-4" }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M5.5 8l4.5 4.5L14.5 8" />
    </svg>
  );
}

/** Indeterminate spinner (CSS-animated) for pending row actions. */
export function SpinnerIcon({ className = "size-4" }: IconProps) {
  return (
    <svg className={`${className} animate-spin`} viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false">
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="2" opacity="0.25" />
      <path d="M17 10a7 7 0 0 0-7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
