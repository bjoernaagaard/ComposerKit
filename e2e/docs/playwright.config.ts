// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

// The docs E2E: npm run e2e:docs. Spec files run side by side, and the
// tests inside one file run in order, against the real static export. The
// run writes artifacts/docs-e2e/report.md, and each test's duration to
// test-results/e2e-timings.json.
import { availableParallelism } from "node:os";
import path from "node:path";

import { defineConfig } from "@playwright/test";

import { DOCS_URL, REPO } from "./support";

const MINUTE = 60_000;

// Half the cores, because other checkouts on this machine run the suite
// too. E2E_WORKERS overrides it.
const workers =
  Number(process.env.E2E_WORKERS) ||
  Math.max(1, Math.floor(availableParallelism() / 2));

export default defineConfig({
  fullyParallel: false,
  globalSetup: "./global-setup.ts",
  // Builds, installs and next build in a temp app take minutes.
  globalTimeout: 60 * MINUTE,
  reporter: [
    ["list"],
    ["json", { outputFile: path.join(REPO, "test-results/e2e-timings.json") }],
  ],
  testDir: ".",
  timeout: 2 * MINUTE,
  use: {
    actionTimeout: 10_000,
    baseURL: DOCS_URL,
    navigationTimeout: 30_000,
    viewport: { height: 900, width: 1440 },
  },
  workers,
});
