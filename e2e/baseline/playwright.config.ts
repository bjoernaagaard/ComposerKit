// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

// Captures the old /catalog and /states/composer pages once, before the
// catalog is replaced by the docs site.
import { defineConfig } from "@playwright/test";

const PORT = 5180;

export default defineConfig({
  testDir: ".",
  reporter: "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort --host 127.0.0.1`,
    cwd: "../../apps/playground",
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: false,
  },
});
