import { useRef, useState } from "react";
import { Folder, Sparkles, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ACCEPTED_INPUT_ACCEPT } from "./file-upload.types";

interface FileDropzoneProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  disabled?: boolean;
}

export function FileDropzone({
  onFileSelect,
  accept = ACCEPTED_INPUT_ACCEPT,
  disabled = false,
}: FileDropzoneProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragDepthRef = useRef(0);

  const handleDragEnter = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (disabled) return;
    dragDepthRef.current += 1;
    if (event.dataTransfer?.items && event.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (disabled) return;
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "copy";
    }
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (disabled) return;
    dragDepthRef.current -= 1;
    if (dragDepthRef.current <= 0) {
      dragDepthRef.current = 0;
      setIsDragging(false);
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = 0;
    setIsDragging(false);
    if (disabled) return;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0 && files[0]) {
      onFileSelect(files[0]);
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0 && files[0]) {
      onFileSelect(files[0]);
    }
    // Reset so selecting the same file triggers change
    event.target.value = "";
  };

  const triggerPicker = () => {
    if (disabled) return;
    inputRef.current?.click();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (disabled) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      triggerPicker();
    }
  };

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      aria-label={t("attachments.chooseFile")}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={triggerPicker}
      onKeyDown={handleKeyDown}
      className={`group relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 sm:p-8 text-center transition-all duration-150 outline-none select-none ${
        disabled
          ? "cursor-not-allowed border-border/50 bg-surface-subtle/20 opacity-60"
          : isDragging
            ? "cursor-copy border-primary bg-primary/10 ring-2 ring-primary/30"
            : "cursor-pointer border-border/80 bg-surface/30 hover:border-primary/50 hover:bg-surface/60 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={handleInputChange}
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
      />

      {/* Center Upload Icon with Sparkles */}
      <div className="relative mb-3.5 flex size-14 items-center justify-center">
        {/* Glow / Background Circle */}
        <div
          className={`size-12 rounded-full flex items-center justify-center border transition-transform duration-200 ${
            isDragging
              ? "scale-110 border-primary/40 bg-primary/20 text-primary"
              : "border-border/80 bg-surface text-primary/80 group-hover:scale-105 group-hover:text-primary"
          }`}
        >
          <Upload className="size-5" strokeWidth={2} aria-hidden="true" />
        </div>
        {/* Decorative subtle sparkles */}
        <Sparkles
          className="absolute -top-0.5 -start-0.5 size-3 text-primary/40 animate-pulse pointer-events-none"
          strokeWidth={1.5}
          aria-hidden="true"
        />
        <Sparkles
          className="absolute -bottom-0.5 -end-0.5 size-3.5 text-primary/50 pointer-events-none"
          strokeWidth={1.5}
          aria-hidden="true"
        />
      </div>

      {/* Main Drag & Drop Text */}
      <p className="text-sm font-semibold text-foreground">
        {isDragging ? t("attachments.dragActive", "Drop file to select") : t("attachments.dragDropHint", "Drag and drop your file here")}
      </p>

      {/* Subtext separator */}
      <p className="my-2 text-xs text-muted-foreground">
        {t("attachments.dragDropOr", "or")}
      </p>

      {/* Browse button */}
      <div
        className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-xs font-semibold text-foreground shadow-2xs transition-all group-hover:bg-surface-hover group-hover:border-border-strong"
      >
        <Folder className="size-3.5 text-primary" strokeWidth={2} aria-hidden="true" />
        <span>{t("attachments.chooseFile", "Choose file")}</span>
      </div>
    </div>
  );
}
