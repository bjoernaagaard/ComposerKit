// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

// Check 5: next build passed (global setup runs it), and next-validate-link
// finds no broken links in the docs content. The pages and their heading
// ids come from the static export, so a link to a page or a #fragment only
// passes when the built site has it.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";
import { scanURLs, validateFiles } from "next-validate-link";

import { DOCS_APP, EXPORT_DIR, readResult, writeResult } from "./support";
import type { CommandRun } from "./support";

const CONTENT = path.join(DOCS_APP, "content/docs");
const ID = /\sid="(?<id>[^"]+)"/gu;

const slugOf = (file: string) => {
  const name = path.basename(file, ".mdx");

  return name === "index" ? [] : [name];
};

const hashesIn = (slug: string[]) => {
  const html = readFileSync(
    path.join(
      EXPORT_DIR,
      `${slug.length === 0 ? "index" : slug.join("/")}.html`
    ),
    "utf-8"
  );

  return [...html.matchAll(ID)].map((match) => match.groups?.id ?? "");
};

test("next build passes and every docs link resolves", async () => {
  const build = readResult<CommandRun>("build");

  const files = readdirSync(CONTENT)
    .filter((file) => file.endsWith(".mdx"))
    .map((file) => path.join(CONTENT, file));

  const scanned = await scanURLs({
    cwd: DOCS_APP,
    populate: {
      "(docs)/[[...slug]]": files.map((file) => {
        const slug = slugOf(file);

        return { hashes: hashesIn(slug), value: { slug } };
      }),
    },
    preset: "next",
  });

  const results = await validateFiles(
    files.map((file) => ({
      content: readFileSync(file, "utf-8"),
      path: path.relative(DOCS_APP, file),
      url: `/${slugOf(file).join("/")}`,
    })),
    { checkRelativePaths: "as-url", scanned }
  );

  const broken = results.flatMap((result) =>
    result.errors.map((error) => ({
      file: result.file,
      line: error.line,
      reason:
        error.reason instanceof Error ? error.reason.message : error.reason,
      url: error.url,
    }))
  );

  writeResult("links", {
    broken,
    build: build
      ? {
          command: build.command,
          exitCode: build.exitCode,
          seconds: build.seconds,
        }
      : null,
    files: files.map((file) => path.relative(DOCS_APP, file)),
    urls: [...scanned.urls.keys()].toSorted(),
  });

  expect(build?.exitCode).toBe(0);
  expect(scanned.urls.size).toBeGreaterThan(files.length - 1);
  expect(broken).toEqual([]);
});
