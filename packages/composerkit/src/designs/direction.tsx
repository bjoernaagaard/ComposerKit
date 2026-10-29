// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

import { useState } from "react";

import { installEmilInteractions } from "./emil/interactions";

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

let cleanup: (() => void) | undefined;

const applyDirection = (direction: Direction) => {
  cleanup?.();
  cleanup = undefined;

  if (direction === "base") {
    delete document.body.dataset.design;
  } else {
    document.body.dataset.design = direction;

    if (direction === "emil") {
      cleanup = installEmilInteractions(document.body);
    }
  }
};

export const startDirection = () => applyDirection(readDirection());

export const DirectionSelector = () => {
  const [direction, setDirection] = useState(readDirection);

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
          setDirection(next);

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
