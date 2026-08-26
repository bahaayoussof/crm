// Small decorative inline SVG icons for attachment actions. No icon dependency.
// Every icon is aria-hidden and non-focusable; the accessible name lives on the
// surrounding control. Artwork is direction-neutral and must not be mirrored in RTL.

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

/** Eye / document-view icon for Preview. */
export function PreviewIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M1.5 10S4.5 4.5 10 4.5 18.5 10 18.5 10 15.5 15.5 10 15.5 1.5 10 1.5 10Z" />
      <circle cx="10" cy="10" r="2.5" />
    </svg>
  );
}

/** Downward arrow into a tray icon for Download. */
export function DownloadIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M10 3v9" />
      <path d="M6 9l4 4 4-4" />
      <path d="M4 15.5h12" />
    </svg>
  );
}

/** Close (X) icon for the preview dialog. */
export function CloseIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M5 5l10 10M15 5L5 15" />
    </svg>
  );
}

/** Indeterminate spinner (CSS-animated) for pending actions. */
export function SpinnerIcon({ className = "size-4" }: IconProps) {
  return (
    <svg className={`${className} animate-spin`} viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false">
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="2" opacity="0.25" />
      <path d="M17 10a7 7 0 0 0-7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
