// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

"use client";

import {
  ChevronDownIcon,
  MessageCircleIcon,
  PlusIcon,
  XIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { KeyboardEvent, MouseEvent } from "react";

import {
  useAppShellLabels,
  useOptionalAppShell,
} from "@/components/app-shell/app-shell-provider";
import type { AppShellLabels } from "@/components/app-shell/labels";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import {
  MenuContent,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuRoot,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";
import { Tip } from "@/components/ui/tip";
import { cn } from "@/lib/utils";

export interface AppShellTab {
  id: string;
  title: string;
  // Drawn before the title. A chat bubble when left out.
  icon?: LucideIcon;
}

export type AppShellTabAppearance = "filled" | "underline";

export const TAB_APPEARANCES: AppShellTabAppearance[] = ["filled", "underline"];

// Characters an id keeps as they are. Every other one, including a space,
// which aria-labelledby splits on, and a lone surrogate, which
// encodeURIComponent throws on, becomes its code point in hex between
// underscores. The underscore is escaped too, so two tab ids never meet.
const ESCAPED_IN_ID = /[^\dA-Za-z-]/gu;

const escapeForId = (value: string): string =>
  value.replaceAll(
    ESCAPED_IN_ID,
    (character) => `_${(character.codePointAt(0) ?? 0).toString(16)}_`
  );

// The id of a tab's element, so the panel it controls can name it with
// aria-labelledby. It starts with the panel's id, which comes from useId,
// so two strips on one page never share an id. A tab id can be any string.
export const appShellTabId = (panelId: string, tabId: string): string =>
  `${panelId}-tab-${escapeForId(tabId)}`;

// The tab element for an id. It compares each tab's data-tab-id instead of
// building a selector, so any string works as an id.
const findTab = (
  strip: HTMLElement | null,
  tabId: string
): HTMLElement | undefined =>
  [...(strip?.querySelectorAll<HTMLElement>('[role="tab"]') ?? [])].find(
    (tab) => tab.dataset.tabId === tabId
  );

// The box around a tab and its close button, which grows in and shrinks
// out.
const findItem = (strip: HTMLElement | null, tabId: string) =>
  findTab(strip, tabId)?.closest<HTMLElement>('[data-slot="tab-item"]') ??
  undefined;

// Whether focus is inside an element, also when the element sits in a
// shadow root.
const holdsFocus = (element: HTMLElement | null): boolean => {
  const root = element?.getRootNode();

  const active =
    root instanceof Document || root instanceof ShadowRoot
      ? root.activeElement
      : null;

  return Boolean(element && active && element.contains(active));
};

// Keeps a tab in view when the row scrolls, with the row's padding
// beside it, so the first and last tabs scroll the row all the way. Only
// the row scrolls; the page stays put.
const reveal = (strip: HTMLElement | null, tabId: string) => {
  const tab = findTab(strip, tabId);

  if (!strip || !tab) {
    return;
  }

  const padding = getComputedStyle(strip);
  const row = strip.getBoundingClientRect();
  const box = tab.getBoundingClientRect();
  const padLeft = Number(padding.paddingLeft.replace("px", "")) || 0;
  const padRight = Number(padding.paddingRight.replace("px", "")) || 0;
  const left = row.left + padLeft;
  const right = row.right - padRight;

  if (box.left < left) {
    strip.scrollLeft -= left - box.left;
  } else if (box.right > right) {
    strip.scrollLeft += box.right - right;
  }
};

// Which ends of the row hide tabs, in reading order. The scroll position
// is negative in right-to-left layouts, so its size is what counts.
export type AppShellTabsOverflow = "start" | "end" | "both";

const readOverflow = (strip: HTMLElement): AppShellTabsOverflow | undefined => {
  const hidden = strip.scrollWidth - strip.clientWidth;

  if (hidden <= 1) {
    return undefined;
  }

  const scrolled = Math.abs(strip.scrollLeft);
  const start = scrolled > 1;
  const end = scrolled < hidden - 1;

  if (start && end) {
    return "both";
  }

  if (start) {
    return "start";
  }

  return end ? "end" : undefined;
};

const MS_PER_SECOND = 1000;
const MIDDLE_BUTTON = 1;
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

// A CSS time such as 180ms or 0.18s, in milliseconds, or 0 when it is
// not one.
const toMs = (value: string): number => {
  const time = value.trim();

  const amount = time.endsWith("ms")
    ? Number(time.slice(0, -2))
    : Number(time.slice(0, -1)) * MS_PER_SECOND;

  return Number.isFinite(amount) ? amount : 0;
};

// A tab grows in from nothing, or shrinks out to nothing, so its
// neighbours slide. Under reduced motion it only fades in, and it leaves
// at once.
const animateItem = async (
  item: HTMLElement,
  direction: "in" | "out"
): Promise<void> => {
  const reduced = window.matchMedia(REDUCED_MOTION).matches;
  const style = getComputedStyle(item);

  const duration = toMs(
    style.getPropertyValue(
      direction === "in" ? "--motion-tab-enter" : "--motion-tab-exit"
    )
  );

  if (duration <= 0 || (reduced && direction === "out")) {
    return;
  }

  const width = `${item.getBoundingClientRect().width}px`;

  const gap = item.parentElement
    ? getComputedStyle(item.parentElement).columnGap
    : "0px";

  const shown: Keyframe = reduced
    ? { opacity: 1 }
    : {
        marginInlineEnd: "0px",
        minWidth: width,
        opacity: 1,
        scale: "1",
        width,
      };

  const gone: Keyframe = reduced
    ? { opacity: 0 }
    : {
        marginInlineEnd: `calc(-1 * ${gap === "normal" ? "0px" : gap})`,
        minWidth: "0px",
        opacity: 0,
        scale: "0.96",
        width: "0px",
      };

  const animation = item.animate(
    direction === "in" ? [gone, shown] : [shown, gone],
    {
      duration,
      easing: style.getPropertyValue("--motion-ease-out").trim() || "ease-out",
      fill: direction === "out" ? "forwards" : "none",
    }
  );

  try {
    await animation.finished;
  } catch {
    // Cancelled, such as when the tab unmounts first. Nothing to wait for.
  }
};

// Removes a tab once it has shrunk out.
const shrinkOut = async (item: HTMLElement, remove: () => void) => {
  await animateItem(item, "out");
  remove();
};

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

// The close button shows on hover, while the tab holds focus, on the open
// tab, and always on a touch screen, which can't hover.
const CLOSE_BUTTON =
  "text-muted-foreground hover:bg-accent hover:text-foreground absolute end-1 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-(--radius-tab) opacity-0 transition-opacity duration-(--motion-duration) ease-(--motion-ease-out) group-focus-within/tab:opacity-100 group-hover/tab:opacity-100 group-data-selected/tab:opacity-100 pointer-coarse:opacity-100";

export interface AppShellTabsProps {
  tabs: AppShellTab[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  // Closing a tab: Delete on the focused tab, a click on its close button,
  // a middle click, or Close in the tab menu. When the open tab closes,
  // onSelectTab runs first with the tab to its right, or to its left for
  // the last tab. The app then removes the tab. Without it tabs can't
  // close, and the only tab never can.
  onCloseTab?: (id: string) => void;
  // Shows a New tab button after the tabs.
  onNewTab?: () => void;
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
  onCloseTab,
  onNewTab,
  panelId,
  appearance = "filled",
  labels,
}: AppShellTabsProps) => {
  const style = TAB_CLASSES[appearance];
  const shell = useOptionalAppShell();
  const text = useAppShellLabels(labels);
  const panel = panelId ?? shell?.ids.main ?? "";
  const closable = onCloseTab !== undefined && tabs.length > 1;
  const activeTab = tabs.find((tab) => tab.id === activeTabId);

  const list = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState<AppShellTabsOverflow>();
  // Tabs shrinking out, which a second click must not close again.
  const closing = useRef(new Set<string>());
  // The tab ids of the last render, to find the tabs that just opened.
  const known = useRef<Set<string> | null>(null);
  const active = useRef(activeTabId);

  const measure = useCallback(() => {
    if (list.current) {
      setOverflow(readOverflow(list.current));
    }
  }, []);

  // The row fades at an end that hides tabs, and the tab menu shows.
  useLayoutEffect(() => {
    const strip = list.current;

    if (!strip) {
      return;
    }

    const observer = new ResizeObserver(measure);

    observer.observe(strip);
    strip.addEventListener("scroll", measure, { passive: true });

    return () => {
      observer.disconnect();
      strip.removeEventListener("scroll", measure);
    };
  }, [measure]);

  // The tab had no width while it grew, so the row is measured and
  // scrolled again once it has its own.
  const growIn = useCallback(
    async (item: HTMLElement) => {
      await animateItem(item, "in");
      reveal(list.current, active.current);
      measure();
    },
    [measure]
  );

  // A tab that opened from a pointer grows in. One opened from the
  // keyboard is there at once.
  useLayoutEffect(() => {
    const before = known.current;

    known.current = new Set(tabs.map((tab) => tab.id));
    measure();

    if (!before || shell?.input === "keyboard") {
      return;
    }

    for (const tab of tabs) {
      const item = before.has(tab.id)
        ? undefined
        : findItem(list.current, tab.id);

      if (item) {
        void growIn(item);
      }
    }
  }, [growIn, measure, shell?.input, tabs]);

  // When tabs don't fit the row scrolls, and the open tab is kept in view,
  // whether it was picked by key, by click, from the tab menu or just
  // opened.
  useEffect(() => {
    active.current = activeTabId;
    reveal(list.current, activeTabId);
  }, [activeTabId]);

  // When the open tab closes, focus and selection move to the tab on the
  // right, or on the left for the last tab. When the focused tab closes,
  // focus moves there too. Tabs still shrinking out are skipped, since
  // they are about to go. A close from a pointer shrinks the tab out
  // first; one from the keyboard or the tab menu is instant.
  const closeTab = (id: string, animate: boolean) => {
    const staying = tabs.filter(
      (tab) => tab.id === id || !closing.current.has(tab.id)
    );

    const index = staying.findIndex((tab) => tab.id === id);

    if (
      !onCloseTab ||
      index === -1 ||
      closing.current.has(id) ||
      staying.length < 2
    ) {
      return;
    }

    const strip = list.current;
    const neighbour = staying[index + 1] ?? staying[index - 1];
    const wasOpen = id === activeTabId;
    const wasFocused = holdsFocus(findTab(strip, id) ?? null);
    const nextFocus = wasOpen || wasFocused ? neighbour?.id : activeTabId;

    if (wasOpen && neighbour) {
      onSelectTab(neighbour.id);
    }

    // A tab id may be the empty string, so this checks for undefined.
    if (nextFocus !== undefined && holdsFocus(strip)) {
      findTab(strip, nextFocus)?.focus({ preventScroll: true });
    }

    const item = findItem(strip, id);

    if (!animate || !item) {
      onCloseTab(id);

      return;
    }

    closing.current.add(id);
    void shrinkOut(item, () => {
      closing.current.delete(id);
      onCloseTab(id);
    });
  };

  // Arrow keys, Home and End move between tabs, as the WAI-ARIA tabs
  // pattern expects. Delete closes the focused tab.
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Delete") {
      const id = event.currentTarget.dataset.tabId;

      if (closable && id !== undefined) {
        event.preventDefault();
        closeTab(id, false);
      }

      return;
    }

    // Tabs still shrinking out can't be opened.
    const reachable = tabs.filter((tab) => !closing.current.has(tab.id));
    const index = reachable.findIndex((tab) => tab.id === activeTabId);

    let target = -1;

    if (event.key === "ArrowLeft") {
      target = (index - 1 + reachable.length) % reachable.length;
    } else if (event.key === "ArrowRight") {
      target = (index + 1) % reachable.length;
    } else if (event.key === "Home") {
      target = 0;
    } else if (event.key === "End") {
      target = reachable.length - 1;
    }

    const next = reachable[target];

    if (!next) {
      return;
    }

    event.preventDefault();
    onSelectTab(next.id);
    findTab(list.current, next.id)?.focus({ preventScroll: true });
  };

  // A middle click closes a tab, and its press doesn't start autoscroll.
  const onMiddlePress = (event: MouseEvent<HTMLButtonElement>) => {
    if (closable && event.button === MIDDLE_BUTTON) {
      event.preventDefault();
    }
  };

  const onMiddleClick = (event: MouseEvent<HTMLButtonElement>) => {
    const id = event.currentTarget.dataset.tabId;

    if (closable && event.button === MIDDLE_BUTTON && id !== undefined) {
      event.preventDefault();
      closeTab(id, true);
    }
  };

  return (
    <div
      className="flex min-w-0 items-center gap-2 self-stretch"
      data-slot="tabs"
    >
      <div
        aria-label={text.tabs}
        className="-m-1 flex min-w-0 [scrollbar-width:thin] items-center gap-2 overflow-x-auto p-1"
        data-appearance={appearance}
        data-overflow={overflow}
        data-slot="tab-strip"
        ref={list}
        role="tablist"
      >
        {tabs.map((tab) => {
          const selected = tab.id === activeTabId;
          const Icon = tab.icon ?? MessageCircleIcon;

          return (
            <div
              className="group/tab relative flex w-(--size-tab-width) min-w-24 shrink"
              data-selected={selected}
              data-slot="tab-item"
              key={tab.id}
            >
              <Tip label={tab.title}>
                <button
                  aria-controls={panel}
                  aria-keyshortcuts={closable ? "Delete" : undefined}
                  aria-selected={selected}
                  className={cn(
                    "flex h-(--size-tab-height) w-full min-w-0 items-center gap-2 py-1 ps-2.5 text-start text-(length:--text-label-size) leading-(--text-label-leading) transition-colors duration-(--motion-duration)",
                    closable && "pe-8",
                    style.base,
                    selected
                      ? `text-foreground font-(--weight-semibold) ${style.selected}`
                      : `text-muted-foreground font-(--weight-regular) ${style.other}`
                  )}
                  data-slot="tab"
                  data-tab-id={tab.id}
                  id={appShellTabId(panel, tab.id)}
                  onAuxClick={onMiddleClick}
                  onClick={() => onSelectTab(tab.id)}
                  onKeyDown={onKeyDown}
                  onMouseDown={onMiddlePress}
                  role="tab"
                  tabIndex={selected ? 0 : -1}
                  type="button"
                >
                  <Icon aria-hidden="true" className="size-4 shrink-0" />
                  <span className={cn("truncate", !closable && "pe-2")}>
                    {tab.title}
                  </span>
                </button>
              </Tip>
              {closable ? (
                // A close button inside a tab list breaks the list's
                // structure for assistive technology, so it is for the
                // pointer only. Keyboard and screen reader users close a
                // tab with Delete, as aria-keyshortcuts says, or from the
                // tab menu. Pressing it leaves focus where it was.
                // oxlint-disable-next-line jsx-a11y/no-aria-hidden-on-focusable -- reachable by pointer only, see above
                <button
                  aria-hidden="true"
                  className={CLOSE_BUTTON}
                  data-slot="tab-close"
                  onClick={() => closeTab(tab.id, true)}
                  onMouseDown={(event) => event.preventDefault()}
                  tabIndex={-1}
                  type="button"
                >
                  <XIcon aria-hidden="true" className="size-3.5" />
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
      {onNewTab ? (
        <IconButton icon={PlusIcon} label={text.newTab} onClick={onNewTab} />
      ) : null}
      {tabs.length > 0 ? (
        <MenuRoot>
          <Tip label={text.tabMenu}>
            {/* Shown when tabs are hidden, and always on a touch screen,
                where it is also the way to close the open tab. */}
            <MenuTrigger
              render={
                <Button
                  aria-label={text.tabMenu}
                  className={cn(
                    "shrink-0",
                    overflow ? undefined : "hidden pointer-coarse:inline-flex"
                  )}
                  data-kind="control"
                  data-slot="icon-button"
                  data-tab-menu=""
                  size="icon"
                  variant="quiet"
                />
              }
            >
              <ChevronDownIcon aria-hidden="true" />
            </MenuTrigger>
          </Tip>
          <MenuContent align="end" label={text.tabMenu} width="medium">
            <MenuRadioGroup onValueChange={onSelectTab} value={activeTabId}>
              {tabs.map((tab) => (
                <MenuRadioItem key={tab.id} label={tab.title} value={tab.id} />
              ))}
            </MenuRadioGroup>
            {closable && activeTab ? (
              <>
                <MenuSeparator />
                <MenuItem
                  label={text.closeTab(activeTab.title)}
                  onSelect={() => closeTab(activeTab.id, false)}
                />
              </>
            ) : null}
          </MenuContent>
        </MenuRoot>
      ) : null}
    </div>
  );
};
