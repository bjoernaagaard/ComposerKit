// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  MessageCircleIcon,
  PanelLeftIcon,
  PlusIcon,
} from "lucide-react";
import { useEffect, useRef } from "react";
import type { KeyboardEvent } from "react";

import { IconButton } from "@/components/ui/icon-button";
import { Tip } from "@/components/ui/tip";
import { DirectionSelector } from "@/designs/direction";

export interface Tab {
  id: string;
  title: string;
}

export const MAIN_PANEL_ID = "main-panel";
export const SIDEBAR_TOGGLE_ID = "sidebar-toggle";

export type TabAppearance = "filled" | "underline";

export const TAB_APPEARANCES: TabAppearance[] = ["filled", "underline"];

// filled: the open tab is a raised box, the default. Other tabs show hover
// by text color, because a hover fill would make them look open.
// underline: no box, a bar sits under the open tab.
// The open tab's title is semibold too, so color is never the only cue.
// Forced colors would draw the other tabs' transparent borders, so there
// they take the background color.
const TAB_CLASSES: Record<
  TabAppearance,
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

export const TabStrip = ({
  tabs,
  activeTabId,
  onSelectTab,
  panelId,
  appearance = "filled",
  label = "Open chats",
}: {
  tabs: Tab[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  panelId: string;
  appearance?: TabAppearance;
  label?: string;
}) => {
  const style = TAB_CLASSES[appearance];

  const list = useRef<HTMLDivElement>(null);

  // When tabs don't fit the row scrolls, and the open tab is kept in view,
  // whether it was picked by key, by click or just opened. Only the row
  // scrolls; the page stays put.
  useEffect(() => {
    const strip = list.current;
    const tab = strip?.querySelector(`[data-tab-id="${activeTabId}"]`);

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
    list.current
      ?.querySelector<HTMLElement>(`[data-tab-id="${next.id}"]`)
      ?.focus({ preventScroll: true });
  };

  return (
    <div
      data-slot="tab-strip"
      aria-label={label}
      className="-m-1 flex min-w-0 [scrollbar-width:thin] items-center gap-2 overflow-x-auto p-1"
      data-appearance={appearance}
      ref={list}
      role="tablist"
    >
      {tabs.map((tab) => {
        const selected = tab.id === activeTabId;

        return (
          <Tip key={tab.id} label={tab.title}>
            <button
              data-slot="tab"
              aria-controls={panelId}
              aria-selected={selected}
              className={`flex h-(--size-tab-height) w-(--size-tab-width) min-w-24 shrink items-center gap-2 py-1 pl-2.5 text-left text-(length:--text-label-size) leading-(--text-label-leading) transition-colors duration-(--motion-duration) ${style.base} ${selected ? `text-foreground font-(--weight-semibold) ${style.selected}` : `text-muted-foreground font-(--weight-regular) ${style.other}`}`}
              data-tab-id={tab.id}
              id={`tab-${tab.id}`}
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
              <span className="truncate pr-2">{tab.title}</span>
            </button>
          </Tip>
        );
      })}
    </div>
  );
};

export const TitleBar = ({
  canGoBack,
  canGoForward,
  onBack,
  onForward,
  sidebarOpen,
  onToggleSidebar,
  tabs,
  activeTabId,
  onSelectTab,
  onNewTab,
  tabAppearance = "filled",
}: {
  canGoBack: boolean;
  canGoForward: boolean;
  onBack: () => void;
  onForward: () => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  tabs: Tab[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  onNewTab: () => void;
  tabAppearance?: TabAppearance;
}) => (
  <header
    data-slot="title-bar"
    className="flex h-(--size-titlebar) shrink-0 items-center max-md:h-auto max-md:flex-wrap"
  >
    <div
      className={`flex shrink-0 items-center gap-1.5 pl-22 max-md:pl-3 ${sidebarOpen ? "md:w-[calc(var(--size-rail)+var(--size-sidebar))]" : "pr-2"}`}
    >
      <IconButton
        disabled={!canGoBack}
        icon={ArrowLeftIcon}
        label="Back"
        onClick={onBack}
        kind="small"
      />
      <IconButton
        disabled={!canGoForward}
        icon={ArrowRightIcon}
        label="Forward"
        onClick={onForward}
        kind="small"
      />
      <IconButton
        aria-expanded={sidebarOpen}
        icon={PanelLeftIcon}
        id={SIDEBAR_TOGGLE_ID}
        label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
        onClick={onToggleSidebar}
        kind="small"
      />
    </div>
    <div className="flex min-w-0 flex-1 items-center gap-2 pr-2 pl-2">
      <TabStrip
        activeTabId={activeTabId}
        appearance={tabAppearance}
        onSelectTab={onSelectTab}
        panelId={MAIN_PANEL_ID}
        tabs={tabs}
      />
      <IconButton icon={PlusIcon} label="New tab" onClick={onNewTab} />
    </div>
    <div className="flex shrink-0 items-center px-2 max-md:w-full max-md:justify-end max-md:pb-1">
      <DirectionSelector />
    </div>
  </header>
);
