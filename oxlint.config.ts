// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

import { defineConfig } from "oxlint";
import antiSlop from "ultracite/oxlint/anti-slop";
import core from "ultracite/oxlint/core";
import playwright from "ultracite/oxlint/playwright";
import react from "ultracite/oxlint/react";
import shadcn from "ultracite/oxlint/shadcn";
import storybook from "ultracite/oxlint/storybook";
import tanstack from "ultracite/oxlint/tanstack";

export default defineConfig({
  env: core.env,
  extends: [core, react, playwright, storybook, tanstack, shadcn, antiSlop],
  ignorePatterns: core.ignorePatterns,
  jsPlugins: shadcn.jsPlugins,
});
