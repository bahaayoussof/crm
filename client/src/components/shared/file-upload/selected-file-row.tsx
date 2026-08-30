import { FileText, Image as ImageIcon, File as GenericFileIcon, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatFileSize, getFileTypeLabel } from "./file-upload.utils";

interface SelectedFileRowProps {
  file: File;
  onRemove: () => void;
  disabled?: boolean;
}

export function SelectedFileRow({ file, onRemove, disabled = false }: SelectedFileRowProps) {
  const { t } = useTranslation();
  const label = getFileTypeLabel(file);
  const isPdf = label === "PDF";
  const isImg = label === "PNG" || label === "JPEG" || label === "WebP" || file.type.startsWith("image/");
  const isTxt = label === "TXT";

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-surface/70 p-3 sm:p-3.5 transition-colors">
      {/* File Type Badge / Icon */}
      <div className="relative flex size-10 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-surface shadow-2xs">
        {isPdf ? (
          <div className="flex flex-col items-center justify-center">
            <FileText className="size-4 text-red-500" strokeWidth={2} aria-hidden="true" />
            <span className="text-[9px] font-black uppercase tracking-tight text-red-500">PDF</span>
          </div>
        ) : isImg ? (
          <ImageIcon className="size-5 text-blue-400" strokeWidth={1.75} aria-hidden="true" />
        ) : isTxt ? (
          <FileText className="size-5 text-emerald-400" strokeWidth={1.75} aria-hidden="true" />
        ) : (
          <GenericFileIcon className="size-5 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
        )}
      </div>

      {/* File Info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground" title={file.name}>
          <bdi dir="auto">{file.name}</bdi>
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          <bdi dir="ltr">
            {label}
            <span className="mx-1.5" aria-hidden="true">·</span>
            {formatFileSize(file.size)}
          </bdi>
        </p>
      </div>

      {/* Remove Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={onRemove}
        aria-label={t("attachments.removeFile")}
        title={t("attachments.removeFile")}
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      >
        <X className="size-4" strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  );
}
