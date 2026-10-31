// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

"use client";

import { useSyncExternalStore } from "react";

const DIRECTIONS = ["base", "apple", "glass", "taste", "emil"] as const;

type Direction = (typeof DIRECTIONS)[number];

const KEY = "composerkit-design";

const readDirection = (): Direction => {
  try {
    const saved = localStorage.getItem(KEY);

    return DIRECTIONS.find((item) => item === saved) ?? "base";
  } catch {
    return "base";
  }
};

// Every mounted selector, so they all follow a change made by any of them.
const listeners = new Set<() => void>();

const applyDirection = (direction: Direction) => {
  if (direction === "base") {
    delete document.body.dataset.design;
  } else {
    document.body.dataset.design = direction;
  }

  for (const listener of listeners) {
    listener();
  }
};

export const startDirection = () => applyDirection(readDirection());

// Runs as the text of an inline script before any bundle loads, so it may
// use only its arguments and browser globals.
const restoreDirection = (key: string, directions: readonly string[]) => {
  try {
    const saved = localStorage.getItem(key);

    if (saved !== null && saved !== "base" && directions.includes(saved)) {
      document.body.dataset.design = saved;
    }
  } catch {
    /* Storage may be unavailable. */
  }
};

const SCRIPT = `(${restoreDirection.toString()})(${JSON.stringify(KEY)},${JSON.stringify(DIRECTIONS)})`;

// Paints the saved design before the first frame. Render it inside <body>.
// Next's InlineScript pattern: text/plain on the client stops React's dev
// warning about rendering a script, and suppressHydrationWarning covers the
// type mismatch.
export const DirectionScript = () => (
  <script
    type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
    suppressHydrationWarning
    // oxlint-disable-next-line react/no-danger -- a pre-paint script must be inline, as next-themes does
    dangerouslySetInnerHTML={{ __html: SCRIPT }}
  />
);

const subscribe = (listener: () => void) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};

// The attribute is what the reader sees, so the select follows it even
// when storage is unavailable.
const currentDirection = (): Direction =>
  DIRECTIONS.find((item) => item === document.body.dataset.design) ?? "base";

const serverDirection = (): Direction => "base";

export const DirectionSelector = () => {
  const direction = useSyncExternalStore(
    subscribe,
    currentDirection,
    serverDirection
  );

  return (
    <label className="text-muted-foreground inline-flex items-center gap-2 text-sm">
      <span>Design</span>
      <select
        aria-label="Design direction"
        className="bg-background text-foreground border-border rounded-md border px-2 py-1"
        value={direction}
        onChange={(event) => {
          const next =
            DIRECTIONS.find((item) => item === event.target.value) ?? "base";

          applyDirection(next);

          try {
            localStorage.setItem(KEY, next);
          } catch {
            /* Storage may be unavailable. */
          }
        }}
      >
        <option value="base">Base</option>
        <option value="apple">Apple</option>
        <option value="glass">Liquid glass</option>
        <option value="taste">Design taste</option>
        <option value="emil">Emil</option>
      </select>
    </label>
  );
};
