import { Fragment, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { formatDurationParts } from "./report-format";

/**
 * Renders a report duration value. Each number+unit segment is its own `<bdi>`
 * (isolated from the surrounding text direction, never wraps internally); a real
 * space between segments lets the value break onto a second line gracefully in a
 * narrow card instead of splitting a number from its unit.
 */
export function Duration({ minutes, className }: { minutes: number | null; className?: string }) {
  const { t, i18n } = useTranslation();
  const nf = useMemo(
    () => new Intl.NumberFormat(i18n.language === "ar" ? "ar-EG" : "en-US"),
    [i18n.language],
  );
  const parts = formatDurationParts(minutes, t, nf);

  return (
    <span className={cn("tabular-nums", className)}>
      {parts.map((part, index) => (
        <Fragment key={index}>
          {index > 0 ? " " : null}
          <bdi className="whitespace-nowrap">{part}</bdi>
        </Fragment>
      ))}
    </span>
  );
}
