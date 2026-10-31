// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

// Runs after vite and tsc have written dist. tsc keeps the "@/" alias in the
// .d.ts files, and a project that installs the package cannot resolve it, so
// each one becomes a relative path. Then the stylesheet and every file it
// imports are copied in, so a new layer's stylesheet ships once styles.css
// imports it.
//
//   bun scripts/finish-dist.ts

import {
  copyFileSync,
  globSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SRC = fileURLToPath(new URL("../src", import.meta.url));
const DIST = fileURLToPath(new URL("../dist", import.meta.url));
const ALIAS = /(?<lead>from |import\()"@\/(?<target>[^"]+)"/gu;

const IMPORT = /@import\s+"(?<target>\.[^"]+\.css)"/gu;

const stylesheets = (file: string, found = new Set<string>()): Set<string> => {
  if (found.has(file)) {
    return found;
  }

  found.add(file);

  const text = readFileSync(path.join(SRC, file), "utf-8");

  for (const match of text.matchAll(IMPORT)) {
    const target = match.groups?.target ?? "";

    stylesheets(path.join(path.dirname(file), target), found);
  }

  return found;
};

for (const file of globSync("**/*.d.ts", { cwd: DIST })) {
  const absolute = path.join(DIST, file);
  const folder = path.dirname(absolute);

  const text = readFileSync(absolute, "utf-8").replaceAll(
    ALIAS,
    (_match, lead: string, target: string) => {
      const relative = path.relative(folder, path.join(DIST, target));
      const specifier = relative.startsWith(".") ? relative : `./${relative}`;

      return `${lead}"${specifier}.js"`;
    }
  );

  writeFileSync(absolute, text);
}

for (const file of stylesheets("styles.css")) {
  mkdirSync(path.dirname(path.join(DIST, file)), { recursive: true });
  copyFileSync(path.join(SRC, file), path.join(DIST, file));
}
