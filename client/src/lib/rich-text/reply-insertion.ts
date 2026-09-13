/**
 * Shared constraints for the reply-style Lexical editor.
 *
 * The editor (`@/components/shared/rich-text/rich-text-editor`) enforces this
 * limit against the resulting plain-text length for every insertion path
 * (typing, Quick Reply insertion, AI Suggested Reply). There is no
 * string-splice path any more.
 */

/** Maximum plain-text length of a public reply (documented in docs/18 §16). */
export const MAX_PUBLIC_REPLY_LENGTH = 20_000;

export type ReplyInsertOutcome = "inserted" | "too-long";
