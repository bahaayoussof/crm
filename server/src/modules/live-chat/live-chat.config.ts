/**
 * Live Chat lifecycle configuration — the single server-side source of truth for
 * the inactivity policy. The client never controls these values.
 *
 * V1 policy: an ACTIVE live chat that has already received at least one public
 * staff reply is auto-resolved after {@link LIVE_CHAT_INACTIVITY_MINUTES} of
 * conversation inactivity (newest `TicketMessage.createdAt`). An unanswered chat
 * (`firstRespondedAt == null`) is NEVER auto-resolved — it stays active and keeps
 * flowing through the existing SLA / escalation automation.
 *
 * Optional future work: expose this as Settings → Live Chat → inactivity timeout.
 * Not required for V1.
 */
export const LIVE_CHAT_INACTIVITY_MINUTES = 30;

/**
 * Bounded batch per inactivity sweep so a backlog can never stall the cron
 * request. Mirrors `SLA_MONITOR_BATCH_SIZE` / `TASK_REMINDER_BATCH_SIZE`.
 */
export const LIVE_CHAT_INACTIVITY_BATCH_SIZE = 100;
