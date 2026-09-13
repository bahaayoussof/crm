import { forwardRef } from "react";
import { Controller, type Control } from "react-hook-form";
import { TicketReplyEditor, type TicketReplyEditorHandle } from "@/features/tickets/ticket-reply-editor";
import type { QuickReplyFormValues } from "./quick-reply.schemas";

/**
 * The Quick Reply "Reply text" field: the shared ticket reply/note Lexical
 * editor (`TicketReplyEditor`), wired into react-hook-form through a
 * `Controller` since it is not a native `<input>`/`<textarea>`. One component
 * shared by the Create and Edit routes (both render `QuickReplyFormPage`) so create/edit never diverge
 * (mirrors the Knowledge Base article form's `Controller` + editor wiring).
 *
 * The editor is uncontrolled (Lexical owns its own state) — react-hook-form
 * only ever receives its serialized HTML via `onChange`. Hydrating existing
 * content (Edit) is the caller's job via the forwarded `TicketReplyEditorHandle`
 * ref (`ref.current.setHtml(...)`).
 */
export const QuickReplyBodyField = forwardRef<
  TicketReplyEditorHandle,
  {
    id: string;
    control: Control<QuickReplyFormValues>;
    ariaLabel: string;
    ariaDescribedBy?: string;
    ariaInvalid?: boolean;
    placeholder?: string;
    disabled?: boolean;
    editorHeightClassName?: string;
  }
>(function QuickReplyBodyField(
  { id, control, ariaLabel, ariaDescribedBy, ariaInvalid, placeholder, disabled, editorHeightClassName },
  ref,
) {
  return (
    <Controller
      name="body"
      control={control}
      render={({ field }) => (
        <TicketReplyEditor
          ref={ref}
          id={id}
          ariaLabel={ariaLabel}
          ariaDescribedBy={ariaDescribedBy}
          ariaInvalid={ariaInvalid}
          placeholder={placeholder ?? ""}
          disabled={disabled}
          editorHeightClassName={editorHeightClassName}
          onChange={(html) => field.onChange(html)}
        />
      )}
    />
  );
});
