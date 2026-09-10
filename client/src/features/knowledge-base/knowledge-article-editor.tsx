import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { LexicalEditor } from "lexical";
import {
  $createLineBreakNode,
  $createParagraphNode,
  $createTextNode,
  $getRoot,
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
import { LinkNode } from "@lexical/link";
import { HeadingNode } from "@lexical/rich-text";
import { $generateHtmlFromNodes, $generateNodesFromDOM } from "@lexical/html";
import { LOOKS_LIKE_ARTICLE_HTML } from "@/lib/rich-text/article-html";
import { KnowledgeArticleEditorToolbar } from "./knowledge-article-editor-toolbar";

/** Imperative surface for the article form. Never exposes the raw Lexical
 * editor. `getHtml()` output is untrusted until the server re-sanitizes it. */
export type KnowledgeArticleEditorHandle = {
  hasText: () => boolean;
  getPlainText: () => string;
  /** Serialized body HTML, ready to send as `content`. */
  getHtml: () => string;
  /** Hydrate from a stored body: rich sanitized HTML, or a legacy plain-text
   * body (split into paragraphs on blank lines, single newlines kept as
   * line breaks). */
  setHtml: (value: string) => void;
  focus: () => void;
};

const EDITOR_THEME = {
  paragraph: "mb-2 last:mb-0",
  heading: {
    h2: "mt-4 mb-2 text-base font-semibold",
    h3: "mt-3 mb-1.5 text-sm font-semibold",
  },
  text: {
    bold: "font-semibold",
    italic: "italic",
    underline: "underline",
  },
  list: {
    ul: "list-disc ms-5 my-2",
    ol: "list-decimal ms-5 my-2",
    listitem: "my-0.5",
  },
  link: "text-primary underline",
};

function readPlainText(editor: LexicalEditor): string {
  return editor.getEditorState().read(() => $getRoot().getTextContent());
}

function hydrate(editor: LexicalEditor, value: string) {
  editor.update(
    () => {
      const root = $getRoot();
      root.clear();

      if (value && LOOKS_LIKE_ARTICLE_HTML.test(value)) {
        const dom = new DOMParser().parseFromString(value, "text/html");
        const nodes = $generateNodesFromDOM(editor, dom);
        if (nodes.length) {
          root.append(...nodes);
        } else {
          root.append($createParagraphNode());
        }
      } else {
        // Legacy plain text → paragraphs on blank lines, single newlines as
        // line breaks so structure survives the conversion (RT-2.4 / BC-3).
        const blocks = value.split(/\n{2,}/);
        for (const block of blocks) {
          const paragraph = $createParagraphNode();
          const lines = block.split(/\r?\n/);
          lines.forEach((line, index) => {
            if (index > 0) paragraph.append($createLineBreakNode());
            if (line) paragraph.append($createTextNode(line));
          });
          root.append(paragraph);
        }
        if (root.getChildrenSize() === 0) root.append($createParagraphNode());
      }
    },
    { discrete: true },
  );
  editor.dispatchCommand(CLEAR_HISTORY_COMMAND, undefined);
}

function EditorBridge({
  editorRef,
  disabled,
}: {
  editorRef: React.MutableRefObject<LexicalEditor | null>;
  disabled: boolean;
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
  return null;
}

type Props = {
  id: string;
  ariaLabel: string;
  ariaDescribedBy?: string;
  ariaInvalid?: boolean;
  placeholder?: string;
  disabled?: boolean;
  onChange?: (html: string, plainText: string) => void;
};

export const KnowledgeArticleEditor = forwardRef<KnowledgeArticleEditorHandle, Props>(
  function KnowledgeArticleEditor(
    { id, ariaLabel, ariaDescribedBy, ariaInvalid, placeholder, disabled = false, onChange },
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
        setHtml: (value) => withEditor((editor) => hydrate(editor, value ?? ""), undefined),
        focus: () => withEditor((editor) => editor.focus(), undefined),
      };
    }, []);

    const initialConfig = {
      namespace: "knowledge-article",
      theme: EDITOR_THEME,
      editable: !disabled,
      nodes: [HeadingNode, ListNode, ListItemNode, LinkNode],
      onError: (error: Error) => {
        throw error;
      },
    };

    return (
      <div className="rounded-md border border-border bg-surface focus-within:ring-2 focus-within:ring-ring">
        <LexicalComposer initialConfig={initialConfig}>
          <KnowledgeArticleEditorToolbar disabled={disabled} />
          <div className="relative">
            <RichTextPlugin
              contentEditable={
                <ContentEditable
                  id={id}
                  dir="auto"
                  aria-label={ariaLabel}
                  aria-describedby={ariaDescribedBy}
                  aria-invalid={ariaInvalid}
                  role="textbox"
                  aria-multiline="true"
                  className="min-h-64 max-h-[32rem] overflow-y-auto px-3 py-2 text-sm leading-7 outline-none [overflow-wrap:anywhere]"
                />
              }
              placeholder={
                placeholder ? (
                  <div className="pointer-events-none absolute inset-x-3 top-2 text-sm text-muted-foreground">
                    {placeholder}
                  </div>
                ) : null
              }
              ErrorBoundary={LexicalErrorBoundary}
            />
            <HistoryPlugin />
            <ListPlugin />
            <LinkPlugin />
            <OnChangePlugin
              onChange={(editorState, editor) =>
                onChange?.(
                  editorState.read(() => $generateHtmlFromNodes(editor, null)),
                  editorState.read(() => $getRoot().getTextContent()),
                )
              }
            />
            <EditorBridge editorRef={editorRef} disabled={disabled} />
          </div>
        </LexicalComposer>
      </div>
    );
  },
);
