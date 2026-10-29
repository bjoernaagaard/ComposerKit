// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

// Builds the docs as a static export, serves it for the specs, and writes
// the report when the run ends.
import { rmSync } from "node:fs";

import { writeReport } from "./report";
import {
  DOCS_PORT,
  EXPORT_DIR,
  REPO,
  RESULTS,
  run,
  serve,
  writeResult,
} from "./support";

const globalSetup = async () => {
  rmSync(RESULTS, { force: true, recursive: true });

  const build = await run(
    "npm",
    ["run", "build", "--workspace", "@composerkit/docs"],
    REPO
  );

  writeResult("build", build);

  if (build.exitCode !== 0) {
    writeReport();
    throw new Error(`next build failed:\n${build.outputTail}`);
  }

  const stop = await serve(EXPORT_DIR, DOCS_PORT);

  return () => {
    stop();
    writeReport();
  };
};

export default globalSetup;
