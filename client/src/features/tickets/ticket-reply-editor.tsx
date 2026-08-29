import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { LexicalEditor } from "lexical";
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  CLEAR_HISTORY_COMMAND,
} from "lexical";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { ListItemNode, ListNode } from "@lexical/list";
import { AutoLinkNode, LinkNode } from "@lexical/link";
import { $generateHtmlFromNodes } from "@lexical/html";
import type { Klass, LexicalNode } from "lexical";
import type { ReactNode } from "react";
import { MAX_PUBLIC_REPLY_LENGTH, type ReplyInsertOutcome } from "./reply-insertion";
import { TicketReplyToolbar } from "./ticket-reply-toolbar";

/** Imperative surface used by the composer, Quick Reply picker, and the AI
 * "Insert into Reply" bridge. Never exposes the raw Lexical editor. */
export type TicketReplyEditorHandle = {
  hasText: () => boolean;
  getPlainText: () => string;
  /** Serialized, ready to POST as the message body. */
  getHtml: () => string;
  /** Insert plain text at the caret. Rejected (draft untouched) if the result
   * would exceed {@link MAX_PUBLIC_REPLY_LENGTH} plain-text characters. */
  insertText: (text: string) => ReplyInsertOutcome;
  /** Replace the whole draft with plain text, same length rule. */
  replaceText: (text: string) => ReplyInsertOutcome;
  focus: () => void;
  clear: () => void;
};

const EDITOR_THEME = {
  paragraph: "mb-1 last:mb-0",
  text: {
    bold: "font-semibold",
    italic: "italic",
    underline: "underline",
    strikethrough: "line-through",
  },
  list: {
    ul: "list-disc ms-5 my-1",
    ol: "list-decimal ms-5 my-1",
    listitem: "my-0.5",
  },
  link: "text-primary underline",
};

function readPlainText(editor: LexicalEditor): string {
  return editor.getEditorState().read(() => $getRoot().getTextContent());
}

/** Captures the Lexical editor instance for the parent's imperative handle and
 * keeps its editable state in sync with the `disabled` prop. */
function EditorBridge({
  editorRef,
  disabled,
  onTextChange,
}: {
  editorRef: React.MutableRefObject<LexicalEditor | null>;
  disabled: boolean;
  onTextChange?: (plainText: string) => void;
}) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    editorRef.current = editor;
    return () => {
      if (editorRef.current === editor) editorRef.current = null;
    };
  }, [editor, editorRef]);
  useEffect(() => {
    editor.setEditable(!disabled);
  }, [editor, disabled]);
  useEffect(() => {
    onTextChange?.(readPlainText(editor));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

type Props = {
  id: string;
  ariaLabel: string;
  ariaDescribedBy?: string;
  placeholder: string;
  disabled?: boolean;
  onTextChange?: (plainText: string) => void;
  /** Extra Lexical node classes to register (e.g. the internal-note `MentionNode`).
   * Kept as a prop so the mention code never enters the Customer Portal import graph. */
  extraNodes?: Klass<LexicalNode>[];
  /** Extra Lexical plugin elements rendered inside the composer (e.g. the mention typeahead). */
  extraPlugins?: ReactNode;
};

export const TicketReplyEditor = forwardRef<TicketReplyEditorHandle, Props>(function TicketReplyEditor(
  { id, ariaLabel, ariaDescribedBy, placeholder, disabled = false, onTextChange, extraNodes, extraPlugins },
  ref,
) {
  const editorRef = useRef<LexicalEditor | null>(null);

  useImperativeHandle(ref, () => {
    const withEditor = <T,>(fn: (editor: LexicalEditor) => T, fallback: T): T => {
      const editor = editorRef.current;
      return editor ? fn(editor) : fallback;
    };
    return {
      hasText: () => withEditor((editor) => readPlainText(editor).trim().length > 0, false),
      getPlainText: () => withEditor((editor) => readPlainText(editor), ""),
      getHtml: () =>
        withEditor(
          (editor) => editor.getEditorState().read(() => $generateHtmlFromNodes(editor, null)),
          "",
        ),
      insertText: (text) =>
        withEditor<ReplyInsertOutcome>((editor) => {
          if (readPlainText(editor).length + text.length > MAX_PUBLIC_REPLY_LENGTH) return "too-long";
          // Programmatic inserts (Quick Reply, AI "insert at cursor") land at the
          // end of the draft — the trigger lives outside the editor, so there is
          // no reliable live caret to splice at, and "continue where I left off"
          // is what a support agent expects.
          editor.update(
            () => {
              const root = $getRoot();
              if (root.getChildrenSize() === 0) root.append($createParagraphNode());
              root.selectEnd();
              const selection = $getSelection();
              if ($isRangeSelection(selection)) selection.insertText(text);
            },
            { discrete: true },
          );
          editor.focus();
          return "inserted";
        }, "too-long"),
      replaceText: (text) =>
        withEditor<ReplyInsertOutcome>((editor) => {
          if (text.length > MAX_PUBLIC_REPLY_LENGTH) return "too-long";
          editor.update(
            () => {
              const root = $getRoot();
              root.clear();
              const paragraph = $createParagraphNode();
              if (text) paragraph.append($createTextNode(text));
              root.append(paragraph);
              paragraph.selectEnd();
            },
            { discrete: true },
          );
          editor.focus();
          return "inserted";
        }, "too-long"),
      focus: () => withEditor((editor) => editor.focus(), undefined),
      clear: () =>
        withEditor((editor) => {
          editor.update(
            () => {
              const root = $getRoot();
              root.clear();
              root.append($createParagraphNode());
            },
            { discrete: true },
          );
          editor.dispatchCommand(CLEAR_HISTORY_COMMAND, undefined);
        }, undefined),
    };
  }, []);

  const initialConfig = {
    namespace: "ticket-reply",
    theme: EDITOR_THEME,
    editable: !disabled,
    nodes: [ListNode, ListItemNode, LinkNode, AutoLinkNode, ...(extraNodes ?? [])],
    onError: (error: Error) => {
      throw error;
    },
  };

  return (
    <div className="rounded-md border border-border bg-surface focus-within:ring-2 focus-within:ring-ring">
      <LexicalComposer initialConfig={initialConfig}>
        <TicketReplyToolbar disabled={disabled} />
        <div className="relative">
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                id={id}
                aria-label={ariaLabel}
                aria-describedby={ariaDescribedBy}
                role="textbox"
                aria-multiline="true"
                className="min-h-[7rem] max-h-60 overflow-y-auto px-3 py-2 text-sm leading-6 outline-none [overflow-wrap:anywhere]"
              />
            }
            placeholder={
              <div className="pointer-events-none absolute inset-x-3 top-2 text-sm text-muted-foreground">
                {placeholder}
              </div>
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
          <HistoryPlugin />
          <ListPlugin />
          <LinkPlugin />
          {extraPlugins}
          <OnChangePlugin
            onChange={(editorState) =>
              editorState.read(() => onTextChange?.($getRoot().getTextContent()))
            }
          />
          <EditorBridge editorRef={editorRef} disabled={disabled} onTextChange={onTextChange} />
        </div>
      </LexicalComposer>
    </div>
  );
});
