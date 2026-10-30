// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

"use client";

import { MessageCircleIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import type { KeyboardEvent } from "react";

import {
  useAppShellLabels,
  useOptionalAppShell,
} from "@/components/app-shell/app-shell-provider";
import type { AppShellLabels } from "@/components/app-shell/labels";
import { Tip } from "@/components/ui/tip";

export interface AppShellTab {
  id: string;
  title: string;
}

export type AppShellTabAppearance = "filled" | "underline";

export const TAB_APPEARANCES: AppShellTabAppearance[] = ["filled", "underline"];

// The id of a tab's element, so the panel it controls can name it with
// aria-labelledby. It starts with the panel's id, which comes from useId,
// so two strips on one page never share an id. A tab id can be any string,
// so it is encoded: aria-labelledby splits on spaces.
export const appShellTabId = (panelId: string, tabId: string): string =>
  `${panelId}-tab-${encodeURIComponent(tabId)}`;

// The tab element for an id. It compares each tab's data-tab-id instead of
// building a selector, so any string works as an id.
const findTab = (
  strip: HTMLElement | null,
  tabId: string
): HTMLElement | undefined =>
  [...(strip?.querySelectorAll<HTMLElement>('[role="tab"]') ?? [])].find(
    (tab) => tab.dataset.tabId === tabId
  );

// filled: the open tab is a raised box, the default. Other tabs show hover
// by text color, because a hover fill would make them look open.
// underline: no box, a bar sits under the open tab.
// The open tab's title is semibold too, so color is never the only cue.
// Forced colors would draw the other tabs' transparent borders, so there
// they take the background color.
const TAB_CLASSES: Record<
  AppShellTabAppearance,
  { base: string; selected: string; other: string }
> = {
  filled: {
    base: "rounded-(--radius-tab) border-(length:--border-hairline)",
    other:
      "hover:text-foreground border-transparent forced-colors:border-[Canvas]",
    selected: "border-border bg-background",
  },
  underline: {
    base: "rounded-t-(--radius-tab) border-b-2",
    other: "hover:bg-accent border-transparent forced-colors:border-[Canvas]",
    selected: "border-foreground",
  },
};

export interface AppShellTabsProps {
  tabs: AppShellTab[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  // The id of the tab panel the tabs control. Inside an AppShellProvider it
  // defaults to the main region's id.
  panelId?: string;
  appearance?: AppShellTabAppearance;
  labels?: Partial<AppShellLabels>;
}

export const AppShellTabs = ({
  tabs,
  activeTabId,
  onSelectTab,
  panelId,
  appearance = "filled",
  labels,
}: AppShellTabsProps) => {
  const style = TAB_CLASSES[appearance];
  const shell = useOptionalAppShell();
  const text = useAppShellLabels(labels);
  const panel = panelId ?? shell?.ids.main ?? "";

  const list = useRef<HTMLDivElement>(null);

  // When tabs don't fit the row scrolls, and the open tab is kept in view,
  // whether it was picked by key, by click or just opened. Only the row
  // scrolls; the page stays put.
  useEffect(() => {
    const strip = list.current;
    const tab = findTab(strip, activeTabId);

    if (!strip || !tab) {
      return;
    }

    const row = strip.getBoundingClientRect();
    const box = tab.getBoundingClientRect();

    if (box.left < row.left) {
      strip.scrollLeft -= row.left - box.left;
    } else if (box.right > row.right) {
      strip.scrollLeft += box.right - row.right;
    }
  }, [activeTabId]);

  // Arrow keys, Home and End move between tabs, as the WAI-ARIA tabs
  // pattern expects.
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const index = tabs.findIndex((tab) => tab.id === activeTabId);

    let target = -1;

    if (event.key === "ArrowLeft") {
      target = (index - 1 + tabs.length) % tabs.length;
    } else if (event.key === "ArrowRight") {
      target = (index + 1) % tabs.length;
    } else if (event.key === "Home") {
      target = 0;
    } else if (event.key === "End") {
      target = tabs.length - 1;
    }

    const next = tabs[target];

    if (!next) {
      return;
    }

    event.preventDefault();
    onSelectTab(next.id);
    findTab(list.current, next.id)?.focus({ preventScroll: true });
  };

  return (
    <div
      aria-label={text.tabs}
      className="-m-1 flex min-w-0 [scrollbar-width:thin] items-center gap-2 overflow-x-auto p-1"
      data-appearance={appearance}
      data-slot="tab-strip"
      ref={list}
      role="tablist"
    >
      {tabs.map((tab) => {
        const selected = tab.id === activeTabId;

        return (
          <Tip key={tab.id} label={tab.title}>
            <button
              aria-controls={panel}
              aria-selected={selected}
              className={`flex h-(--size-tab-height) w-(--size-tab-width) min-w-24 shrink items-center gap-2 py-1 ps-2.5 text-start text-(length:--text-label-size) leading-(--text-label-leading) transition-colors duration-(--motion-duration) ${style.base} ${selected ? `text-foreground font-(--weight-semibold) ${style.selected}` : `text-muted-foreground font-(--weight-regular) ${style.other}`}`}
              data-slot="tab"
              data-tab-id={tab.id}
              id={appShellTabId(panel, tab.id)}
              onClick={() => onSelectTab(tab.id)}
              onKeyDown={onKeyDown}
              role="tab"
              tabIndex={selected ? 0 : -1}
              type="button"
            >
              <MessageCircleIcon
                aria-hidden="true"
                className="size-4 shrink-0"
              />
              <span className="truncate pe-2">{tab.title}</span>
            </button>
          </Tip>
        );
      })}
    </div>
  );
};
