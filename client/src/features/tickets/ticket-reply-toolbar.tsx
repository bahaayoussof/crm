import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Bold, Italic, Link2, List, ListOrdered, Redo2, Underline, Undo2 } from "lucide-react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getNearestNodeOfType, mergeRegister } from "@lexical/utils";
import {
  $isListNode,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  ListNode,
  REMOVE_LIST_COMMAND,
} from "@lexical/list";
import { $isLinkNode, TOGGLE_LINK_COMMAND } from "@lexical/link";
import {
  $getSelection,
  $isRangeSelection,
  CAN_REDO_COMMAND,
  CAN_UNDO_COMMAND,
  COMMAND_PRIORITY_LOW,
  FORMAT_TEXT_COMMAND,
  REDO_COMMAND,
  SELECTION_CHANGE_COMMAND,
  UNDO_COMMAND,
} from "lexical";
import type { LucideIcon } from "lucide-react";

/**
 * Minimal formatting toolbar for the public-reply Lexical editor: emphasis,
 * lists, link, and history. Icon-only buttons with accessible labels and
 * `aria-pressed` for the toggle formats. No headings, code blocks, tables, or
 * markdown — support replies only.
 */
export function TicketReplyToolbar({ disabled = false }: { disabled?: boolean }) {
  const { t } = useTranslation();
  const [editor] = useLexicalComposerContext();
  const [bold, setBold] = useState(false);
  const [italic, setItalic] = useState(false);
  const [underline, setUnderline] = useState(false);
  const [link, setLink] = useState(false);
  const [listType, setListType] = useState<"bullet" | "number" | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const sync = useCallback(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return;
    setBold(selection.hasFormat("bold"));
    setItalic(selection.hasFormat("italic"));
    setUnderline(selection.hasFormat("underline"));
    const anchorNode = selection.anchor.getNode();
    const element =
      anchorNode.getKey() === "root" ? anchorNode : anchorNode.getTopLevelElementOrThrow();
    const listNode = $getNearestNodeOfType(anchorNode, ListNode);
    setListType(
      $isListNode(listNode)
        ? listNode.getListType() === "number"
          ? "number"
          : "bullet"
        : $isListNode(element)
          ? element.getListType() === "number"
            ? "number"
            : "bullet"
          : null,
    );
    const parent = anchorNode.getParent();
    setLink($isLinkNode(parent) || $isLinkNode(anchorNode));
  }, []);

  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => editorState.read(sync)),
      editor.registerCommand(SELECTION_CHANGE_COMMAND, () => { sync(); return false; }, COMMAND_PRIORITY_LOW),
      editor.registerCommand(CAN_UNDO_COMMAND, (payload) => { setCanUndo(payload); return false; }, COMMAND_PRIORITY_LOW),
      editor.registerCommand(CAN_REDO_COMMAND, (payload) => { setCanRedo(payload); return false; }, COMMAND_PRIORITY_LOW),
    );
  }, [editor, sync]);

  const toggleList = (type: "bullet" | "number") => {
    if (listType === type) {
      editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
    } else {
      editor.dispatchCommand(
        type === "bullet" ? INSERT_UNORDERED_LIST_COMMAND : INSERT_ORDERED_LIST_COMMAND,
        undefined,
      );
    }
  };

  const toggleLink = () => {
    if (link) {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
      return;
    }
    const url = window.prompt(t("tickets.conversation.editor.linkPrompt"));
    if (!url) return;
    const safe = /^(https?:|mailto:)/i.test(url) ? url : `https://${url}`;
    editor.dispatchCommand(TOGGLE_LINK_COMMAND, safe);
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-border px-1.5 py-1" role="toolbar" aria-label={t("tickets.conversation.editor.toolbarLabel")}>
      <ToolbarButton icon={Bold} label={t("tickets.conversation.editor.bold")} pressed={bold} disabled={disabled} onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold")} />
      <ToolbarButton icon={Italic} label={t("tickets.conversation.editor.italic")} pressed={italic} disabled={disabled} onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic")} />
      <ToolbarButton icon={Underline} label={t("tickets.conversation.editor.underline")} pressed={underline} disabled={disabled} onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline")} />
      <Divider />
      <ToolbarButton icon={List} label={t("tickets.conversation.editor.bulletList")} pressed={listType === "bullet"} disabled={disabled} onClick={() => toggleList("bullet")} />
      <ToolbarButton icon={ListOrdered} label={t("tickets.conversation.editor.numberList")} pressed={listType === "number"} disabled={disabled} onClick={() => toggleList("number")} />
      <ToolbarButton icon={Link2} label={t("tickets.conversation.editor.link")} pressed={link} disabled={disabled} onClick={toggleLink} />
      <Divider />
      <ToolbarButton icon={Undo2} label={t("tickets.conversation.editor.undo")} disabled={disabled || !canUndo} onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)} />
      <ToolbarButton icon={Redo2} label={t("tickets.conversation.editor.redo")} disabled={disabled || !canRedo} onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)} />
    </div>
  );
}

function Divider() {
  return <span className="mx-0.5 h-5 w-px shrink-0 bg-border" aria-hidden="true" />;
}

function ToolbarButton({
  icon: Icon,
  label,
  pressed,
  disabled,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  pressed?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-45 ${
        pressed ? "bg-surface-hover text-foreground" : ""
      }`}
      aria-label={label}
      aria-pressed={pressed === undefined ? undefined : pressed}
      title={label}
      disabled={disabled}
      // keep focus in the editor so the command applies to the current selection
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      <Icon className="size-4" strokeWidth={1.75} aria-hidden="true" />
    </button>
  );
}
