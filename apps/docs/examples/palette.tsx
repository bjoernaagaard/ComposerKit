// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

"use client";

import type { CSSProperties } from "react";

import { COLOR_ROLES } from "@/content/color-roles";

// A style that sets a CSS variable. Typed here, so the example compiles in
// any app without a global declaration for custom properties.
type SwatchStyle = CSSProperties & Record<`--${string}`, string>;

// Every color role the theme sets, drawn in the scheme on screen. Switch
// the docs to dark to see the dark scheme.
export const Palette = () => (
  <ul className="grid grid-cols-[repeat(auto-fill,minmax(var(--size-catalog-grid-item-min),1fr))] gap-3">
    {COLOR_ROLES.map((role) => {
      const swatch: SwatchStyle = { "--swatch": `var(--${role})` };

      return (
        <li className="flex items-center gap-2" key={role}>
          <span
            aria-hidden="true"
            className="border-border size-8 shrink-0 rounded-(--radius-control) border-(length:--border-hairline) bg-(--swatch)"
            style={swatch}
          />
          <code className="text-muted-foreground font-mono text-(length:--text-caption-size)">
            {role}
          </code>
        </li>
      );
    })}
  </ul>
);
