import type { LucideProps } from "lucide-react";
import {
  ChevronDown,
  Loader2,
  Pencil,
  UserRoundCheck,
  UserRoundX,
} from "lucide-react";

/** Pencil icon for the row Edit action. */
export function PencilIcon(props: LucideProps) {
  return <Pencil size={16} strokeWidth={1.75} aria-hidden="true" {...props} />;
}

/** Person with an "x" — deactivate a user account. */
export function UserRoundXIcon(props: LucideProps) {
  return <UserRoundX size={16} strokeWidth={1.75} aria-hidden="true" {...props} />;
}

/** Person with a check — reactivate a user account. */
export function UserRoundCheckIcon(props: LucideProps) {
  return <UserRoundCheck size={16} strokeWidth={1.75} aria-hidden="true" {...props} />;
}

/** Down chevron for custom-styled native selects. Direction-neutral. */
export function ChevronDownIcon(props: LucideProps) {
  return <ChevronDown size={16} strokeWidth={1.75} aria-hidden="true" {...props} />;
}

/** Indeterminate spinner for pending row actions. */
export function SpinnerIcon({ className = "size-4", ...props }: LucideProps) {
  return <Loader2 className={`${className} animate-spin`} size={16} strokeWidth={2} aria-hidden="true" {...props} />;
}
