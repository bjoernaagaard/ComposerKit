// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  CSSProperties,
  MouseEvent,
  PointerEvent,
  RefCallback,
} from "react";

import { pixelsOf, themeMilliseconds } from "@/components/ui/theme-value";

// A press becomes a drag after this many px, so a click stays a click.
const START_DISTANCE = 4;

// A finger that moves this far before --motion-drag-press is scrolling.
const TOUCH_SLOP = 8;

const FALLBACK_DRAG_PRESS_MS = 400;
const LIFT_BUZZ_MS = 10;

// How far the list scrolls each frame while the pointer is near its edge.
const EDGE_SCROLL_STEP = 8;

const FALLBACK_EDGE = 24;
const PRIMARY_BUTTON = 0;

export interface UseSortableOptions {
  // The items' ids in the order the list draws them.
  ids: readonly string[];
  orientation: "horizontal";
  enabled: boolean;
  // Called once on drop, only when the place changed. index is the item's
  // place after the move.
  onMove: (id: string, index: number) => void;
  // Shell state for styling, when there is a shell.
  onDraggingChange?: (dragging: boolean) => void;
  // Whether a press on the item may start a drag, such as not while it
  // animates out.
  canDrag?: (id: string) => boolean;
}

export interface SortableItemProps {
  "data-drag-pressed": "" | undefined;
  "data-dragging": "" | undefined;
  "data-sortable-id": string;
  onClickCapture: (event: MouseEvent<HTMLElement>) => void;
  onContextMenu: (event: MouseEvent<HTMLElement>) => void;
  onLostPointerCapture: (event: PointerEvent<HTMLElement>) => void;
  onPointerCancel: (event: PointerEvent<HTMLElement>) => void;
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLElement>) => void;
  style: CSSProperties | undefined;
}

export interface Sortable {
  listRef: RefCallback<HTMLElement>;
  // Spread on each item, the list's direct children.
  itemProps: (id: string) => SortableItemProps;
  // The id of the item being dragged.
  dragging: string | null;
}

// Measured once when the drag starts. Rects are in viewport px at that
// moment, so a scroll since then is added to the pointer's travel.
interface Drag {
  list: HTMLElement;
  box: DOMRect;
  rects: DOMRect[];
  from: number;
  slot: number;
  scrollStart: number;
  // -1 in right-to-left layouts, where the ids run from right to left.
  sign: number;
  gap: number;
  edge: number;
  frame: number;
}

interface Press {
  pointerId: number;
  id: string;
  ids: readonly string[];
  item: HTMLElement;
  startX: number;
  startY: number;
  x: number;
  y: number;
  touch: boolean;
  // Whether a move may start the drag. A finger has to hold still for
  // --motion-drag-press first, so a quick swipe still scrolls the list.
  ready: boolean;
  timer: number;
  // Set once the press passes START_DISTANCE.
  drag: Drag | null;
}

type View =
  | { phase: "idle" }
  // A finger held long enough: the item lifts before it moves.
  | { phase: "pressed"; id: string }
  | { phase: "dragging"; id: string; offsets: ReadonlyMap<string, number> }
  // The items stand in their new order, drawn once with no transition.
  | { phase: "dropped" };

const IDLE: View = { phase: "idle" };
const DROPPED: View = { phase: "dropped" };

// The browser starts a touch scroll on the first touchmove nobody cancels,
// and touch-action can't change once the finger is down.
const holdScroll = (event: TouchEvent) => {
  if (event.cancelable) {
    event.preventDefault();
  }
};

const sameIds = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((id, index) => id === b[index]);

// A pointer more than an item's height above or below the list puts the
// item back, so a press dragged off moves nothing.
const isAway = (press: Press, { box, rects, from }: Drag): boolean => {
  const height = rects[from]?.height ?? 0;

  return press.y < box.top - height || press.y > box.bottom + height;
};

// The place the item would land, from the slots' midpoints, and how far
// each item moves to show it: the dragged one follows the pointer inside
// the list, and those it passed step aside by its width.
interface Placement {
  slot: number;
  offsets: Map<string, number>;
}

const place = (press: Press, drag: Drag): Placement => {
  const { rects, from, sign, gap } = drag;
  const rect = rects[from];
  const offsets = new Map<string, number>();

  if (!rect || isAway(press, drag)) {
    return { offsets, slot: from };
  }

  const start = Math.min(...rects.map((other) => other.left));
  const end = Math.max(...rects.map((other) => other.right));

  const moved =
    press.x - press.startX + drag.list.scrollLeft - drag.scrollStart;

  const dx = Math.min(end - rect.right, Math.max(start - rect.left, moved));
  // The slot follows the pointer, not the drawn tab, which stops at the
  // ends, so a drag past the last tab still reaches the last place.
  const center = (rect.left + rect.width / 2 + moved) * sign;
  let slot = from;

  for (const [index, other] of rects.entries()) {
    const middle = (other.left + other.width / 2) * sign;

    if (index > from && center > middle) {
      slot += 1;
    } else if (index < from && center < middle) {
      slot -= 1;
    }
  }

  const shift = (rect.width + gap) * sign;

  for (const [index, id] of press.ids.entries()) {
    if (index === from) {
      offsets.set(id, dx);
    } else if (index > from && index <= slot) {
      offsets.set(id, -shift);
    } else if (index < from && index >= slot) {
      offsets.set(id, shift);
    }
  }

  return { offsets, slot };
};

const measure = (press: Press, list: HTMLElement): Drag | null => {
  const items = [...list.querySelectorAll<HTMLElement>("[data-sortable-id]")];
  const rects: DOMRect[] = [];

  for (const id of press.ids) {
    const item = items.find((element) => element.dataset.sortableId === id);

    if (!item) {
      return null;
    }

    rects.push(item.getBoundingClientRect());
  }

  const style = getComputedStyle(list);
  const edge = pixelsOf(style.getPropertyValue("--space-fade-end").trim());
  const from = press.ids.indexOf(press.id);

  return {
    box: list.getBoundingClientRect(),
    edge: Number.isNaN(edge) ? FALLBACK_EDGE : edge,
    frame: 0,
    from,
    gap: pixelsOf(style.columnGap) || 0,
    list,
    rects,
    scrollStart: list.scrollLeft,
    sign: style.direction === "rtl" ? -1 : 1,
    slot: from,
  };
};

// Pointer reorder for one list, in the splitter's style: a ref holds the
// press, pointer capture keeps the drag, and up, cancel and lost capture
// end it. Mouse and pen drag after a 4 px move, and a finger after it
// holds still for --motion-drag-press. Escape, a release far
// above or below the list, the list changing, and unmount put the items
// back. The list stays controlled: onMove reports the drop, and the
// transforms clear once the new order renders.
export const useSortable = ({
  ids,
  enabled,
  onMove,
  onDraggingChange,
  canDrag,
}: UseSortableOptions): Sortable => {
  const list = useRef<HTMLElement | null>(null);
  const press = useRef<Press | null>(null);
  const swallowClick = useRef(false);
  const callbacks = useRef({ onDraggingChange, onMove });
  const [view, setView] = useState<View>(IDLE);
  const dragging = view.phase === "dragging" ? view.id : null;

  useEffect(() => {
    callbacks.current = { onDraggingChange, onMove };
  }, [onDraggingChange, onMove]);

  const listRef = useCallback((element: HTMLElement | null) => {
    list.current = element;
  }, []);

  const show = useCallback((current: Press, drag: Drag) => {
    const { offsets, slot } = place(current, drag);

    drag.slot = slot;
    setView({ id: current.id, offsets, phase: "dragging" });
  }, []);

  const finish = useCallback((release?: { x: number; y: number }) => {
    const { current } = press;

    press.current = null;

    if (!current) {
      return;
    }

    window.clearTimeout(current.timer);
    current.item.removeEventListener("touchmove", holdScroll);

    if (!current.drag) {
      setView((shown) => (shown.phase === "pressed" ? IDLE : shown));

      return;
    }

    const { drag } = current;

    cancelAnimationFrame(drag.frame);

    if (current.item.hasPointerCapture(current.pointerId)) {
      current.item.releasePointerCapture(current.pointerId);
    }

    callbacks.current.onDraggingChange?.(false);

    if (release) {
      current.x = release.x;
      current.y = release.y;
    }

    const slot = release ? place(current, drag).slot : drag.from;

    if (slot === drag.from) {
      setView(IDLE);

      return;
    }

    setView(DROPPED);
    callbacks.current.onMove(current.id, slot);
  }, []);

  // A drag ends without a move when the list changes under it, such as
  // when a tab closes, or when moving turns off.
  useEffect(() => {
    const { current } = press;

    if (current && (!enabled || !sameIds(current.ids, ids))) {
      finish();
    }
  }, [enabled, finish, ids]);

  // No pointer event reaches a list that has gone, so unmount ends it too.
  useEffect(() => () => finish(), [finish]);

  const active = dragging !== null;

  useEffect(() => {
    if (!active) {
      return;
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        finish();
      }
    };

    window.addEventListener("keydown", onKey, true);

    return () => window.removeEventListener("keydown", onKey, true);
  }, [active, finish]);

  // The new order rendered with transitions off. Reading layout commits
  // those styles, so turning transitions back on a frame later slides
  // nothing from its old place.
  useEffect(() => {
    if (view.phase !== "dropped") {
      return;
    }

    list.current?.getBoundingClientRect();

    const frame = requestAnimationFrame(() => setView(IDLE));

    return () => cancelAnimationFrame(frame);
  }, [view]);

  // The click that ends a drag would act on the item, so it is swallowed.
  // It follows the button going up, wherever the drag ended.
  const swallowNextClick = (pointerId: number) => {
    swallowClick.current = true;

    const release = (event: globalThis.PointerEvent) => {
      if (event.pointerId !== pointerId) {
        return;
      }

      window.removeEventListener("pointerup", release, true);
      window.removeEventListener("pointercancel", release, true);
      window.setTimeout(() => {
        swallowClick.current = false;
      }, 0);
    };

    window.addEventListener("pointerup", release, true);
    window.addEventListener("pointercancel", release, true);
  };

  const begin = (current: Press) => {
    const drag = list.current ? measure(current, list.current) : null;

    if (!drag) {
      finish();

      return;
    }

    current.drag = drag;
    current.item.setPointerCapture(current.pointerId);
    swallowNextClick(current.pointerId);
    callbacks.current.onDraggingChange?.(true);
    show(current, drag);

    // Near either end the list scrolls each frame, and the item keeps
    // following the pointer through the scroll.
    const scrollNearEdge = () => {
      if (press.current !== current) {
        return;
      }

      const { box, edge } = drag;
      let step = 0;

      if (current.x < box.left + edge) {
        step = -EDGE_SCROLL_STEP;
      } else if (current.x > box.right - edge) {
        step = EDGE_SCROLL_STEP;
      }

      const before = drag.list.scrollLeft;

      if (step !== 0 && !isAway(current, drag)) {
        drag.list.scrollLeft += step;
      }

      if (drag.list.scrollLeft !== before) {
        show(current, drag);
      }

      drag.frame = requestAnimationFrame(scrollNearEdge);
    };

    drag.frame = requestAnimationFrame(scrollNearEdge);
  };

  const lift = (current: Press) => {
    if (press.current !== current) {
      return;
    }

    current.ready = true;
    current.item.addEventListener("touchmove", holdScroll, { passive: false });

    if ("vibrate" in navigator) {
      navigator.vibrate(LIFT_BUZZ_MS);
    }

    setView({ id: current.id, phase: "pressed" });
  };

  const onPointerDown = (event: PointerEvent<HTMLElement>, id: string) => {
    if (
      !enabled ||
      press.current?.drag ||
      event.button !== PRIMARY_BUTTON ||
      canDrag?.(id) === false
    ) {
      return;
    }

    // A press this item never saw end, such as a second finger's.
    finish();

    const touch = event.pointerType === "touch";

    // No preventDefault, so the press still focuses and clicks as before.
    const current: Press = {
      drag: null,
      id,
      ids,
      item: event.currentTarget,
      pointerId: event.pointerId,
      ready: !touch,
      startX: event.clientX,
      startY: event.clientY,
      timer: 0,
      touch,
      x: event.clientX,
      y: event.clientY,
    };

    press.current = current;

    if (touch) {
      current.timer = window.setTimeout(
        () => lift(current),
        themeMilliseconds("--motion-drag-press", FALLBACK_DRAG_PRESS_MS)
      );
    }
  };

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const { current } = press;

    if (current?.pointerId !== event.pointerId) {
      return;
    }

    current.x = event.clientX;
    current.y = event.clientY;

    if (current.drag) {
      show(current, current.drag);

      return;
    }

    // The button went up somewhere this item never heard about.
    if (event.buttons % 2 === 0) {
      finish();

      return;
    }

    const moved = Math.hypot(
      event.clientX - current.startX,
      event.clientY - current.startY
    );

    if (!current.ready) {
      if (moved > TOUCH_SLOP) {
        finish();
      }

      return;
    }

    if (moved >= START_DISTANCE) {
      begin(current);
    }
  };

  const onPointerUp = (event: PointerEvent<HTMLElement>) => {
    if (press.current?.pointerId === event.pointerId) {
      finish({ x: event.clientX, y: event.clientY });
    }
  };

  const onPointerEnd = (event: PointerEvent<HTMLElement>) => {
    if (press.current?.pointerId === event.pointerId) {
      finish();
    }
  };

  // A finger's press is captured by the element it landed on, so taking
  // the capture for the item makes that element lose it. That loss bubbles
  // here and must not end the drag.
  const onLostPointerCapture = (event: PointerEvent<HTMLElement>) => {
    if (event.target === event.currentTarget) {
      onPointerEnd(event);
    }
  };

  // A long press would open the browser's menu for the tab.
  const onContextMenu = (event: MouseEvent<HTMLElement>) => {
    const { current } = press;

    if (current?.drag || (current?.touch && current.ready)) {
      event.preventDefault();
    }
  };

  const onClickCapture = (event: MouseEvent<HTMLElement>) => {
    if (swallowClick.current) {
      swallowClick.current = false;
      event.preventDefault();
      event.stopPropagation();
    }
  };

  const styleFor = (id: string): CSSProperties | undefined => {
    if (view.phase === "dropped") {
      return { transition: "none" };
    }

    const offset = view.phase === "dragging" ? view.offsets.get(id) : 0;

    return offset ? { transform: `translateX(${offset}px)` } : undefined;
  };

  const itemProps = (id: string): SortableItemProps => ({
    "data-drag-pressed":
      view.phase === "pressed" && view.id === id ? "" : undefined,
    "data-dragging": dragging === id ? "" : undefined,
    "data-sortable-id": id,
    onClickCapture,
    onContextMenu,
    onLostPointerCapture,
    onPointerCancel: onPointerEnd,
    onPointerDown: (event) => onPointerDown(event, id),
    onPointerMove,
    onPointerUp,
    style: styleFor(id),
  });

  return { dragging, itemProps, listRef };
};
