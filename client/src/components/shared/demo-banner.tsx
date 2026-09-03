import { useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { isDemoMode } from "@/lib/demo";

const DISMISS_KEY = "crm_demo_banner_dismissed";

function readDismissed(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === "true";
  } catch {
    return false;
  }
}

/**
 * Lightweight global "this is a demo" indicator. Fixed to the bottom-centre so
 * it never eats layout space or fights the sticky app header. Renders only when
 * the client is built with `VITE_DEMO_MODE=true`; dismissible for the session.
 */
export function DemoBanner() {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(readDismissed);

  if (!isDemoMode || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, "true");
    } catch {
      // storage unavailable — dismiss for this render only
    }
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-3 z-50 flex justify-center px-3">
      <div
        role="status"
        className="pointer-events-auto flex max-w-[92vw] items-center gap-2.5 rounded-full border border-warning-soft bg-warning-soft/95 px-3.5 py-1.5 text-xs text-warning-soft-foreground shadow-subtle backdrop-blur"
      >
        <span className="inline-block size-1.5 shrink-0 rounded-full bg-warning" aria-hidden />
        <span className="font-medium">{t("demo.banner.title")}</span>
        <span className="hidden text-warning-soft-foreground/80 sm:inline">{t("demo.banner.detail")}</span>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t("demo.banner.dismiss")}
          className="ms-0.5 rounded-full p-0.5 text-warning-soft-foreground/70 transition hover:bg-warning/15 hover:text-warning-soft-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning/40"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
