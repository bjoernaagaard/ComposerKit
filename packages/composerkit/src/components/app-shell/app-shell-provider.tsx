// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

"use client";

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { ReactNode, RefObject } from "react";

import { APP_SHELL_LABELS } from "@/components/app-shell/labels";
import type { AppShellLabels } from "@/components/app-shell/labels";
import { writeShellCookie } from "@/components/app-shell/persist";
import { SIDEBAR_WIDTH } from "@/components/app-shell/sidebar-width";
import { pixelsOf } from "@/components/ui/theme-value";

// The shell is narrow below 48rem of its own width, not the window's, so a
// shell inside a docs page or a split view follows the room it has.
const NARROW_REM = 48;
const FALLBACK_REM_PX = 16;
const DEFAULT_SHORTCUT = "b";

const clampSidebarWidth = (px: number): number =>
  Math.round(Math.min(SIDEBAR_WIDTH.max, Math.max(SIDEBAR_WIDTH.min, px)));

export type AppShellInput = "pointer" | "keyboard";

export interface AppShellProviderProps {
  // The sidebar's open state on wide layouts, when the app owns it.
  open?: boolean;
  // The first open state when the shell owns it. Pass the cookie's value,
  // from readShellCookie, so the first frame matches the last visit.
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  // The sidebar width in px that the person chose last time, such as the
  // cookie's width. Leave it out to use --size-sidebar, the theme's width,
  // until they resize the sidebar. Kept between 220 and 480.
  defaultWidth?: number;
  // Saves the open state and width in the composerkit_shell cookie.
  persist?: boolean;
  // The key that toggles the sidebar with Meta on Apple platforms and
  // Control elsewhere, or false for none.
  shortcut?: string | false;
  labels?: Partial<AppShellLabels>;
  children: ReactNode;
}

export interface AppShellContextValue {
  // Wide layouts: whether the sidebar sits beside the main region.
  open: boolean;
  setOpen: (open: boolean) => void;
  // Narrow layouts: whether the sidebar covers the page. Kept apart from
  // open, so a resize never overwrites the person's choice.
  openNarrow: boolean;
  setOpenNarrow: (open: boolean) => void;
  // The shell's own width is under 48rem. Always false on the server.
  isNarrow: boolean;
  // The sidebar's width in px: the one the person chose, or --size-sidebar,
  // the theme's, until they choose one.
  width: number;
  // The width the person chose, with the splitter or as defaultWidth, or
  // null. AppShell draws it as --size-sidebar on its root.
  chosenWidth: number | null;
  // Sets the width, kept between 220 and 480. null goes back to the
  // theme's width.
  setWidth: (px: number | null) => void;
  // A pointer is dragging the splitter. AppShell marks its root with
  // data-resizing, which turns transitions off, and the cookie is written
  // when the drag ends.
  resizing: boolean;
  setResizing: (resizing: boolean) => void;
  // A pointer is dragging a tab. AppShell marks its root with
  // data-dragging, which keeps transitions on, so the other tabs slide.
  dragging: boolean;
  setDragging: (dragging: boolean) => void;
  // Toggles open, or openNarrow when narrow.
  toggleSidebar: () => void;
  // Closes the narrow drawer and moves focus to the main region, for a
  // choice inside the drawer that changes the page, such as opening a chat.
  // Does nothing when the drawer is not open.
  closeNarrowAndFocusMain: () => void;
  // The last input type. Shell motion runs only for a pointer.
  input: AppShellInput;
  ids: { main: string; sidebar: string; toggle: string };
  refs: {
    toggle: RefObject<HTMLButtonElement | null>;
    main: RefObject<HTMLElement | null>;
    sidebar: RefObject<HTMLElement | null>;
    // The AppShell root, where the narrow drawer mounts.
    root: RefObject<HTMLElement | null>;
  };
  // Where focus goes when the narrow drawer has closed, as its finalFocus:
  // the sidebar toggle, or the main region after closeNarrowAndFocusMain.
  // The main region takes focus here, because the drawer would focus its
  // first control instead.
  narrowFinalFocus: () => HTMLElement | boolean;
  // The row at the top of the narrow drawer that AppShellRail moves into.
  // AppShellSidebar sets it.
  railSlot: HTMLElement | null;
  setRailSlot: (element: HTMLElement | null) => void;
  labels: AppShellLabels;
  // The shortcut as aria-keyshortcuts reads it and as a tooltip shows it.
  shortcut: { aria: string; display: string } | null;
  // AppShell hands its root element here, to measure its width.
  rootRef: (element: HTMLElement | null) => void;
}

const AppShellContext = createContext<AppShellContextValue | null>(null);

export const useAppShell = (): AppShellContextValue => {
  const context = use(AppShellContext);

  if (!context) {
    throw new Error("useAppShell must be used inside an AppShellProvider");
  }

  return context;
};

// For parts that also work on their own, such as the tabs.
export const useOptionalAppShell = (): AppShellContextValue | null =>
  use(AppShellContext);

export const useAppShellLabels = (
  labels?: Partial<AppShellLabels>
): AppShellLabels => {
  const context = use(AppShellContext);

  return { ...(context?.labels ?? APP_SHELL_LABELS), ...labels };
};

const isNarrowElement = (element: HTMLElement) => {
  const rem =
    Number(
      getComputedStyle(document.documentElement).fontSize.replace("px", "")
    ) || FALLBACK_REM_PX;

  return element.getBoundingClientRect().width < NARROW_REM * rem;
};

const sidebarWidthOf = (element: HTMLElement) => {
  const px = pixelsOf(
    getComputedStyle(element).getPropertyValue("--size-sidebar").trim()
  );

  return Number.isNaN(px) ? SIDEBAR_WIDTH.theme : px;
};

const onServerWidth = () => SIDEBAR_WIDTH.theme;

const noUpdates = () => {
  // Nothing to watch until the root mounts.
};

const subscribeNever = () => noUpdates;

const APPLE_PLATFORM = /mac|iphone|ipad|ipod/iu;

const isApplePlatform = () => APPLE_PLATFORM.test(navigator.platform);

const onServer = () => false;

interface ShortcutShell {
  key: string;
  root: HTMLElement | null;
}

const shortcutShells = new Set<ShortcutShell>();

// One press toggles one shell: of the shells with that key, the one that
// holds focus, the innermost when shells nest, or the first on the page
// when focus is in none. The key event's composed path runs from the
// focused element out to the window, through any shadow roots on the way,
// so the first shell root on it is the innermost shell that holds focus,
// even inside a web component. Otherwise shells are compared in page
// order, and a shell whose root hasn't mounted or sits in a shadow root
// comes last.
const shortcutOwner = (
  key: string,
  path: EventTarget[]
): ShortcutShell | undefined => {
  const shells = [...shortcutShells].filter((shell) => shell.key === key);

  const place = (shell: ShortcutShell) =>
    shell.root ? path.indexOf(shell.root) : -1;

  const focused = shells
    .filter((shell) => place(shell) !== -1)
    .toSorted((a, b) => place(a) - place(b));

  if (focused[0]) {
    return focused[0];
  }

  const onPage = [...document.querySelectorAll('[data-slot="app-shell"]')];

  const pagePlace = (shell: ShortcutShell) => {
    const index = shell.root ? onPage.indexOf(shell.root) : -1;

    return index === -1 ? onPage.length : index;
  };

  return shells.toSorted((a, b) => pagePlace(a) - pagePlace(b))[0];
};

export const AppShellProvider = ({
  open: openProp,
  defaultOpen = true,
  onOpenChange,
  defaultWidth,
  persist = true,
  shortcut = DEFAULT_SHORTCUT,
  labels: labelOverrides,
  children,
}: AppShellProviderProps) => {
  const [ownOpen, setOwnOpen] = useState(defaultOpen);
  const [narrowOpen, setNarrowOpen] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [dragging, setDragging] = useState(false);

  const [widthPx, setWidthPx] = useState<number | null>(() =>
    defaultWidth === undefined ? null : clampSidebarWidth(defaultWidth)
  );

  const [input, setInput] = useState<AppShellInput>("pointer");
  // AppShell hands over its root element during the commit. The state
  // change renders again before the first paint, so the first frame is
  // measured.
  const [rootElement, setRootElement] = useState<HTMLElement | null>(null);
  const [railSlot, setRailSlot] = useState<HTMLElement | null>(null);
  const rootElementRef = useRef<HTMLElement>(null);
  const narrowReturnRef = useRef<"toggle" | "main">("toggle");

  const setRoot = useCallback((element: HTMLElement | null) => {
    rootElementRef.current = element;
    setRootElement(element);
  }, []);

  const open = openProp ?? ownOpen;

  const subscribeToWidth = useCallback(
    (notify: () => void) => {
      if (!rootElement) {
        return noUpdates;
      }

      const observer = new ResizeObserver(notify);

      observer.observe(rootElement);

      return () => observer.disconnect();
    },
    [rootElement]
  );

  const readNarrow = useCallback(
    () => (rootElement ? isNarrowElement(rootElement) : false),
    [rootElement]
  );

  const isNarrow = useSyncExternalStore(subscribeToWidth, readNarrow, onServer);

  // The drawer is gone while the shell is wide, so it closes then. Turning
  // narrow again leaves it closed and focus where it is.
  if (!isNarrow && narrowOpen) {
    setNarrowOpen(false);
  }

  const apple = useSyncExternalStore(subscribeNever, isApplePlatform, onServer);

  const base = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);

  // The width the sidebar is drawn at: --size-sidebar on the root, which
  // is the chosen width once there is one, and the theme's until then. A
  // design can change the theme's, so it is read again whenever the shell
  // or the sidebar beside the main region changes size.
  const subscribeToSidebar = useCallback(
    (notify: () => void) => {
      if (!rootElement) {
        return noUpdates;
      }

      const observer = new ResizeObserver(notify);
      const sidebar = isNarrow ? null : sidebarRef.current;

      observer.observe(rootElement);

      if (sidebar) {
        observer.observe(sidebar);
      }

      return () => observer.disconnect();
    },
    [isNarrow, rootElement]
  );

  const readSidebarWidth = useCallback(
    () => (rootElement ? sidebarWidthOf(rootElement) : SIDEBAR_WIDTH.theme),
    [rootElement]
  );

  const drawnWidth = useSyncExternalStore(
    subscribeToSidebar,
    readSidebarWidth,
    onServerWidth
  );

  const width = widthPx ?? drawnWidth;

  // A sidebar that closes around the focused control would drop focus to
  // the page, so focus moves to the toggle first.
  const handOffFocus = useCallback(() => {
    if (sidebarRef.current?.contains(document.activeElement)) {
      toggleRef.current?.focus();
    }
  }, []);

  const setOpen = useCallback(
    (next: boolean) => {
      if (!next) {
        handOffFocus();
      }

      if (openProp === undefined) {
        setOwnOpen(next);
      }

      onOpenChange?.(next);
    },
    [handOffFocus, onOpenChange, openProp]
  );

  const setWidth = useCallback((px: number | null) => {
    setWidthPx(px === null ? null : clampSidebarWidth(px));
  }, []);

  // The cookie follows the open state and width the shell shows, whether
  // the shell or the app owns them, so a reload restores what was last on
  // screen. The first render's values came from the cookie or the app, so
  // only a change is written. During a drag it waits for the drag to end.
  const saved = useRef({ open, width: widthPx });

  useEffect(() => {
    if (
      !persist ||
      resizing ||
      (saved.current.open === open && saved.current.width === widthPx)
    ) {
      return;
    }

    saved.current = { open, width: widthPx };
    writeShellCookie({ open, width: widthPx ?? undefined });
  }, [open, persist, resizing, widthPx]);

  // The drawer moves focus in when it opens and back out when it closes.
  const setOpenNarrow = useCallback((next: boolean) => {
    setNarrowOpen(next);
  }, []);

  const narrowFinalFocus = useCallback(() => {
    if (narrowReturnRef.current === "main") {
      narrowReturnRef.current = "toggle";
      mainRef.current?.focus();

      return false;
    }

    return toggleRef.current ?? true;
  }, []);

  const closeNarrowAndFocusMain = useCallback(() => {
    if (!(isNarrow && narrowOpen)) {
      return;
    }

    narrowReturnRef.current = "main";
    setNarrowOpen(false);
  }, [isNarrow, narrowOpen]);

  const toggleSidebar = useCallback(() => {
    if (isNarrow) {
      setOpenNarrow(!narrowOpen);
    } else {
      setOpen(!open);
    }
  }, [isNarrow, narrowOpen, open, setOpen, setOpenNarrow]);

  const toggleLatest = useRef(toggleSidebar);

  useEffect(() => {
    toggleLatest.current = toggleSidebar;
  }, [toggleSidebar]);

  // The last input type, read before any handler runs, so a change made
  // from the keyboard is drawn without motion.
  useEffect(() => {
    const onPointer = () => setInput("pointer");
    const onKey = () => setInput("keyboard");

    window.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("keydown", onKey, true);

    return () => {
      window.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }, []);

  useEffect(() => {
    if (!shortcut) {
      return;
    }

    const shell: ShortcutShell = {
      key: shortcut.toLowerCase(),
      root: rootElement,
    };

    shortcutShells.add(shell);

    const onKey = (event: KeyboardEvent) => {
      const modifier = isApplePlatform()
        ? event.metaKey && !event.ctrlKey
        : event.ctrlKey && !event.metaKey;

      if (
        !modifier ||
        event.defaultPrevented ||
        event.altKey ||
        event.shiftKey ||
        event.repeat ||
        event.key.toLowerCase() !== shell.key ||
        shortcutOwner(shell.key, event.composedPath()) !== shell
      ) {
        return;
      }

      event.preventDefault();
      setInput("keyboard");
      toggleLatest.current();
    };

    window.addEventListener("keydown", onKey);

    return () => {
      shortcutShells.delete(shell);
      window.removeEventListener("keydown", onKey);
    };
  }, [rootElement, shortcut]);

  const value = useMemo<AppShellContextValue>(() => {
    const key = shortcut ? shortcut.toUpperCase() : "";

    return {
      chosenWidth: widthPx,
      closeNarrowAndFocusMain,
      dragging,
      ids: {
        main: `${base}main`,
        sidebar: `${base}sidebar`,
        toggle: `${base}toggle`,
      },
      input,
      isNarrow,
      labels: { ...APP_SHELL_LABELS, ...labelOverrides },
      narrowFinalFocus,
      open,
      openNarrow: narrowOpen,
      railSlot,
      refs: {
        main: mainRef,
        root: rootElementRef,
        sidebar: sidebarRef,
        toggle: toggleRef,
      },
      resizing,
      rootRef: setRoot,
      setDragging,
      setOpen,
      setOpenNarrow,
      setRailSlot,
      setResizing,
      setWidth,
      shortcut: shortcut
        ? {
            aria: apple ? `Meta+${key}` : `Control+${key}`,
            display: apple ? `⌘${key}` : `Ctrl+${key}`,
          }
        : null,
      toggleSidebar,
      width,
    };
  }, [
    apple,
    base,
    closeNarrowAndFocusMain,
    dragging,
    input,
    isNarrow,
    labelOverrides,
    narrowFinalFocus,
    open,
    narrowOpen,
    railSlot,
    resizing,
    setOpen,
    setOpenNarrow,
    setRoot,
    setWidth,
    shortcut,
    toggleSidebar,
    width,
    widthPx,
  ]);

  return <AppShellContext value={value}>{children}</AppShellContext>;
};
