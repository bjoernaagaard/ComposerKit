// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

"use client";

import { useRender } from "@base-ui/react/use-render";
import { useEffect, useRef } from "react";
import type { ComponentProps } from "react";

import {
  useAppShell,
  useAppShellLabels,
} from "@/components/app-shell/app-shell-provider";
import type { AppShellLabels } from "@/components/app-shell/labels";
import { cn } from "@/lib/utils";

// The window: a title bar across the top, then the rail, the sidebar and
// the main region side by side. Each part places itself in the grid, so an
// app can leave out the rail or the sidebar. The root carries the shell's
// state for styling:
//   data-sidebar          expanded or collapsed
//   data-sidebar-variant  push (beside the main region) or overlay (narrow)
//   data-input            pointer or keyboard, the last input type
// --shell-sidebar-width is the room the sidebar takes: its width when it
// is expanded beside the main region, and 0 otherwise.
export type AppShellProps = Omit<ComponentProps<"div">, "ref">;

export const AppShell = ({ className, ...props }: AppShellProps) => {
  const { rootRef, isNarrow, open, openNarrow, input } = useAppShell();
  const expanded = isNarrow ? openNarrow : open;

  return (
    <div
      className={cn(
        "group/shell bg-window text-foreground relative grid h-full min-h-0 grid-cols-[auto_auto_minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)] [--shell-sidebar-width:0px] data-[sidebar=expanded]:data-[sidebar-variant=push]:[--shell-sidebar-width:var(--size-sidebar)]",
        className
      )}
      data-input={input}
      data-sidebar={expanded ? "expanded" : "collapsed"}
      data-sidebar-variant={isNarrow ? "overlay" : "push"}
      data-slot="app-shell"
      ref={rootRef}
      {...props}
    />
  );
};

export interface AppShellSkipLinkProps extends Omit<
  ComponentProps<"a">,
  "children" | "href"
> {
  labels?: Partial<AppShellLabels>;
}

// The first Tab stop. It stays out of sight until it has focus, and moves
// focus to the main region, past the title bar, the rail and the sidebar.
export const AppShellSkipLink = ({
  className,
  labels,
  onClick,
  ...props
}: AppShellSkipLinkProps) => {
  const { ids, refs } = useAppShell();
  const text = useAppShellLabels(labels);

  return (
    <a
      className={cn(
        "bg-background text-foreground border-border absolute start-2 top-2 z-50 rounded-(--radius-control) border-(length:--border-hairline) px-3 py-1.5 text-(length:--text-label-size) leading-(--text-label-leading) font-(--weight-medium) shadow-(--shadow-menu) not-focus:sr-only",
        className
      )}
      data-slot="skip-link"
      href={`#${ids.main}`}
      onClick={(event) => {
        onClick?.(event);

        if (event.defaultPrevented) {
          return;
        }

        // Focus moves without changing the address.
        event.preventDefault();
        refs.main.current?.focus();
      }}
      {...props}
    >
      {text.skipToContent}
    </a>
  );
};

// render swaps the <aside> for another element, such as a <section> when
// the shell sits inside a page that already has its landmarks.
export interface AppShellSidebarProps extends Omit<
  useRender.ComponentProps<"aside">,
  "id" | "ref"
> {
  labels?: Partial<AppShellLabels>;
}

// The sidebar stays mounted when it is collapsed, so its search, its scroll
// position and anything else inside it are still there when it opens. A
// collapsed sidebar is inert. Beside the main region (push), a spacer
// animates its width while the panel slides in from the rail's edge; a
// change from the keyboard is instant. On narrow shells (overlay) the
// panel covers the page with a scrim behind it.
export const AppShellSidebar = ({
  className,
  children,
  labels,
  render,
  ...props
}: AppShellSidebarProps) => {
  const {
    ids,
    refs: { sidebar: sidebarRef, toggle },
    isNarrow,
    open,
    openNarrow,
    setOpenNarrow,
  } = useAppShell();

  const text = useAppShellLabels(labels);
  const expanded = isNarrow ? openNarrow : open;
  const overlay = isNarrow && openNarrow;
  const panel = useRef<HTMLDivElement>(null);

  // Over the page, focus moves into the panel, and Escape closes it and
  // hands focus back to the toggle. An Escape that a menu already handled
  // is skipped.
  useEffect(() => {
    if (!overlay) {
      return;
    }

    panel.current?.querySelector<HTMLElement>("button")?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) {
        setOpenNarrow(false);
        toggle.current?.focus();
      }
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [overlay, setOpenNarrow, toggle]);

  const sidebar = useRender({
    defaultTagName: "aside",
    props: {
      "aria-label": text.sidebar,
      children: (
        <div
          className="group-data-[sidebar-variant=overlay]/shell:bg-window absolute inset-y-0 start-0 flex w-(--size-sidebar) translate-x-(--shell-sidebar-offset) opacity-0 transition duration-0 ease-(--motion-ease-drawer) [--shell-sidebar-offset:-100%] group-data-[input=pointer]/shell:duration-(--motion-sidebar-exit) group-data-[sidebar-variant=overlay]/shell:max-w-[calc(100vw-var(--size-rail))] group-data-[sidebar-variant=overlay]/shell:shadow-(--shadow-drawer) group-data-[sidebar=expanded]/shell:translate-x-0 group-data-[sidebar=expanded]/shell:opacity-100 group-data-[input=pointer]/shell:group-data-[sidebar=expanded]/shell:duration-(--motion-sidebar-enter) motion-reduce:translate-none! rtl:[--shell-sidebar-offset:100%]"
          data-slot="sidebar-panel"
          data-state={expanded ? "open" : "closed"}
          ref={panel}
        >
          {children}
        </div>
      ),
      className: cn(
        "relative z-10 col-start-2 row-start-2 min-h-0 w-(--shell-sidebar-width) transition-all duration-0 ease-(--motion-ease-drawer) [clip-path:inset(-100vh_-100vw_-100vh_0)] group-data-[input=pointer]/shell:duration-(--motion-sidebar-exit) group-data-[sidebar-variant=overlay]/shell:z-30 group-data-[input=pointer]/shell:group-data-[sidebar=expanded]/shell:duration-(--motion-sidebar-enter) rtl:[clip-path:inset(-100vh_0_-100vh_-100vw)]",
        className
      ),
      "data-slot": "sidebar-gap",
      "data-state": expanded ? "open" : "closed",
      id: ids.sidebar,
      inert: !expanded,
      ...props,
    },
    ref: sidebarRef,
    render,
  });

  return (
    <>
      {sidebar}
      {overlay ? (
        <button
          aria-label={text.closeSidebar}
          className="absolute inset-0 z-20 col-span-full row-start-2 bg-(--scrim)"
          data-slot="sidebar-scrim"
          onClick={() => {
            setOpenNarrow(false);
            toggle.current?.focus();
          }}
          type="button"
        />
      ) : null}
    </>
  );
};

export type AppShellMainProps = Omit<
  useRender.ComponentProps<"main">,
  "id" | "ref" | "tabIndex"
>;

// The main region. The skip link moves focus here, so it takes focus from
// script but is not a Tab stop. Popups can mount inside it, so every part
// of the page sits in a landmark. render swaps the <main> for another
// element, such as a <div> when the shell sits inside a page that already
// has a main landmark.
export const AppShellMain = ({
  className,
  render,
  ...props
}: AppShellMainProps) => {
  const {
    ids,
    refs: { main: mainRef },
    isNarrow,
    open,
  } = useAppShell();

  return useRender({
    defaultTagName: "main",
    props: {
      className: cn(
        "bg-background relative col-start-3 row-start-2 min-h-0 min-w-0 overflow-y-auto outline-none",
        open && !isNarrow
          ? "border-border border-s-(length:--border-hairline)"
          : "",
        className
      ),
      "data-slot": "main-sheet",
      id: ids.main,
      tabIndex: -1,
      ...props,
    },
    ref: mainRef,
    render,
  });
};
