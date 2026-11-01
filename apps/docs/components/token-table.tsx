// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

import { readFile } from "node:fs/promises";
import path from "node:path";

import { cssVariables } from "../../../scripts/token-variables.ts";
import type { Tokens, Variables } from "../../../scripts/token-variables.ts";

const ROOT = path.resolve(process.cwd(), "../..");

const TOKENS_PATH = path.join(
  ROOT,
  "crates/composerkit-theme/design-tokens.json"
);

const LIBRARY = path.join(ROOT, "packages/composerkit");

const VARIABLE = /--(?<name>[a-z][a-z0-9-]*)/gu;

// Tailwind classes that read a color role, such as bg-primary/85 or
// before:bg-accent.
const colorClass = (role: string) =>
  new RegExp(
    `(?<![\\w-])(?:bg|text|border|outline|ring|fill|stroke|caret|decoration|divide|shadow)-${role}(?![\\w-])`,
    "u"
  );

interface RegistryItem {
  name: string;
  files?: { path: string }[];
}

const filesOf = async (item: string): Promise<string[]> => {
  // SAFETY: registry.json follows shadcn's registry schema, which the E2E
  // validates, so items have a name and optional files with a path.
  const registry = JSON.parse(
    await readFile(path.join(LIBRARY, "registry.json"), "utf-8")
  ) as { items: RegistryItem[] };

  const entry = registry.items.find((candidate) => candidate.name === item);

  if (!entry) {
    throw new Error(`registry.json has no item named ${item}`);
  }

  return (entry.files ?? []).map((file) => file.path);
};

const sourceOf = async (files: string[]): Promise<string> => {
  const sources = await Promise.all(
    files.map((file) => readFile(path.join(LIBRARY, file), "utf-8"))
  );

  return sources.join("\n");
};

// The tokens an item's files use, with their light and dark values. Values
// come from crates/composerkit-theme/design-tokens.json at build time,
// mapped to CSS variables the same way scripts/tokens.ts writes tokens.css.
// The theme item ships every token, so it lists them all. Pieces that are
// not registry items pass their files (relative to packages/composerkit).
export const TokenTable = async ({
  item,
  files,
}: {
  item?: string;
  files?: string[];
}) => {
  // SAFETY: scripts/tokens.ts reads the same file with the same type, and
  // the Rust theme crate deserializes it into typed structs.
  const tokens = JSON.parse(await readFile(TOKENS_PATH, "utf-8")) as Tokens;
  const variables = cssVariables(tokens);
  const light: Variables = variables.light;
  const dark: Variables = variables.dark;
  const roles = new Set(Object.keys(tokens.color.light));
  const names = [...new Set([...Object.keys(light), ...Object.keys(dark)])];

  let shown = names;

  if (item !== "theme") {
    const source = await sourceOf(files ?? (await filesOf(item ?? "")));

    const referenced = new Set(
      [...source.matchAll(VARIABLE)].map((match) => match.groups?.name)
    );

    shown = names.filter(
      (name) =>
        referenced.has(name) ||
        (roles.has(name) && colorClass(name).test(source))
    );
  }

  return (
    <table>
      <thead>
        <tr>
          <th>Variable</th>
          <th>Light</th>
          <th>Dark</th>
        </tr>
      </thead>
      <tbody>
        {shown.map((name) => (
          <tr key={name}>
            <td>
              <code>--{name}</code>
            </td>
            <td>
              <code>{light[name] ?? ""}</code>
            </td>
            <td>
              <code>{dark[name] ?? light[name] ?? ""}</code>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
