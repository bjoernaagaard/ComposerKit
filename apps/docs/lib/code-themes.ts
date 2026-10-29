// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

// Shiki's GitHub themes put some tokens below 4.5:1 on the code block
// background (axe color-contrast). The high-contrast pair keeps every token
// readable in light and dark.
export const CODE_THEMES = {
  dark: "github-dark-high-contrast",
  light: "github-light-high-contrast",
} as const;
