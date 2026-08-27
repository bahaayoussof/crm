import { useTranslation } from "react-i18next";
import { useTheme, type Theme } from "@/lib/theme-provider";
import { cn } from "@/lib/utils";
import { Sun, Moon, Monitor } from "lucide-react";

interface ThemeToggleProps {
  className?: string;
  variant?: "segmented" | "menu";
}

export function ThemeToggle({ className, variant = "segmented" }: ThemeToggleProps) {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();

  const options: { value: Theme; labelKey: string; icon: typeof Sun }[] = [
    { value: "light", labelKey: "theme.light", icon: Sun },
    { value: "system", labelKey: "theme.system", icon: Monitor },
    { value: "dark", labelKey: "theme.dark", icon: Moon },
  ];

  if (variant === "menu") {
    return (
      <div className={cn("flex flex-col gap-1 py-1", className)}>
        <span className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t("theme.title")}
        </span>
        <div className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-surface-secondary p-1">
          {options.map(({ value, labelKey, icon: Icon }) => {
            const isSelected = theme === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setTheme(value)}
                aria-pressed={isSelected}
                title={t(labelKey)}
                aria-label={t(labelKey)}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-all outline-none",
                  "focus-visible:ring-2 focus-visible:ring-ring",
                  isSelected
                    ? "bg-surface text-foreground shadow-xs"
                    : "text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                )}
              >
                <Icon className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                <span className="text-[11px]">{t(labelKey)}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-label={t("theme.title")}
      className={cn(
        "inline-flex items-center rounded-lg border border-border bg-surface p-0.5 shadow-2xs",
        className
      )}
    >
      {options.map(({ value, labelKey, icon: Icon }) => {
        const isSelected = theme === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => setTheme(value)}
            aria-pressed={isSelected}
            title={t(labelKey)}
            aria-label={t(labelKey)}
            className={cn(
              "flex size-7 items-center justify-center rounded-md text-xs font-medium transition-colors outline-none",
              "focus-visible:ring-2 focus-visible:ring-ring",
              isSelected
                ? "bg-surface-active text-foreground font-semibold shadow-2xs"
                : "text-muted-foreground hover:bg-surface-hover hover:text-foreground"
            )}
          >
            <Icon className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
