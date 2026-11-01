// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

import { defineConfig } from "oxlint";
import antiSlop from "ultracite/oxlint/anti-slop";
import core from "ultracite/oxlint/core";
import next from "ultracite/oxlint/next";
import playwright from "ultracite/oxlint/playwright";
import react from "ultracite/oxlint/react";
import shadcn from "ultracite/oxlint/shadcn";

export default defineConfig({
  env: core.env,
  extends: [core, react, playwright, shadcn, antiSlop],
  ignorePatterns: core.ignorePatterns,
  jsPlugins: shadcn.jsPlugins,
  // Only the docs site is a Next.js app. The playground runs on Vite and the
  // library ships to any React app.
  overrides: [
    {
      files: ["apps/docs/**"],
      plugins: next.plugins,
      rules: next.rules,
    },
  ],
  // The apps import the library's components through the "@/" path, and only
  // the library has a components.json. Without this, @shadcn/lint does not
  // see <Button> in the apps as a design-system component, so no-restyle
  // never runs there.
  settings: {
    shadcn: {
      ui: "@/components/ui",
    },
  },
});
