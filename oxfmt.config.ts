// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

export default defineConfig({
  ...ultracite,
  // Written by scripts/tokens.ts and shadcn build, so the formatter leaves
  // them as the tools write them.
  ignorePatterns: [
    ...(ultracite.ignorePatterns ?? []),
    "public/r",
    "registry.json",
    "src/theme/tokens.css",
  ],
});
