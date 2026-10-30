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

// The shell is narrow below 48rem of its own width, not the window's, so a
// shell inside a docs page or a split view follows the room it has.
const NARROW_REM = 48;
const FALLBACK_REM_PX = 16;
const DEFAULT_WIDTH = 288;
const DEFAULT_SHORTCUT = "b";

export type AppShellInput = "pointer" | "keyboard";

export interface AppShellProviderProps {
  // The sidebar's open state on wide layouts, when the app owns it.
  open?: boolean;
  // The first open state when the shell owns it. Pass the cookie's value,
  // from readShellCookie, so the first frame matches the last visit.
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  // The sidebar width in px. Kept and saved now; resizing arrives with the
  // splitter.
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
  width: number;
  setWidth: (px: number) => void;
  // Toggles open, or openNarrow when narrow.
  toggleSidebar: () => void;
  // The last input type. Shell motion runs only for a pointer.
  input: AppShellInput;
  ids: { main: string; sidebar: string; toggle: string };
  refs: {
    toggle: RefObject<HTMLButtonElement | null>;
    main: RefObject<HTMLElement | null>;
    sidebar: RefObject<HTMLElement | null>;
  };
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

// Whether an element is narrower than 48rem.
const isNarrowElement = (element: HTMLElement) => {
  const rem =
    Number(
      getComputedStyle(document.documentElement).fontSize.replace("px", "")
    ) || FALLBACK_REM_PX;

  return element.getBoundingClientRect().width < NARROW_REM * rem;
};

const noUpdates = () => {
  // Nothing to watch until the root mounts.
};

const subscribeNever = () => noUpdates;

const APPLE_PLATFORM = /mac|iphone|ipad|ipod/iu;

const isApplePlatform = () => APPLE_PLATFORM.test(navigator.platform);

const onServer = () => false;

export const AppShellProvider = ({
  open: openProp,
  defaultOpen = true,
  onOpenChange,
  defaultWidth = DEFAULT_WIDTH,
  persist = true,
  shortcut = DEFAULT_SHORTCUT,
  labels: labelOverrides,
  children,
}: AppShellProviderProps) => {
  const [ownOpen, setOwnOpen] = useState(defaultOpen);
  const [narrowOpen, setNarrowOpen] = useState(false);
  const [widthPx, setWidthPx] = useState(defaultWidth);
  const [input, setInput] = useState<AppShellInput>("pointer");
  // AppShell hands over its root element during the commit. The state
  // change renders again before the first paint, so the first frame is
  // measured.
  const [rootElement, setRootElement] = useState<HTMLElement | null>(null);

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

  const apple = useSyncExternalStore(subscribeNever, isApplePlatform, onServer);

  const base = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);

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

      if (persist) {
        writeShellCookie({ open: next, width: widthPx });
      }
    },
    [handOffFocus, onOpenChange, openProp, persist, widthPx]
  );

  const setOpenNarrow = useCallback(
    (next: boolean) => {
      if (!next) {
        handOffFocus();
      }

      setNarrowOpen(next);
    },
    [handOffFocus]
  );

  const setWidth = useCallback(
    (px: number) => {
      setWidthPx(px);

      if (persist) {
        writeShellCookie({ open, width: px });
      }
    },
    [open, persist]
  );

  const toggleSidebar = useCallback(() => {
    if (isNarrow) {
      setOpenNarrow(!narrowOpen);
    } else {
      setOpen(!open);
    }
  }, [isNarrow, narrowOpen, open, setOpen, setOpenNarrow]);

  // The listeners below are added once and call the latest toggle.
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
        event.key.toLowerCase() !== shortcut.toLowerCase()
      ) {
        return;
      }

      event.preventDefault();
      setInput("keyboard");
      toggleLatest.current();
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [shortcut]);

  const value = useMemo<AppShellContextValue>(() => {
    const key = shortcut ? shortcut.toUpperCase() : "";

    return {
      ids: {
        main: `${base}main`,
        sidebar: `${base}sidebar`,
        toggle: `${base}toggle`,
      },
      input,
      isNarrow,
      labels: { ...APP_SHELL_LABELS, ...labelOverrides },
      open,
      openNarrow: narrowOpen,
      refs: { main: mainRef, sidebar: sidebarRef, toggle: toggleRef },
      rootRef: setRootElement,
      setOpen,
      setOpenNarrow,
      setWidth,
      shortcut: shortcut
        ? {
            aria: apple ? `Meta+${key}` : `Control+${key}`,
            display: apple ? `⌘${key}` : `Ctrl+${key}`,
          }
        : null,
      toggleSidebar,
      width: widthPx,
    };
  }, [
    apple,
    base,
    input,
    isNarrow,
    labelOverrides,
    open,
    narrowOpen,
    setOpen,
    setOpenNarrow,
    setWidth,
    shortcut,
    toggleSidebar,
    widthPx,
  ]);

  return <AppShellContext value={value}>{children}</AppShellContext>;
};
