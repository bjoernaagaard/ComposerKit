// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

"use client";

import tokens from "../../../crates/composerkit-theme/design-tokens.json";

// The color roles in the token file, drawn in the scheme on screen. Switch
// the docs to dark to see the dark scheme.
const ROLES = Object.keys(tokens.color.light);

export const Palette = () => (
  <ul className="grid grid-cols-[repeat(auto-fill,minmax(var(--size-catalog-grid-item-min),1fr))] gap-3">
    {ROLES.map((role) => (
      <li className="flex items-center gap-2" key={role}>
        <span
          aria-hidden="true"
          className="border-border size-8 shrink-0 rounded-(--radius-control) border-(length:--border-hairline) bg-(--swatch)"
          style={{ "--swatch": `var(--${role})` }}
        />
        <code className="text-muted-foreground font-mono text-(length:--text-caption-size)">
          {role}
        </code>
      </li>
    ))}
  </ul>
);
