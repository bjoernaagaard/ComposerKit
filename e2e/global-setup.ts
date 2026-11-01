// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

// Rebuilds the registry files from the library source, builds the docs as
// a static export, serves it and the playground's dev server for the specs,
// and writes the report when the run ends. The registry is rebuilt first so
// checks 1 and 2 test the components as they are now, not the last
// committed copy.
import { mkdirSync, rmSync } from "node:fs";

import { writeReport } from "./report";
import {
  DOCS_PORT,
  EXPORT_DIR,
  REPO,
  RESULTS,
  run,
  serve,
  servePlayground,
  writeResult,
} from "./support";

const globalSetup = async () => {
  rmSync(RESULTS, { force: true, recursive: true });
  mkdirSync(RESULTS, { recursive: true });

  const registry = await run("npm", ["run", "registry:build"], REPO);

  if (registry.exitCode !== 0) {
    throw new Error(`registry:build failed:\n${registry.outputTail}`);
  }

  const build = await run("npm", ["run", "docs:build"], REPO);

  writeResult("build", build);

  if (build.exitCode !== 0) {
    writeReport();
    throw new Error(`next build failed:\n${build.outputTail}`);
  }

  const stopDocs = await serve(EXPORT_DIR, DOCS_PORT);
  const stopPlayground = await servePlayground();

  return () => {
    stopDocs();
    stopPlayground();
    writeReport();
  };
};

export default globalSetup;
