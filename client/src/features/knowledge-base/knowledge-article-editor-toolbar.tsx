import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Bold,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  Pilcrow,
  Redo2,
  Underline,
  Undo2,
} from "lucide-react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getNearestNodeOfType, mergeRegister } from "@lexical/utils";
import {
  $isListNode,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  ListNode,
  REMOVE_LIST_COMMAND,
} from "@lexical/list";
import { $createHeadingNode, $isHeadingNode } from "@lexical/rich-text";
import { $setBlocksType } from "@lexical/selection";
import { $createLinkNode, $isLinkNode, LinkNode, TOGGLE_LINK_COMMAND } from "@lexical/link";
import {
  $createParagraphNode,
  $createTextNode,
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $isElementNode,
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
import { RichTextLinkPopover } from "@/components/shared/rich-text/rich-text-link-popover";
import type { LinkPopoverData, LinkSubmitPayload } from "@/components/shared/rich-text/rich-text-link.utils";

type BlockType = "paragraph" | "h2" | "h3";

/**
 * Bounded formatting toolbar for the Knowledge Base article editor. Mirrors the
 * ticket reply toolbar (emphasis / lists / link / history) and adds the two
 * heading levels the article body allows — H2 (section) and H3 (sub-section);
 * the article page owns the H1. No other control: no code, tables, quotes,
 * colour, alignment, or media (RT-1.3 / RT-1.4).
 */
export function KnowledgeArticleEditorToolbar({ disabled = false }: { disabled?: boolean }) {
  const { t } = useTranslation();
  const [editor] = useLexicalComposerContext();
  const [bold, setBold] = useState(false);
  const [italic, setItalic] = useState(false);
  const [underline, setUnderline] = useState(false);
  const [link, setLink] = useState(false);
  const [blockType, setBlockType] = useState<BlockType>("paragraph");
  const [listType, setListType] = useState<"bullet" | "number" | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false);
  const [linkData, setLinkData] = useState<LinkPopoverData>({
    url: "",
    text: "",
    openInNewTab: true,
    isExisting: false,
  });
  const [linkNodeKey, setLinkNodeKey] = useState<string | null>(null);
  const linkButtonRef = useRef<HTMLButtonElement>(null);

  const sync = useCallback(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return;
    setBold(selection.hasFormat("bold"));
    setItalic(selection.hasFormat("italic"));
    setUnderline(selection.hasFormat("underline"));
    const anchorNode = selection.anchor.getNode();
    const element =
      anchorNode.getKey() === "root" ? anchorNode : anchorNode.getTopLevelElementOrThrow();
    if ($isHeadingNode(element)) {
      setBlockType(element.getTag() === "h3" ? "h3" : "h2");
    } else {
      setBlockType("paragraph");
    }
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

  const applyBlock = (next: BlockType) => {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      if (next === "paragraph" || blockType === next) {
        $setBlocksType(selection, () => $createParagraphNode());
      } else {
        $setBlocksType(selection, () => $createHeadingNode(next));
      }
    });
  };

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

  const handleOpenLinkPopover = () => {
    if (linkPopoverOpen) {
      setLinkPopoverOpen(false);
      return;
    }
    let initialUrl = "";
    let initialText = "";
    let initialOpenInNewTab = true;
    let isExisting = false;
    let targetKey: string | null = null;

    editor.getEditorState().read(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        initialText = selection.getTextContent();
        const anchorNode = selection.anchor.getNode();
        const parent = anchorNode.getParent();
        const targetLinkNode = $isLinkNode(anchorNode)
          ? anchorNode
          : $isLinkNode(parent)
            ? parent
            : $getNearestNodeOfType(anchorNode, LinkNode);
        if ($isLinkNode(targetLinkNode)) {
          isExisting = true;
          initialUrl = targetLinkNode.getURL();
          initialText = targetLinkNode.getTextContent();
          initialOpenInNewTab = targetLinkNode.getTarget() === "_blank";
          targetKey = targetLinkNode.getKey();
        }
      }
    });

    setLinkData({ url: initialUrl, text: initialText, openInNewTab: initialOpenInNewTab, isExisting });
    setLinkNodeKey(targetKey);
    setLinkPopoverOpen(true);
  };

  const handleInsertLink = ({ url, text, openInNewTab }: LinkSubmitPayload) => {
    editor.update(
      () => {
        const target = openInNewTab ? "_blank" : null;
        const rel = openInNewTab ? "noopener noreferrer" : null;

        if (linkData.isExisting && linkNodeKey) {
          const node = $getNodeByKey(linkNodeKey);
          if ($isLinkNode(node)) {
            node.setURL(url);
            node.setTarget(target);
            node.setRel(rel);
            const currentText = node.getTextContent();
            if (text && text !== currentText) {
              node.clear();
              node.append($createTextNode(text));
            }
            return;
          }
        }

        let selection = $getSelection();
        if ($isRangeSelection(selection) && !selection.isCollapsed()) {
          const selectedText = selection.getTextContent();
          if (!text || text === selectedText) {
            editor.dispatchCommand(TOGGLE_LINK_COMMAND, { url, target, rel });
            return;
          }
        }

        const root = $getRoot();
        if (root.getChildrenSize() === 0) root.append($createParagraphNode());
        let paragraph = root.getFirstChild();
        if (!$isElementNode(paragraph)) {
          paragraph = $createParagraphNode();
          root.append(paragraph);
        }
        if (!$isRangeSelection(selection) || selection.anchor.getNode().getKey() === "root") {
          paragraph.selectEnd();
          selection = $getSelection();
        }

        const textToDisplay = text || url;
        const linkNode = $createLinkNode(url, { target, rel });
        linkNode.append($createTextNode(textToDisplay));
        if ($isRangeSelection(selection)) {
          selection.insertNodes([linkNode]);
        } else if ($isElementNode(paragraph)) {
          paragraph.append(linkNode);
        }
      },
      { discrete: true },
    );
    setLinkPopoverOpen(false);
    editor.focus();
  };

  const handleRemoveLink = () => {
    editor.update(
      () => {
        if (linkNodeKey) {
          const node = $getNodeByKey(linkNodeKey);
          if ($isLinkNode(node)) {
            for (const child of node.getChildren()) node.insertBefore(child);
            node.remove();
            return;
          }
        }
        editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
      },
      { discrete: true },
    );
    setLinkPopoverOpen(false);
    editor.focus();
  };

  const handleClosePopover = () => {
    setLinkPopoverOpen(false);
    editor.focus();
  };

  return (
    <div
      className="flex flex-wrap items-center gap-0.5 border-b border-border px-1.5 py-1"
      role="toolbar"
      aria-label={t("knowledgeBase.editor.toolbarLabel")}
    >
      <ToolbarButton icon={Pilcrow} label={t("knowledgeBase.editor.paragraph")} pressed={blockType === "paragraph"} disabled={disabled} onClick={() => applyBlock("paragraph")} />
      <ToolbarButton icon={Heading2} label={t("knowledgeBase.editor.heading2")} pressed={blockType === "h2"} disabled={disabled} onClick={() => applyBlock("h2")} />
      <ToolbarButton icon={Heading3} label={t("knowledgeBase.editor.heading3")} pressed={blockType === "h3"} disabled={disabled} onClick={() => applyBlock("h3")} />
      <Divider />
      <ToolbarButton icon={Bold} label={t("knowledgeBase.editor.bold")} pressed={bold} disabled={disabled} onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold")} />
      <ToolbarButton icon={Italic} label={t("knowledgeBase.editor.italic")} pressed={italic} disabled={disabled} onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic")} />
      <ToolbarButton icon={Underline} label={t("knowledgeBase.editor.underline")} pressed={underline} disabled={disabled} onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline")} />
      <Divider />
      <ToolbarButton icon={List} label={t("knowledgeBase.editor.bulletList")} pressed={listType === "bullet"} disabled={disabled} onClick={() => toggleList("bullet")} />
      <ToolbarButton icon={ListOrdered} label={t("knowledgeBase.editor.numberList")} pressed={listType === "number"} disabled={disabled} onClick={() => toggleList("number")} />
      <ToolbarButton
        ref={linkButtonRef}
        icon={Link2}
        label={t("knowledgeBase.editor.link")}
        pressed={link}
        disabled={disabled}
        ariaHasPopup="dialog"
        ariaExpanded={linkPopoverOpen}
        preventMouseDown={false}
        onClick={handleOpenLinkPopover}
      />
      <Divider />
      <ToolbarButton icon={Undo2} label={t("knowledgeBase.editor.undo")} disabled={disabled || !canUndo} onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)} />
      <ToolbarButton icon={Redo2} label={t("knowledgeBase.editor.redo")} disabled={disabled || !canRedo} onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)} />

      <RichTextLinkPopover
        open={linkPopoverOpen}
        triggerRef={linkButtonRef}
        initialData={linkData}
        onSubmit={handleInsertLink}
        onRemove={linkData.isExisting ? handleRemoveLink : undefined}
        onClose={handleClosePopover}
      />
    </div>
  );
}

function Divider() {
  return <span className="mx-0.5 h-5 w-px shrink-0 bg-border" aria-hidden="true" />;
}

function ToolbarButton({
  ref,
  icon: Icon,
  label,
  pressed,
  disabled,
  ariaHasPopup,
  ariaExpanded,
  preventMouseDown = true,
  onClick,
}: {
  ref?: React.Ref<HTMLButtonElement>;
  icon: LucideIcon;
  label: string;
  pressed?: boolean;
  disabled?: boolean;
  ariaHasPopup?: boolean | "dialog" | "menu" | "listbox" | "tree" | "grid";
  ariaExpanded?: boolean;
  preventMouseDown?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      ref={ref}
      type="button"
      className={`inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-45 ${
        pressed ? "bg-surface-hover text-foreground" : ""
      }`}
      aria-label={label}
      aria-pressed={pressed === undefined ? undefined : pressed}
      aria-haspopup={ariaHasPopup}
      aria-expanded={ariaExpanded}
      title={label}
      disabled={disabled}
      onMouseDown={preventMouseDown ? (event) => event.preventDefault() : undefined}
      onClick={onClick}
    >
      <Icon className="size-4" strokeWidth={1.75} aria-hidden="true" />
    </button>
  );
}
