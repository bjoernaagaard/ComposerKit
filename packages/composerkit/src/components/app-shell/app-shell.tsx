// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

"use client";

import { useDirection } from "@base-ui/react/direction-provider";
import { Drawer } from "@base-ui/react/drawer";
import { useRender } from "@base-ui/react/use-render";
import { useState } from "react";
import type { ComponentProps, ReactNode } from "react";

import {
  useAppShell,
  useAppShellLabels,
} from "@/components/app-shell/app-shell-provider";
import type { AppShellLabels } from "@/components/app-shell/labels";
import { PopupLayer } from "@/components/ui/popup-layer";
import { cn } from "@/lib/utils";

// The window: a title bar across the top, then the rail, the sidebar and
// the main region side by side. Each part places itself in the grid, so an
// app can leave out the rail or the sidebar. The root carries the shell's
// state for styling:
//   data-sidebar          expanded or collapsed
//   data-sidebar-variant  push (beside the main region) or overlay (narrow)
//   data-input            pointer or keyboard, the last input type
//   data-resizing         while a pointer drags the splitter
// --shell-sidebar-width is the room the sidebar takes: its width when it
// is expanded beside the main region, and 0 otherwise. A width the person
// chose with the splitter is drawn as --size-sidebar here, so until then
// the theme's width applies.
export type AppShellProps = Omit<ComponentProps<"div">, "ref">;

export const AppShell = ({ className, style, ...props }: AppShellProps) => {
  const { rootRef, isNarrow, open, openNarrow, input, resizing, chosenWidth } =
    useAppShell();

  const expanded = isNarrow ? openNarrow : open;

  // Spread in, so it type-checks in apps whose CSSProperties doesn't list
  // custom properties.
  const drawnWidth = { "--size-sidebar": `${chosenWidth}px` };

  return (
    <div
      className={cn(
        "group/shell bg-window text-foreground relative grid h-full min-h-0 grid-cols-[auto_auto_minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)] [--shell-sidebar-width:0px] data-[sidebar=expanded]:data-[sidebar-variant=push]:[--shell-sidebar-width:var(--size-sidebar)]",
        className
      )}
      data-input={input}
      data-resizing={resizing ? "" : undefined}
      data-sidebar={expanded ? "expanded" : "collapsed"}
      data-sidebar-variant={isNarrow ? "overlay" : "push"}
      data-slot="app-shell"
      ref={rootRef}
      style={chosenWidth === null ? style : { ...drawnWidth, ...style }}
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

// The narrow sidebar: a modal Base UI Drawer over the shell, below the
// title bar. It is a dialog named by labels.sidebar. Focus moves in when it
// opens and stays in, and the rest of the shell is hidden from assistive
// technology. Escape, a press on the backdrop or a swipe toward the
// leading edge closes it, and focus goes back to the sidebar toggle, or to
// the main region after closeNarrowAndFocusMain. It is at most
// 100% - 48px wide, so a strip of backdrop is always there to tap. The
// rail's destinations move into the row at its top. It stays mounted while
// closed, so the sidebar keeps its search and scroll. Menus and tooltips
// inside it mount inside it too, because the page behind is hidden.
const AppShellSidebarDrawer = ({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) => {
  const {
    ids,
    refs: { root },
    input,
    narrowFinalFocus,
    openNarrow,
    setOpenNarrow,
    setRailSlot,
  } = useAppShell();

  const direction = useDirection();
  const [layer, setLayer] = useState<HTMLDivElement | null>(null);

  return (
    <Drawer.Root
      modal
      onOpenChange={setOpenNarrow}
      open={openNarrow}
      swipeDirection={direction === "rtl" ? "right" : "left"}
    >
      <Drawer.Portal className="contents" container={root} keepMounted>
        <Drawer.Backdrop
          className="absolute inset-0 z-30 col-span-full row-start-2 bg-(--scrim) opacity-(--shell-scrim-opacity) transition-opacity duration-0 ease-(--motion-ease-out) [--shell-scrim-opacity:calc(1-var(--drawer-swipe-progress))] group-data-[input=pointer]/shell:duration-(--motion-overlay-enter) data-ending-style:opacity-0 group-data-[input=pointer]/shell:data-ending-style:duration-(--motion-overlay-exit) data-starting-style:opacity-0 data-swiping:duration-0"
          data-slot="sidebar-scrim"
        />
        {/* The viewport handles the swipe that closes the drawer. It has no
            box of its own, so the popup still sits in the shell's grid. */}
        <Drawer.Viewport className="contents">
          <Drawer.Popup
            // Base UI hides the rest of the page with aria-hidden, except live
            // regions and what holds them; aria-modal tells screen readers the
            // whole page behind is out of reach.
            aria-modal="true"
            className="bg-sidebar absolute inset-y-0 start-0 z-40 col-span-full row-start-2 flex w-[min(var(--size-sidebar),100%-48px)] [transform:translateX(var(--drawer-swipe-movement-x))] flex-col ps-(--shell-drawer-inset) shadow-(--shadow-drawer) transition duration-0 ease-(--motion-ease-drawer) outline-none [--shell-drawer-exit:calc(var(--drawer-swipe-strength)*var(--motion-overlay-exit))] [--shell-drawer-inset:env(safe-area-inset-left)] group-data-[input=pointer]/shell:duration-(--motion-overlay-enter) group-data-[input=pointer]/shell:data-ending-style:duration-(--shell-drawer-exit) data-swiping:duration-0 data-swiping:select-none motion-safe:data-ending-style:[transform:translateX(-100%)] motion-safe:data-starting-style:[transform:translateX(-100%)] motion-reduce:data-ending-style:opacity-0 motion-reduce:data-starting-style:opacity-0 rtl:[--shell-drawer-inset:env(safe-area-inset-right)] rtl:motion-safe:data-ending-style:[transform:translateX(100%)] rtl:motion-safe:data-starting-style:[transform:translateX(100%)]"
            data-slot="sidebar-panel"
            data-state={openNarrow ? "open" : "closed"}
            data-variant="overlay"
            finalFocus={narrowFinalFocus}
            id={ids.sidebar}
            // From the keyboard, focus goes to the first control. From a
            // pointer it goes to the dialog itself, so a touch doesn't land on
            // a control or open the on-screen keyboard.
            initialFocus={input === "keyboard" ? true : undefined}
          >
            <Drawer.Title className="sr-only">{title}</Drawer.Title>
            <div className="contents" ref={setRailSlot} />
            <div className="flex min-h-0 flex-1">
              <PopupLayer container={layer}>{children}</PopupLayer>
            </div>
            <div ref={setLayer} />
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
};

// render swaps the <aside> for another element, such as a <section> when
// the shell sits inside a page that already has its landmarks. On narrow
// shells the sidebar is a dialog instead, and these props don't apply.
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
// change from the keyboard is instant. On narrow shells it is a modal
// drawer instead: see AppShellSidebarDrawer.
export const AppShellSidebar = ({
  className,
  children,
  labels,
  render,
  ...props
}: AppShellSidebarProps) => {
  const {
    ids,
    refs: { sidebar: sidebarRef },
    isNarrow,
    open,
  } = useAppShell();

  const text = useAppShellLabels(labels);

  const sidebar = useRender({
    defaultTagName: "aside",
    enabled: !isNarrow,
    props: {
      "aria-label": text.sidebar,
      children: (
        <div
          className="absolute inset-y-0 start-0 flex w-(--size-sidebar) translate-x-(--shell-sidebar-offset) opacity-0 transition duration-0 ease-(--motion-ease-drawer) [--shell-sidebar-offset:-100%] group-data-[input=pointer]/shell:duration-(--motion-sidebar-exit) group-data-[sidebar=expanded]/shell:translate-x-0 group-data-[sidebar=expanded]/shell:opacity-100 group-data-[input=pointer]/shell:group-data-[sidebar=expanded]/shell:duration-(--motion-sidebar-enter) motion-reduce:translate-none! rtl:[--shell-sidebar-offset:100%]"
          data-slot="sidebar-panel"
          data-state={open ? "open" : "closed"}
          data-variant="push"
        >
          {children}
        </div>
      ),
      className: cn(
        "relative z-10 col-start-2 row-start-2 min-h-0 w-(--shell-sidebar-width) transition-all duration-0 ease-(--motion-ease-drawer) [clip-path:inset(-100vh_-100vw_-100vh_0)] group-data-[input=pointer]/shell:duration-(--motion-sidebar-exit) group-data-[input=pointer]/shell:group-data-[sidebar=expanded]/shell:duration-(--motion-sidebar-enter) rtl:[clip-path:inset(-100vh_0_-100vh_-100vw)]",
        className
      ),
      "data-slot": "sidebar-gap",
      "data-state": open ? "open" : "closed",
      id: ids.sidebar,
      inert: !open,
      ...props,
    },
    ref: sidebarRef,
    render,
  });

  if (isNarrow) {
    return (
      <AppShellSidebarDrawer title={text.sidebar}>
        {children}
      </AppShellSidebarDrawer>
    );
  }

  return sidebar;
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
