// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

// Rebuilds the registry files from the library source, serves the
// playground's dev server for the specs, and writes the report when the run
// ends. The registry is rebuilt first so checks 1 and 2 test the components
// as they are now, not the last committed copy.
import { mkdirSync, rmSync } from "node:fs";

import { writeReport } from "./report";
import { REPO, RESULTS, run, servePlayground } from "./support";

const globalSetup = async () => {
  rmSync(RESULTS, { force: true, recursive: true });
  mkdirSync(RESULTS, { recursive: true });

  const registry = await run("bun", ["run", "registry:build"], REPO);

  if (registry.exitCode !== 0) {
    throw new Error(`registry:build failed:\n${registry.outputTail}`);
  }

  const stopPlayground = await servePlayground();

  return () => {
    stopPlayground();
    writeReport();
  };
};

export default globalSetup;
