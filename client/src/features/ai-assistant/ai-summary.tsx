import { useTranslation } from "react-i18next";
import type { AiSummaryResult } from "./ai-assistant.types";

/** Renders the structured SUMMARY result — never raw JSON. */
export function AiSummary({ summary }: { summary: AiSummaryResult }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      <Field label={t("aiAssistant.fields.issue")} value={summary.issue} />

      <div>
        <p className="text-xs font-medium text-muted-foreground">{t("aiAssistant.fields.timeline")}</p>
        {summary.timeline.length > 0 ? (
          <ul className="mt-1 space-y-1.5">
            {summary.timeline.map((item, index) => (
              <li
                key={index}
                className="relative ps-4 text-sm leading-6 text-foreground [overflow-wrap:anywhere]"
              >
                <span
                  aria-hidden="true"
                  className="absolute start-0 top-2 size-1.5 rounded-full bg-border-strong"
                />
                {item}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">{t("aiAssistant.emptyTimeline")}</p>
        )}
      </div>

      <Field label={t("aiAssistant.fields.currentState")} value={summary.currentState} />
      <Field label={t("aiAssistant.fields.recommendedNextAction")} value={summary.recommendedNextAction} />
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-foreground [overflow-wrap:anywhere]">
        {value}
      </p>
    </div>
  );
}
