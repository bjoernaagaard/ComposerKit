// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

// Size budget: every JS file under packages/composerkit/dist/components,
// gzipped at level 9, stays within 5% of its size in size-budget.json.
// A dist file with no entry fails too, so a new component gets a budget.
// After a change that is meant to grow a file, rerun with
// --update-snapshots to write today's sizes as the new baseline.
import { globSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { constants, gzipSync } from "node:zlib";

import { expect, test } from "@playwright/test";

import { REPO, run } from "./support";

const DIST = path.join(REPO, "packages/composerkit/dist/components");
const BASELINE_FILE = path.join(REPO, "e2e/size-budget.json");
const ALLOWED_GROWTH = 0.05;
const PERCENT = 100;

interface SizeRow {
  name: string;
  baseline: number | undefined;
  now: number;
}

const gzipBytes = (file: string) =>
  gzipSync(readFileSync(file), { level: constants.Z_BEST_COMPRESSION })
    .byteLength;

const change = ({ baseline, now }: SizeRow) =>
  baseline === undefined
    ? "no baseline"
    : `${(((now - baseline) / baseline) * PERCENT).toFixed(1)}%`;

const table = (rows: SizeRow[]) =>
  [
    "name | baseline | now | change",
    ...rows.map(
      (row) =>
        `${row.name} | ${row.baseline ?? "-"} | ${row.now} | ${change(row)}`
    ),
  ].join("\n");

test("every component's gzip size is within 5% of its baseline", async () => {
  const build = await run(
    "bun",
    ["run", "--filter", "composerkit", "build"],
    REPO
  );

  expect(build.exitCode, build.outputTail).toBe(0);

  const baseline: Record<string, number> = JSON.parse(
    readFileSync(BASELINE_FILE, "utf-8")
  );

  const rows: SizeRow[] = globSync("**/*.js", { cwd: DIST })
    .toSorted()
    .map((name) => ({
      baseline: baseline[name],
      name,
      now: gzipBytes(path.join(DIST, name)),
    }));

  process.stdout.write(`${table(rows)}\n`);

  expect(rows.length, "measured no files in dist/components").toBeGreaterThan(
    0
  );

  if (["all", "changed"].includes(test.info().config.updateSnapshots)) {
    const sizes = Object.fromEntries(rows.map((row) => [row.name, row.now]));

    writeFileSync(BASELINE_FILE, `${JSON.stringify(sizes, null, 2)}\n`);

    return;
  }

  const overBudget = rows.flatMap((row) =>
    row.baseline === undefined || row.now > row.baseline * (1 + ALLOWED_GROWTH)
      ? [`${row.name} ${change(row)}`]
      : []
  );

  expect(overBudget, "over budget or missing from size-budget.json").toEqual(
    []
  );
});
