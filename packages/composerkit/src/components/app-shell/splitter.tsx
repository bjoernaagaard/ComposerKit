// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

"use client";

import { useEffect, useRef } from "react";
import type { ComponentProps, KeyboardEvent, PointerEvent } from "react";

import {
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  useAppShell,
  useAppShellLabels,
} from "@/components/app-shell/app-shell-provider";
import type { AppShellLabels } from "@/components/app-shell/labels";
import { cn } from "@/lib/utils";

const STEP = 16;
const FINE_STEP = 8;

// The splitter sets its role, value, focus and the handlers that resize.
export interface AppShellSplitterProps extends Omit<
  ComponentProps<"div">,
  | "children"
  | "ref"
  | "role"
  | "tabIndex"
  | "onDoubleClick"
  | "onKeyDown"
  | "onLostPointerCapture"
  | "onPointerCancel"
  | "onPointerDown"
  | "onPointerMove"
  | "onPointerUp"
> {
  labels?: Partial<AppShellLabels>;
}

interface Drag {
  pointerId: number;
  startX: number;
  startWidth: number;
  rtl: boolean;
}

const isRtl = (element: Element) =>
  getComputedStyle(element).direction === "rtl";

// The WAI-ARIA window splitter on the sidebar's inline-end edge. Place it
// after AppShellSidebar. It is a focusable separator whose value is the
// sidebar's width, from 220 to 480 px:
//   ArrowLeft, ArrowRight  narrower or wider by 16 px, or 8 with Shift,
//                          mirrored in right-to-left layouts
//   Home, End              220 or 480
//   Enter                  hides the sidebar and moves focus to the sidebar
//                          toggle, where Enter shows it again at its width
//   double click           back to --size-sidebar, the theme's width
//   pointer drag           the edge follows the pointer
// The 16 px hit area draws a 1 px line on hover, on focus and during a
// drag. A design moves the line with --shell-splitter-offset and colors it
// with --shell-splitter-line. It renders nothing on narrow shells, where
// the sidebar is a drawer, or while the sidebar is hidden.
export const AppShellSplitter = ({
  className,
  labels,
  ...props
}: AppShellSplitterProps) => {
  const { ids, isNarrow, open, refs, setOpen, setResizing, setWidth, width } =
    useAppShell();

  const text = useAppShellLabels(labels);
  const drag = useRef<Drag | null>(null);
  const hidden = isNarrow || !open;

  // A drag also ends when the splitter goes away under the pointer, such
  // as when a shortcut hides the sidebar, since no pointer event reaches
  // it then. The cookie is written with the width the drag reached.
  useEffect(() => {
    if (hidden) {
      return;
    }

    return () => {
      if (drag.current) {
        drag.current = null;
        setResizing(false);
      }
    };
  }, [hidden, setResizing]);

  if (hidden) {
    return null;
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    const step = event.shiftKey ? FINE_STEP : STEP;
    const wider = isRtl(event.currentTarget) ? "ArrowLeft" : "ArrowRight";

    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      setWidth(width + (event.key === wider ? step : -step));
    } else if (event.key === "Home") {
      setWidth(SIDEBAR_MIN_WIDTH);
    } else if (event.key === "End") {
      setWidth(SIDEBAR_MAX_WIDTH);
    } else if (event.key === "Enter") {
      // The splitter goes away with the sidebar, so focus moves first.
      (refs.toggle.current ?? refs.main.current)?.focus();
      setOpen(false);
    } else {
      return;
    }

    event.preventDefault();
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }

    // A drag never selects text.
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      pointerId: event.pointerId,
      rtl: isRtl(event.currentTarget),
      startWidth: width,
      startX: event.clientX,
    };
    setResizing(true);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const { current } = drag;

    if (current?.pointerId !== event.pointerId) {
      return;
    }

    const moved = event.clientX - current.startX;

    setWidth(current.startWidth + (current.rtl ? -moved : moved));
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId !== event.pointerId) {
      return;
    }

    drag.current = null;
    setResizing(false);
  };

  return (
    <div
      aria-controls={ids.sidebar}
      aria-label={text.resizeSidebar}
      aria-orientation="vertical"
      aria-valuemax={SIDEBAR_MAX_WIDTH}
      aria-valuemin={SIDEBAR_MIN_WIDTH}
      aria-valuenow={Math.round(width)}
      className={cn(
        "relative z-20 col-start-3 row-start-2 -ms-[calc(var(--size-splitter-hit)/2)] w-(--size-splitter-hit) cursor-col-resize touch-none justify-self-start outline-none select-none [--shell-splitter-line:var(--ring)] after:pointer-events-none after:absolute after:inset-y-0 after:start-[calc(50%-0.5px+var(--shell-splitter-offset,0px))] after:w-px after:bg-transparent after:transition-colors after:duration-(--motion-duration) group-data-resizing/shell:after:bg-(--shell-splitter-line) hover:after:bg-(--shell-splitter-line) focus-visible:after:bg-(--shell-splitter-line)",
        className
      )}
      data-slot="sidebar-splitter"
      onDoubleClick={() => setWidth(null)}
      onKeyDown={onKeyDown}
      onLostPointerCapture={endDrag}
      onPointerCancel={endDrag}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- a window splitter is a focusable separator with a value, which <hr> can't be
      role="separator"
      tabIndex={0}
      {...props}
    />
  );
};
