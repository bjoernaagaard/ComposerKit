// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

"use client";

import type { LucideIcon } from "lucide-react";
import { createContext, use } from "react";
import type { ComponentProps } from "react";
import { createPortal } from "react-dom";

import {
  useAppShellLabels,
  useOptionalAppShell,
} from "@/components/app-shell/app-shell-provider";
import type { AppShellLabels } from "@/components/app-shell/labels";
import { Button } from "@/components/ui/button";
import { PopupLayer } from "@/components/ui/popup-layer";
import { Tip } from "@/components/ui/tip";
import { cn } from "@/lib/utils";

// side: a column at the window's leading edge. drawer: a row of icons at
// the top of the narrow drawer.
export type AppShellRailPlacement = "side" | "drawer";

const RailPlacementContext = createContext<AppShellRailPlacement>("side");

export interface AppShellRailProps extends ComponentProps<"nav"> {
  labels?: Partial<AppShellLabels>;
}

// The destinations, a navigation landmark named by labels.rail ("Main").
// On wide shells it is a column at the window's leading edge, with a
// hairline divider on its inline-end edge. On narrow shells the chats get
// the whole width, so the rail moves into the sidebar's drawer as a row of
// icons at its top, and nothing is drawn beside the main region. Without an AppShellSidebar there is no drawer,
// so a narrow shell shows no rail.
export const AppShellRail = ({
  className,
  labels,
  ...props
}: AppShellRailProps) => {
  const text = useAppShellLabels(labels);
  const shell = useOptionalAppShell();
  const placement: AppShellRailPlacement = shell?.isNarrow ? "drawer" : "side";

  const rail = (
    <RailPlacementContext value={placement}>
      <nav
        aria-label={text.rail}
        className={cn(
          placement === "side"
            ? "border-border col-start-1 row-start-2 flex min-h-0 w-(--size-rail) shrink-0 flex-col items-center border-e-(length:--border-hairline) pb-1"
            : "border-border flex min-w-0 shrink-0 items-center gap-1 border-b-(length:--border-hairline) ps-1 pe-2",
          className
        )}
        data-placement={placement}
        data-slot="icon-rail"
        {...props}
      />
    </RailPlacementContext>
  );

  if (placement === "side") {
    return rail;
  }

  // The page behind the drawer is hidden, so the rail's menus and tooltips
  // mount inside the drawer too.
  return shell?.railSlot
    ? createPortal(
        <PopupLayer container={shell.railSlot}>{rail}</PopupLayer>,
        shell.railSlot
      )
    : null;
};

// The destinations. They scroll when the window is short, and the footer
// stays put. The scroll box spans the whole rail and the buttons center in
// it, so a focus ring, or a design's button wider than the token padding
// leaves, is drawn in full instead of cut or squeezed. When it scrolls,
// its scroll padding keeps the focused button's ring in view too.
// In the drawer the destinations are a row that scrolls sideways when
// they don't fit.
export const AppShellRailContent = ({
  className,
  ...props
}: ComponentProps<"div">) => {
  const placement = use(RailPlacementContext);

  return (
    <div
      className={cn(
        placement === "side"
          ? "flex min-h-0 w-full flex-1 scroll-py-1 flex-col items-center gap-(--space-rail-gap) overflow-x-hidden overflow-y-auto pt-(--space-rail-padding) pb-1"
          : "flex min-w-0 flex-1 scroll-px-1 [scrollbar-width:thin] items-center gap-1 overflow-x-auto overflow-y-hidden p-1",
        className
      )}
      data-slot="rail-content"
      {...props}
    />
  );
};

export type AppShellRailItemProps = Omit<
  ComponentProps<typeof Button>,
  "aria-label" | "children" | "size" | "variant"
> & {
  icon: LucideIcon;
  label: string;
  // The page this item opens is the one on screen.
  current?: boolean;
};

// One destination: an icon button named by its label, with the label in a
// tooltip. The current one gets a fill and a bar on its leading edge. Pass
// render={<a href="…" />} and nativeButton={false} for a real link.
// Inside the narrow drawer, picking a destination closes the drawer and
// moves focus to the main region, unless onClick calls preventDefault.
export const AppShellRailItem = ({
  icon: Glyph,
  label,
  current = false,
  onClick,
  ...props
}: AppShellRailItemProps) => {
  const placement = use(RailPlacementContext);
  const shell = useOptionalAppShell();

  return (
    <Tip label={label} side={placement === "side" ? "right" : "bottom"}>
      <Button
        aria-current={current ? "page" : undefined}
        aria-label={label}
        data-rail-item=""
        onClick={(event) => {
          onClick?.(event);

          if (placement === "drawer" && !event.defaultPrevented) {
            shell?.closeNarrowAndFocusMain();
          }
        }}
        size="icon-lg"
        variant="quiet"
        {...props}
      >
        <Glyph aria-hidden="true" />
      </Button>
    </Tip>
  );
};

// A short rule between groups of destinations.
// In the drawer's row it stands upright.
export const AppShellRailSeparator = ({
  className,
  ...props
}: ComponentProps<"hr">) => {
  const placement = use(RailPlacementContext);

  return (
    <hr
      className={cn(
        "border-input",
        placement === "side"
          ? "my-px w-5"
          : "mx-px h-5 w-0 shrink-0 border-s border-t-0",
        className
      )}
      data-slot="rail-separator"
      {...props}
    />
  );
};

// The foot of the rail, such as the account button. In the drawer it ends
// the row.
export const AppShellRailFooter = ({
  className,
  ...props
}: ComponentProps<"div">) => {
  const placement = use(RailPlacementContext);

  return (
    <div
      className={cn(
        "flex items-center",
        placement === "side" ? "flex-col" : "shrink-0",
        className
      )}
      data-slot="rail-footer"
      {...props}
    />
  );
};
