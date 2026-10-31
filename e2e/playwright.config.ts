// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

// The E2E: bun run e2e. Spec files run side by side, and the tests inside
// one file run in order, against the playground and the registry. The run
// writes artifacts/e2e/report.md, and each test's duration to
// test-results/e2e-timings.json.
import { availableParallelism } from "node:os";
import path from "node:path";

import { defineConfig } from "@playwright/test";

import { PLAYGROUND_URL, REPO } from "./support";

const MINUTE = 60_000;

// Half the cores, because other checkouts on this machine run the suite
// too. E2E_WORKERS overrides it.
const workers =
  Number(process.env.E2E_WORKERS) ||
  Math.max(1, Math.floor(availableParallelism() / 2));

export default defineConfig({
  fullyParallel: false,
  globalSetup: "./global-setup.ts",
  // Installs and next build in a temp app take minutes.
  globalTimeout: 60 * MINUTE,
  reporter: [
    ["list"],
    ["json", { outputFile: path.join(REPO, "test-results/e2e-timings.json") }],
  ],
  testDir: ".",
  timeout: 2 * MINUTE,
  use: {
    actionTimeout: 10_000,
    baseURL: PLAYGROUND_URL,
    navigationTimeout: 30_000,
    viewport: { height: 900, width: 1440 },
  },
  workers,
});
