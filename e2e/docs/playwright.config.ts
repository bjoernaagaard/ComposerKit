// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

// The docs E2E: npm run e2e:docs. Specs run one at a time in file order,
// against the real static export, and the run writes
// artifacts/docs-e2e/report.md.
import { defineConfig } from "@playwright/test";

import { DOCS_URL } from "./support";

const MINUTE = 60_000;

export default defineConfig({
  fullyParallel: false,
  globalSetup: "./global-setup.ts",
  // Builds, installs and next build in a temp app take minutes.
  globalTimeout: 60 * MINUTE,
  reporter: "list",
  testDir: ".",
  timeout: 2 * MINUTE,
  use: {
    actionTimeout: 10_000,
    baseURL: DOCS_URL,
    navigationTimeout: 30_000,
    viewport: { height: 900, width: 1440 },
  },
  workers: 1,
});
