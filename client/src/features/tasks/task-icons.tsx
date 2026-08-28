import type { LucideProps } from "lucide-react";
import { Check, Loader2, Pencil, RotateCcw, Trash2 } from "lucide-react";

export function PencilIcon(props: LucideProps) {
  return <Pencil size={16} strokeWidth={1.75} aria-hidden="true" {...props} />;
}

export function TrashIcon(props: LucideProps) {
  return <Trash2 size={16} strokeWidth={1.75} aria-hidden="true" {...props} />;
}

export function CheckIcon(props: LucideProps) {
  return <Check size={16} strokeWidth={2} aria-hidden="true" {...props} />;
}

export function ReopenIcon(props: LucideProps) {
  return <RotateCcw size={16} strokeWidth={1.75} aria-hidden="true" {...props} />;
}

export function SpinnerIcon({ className = "size-4", ...props }: LucideProps) {
  return (
    <Loader2 className={`${className} animate-spin`} size={16} strokeWidth={2} aria-hidden="true" {...props} />
  );
}
