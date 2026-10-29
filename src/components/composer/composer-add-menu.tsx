// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

import type { LucideIcon } from "lucide-react";
import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

// Something the add button offers, such as attaching files. The composer
// runs its own items, Files and Images, itself; an item a caller adds runs
// onSelect.
export interface ComposerAddItem {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  onSelect?: () => void;
}

// Items whose label or description holds the text typed since the menu
// opened. Spaces around it are ignored, so typing a space keeps the list.
export const filterAddItems = (
  items: readonly ComposerAddItem[],
  typed: string
): ComposerAddItem[] => {
  const query = typed.trim().toLowerCase();

  if (!query) {
    return [...items];
  }

  return items.filter((item) =>
    `${item.label} ${item.description}`.toLowerCase().includes(query)
  );
};

// Shown, and announced, when the typed text matches no item.
export const NO_MATCH = "Nothing matches what you typed.";

export const addOptionId = (listId: string, itemId: string): string =>
  `${listId}-${itemId}`;

const PANEL =
  "bg-popover text-popover-foreground inset-ring-border absolute inset-x-0 bottom-full z-20 mb-(--space-menu-offset) max-h-(--size-add-menu-max-height) overflow-y-auto overscroll-contain rounded-(--radius-add-menu) p-(--space-add-menu-padding) shadow-(--shadow-menu) inset-ring-(length:--border-panel)";

// The list the add button opens, directly above the composer and as wide as
// it. Focus stays in the message field the whole time, which points at the
// highlighted option with aria-activedescendant, as a combobox does. The
// field's key handler moves the highlight and runs it; see Composer.
export const ComposerAddMenu = ({
  id,
  items,
  highlighted,
  onHighlight,
  onRun,
}: {
  id: string;
  items: readonly ComposerAddItem[];
  highlighted: string | undefined;
  onHighlight: (id: string) => void;
  onRun: (item: ComposerAddItem) => void;
}) => {
  const list = useRef<HTMLDivElement>(null);

  // Keeps the highlight in view as the arrow keys move it.
  useEffect(() => {
    if (!highlighted) {
      return;
    }

    list.current
      ?.querySelector(`#${CSS.escape(addOptionId(id, highlighted))}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [highlighted, id]);

  // With nothing left to choose there is no list, only a note. The
  // composer's live region says the same to a screen reader.
  if (items.length === 0) {
    return (
      <div className={PANEL} data-slot="composer-add-menu">
        <p className="text-subtle-foreground flex h-(--size-add-menu-item) items-center px-(--space-menu-item-padding-x) text-(length:--text-label-size)">
          {NO_MATCH}
        </p>
      </div>
    );
  }

  // A native select or datalist cannot work here: focus has to stay in the
  // message field while the list filters and highlights, which only an
  // ARIA listbox driven by aria-activedescendant allows.
  return (
    <div
      aria-label="Add to your message"
      className={PANEL}
      data-slot="composer-add-menu"
      id={id}
      ref={list}
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
      role="listbox"
    >
      {items.map((item) => {
        const { icon: Glyph } = item;
        const active = item.id === highlighted;

        return (
          // The field keeps focus and handles the keys, so an option takes
          // only the pointer.
          // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/interactive-supports-focus
          <div
            aria-selected={active}
            className={cn(
              "flex h-(--size-add-menu-item) items-center gap-2 rounded-full px-(--space-menu-item-padding-x) text-(length:--text-label-size) leading-(--text-label-leading) select-none",
              active && "bg-accent text-accent-foreground"
            )}
            data-slot="composer-add-option"
            id={addOptionId(id, item.id)}
            key={item.id}
            onClick={() => onRun(item)}
            onMouseDown={(event) => event.preventDefault()}
            onMouseMove={() => onHighlight(item.id)}
            // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
            role="option"
          >
            <Glyph aria-hidden="true" className="text-link size-4 shrink-0" />
            <span className="shrink-0">{item.label}</span>
            <span className="text-subtle-foreground min-w-0 truncate">
              {item.description}
            </span>
          </div>
        );
      })}
    </div>
  );
};
