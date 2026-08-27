import type { LucideProps } from "lucide-react";
import {
  Loader2,
  MessageSquareQuote,
  Pencil,
  Trash2,
} from "lucide-react";

/** Pencil icon for the row Edit action. */
export function PencilIcon(props: LucideProps) {
  return <Pencil size={16} strokeWidth={1.75} aria-hidden="true" {...props} />;
}

/** Trash icon for the row Delete action. */
export function TrashIcon(props: LucideProps) {
  return <Trash2 size={16} strokeWidth={1.75} aria-hidden="true" {...props} />;
}

/** Speech-bubble-with-quote icon for the composer "Insert quick reply" trigger. */
export function QuickReplyIcon(props: LucideProps) {
  return <MessageSquareQuote size={16} strokeWidth={1.75} aria-hidden="true" {...props} />;
}

/** Indeterminate spinner for pending row actions. */
export function SpinnerIcon({ className = "size-4", ...props }: LucideProps) {
  return <Loader2 className={`${className} animate-spin`} size={16} strokeWidth={2} aria-hidden="true" {...props} />;
}
