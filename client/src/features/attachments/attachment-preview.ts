import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { downloadAttachment, downloadPortalAttachment } from "./attachment-api";
import { getAttachmentError } from "./attachment-error";

type Scope = "internal" | "portal";

export type PreviewKind = "image" | "pdf" | "text" | "unsupported";
export type PreviewStatus = "idle" | "loading" | "ready" | "error";

export interface PreviewTarget {
  id: string;
  fileName: string;
  mimeType: string;
}

export interface PreviewState {
  open: boolean;
  target: PreviewTarget | null;
  status: PreviewStatus;
  kind: PreviewKind | null;
  /** Temporary authenticated object URL for image / PDF previews. Never a provider URL. */
  objectUrl: string | null;
  /** Decoded text for plain-text previews. Rendered escaped, never as HTML. */
  text: string | null;
  error: string | null;
}

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const TEXT_PREVIEW_LIMIT = 1_000_000;

/** Decode a Blob to text. Prefers the native method; falls back to FileReader. */
function readBlobText(blob: Blob): Promise<string> {
  if (typeof blob.text === "function") return blob.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the file"));
    reader.readAsText(blob);
  });
}

export function classifyPreview(mimeType: string): PreviewKind {
  if (IMAGE_TYPES.includes(mimeType)) return "image";
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType === "text/plain") return "text";
  return "unsupported";
}

const CLOSED: PreviewState = { open: false, target: null, status: "idle", kind: null, objectUrl: null, text: null, error: null };

/**
 * Preview an authorized attachment as a temporary in-memory browser Blob URL
 * (image / PDF) or decoded text. The object URL is revoked when the dialog
 * closes, the previewed file changes, or the component unmounts. No provider URL,
 * storage key, or token is involved; nothing is written to persistent state or
 * the query cache.
 */
export function useAttachmentPreview(scope: Scope) {
  const { t } = useTranslation();
  const [state, setState] = useState<PreviewState>(CLOSED);
  const objectUrlRef = useRef<string | null>(null);
  const requestId = useRef(0);
  const loadingIdRef = useRef<string | null>(null);

  const revoke = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  const openPreview = useCallback(
    async (attachment: PreviewTarget) => {
      if (loadingIdRef.current === attachment.id) return; // duplicate request for the same file
      const id = ++requestId.current;
      loadingIdRef.current = attachment.id;
      revoke();
      setState({
        open: true,
        target: attachment,
        status: "loading",
        kind: classifyPreview(attachment.mimeType),
        objectUrl: null,
        text: null,
        error: null,
      });
      try {
        const fetcher = scope === "portal" ? downloadPortalAttachment : downloadAttachment;
        const { blob } = await fetcher(attachment.id, attachment.fileName);
        if (id !== requestId.current) return; // a newer preview superseded this one
        const kind = classifyPreview(attachment.mimeType);
        if (kind === "image" || kind === "pdf") {
          const objectUrl = URL.createObjectURL(blob);
          objectUrlRef.current = objectUrl;
          setState((s) => ({ ...s, status: "ready", kind, objectUrl }));
        } else if (kind === "text") {
          const raw = await readBlobText(blob);
          if (id !== requestId.current) return;
          setState((s) => ({ ...s, status: "ready", kind, text: raw.slice(0, TEXT_PREVIEW_LIMIT) }));
        } else {
          setState((s) => ({ ...s, status: "ready", kind: "unsupported" }));
        }
      } catch (caught) {
        if (id !== requestId.current) return;
        setState((s) => ({ ...s, status: "error", error: getAttachmentError(caught, "attachments.previewFailed", t) }));
      } finally {
        if (loadingIdRef.current === attachment.id) loadingIdRef.current = null;
      }
    },
    [revoke, scope, t],
  );

  const close = useCallback(() => {
    requestId.current += 1;
    loadingIdRef.current = null;
    revoke();
    setState(CLOSED);
  }, [revoke]);

  const retry = useCallback(() => {
    if (state.target) void openPreview(state.target);
  }, [openPreview, state.target]);

  useEffect(() => revoke, [revoke]); // revoke on unmount

  return { state, openPreview, close, retry };
}
