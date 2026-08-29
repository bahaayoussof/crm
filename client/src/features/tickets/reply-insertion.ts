/**
 * Shared constraints for the public-reply composer.
 *
 * The composer is a Lexical rich-text editor; insertion (Quick Reply, AI
 * Suggested Reply) happens through the editor's imperative handle
 * (`ticket-reply-editor.tsx`), which enforces this limit against the resulting
 * plain-text length. There is no string-splice path any more.
 */

/** Maximum plain-text length of a public reply (documented in docs/18 §16). */
export const MAX_PUBLIC_REPLY_LENGTH = 20_000;

export type ReplyInsertOutcome = "inserted" | "too-long";
