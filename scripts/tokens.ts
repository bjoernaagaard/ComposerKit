// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

// Turns crates/composerkit-theme/design-tokens.json into shadcn's CSS
// variables. It writes them to packages/composerkit/src/theme/tokens.css and
// to the cssVars of the "theme" item in packages/composerkit/registry.json, so
// both always match the token file. It also writes the color role names to
// packages/composerkit/src/content/color-roles.ts, for the docs palette
// example. The Rust theme crate compiles in the same file.
//
//   node scripts/tokens.ts

import { readFileSync, writeFileSync } from "node:fs";

import { cssVariables } from "./token-variables.ts";
import type { Tokens, Variables } from "./token-variables.ts";

const ROOT = new URL("..", import.meta.url);
const THEME_CRATE = new URL("crates/composerkit-theme/", ROOT);
const TOKENS_PATH = new URL("design-tokens.json", THEME_CRATE);
const CSS_PATH = new URL("packages/composerkit/src/theme/tokens.css", ROOT);
const REGISTRY_PATH = new URL("packages/composerkit/registry.json", ROOT);
const THEME_ITEM = "theme";
const ROLES_FILE = "packages/composerkit/src/content/color-roles.ts";
const ROLES_PATH = new URL(ROLES_FILE, ROOT);

const tokens: Tokens = JSON.parse(readFileSync(TOKENS_PATH, "utf-8"));

const cssVars = cssVariables(tokens);

const block = (selector: string, variables: Variables): string =>
  [
    `${selector} {`,
    ...Object.entries(variables).map(
      ([name, value]) => `  --${name}: ${value};`
    ),
    "}",
  ].join("\n");

// The header below is for tokens.css, not this file.
// REUSE-IgnoreStart
const css = [
  "/* SPDX-FileCopyrightText: 2026 Bjørn Aagaard",
  "   SPDX-License-Identifier: MIT */",
  // REUSE-IgnoreEnd
  "",
  "/* Generated from crates/composerkit-theme/design-tokens.json by scripts/tokens.ts. */",
  "",
  block("@theme inline", cssVars.theme),
  "",
  block(":root", cssVars.light),
  "",
  block(".dark", cssVars.dark),
  "",
].join("\n");

writeFileSync(CSS_PATH, css);

// REUSE-IgnoreStart
const roles = [
  "// SPDX-FileCopyrightText: 2026 Bjørn Aagaard",
  "// SPDX-License-Identifier: MIT",
  // REUSE-IgnoreEnd
  "",
  "// Generated from crates/composerkit-theme/design-tokens.json by scripts/tokens.ts.",
  "// The color roles, each a CSS variable the theme sets in light and dark.",
  "export const COLOR_ROLES = [",
  ...Object.keys(tokens.color.light).map((role) => `  "${role}",`),
  "] as const;",
  "",
].join("\n");

writeFileSync(ROLES_PATH, roles);

const registry = JSON.parse(readFileSync(REGISTRY_PATH, "utf-8"));

const item = registry.items.find(
  (entry: { name: string }) => entry.name === THEME_ITEM
);

if (!item) {
  throw new Error(`registry.json has no "${THEME_ITEM}" item`);
}

item.cssVars = cssVars;

writeFileSync(REGISTRY_PATH, `${JSON.stringify(registry, null, 2)}\n`);
