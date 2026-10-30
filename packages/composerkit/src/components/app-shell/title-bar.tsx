// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

"use client";

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  PanelLeftIcon,
  PlusIcon,
} from "lucide-react";
import type { ComponentProps } from "react";

import {
  useAppShell,
  useAppShellLabels,
} from "@/components/app-shell/app-shell-provider";
import type { AppShellLabels } from "@/components/app-shell/labels";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Tip } from "@/components/ui/tip";
import { cn } from "@/lib/utils";

// The banner across the top of the window. In a desktop window with no
// frame (Electron, Tauri, an installed web app), its empty space drags the
// window and its controls stay clickable; app-shell.css holds those rules.
// On narrow shells it wraps, so the actions get a row of their own.
export const AppShellTitleBar = ({
  className,
  ...props
}: ComponentProps<"header">) => (
  <header
    className={cn(
      "col-span-full row-start-1 flex h-(--size-titlebar) min-w-0 shrink-0 items-center group-data-[sidebar-variant=overlay]/shell:h-auto group-data-[sidebar-variant=overlay]/shell:flex-wrap",
      className
    )}
    data-slot="title-bar"
    {...props}
  />
);

// The leading group: history and the sidebar toggle. It starts after the
// window controls (see app-shell.css) and is at least as wide as the rail and the open
// sidebar, so the tabs line up with the main region and travel with the
// sidebar on the same curve.
export const AppShellTitleBarStart = ({
  className,
  ...props
}: ComponentProps<"div">) => (
  <div
    className={cn(
      "flex w-[calc(var(--size-rail)+var(--shell-sidebar-width))] min-w-fit shrink-0 items-center gap-1.5 ps-(--space-titlebar-inset-start) pe-2 transition-all duration-0 ease-(--motion-ease-drawer) group-data-[input=pointer]/shell:duration-(--motion-sidebar-exit) group-data-[input=pointer]/shell:group-data-[sidebar=expanded]/shell:duration-(--motion-sidebar-enter)",
      className
    )}
    data-slot="title-bar-nav"
    {...props}
  />
);

export interface AppShellHistoryProps {
  canGoBack: boolean;
  canGoForward: boolean;
  onBack: () => void;
  onForward: () => void;
  labels?: Partial<AppShellLabels>;
}

// Back and forward through the open tab's history.
export const AppShellHistory = ({
  canGoBack,
  canGoForward,
  onBack,
  onForward,
  labels,
}: AppShellHistoryProps) => {
  const text = useAppShellLabels(labels);

  return (
    <>
      <IconButton
        disabled={!canGoBack}
        icon={ArrowLeftIcon}
        kind="small"
        label={text.back}
        onClick={onBack}
      />
      <IconButton
        disabled={!canGoForward}
        icon={ArrowRightIcon}
        kind="small"
        label={text.forward}
        onClick={onForward}
      />
    </>
  );
};

export interface AppShellSidebarToggleProps {
  labels?: Partial<AppShellLabels>;
}

// Shows and hides the sidebar. It names the shortcut for assistive
// technology and in its tooltip, such as "Hide sidebar ⌘B".
export const AppShellSidebarToggle = ({
  labels,
}: AppShellSidebarToggleProps) => {
  const {
    ids,
    refs: { toggle: toggleRef },
    isNarrow,
    open,
    openNarrow,
    shortcut,
    toggleSidebar,
  } = useAppShell();

  const text = useAppShellLabels(labels);
  const expanded = isNarrow ? openNarrow : open;
  const label = expanded ? text.hideSidebar : text.showSidebar;

  return (
    <Tip label={shortcut ? text.withShortcut(label, shortcut.display) : label}>
      <Button
        aria-controls={ids.sidebar}
        aria-expanded={expanded}
        aria-keyshortcuts={shortcut?.aria}
        aria-label={label}
        data-kind="small"
        data-slot="icon-button"
        id={ids.toggle}
        onClick={toggleSidebar}
        ref={toggleRef}
        size="icon-sm"
        variant="quiet"
      >
        <PanelLeftIcon aria-hidden="true" />
      </Button>
    </Tip>
  );
};

// The middle group, which holds the tabs and grows to fill the bar.
export const AppShellTitleBarTabs = ({
  className,
  ...props
}: ComponentProps<"div">) => (
  <div
    className={cn("flex min-w-0 flex-1 items-center gap-2 px-2", className)}
    data-slot="title-bar-tabs"
    {...props}
  />
);

export interface AppShellNewTabProps {
  onNewTab: () => void;
  labels?: Partial<AppShellLabels>;
}

export const AppShellNewTab = ({ onNewTab, labels }: AppShellNewTabProps) => {
  const text = useAppShellLabels(labels);

  return <IconButton icon={PlusIcon} label={text.newTab} onClick={onNewTab} />;
};

// The trailing group, for the app's own actions.
export const AppShellTitleBarEnd = ({
  className,
  ...props
}: ComponentProps<"div">) => (
  <div
    className={cn(
      "flex shrink-0 items-center px-2 group-data-[sidebar-variant=overlay]/shell:w-full group-data-[sidebar-variant=overlay]/shell:justify-end group-data-[sidebar-variant=overlay]/shell:pb-1",
      className
    )}
    data-slot="title-bar-actions"
    {...props}
  />
);
