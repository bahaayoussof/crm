import type { LucideProps } from "lucide-react";
import {
  Download,
  Eye,
  Loader2,
  X,
} from "lucide-react";

/** Eye / document-view icon for Preview. */
export function PreviewIcon(props: LucideProps) {
  return <Eye size={16} strokeWidth={1.75} aria-hidden="true" {...props} />;
}

/** Downward arrow into a tray icon for Download. */
export function DownloadIcon(props: LucideProps) {
  return <Download size={16} strokeWidth={1.75} aria-hidden="true" {...props} />;
}

/** Close (X) icon for the preview dialog. */
export function CloseIcon(props: LucideProps) {
  return <X size={16} strokeWidth={1.75} aria-hidden="true" {...props} />;
}

/** Indeterminate spinner for pending actions. */
export function SpinnerIcon({ className = "size-4", ...props }: LucideProps) {
  return <Loader2 className={`${className} animate-spin`} size={16} strokeWidth={2} aria-hidden="true" {...props} />;
}
