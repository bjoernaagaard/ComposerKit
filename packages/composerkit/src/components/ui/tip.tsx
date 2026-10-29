// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

import { Tooltip } from "@base-ui/react/tooltip";
import type { ReactElement, ReactNode } from "react";

import { usePopupLayer } from "@/components/ui/popup-layer";
import { themeMilliseconds, themePixels } from "@/components/ui/theme-value";

// Used on the server and before the theme's CSS has loaded.
const FALLBACK_DELAY_MS = 200;
const FALLBACK_CLOSE_DELAY_MS = 0;
const FALLBACK_OFFSET = 2;

// Every tooltip waits the full delay, even right after another one closed,
// and closes as soon as the pointer leaves. Base UI's Tooltip.Provider
// opens a neighbour at once while a group is active, so there is no group:
// each Tip sets its own delays. This stays as the place to wrap an app, so
// apps written against the earlier grouped version keep working.
export interface TipProviderProps {
  children: ReactNode;
}

export const TipProvider = ({ children }: TipProviderProps) => children;

// A short visible label for an icon-only control. It opens on hover and on
// keyboard focus. The control keeps its own aria-label, so the tooltip
// never carries the accessible name alone. The child must be one element
// that accepts a ref, such as a button. It is centered on the control and
// moves to the other side when there is no room. A label too long for
// one line ends in an ellipsis; the control's aria-label keeps it whole.
export interface TipProps {
  label: string;
  side?: "top" | "right" | "bottom" | "left";
  children: ReactElement;
}

export const Tip = ({ label, side = "bottom", children }: TipProps) => (
  <Tooltip.Root>
    <Tooltip.Trigger
      closeDelay={themeMilliseconds(
        "--motion-tooltip-close-delay",
        FALLBACK_CLOSE_DELAY_MS
      )}
      delay={themeMilliseconds("--motion-tooltip-delay", FALLBACK_DELAY_MS)}
      render={children}
    />
    <Tooltip.Portal container={usePopupLayer()}>
      <Tooltip.Positioner
        className="isolate z-50"
        positionMethod="fixed"
        side={side}
        sideOffset={() =>
          themePixels("--space-tooltip-offset", FALLBACK_OFFSET)
        }
      >
        <Tooltip.Popup
          className="bg-popover text-popover-foreground border-border z-50 flex h-(--size-tooltip-height) max-w-[min(--spacing(80),var(--available-width))] items-center rounded-(--radius-tooltip) border-(length:--border-panel) px-(--space-tooltip-padding-x) text-(length:--text-caption-size) leading-(--text-caption-leading) shadow-(--shadow-menu)"
          data-slot="tooltip"
        >
          <span className="min-w-0 truncate">{label}</span>
        </Tooltip.Popup>
      </Tooltip.Positioner>
    </Tooltip.Portal>
  </Tooltip.Root>
);
