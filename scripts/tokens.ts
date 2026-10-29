// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

// Turns crates/composerkit-theme/design-tokens.json into shadcn's CSS
// variables. It writes them to packages/composerkit/src/theme/tokens.css and
// to the cssVars of the "theme" item in packages/composerkit/registry.json, so
// both always match the token file. The Rust theme crate compiles in the same file.
//
//   node scripts/tokens.ts

import { readFileSync, writeFileSync } from "node:fs";

const ROOT = new URL("..", import.meta.url);
const THEME_CRATE = new URL("crates/composerkit-theme/", ROOT);
const TOKENS_PATH = new URL("design-tokens.json", THEME_CRATE);
const CSS_PATH = new URL("packages/composerkit/src/theme/tokens.css", ROOT);
const REGISTRY_PATH = new URL("packages/composerkit/registry.json", ROOT);
const THEME_ITEM = "theme";

type Scheme = "light" | "dark";

type Variables = Record<string, string>;

interface Tokens {
  palette: Record<string, Record<string, string>>;
  color: Record<Scheme, Record<string, string>>;
  font: { ui: string; mono: string } & Record<string, string | number>;
  text: Record<string, { size: number; lineHeight: number }>;
  radius: Record<string, number> & { control: number };
  size: Record<string, number> & {
    conversationComposerMinHeight: number;
    composerControl: number;
  };
  space: Record<string, number>;
  border: Record<string, number>;
  shadow: Record<string, string> & {
    composerLight: string;
    composerDarkEdge: string;
  };
  blur: Record<string, number>;
  motion: Record<string, string | number>;
}

const tokens: Tokens = JSON.parse(readFileSync(TOKENS_PATH, "utf-8"));

const px = (value: number): string => `${value}px`;

const kebab = (name: string): string =>
  name.replaceAll(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`);

const group = (prefix: string, values: Record<string, number>) =>
  Object.entries(values).map(([name, value]) => [
    `${prefix}-${kebab(name)}`,
    px(value),
  ]);

// "neutral.900" names a step of a palette ramp.
const resolve = (reference: string): string => {
  const [ramp = "", step = ""] = reference.split(".");
  const value = tokens.palette[ramp]?.[step];

  if (!value) {
    throw new Error(
      `crates/composerkit-theme/design-tokens.json: no palette step ${reference}`
    );
  }

  return value;
};

const colors = (scheme: Scheme): Variables =>
  Object.fromEntries(
    Object.entries(tokens.color[scheme]).map(([role, reference]) => [
      role,
      resolve(reference),
    ])
  );

// Durations end in Ms in the token file and become CSS times, so
// tooltipDelayMs is --motion-tooltip-delay: 200ms. Curves start with ease
// and pass through.
// Other numbers, such as marqueeMsPerPixel, are for native code only.
const motion = () =>
  Object.entries(tokens.motion).flatMap(([name, value]) => {
    if (name.startsWith("ease")) {
      return [[`motion-${kebab(name)}`, String(value)]];
    }

    return name.endsWith("Ms")
      ? [[`motion-${kebab(name.slice(0, -"Ms".length))}`, `${value}ms`]]
      : [];
  });

// Sizes, spacing, type and motion are the same in both schemes, so they sit
// in :root with the light colors.
const shared = (): Variables =>
  Object.fromEntries([
    ["radius", px(tokens.radius.control)],
    ["font-ui", tokens.font.ui],
    ["weight-regular", String(tokens.font.weightRegular)],
    ["weight-medium", String(tokens.font.weightMedium)],
    ["weight-semibold", String(tokens.font.weightSemibold)],
    ...Object.entries(tokens.text).flatMap(([name, style]) => [
      [`text-${kebab(name)}-size`, px(style.size)],
      [`text-${kebab(name)}-leading`, px(style.lineHeight)],
    ]),
    ...group("radius", tokens.radius),
    ...group("size", tokens.size),
    ...group("space", tokens.space),
    [
      "space-conversation-composer-padding-y",
      px(
        (tokens.size.conversationComposerMinHeight -
          tokens.size.composerControl) /
          2
      ),
    ],
    ...group("border", tokens.border),
    ...Object.entries(tokens.shadow).map(([name, value]) => [
      `shadow-${kebab(name)}`,
      value,
    ]),
    ...group("blur", tokens.blur),
    ...motion(),
  ]);

// Tailwind reads these, so classes such as bg-muted or text-link work.
const theme = (): Variables =>
  Object.fromEntries([
    ...Object.keys(tokens.color.light).map((role) => [
      `color-${role}`,
      `var(--${role})`,
    ]),
    ["font-sans", tokens.font.ui],
    ["font-mono", tokens.font.mono],
    ["radius-sm", "calc(var(--radius) * 0.6)"],
    ["radius-md", "calc(var(--radius) * 0.8)"],
    ["radius-lg", "var(--radius)"],
    ["radius-xl", "calc(var(--radius) * 1.4)"],
  ]);

const cssVars = {
  dark: {
    ...colors("dark"),
    "shadow-composer": tokens.shadow.composerDarkEdge,
  },
  light: {
    ...colors("light"),
    "shadow-composer": tokens.shadow.composerLight,
    ...shared(),
  },
  theme: theme(),
};

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

const registry = JSON.parse(readFileSync(REGISTRY_PATH, "utf-8"));

const item = registry.items.find(
  (entry: { name: string }) => entry.name === THEME_ITEM
);

if (!item) {
  throw new Error(`registry.json has no "${THEME_ITEM}" item`);
}

item.cssVars = cssVars;

writeFileSync(REGISTRY_PATH, `${JSON.stringify(registry, null, 2)}\n`);
