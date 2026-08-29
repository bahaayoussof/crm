import {
  $applyNodeReplacement,
  TextNode,
  type EditorConfig,
  type LexicalNode,
  type NodeKey,
  type SerializedTextNode,
  type Spread,
} from "lexical";

/**
 * A `@mention` in an internal-note Lexical editor. It is a `TextNode` whose text
 * content is the canonical `@[Name](userId)` token — the exact shape the server
 * (`parseMentions`) and the timeline renderer already understand — so both
 * `root.getTextContent()` (plain text) and `$generateHtmlFromNodes` (HTML) carry
 * the token verbatim and need no special serializer. It is a `token`-mode node so
 * the whole chip is inserted/deleted atomically.
 */
export type SerializedMentionNode = Spread<
  { mentionName: string; mentionId: string },
  SerializedTextNode
>;

export class MentionNode extends TextNode {
  __mentionName: string;
  __mentionId: string;

  static getType(): string {
    return "ticket-mention";
  }

  static clone(node: MentionNode): MentionNode {
    return new MentionNode(node.__mentionName, node.__mentionId, node.__text, node.__key);
  }

  constructor(mentionName: string, mentionId: string, text?: string, key?: NodeKey) {
    super(text ?? `@[${mentionName}](${mentionId})`, key);
    this.__mentionName = mentionName;
    this.__mentionId = mentionId;
  }

  static importJSON(serializedNode: SerializedMentionNode): MentionNode {
    const node = $createMentionNode(serializedNode.mentionName, serializedNode.mentionId);
    node.setFormat(serializedNode.format);
    node.setDetail(serializedNode.detail);
    node.setStyle(serializedNode.style);
    return node;
  }

  exportJSON(): SerializedMentionNode {
    return {
      ...super.exportJSON(),
      mentionName: this.__mentionName,
      mentionId: this.__mentionId,
      type: "ticket-mention",
      version: 1,
    };
  }

  createDOM(config: EditorConfig): HTMLElement {
    const dom = super.createDOM(config);
    dom.className = "rounded-sm bg-primary/10 px-1 font-medium text-primary";
    dom.setAttribute("data-lexical-mention", "true");
    return dom;
  }

  isTextEntity(): true {
    return true;
  }

  canInsertTextBefore(): boolean {
    return false;
  }

  canInsertTextAfter(): boolean {
    return false;
  }
}

export function $createMentionNode(name: string, id: string): MentionNode {
  const node = new MentionNode(name, id);
  node.setMode("token");
  return $applyNodeReplacement(node);
}

export function $isMentionNode(node: LexicalNode | null | undefined): node is MentionNode {
  return node instanceof MentionNode;
}
