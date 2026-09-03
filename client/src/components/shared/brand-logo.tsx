import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

type BrandLogoVariant = "full" | "icon";

type BrandLogoProps = {
  /** `full` = horizontal wordmark (auth, expanded chrome); `icon` = square mark (collapsed / tight spaces). */
  variant?: BrandLogoVariant;
  className?: string;
  /**
   * Accessible name for the image. Defaults to the localized app title.
   * Pass `""` when adjacent text already communicates the brand (avoids a redundant
   * screen-reader announcement).
   */
  alt?: string;
};

const SRC: Record<BrandLogoVariant, string> = {
  full: "/brand/crm-logo.png",
  icon: "/brand/crm-icon.png",
};

/**
 * Static brand mark for the current CRM logo assets under `client/public/brand/`.
 * Display size is controlled entirely by `className`; the image keeps its aspect
 * ratio via `object-contain` and never flips in RTL.
 */
export function BrandLogo({ variant = "full", className, alt }: BrandLogoProps) {
  const { t } = useTranslation();

  return (
    <img
      src={SRC[variant]}
      alt={alt ?? t("app.title")}
      className={cn("block w-auto max-w-full select-none object-contain", className)}
      draggable={false}
    />
  );
}
