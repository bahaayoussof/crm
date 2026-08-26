import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { downloadAttachment, downloadPortalAttachment } from "./attachment-api";
import { getAttachmentError } from "./attachment-error";

type Scope = "internal" | "portal";

/**
 * Authenticated attachment download: fetch the Blob through the API client,
 * hand the browser a temporary object URL with the server-provided filename,
 * then revoke it. Prevents duplicate pending downloads and surfaces a localized
 * error. The raw response never enters persistent state.
 */
export function useAttachmentDownload(scope: Scope) {
  const { t } = useTranslation();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef<Set<string>>(new Set());

  const download = useCallback(
    async (attachment: { id: string; fileName: string }) => {
      if (inFlight.current.has(attachment.id)) return;
      inFlight.current.add(attachment.id);
      setPendingId(attachment.id);
      setError(null);
      try {
        const fetcher = scope === "portal" ? downloadPortalAttachment : downloadAttachment;
        const { blob, fileName } = await fetcher(attachment.id, attachment.fileName);
        const objectUrl = URL.createObjectURL(blob);
        try {
          const link = document.createElement("a");
          link.href = objectUrl;
          link.download = fileName || attachment.fileName || "file";
          link.rel = "noopener";
          document.body.appendChild(link);
          link.click();
          link.remove();
        } finally {
          URL.revokeObjectURL(objectUrl);
        }
      } catch (caught) {
        setError(getAttachmentError(caught, "attachments.downloadFailure", t));
      } finally {
        inFlight.current.delete(attachment.id);
        setPendingId((current) => (current === attachment.id ? null : current));
      }
    },
    [scope, t],
  );

  return { download, pendingId, error, clearError: () => setError(null) };
}
