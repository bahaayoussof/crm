// Small decorative inline SVG icons for Quick Replies (matches the attachments
// icon convention: 20x20 viewBox, 1.6 stroke, aria-hidden, non-focusable,
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

/** Trash icon for the row Delete action. */
export function TrashIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M3.5 5.5h13" />
      <path d="M8 3.5h4" />
      <path d="M5 5.5l.8 10a1 1 0 0 0 1 .9h6.4a1 1 0 0 0 1-.9L16 5.5" />
      <path d="M8.5 8.5v5M11.5 8.5v5" />
    </svg>
  );
}

/** Speech-bubble-with-lines icon for the composer "Insert quick reply" trigger. */
export function QuickReplyIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M3.5 5.5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H8l-3.5 3v-3H5.5a2 2 0 0 1-2-2Z" />
      <path d="M6.5 7.5h7M6.5 10h4.5" />
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
