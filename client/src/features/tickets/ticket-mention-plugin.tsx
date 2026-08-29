import { useCallback, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
  useBasicTypeaheadTriggerMatch,
} from "@lexical/react/LexicalTypeaheadMenuPlugin";
import { $createTextNode, type TextNode } from "lexical";
import { useDebouncedValue } from "@/features/customers/use-debounced-value";
import { useMentionableUsers } from "@/features/collaboration/collaboration-hooks";
import type { MentionableUser } from "@/features/collaboration/collaboration.types";
import { cn } from "@/lib/utils";
import { $createMentionNode } from "./ticket-mention-node";

class MentionMenuOption extends MenuOption {
  constructor(public user: MentionableUser) {
    super(user.id);
  }
}

/**
 * `@mention` typeahead for the internal-note Lexical editor. Reuses the internal
 * `/api/users/mentionable` query (`useMentionableUsers`) — this plugin is mounted
 * ONLY on the internal note editor, never the public reply editor and never the
 * Customer Portal composer. Selecting a user inserts a {@link MentionNode} whose
 * text is the canonical `@[Name](userId)` token.
 */
export function TicketMentionPlugin() {
  const { t } = useTranslation();
  const [editor] = useLexicalComposerContext();
  const [query, setQuery] = useState<string | null>(null);
  const debounced = useDebouncedValue(query ?? "");
  const mentionable = useMentionableUsers(debounced.trim(), { enabled: query !== null });

  const options = useMemo(
    () => (mentionable.data ?? []).map((user) => new MentionMenuOption(user)),
    [mentionable.data],
  );

  // `@` after whitespace / line start, empty query allowed so the list opens on `@`.
  const triggerFn = useBasicTypeaheadTriggerMatch("@", { minLength: 0, maxLength: 40 });

  const onSelectOption = useCallback(
    (option: MentionMenuOption, nodeToReplace: TextNode | null, closeMenu: () => void) => {
      editor.update(() => {
        const mention = $createMentionNode(option.user.name, option.user.id);
        if (nodeToReplace) nodeToReplace.replace(mention);
        else mention.selectNext();
        const space = $createTextNode(" ");
        mention.insertAfter(space);
        space.select();
        closeMenu();
      });
    },
    [editor],
  );

  return (
    <LexicalTypeaheadMenuPlugin<MentionMenuOption>
      options={options}
      triggerFn={triggerFn}
      onQueryChange={setQuery}
      onSelectOption={onSelectOption}
      menuRenderFn={(anchorRef, { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex }) => {
        if (anchorRef.current == null || query === null) return null;
        return createPortal(
          <div
            data-mention-popover
            className="z-[60] mt-1 w-[min(340px,90vw)] overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-flyout"
          >
            <ul role="listbox" aria-label={t("collaboration.mention.listLabel")} className="max-h-72 overflow-y-auto p-1">
              {mentionable.isLoading ? (
                <li className="px-3 py-2 text-sm text-muted-foreground" role="status">
                  {t("collaboration.mention.loading")}
                </li>
              ) : mentionable.isError ? (
                <li className="px-3 py-2 text-sm text-danger-foreground" role="status">
                  {t("collaboration.mention.error")}
                </li>
              ) : options.length === 0 ? (
                <li className="px-3 py-2 text-sm text-muted-foreground" role="status">
                  {t("collaboration.mention.noResults")}
                </li>
              ) : (
                options.map((option, index) => (
                  <li
                    key={option.key}
                    role="option"
                    aria-selected={index === selectedIndex}
                    ref={(el) => option.setRefElement(el)}
                    className={cn(
                      "cursor-pointer rounded-sm px-3 py-2 transition-colors hover:bg-surface-hover",
                      index === selectedIndex && "bg-surface-hover",
                    )}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectOptionAndCleanUp(option)}
                  >
                    <span className="block truncate text-sm font-medium text-foreground" dir="auto">
                      {option.user.name}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground" dir="ltr">
                      {option.user.email}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </div>,
          anchorRef.current,
        );
      }}
    />
  );
}
