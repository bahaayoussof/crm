import * as React from "react";
import { useTranslation } from "react-i18next";
import { Clock } from "lucide-react";
import { AppSelect } from "@/components/ui/app-select";
import { formatTwoDigits } from "./date-picker-utils";

export interface TimeValue {
  hours: number;
  minutes: number;
}

export interface TimeFieldProps {
  value: TimeValue;
  onChange: (value: TimeValue) => void;
  /** Minute granularity for the minute selector. Default: 5. */
  minuteStep?: number;
  disabled?: boolean;
  className?: string;
}

/**
 * Compact hour : minute control built from the shared `AppSelect` so it inherits
 * the CRM select surface, dark mode, and RTL handling. 24-hour input; the trigger
 * label elsewhere renders the locale-aware 12/24h display via `Intl`.
 */
export function TimeField({
  value,
  onChange,
  minuteStep = 5,
  disabled,
  className,
}: TimeFieldProps) {
  const { t, i18n } = useTranslation();
  const language = i18n.language;

  const hourOptions = React.useMemo(
    () =>
      Array.from({ length: 24 }, (_, hour) => ({
        value: String(hour),
        label: formatTwoDigits(hour, language),
      })),
    [language],
  );

  const minuteOptions = React.useMemo(() => {
    const step = Math.max(1, Math.min(30, minuteStep));
    const options = [];
    for (let minute = 0; minute < 60; minute += step) {
      options.push({ value: String(minute), label: formatTwoDigits(minute, language) });
    }
    // Keep an out-of-step current minute selectable so existing values render.
    if (!options.some((option) => option.value === String(value.minutes))) {
      options.push({
        value: String(value.minutes),
        label: formatTwoDigits(value.minutes, language),
      });
      options.sort((a, b) => Number(a.value) - Number(b.value));
    }
    return options;
  }, [minuteStep, language, value.minutes]);

  return (
    <div className={className}>
      <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Clock className="size-3.5" strokeWidth={1.75} aria-hidden />
        {t("datePicker.time")}
      </span>
      <div className="flex items-center gap-2">
        <AppSelect
          ariaLabel={t("datePicker.hours")}
          value={String(value.hours)}
          onValueChange={(next) => onChange({ ...value, hours: Number(next) })}
          options={hourOptions}
          disabled={disabled}
          className="w-[4.5rem]"
        />
        <span aria-hidden className="text-sm font-semibold text-muted-foreground">
          :
        </span>
        <AppSelect
          ariaLabel={t("datePicker.minutes")}
          value={String(value.minutes)}
          onValueChange={(next) => onChange({ ...value, minutes: Number(next) })}
          options={minuteOptions}
          disabled={disabled}
          className="w-[4.5rem]"
        />
      </div>
    </div>
  );
}
