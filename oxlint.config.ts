// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

import { defineConfig } from "oxlint";
import antiSlop from "ultracite/oxlint/anti-slop";
import core from "ultracite/oxlint/core";
import playwright from "ultracite/oxlint/playwright";
import react from "ultracite/oxlint/react";
import shadcn from "ultracite/oxlint/shadcn";

export default defineConfig({
  env: core.env,
  extends: [core, react, playwright, shadcn, antiSlop],
  ignorePatterns: core.ignorePatterns,
  jsPlugins: shadcn.jsPlugins,
  // The playground imports the library's components through the "@/" path,
  // and only the library has a components.json. Without this, @shadcn/lint
  // does not see <Button> in the playground as a design-system component, so
  // no-restyle never runs there.
  settings: {
    shadcn: {
      ui: "@/components/ui",
    },
  },
});
