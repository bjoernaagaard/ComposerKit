// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

// Turns crates/composerkit-theme/design-tokens.json into shadcn's CSS
// variables. It writes them to packages/composerkit/src/theme/tokens.css and
// to the cssVars of the "theme" item in packages/composerkit/registry.json, so
// both always match the token file. It also writes the color role names to
// packages/composerkit/src/content/color-roles.ts, for the sample data
// item, and the sidebar's widths to
// packages/composerkit/src/components/app-shell/sidebar-width.ts, for the
// splitter. The Rust theme crate compiles in the same file. It also copies
// the rules in app-shell.css and chat-sidebar.css into the css of their
// registry items, so bun run registry:build runs it first.
//
//   bun scripts/tokens.ts

import { readFileSync, writeFileSync } from "node:fs";

import { parse } from "postcss";
import type { ChildNode } from "postcss";

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
const COMPONENTS = new URL("packages/composerkit/src/components/", ROOT);
const SIDEBAR_PATH = new URL("app-shell/sidebar-width.ts", COMPONENTS);

// The registry items whose css is the rules of a stylesheet.
const ITEM_CSS = {
  "app-shell": "app-shell/app-shell.css",
  "chat-sidebar": "chat-sidebar/chat-sidebar.css",
};

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

// REUSE-IgnoreStart
const sidebarWidth = [
  "// SPDX-FileCopyrightText: 2026 Bjørn Aagaard",
  "// SPDX-License-Identifier: MIT",
  // REUSE-IgnoreEnd
  "",
  "// Generated from crates/composerkit-theme/design-tokens.json by scripts/tokens.ts.",
  "// The sidebar's widths in px: --size-sidebar, the theme's, and the range",
  "// the splitter keeps it in, --size-sidebar-min to --size-sidebar-max.",
  "export const SIDEBAR_WIDTH = {",
  `  max: ${tokens.size.sidebarMax},`,
  `  min: ${tokens.size.sidebarMin},`,
  `  theme: ${tokens.size.sidebar},`,
  "} as const;",
  "",
].join("\n");

writeFileSync(SIDEBAR_PATH, sidebarWidth);

// shadcn's css field: each rule's selectors and declarations, and each at
// rule's rules inside its own key, with the line breaks of the stylesheet
// folded to single spaces.
interface CssRules {
  [key: string]: string | CssRules;
}

const fold = (text: string): string =>
  text
    .replaceAll(/\s+/gu, " ")
    .replaceAll("( ", "(")
    .replaceAll(" )", ")")
    .trim();

const cssRules = (nodes: ChildNode[]): CssRules => {
  const rules: CssRules = {};

  for (const node of nodes) {
    if (node.type === "rule") {
      rules[node.selectors.map(fold).join(", ")] = cssRules(node.nodes);
    } else if (node.type === "atrule") {
      rules[`@${node.name} ${fold(node.params)}`] = cssRules(node.nodes ?? []);
    } else if (node.type === "decl") {
      rules[node.prop] = node.important
        ? `${fold(node.value)} !important`
        : fold(node.value);
    }
  }

  return rules;
};

const registry = JSON.parse(readFileSync(REGISTRY_PATH, "utf-8"));

const registryItem = (name: string) => {
  const found = registry.items.find(
    (entry: { name: string }) => entry.name === name
  );

  if (!found) {
    throw new Error(`registry.json has no "${name}" item`);
  }

  return found;
};

registryItem(THEME_ITEM).cssVars = cssVars;

for (const [name, file] of Object.entries(ITEM_CSS)) {
  const stylesheet = readFileSync(new URL(file, COMPONENTS), "utf-8");

  registryItem(name).css = cssRules(parse(stylesheet).nodes);
}

writeFileSync(REGISTRY_PATH, `${JSON.stringify(registry, null, 2)}\n`);
