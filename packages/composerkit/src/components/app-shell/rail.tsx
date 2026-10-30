// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

"use client";

import type { LucideIcon } from "lucide-react";
import type { ComponentProps } from "react";

import { useAppShellLabels } from "@/components/app-shell/app-shell-provider";
import type { AppShellLabels } from "@/components/app-shell/labels";
import { Button } from "@/components/ui/button";
import { Tip } from "@/components/ui/tip";
import { cn } from "@/lib/utils";

export interface AppShellRailProps extends ComponentProps<"nav"> {
  labels?: Partial<AppShellLabels>;
}

// The column of destinations at the window's leading edge, a navigation
// landmark named by labels.rail ("Main").
export const AppShellRail = ({
  className,
  labels,
  ...props
}: AppShellRailProps) => {
  const text = useAppShellLabels(labels);

  return (
    <nav
      aria-label={text.rail}
      className={cn(
        "col-start-1 row-start-2 flex min-h-0 w-(--size-rail) shrink-0 flex-col items-center pb-1",
        className
      )}
      data-slot="icon-rail"
      {...props}
    />
  );
};

// The destinations. They scroll when the window is short, and the footer
// stays put. The scroll box spans the whole rail and the buttons center in
// it, so a focus ring, or a design's button wider than the token padding
// leaves, is drawn in full instead of cut or squeezed. When it scrolls,
// its scroll padding keeps the focused button's ring in view too.
export const AppShellRailContent = ({
  className,
  ...props
}: ComponentProps<"div">) => (
  <div
    className={cn(
      "flex min-h-0 w-full flex-1 scroll-py-1 flex-col items-center gap-(--space-rail-gap) overflow-x-hidden overflow-y-auto pt-(--space-rail-padding) pb-1",
      className
    )}
    data-slot="rail-content"
    {...props}
  />
);

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
export const AppShellRailItem = ({
  icon: Glyph,
  label,
  current = false,
  ...props
}: AppShellRailItemProps) => (
  <Tip label={label} side="right">
    <Button
      aria-current={current ? "page" : undefined}
      aria-label={label}
      data-rail-item=""
      size="icon-lg"
      variant="quiet"
      {...props}
    >
      <Glyph aria-hidden="true" />
    </Button>
  </Tip>
);

// A short rule between groups of destinations.
export const AppShellRailSeparator = ({
  className,
  ...props
}: ComponentProps<"hr">) => (
  <hr
    className={cn("border-input my-px w-5", className)}
    data-slot="rail-separator"
    {...props}
  />
);

// The foot of the rail, such as the account button.
export const AppShellRailFooter = ({
  className,
  ...props
}: ComponentProps<"div">) => (
  <div
    className={cn("flex flex-col items-center", className)}
    data-slot="rail-footer"
    {...props}
  />
);
