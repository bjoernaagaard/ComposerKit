// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

// Check 4: every screenshot taken from the old catalog before it was
// deleted has a docs example with the same id. Each example is
// screenshotted in light and dark and compared with its baseline. The ratio
// is the share of pixels that differ after both images are padded to the
// same size from the top left, so a size change counts as a difference.
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

import {
  ARTIFACTS,
  PAGES,
  SCHEMES,
  appendResult,
  openPage,
  readManifest,
} from "./support";
import type { Scheme } from "./support";

const BEFORE = path.join(ARTIFACTS, "catalog-before");
const AFTER = path.join(ARTIFACTS, "docs-after");

export interface MatchRow {
  id: string;
  scheme: Scheme;
  page: string | null;
  before: { width: number; height: number } | null;
  after: { width: number; height: number } | null;
  ratio: number | null;
}

const padded = (image: PNG, width: number, height: number) => {
  const canvas = new PNG({ height, width });

  PNG.bitblt(image, canvas, 0, 0, image.width, image.height, 0, 0);

  return canvas;
};

const compare = (beforeFile: string, afterFile: string) => {
  const before = PNG.sync.read(readFileSync(beforeFile));
  const after = PNG.sync.read(readFileSync(afterFile));
  const width = Math.max(before.width, after.width);
  const height = Math.max(before.height, after.height);

  const differing = pixelmatch(
    padded(before, width, height).data,
    padded(after, width, height).data,
    undefined,
    width,
    height
  );

  return {
    after: { height: after.height, width: after.width },
    before: { height: before.height, width: before.width },
    ratio: differing / (width * height),
  };
};

for (const scheme of SCHEMES) {
  test(`every catalog screenshot has a docs example, ${scheme}`, async ({
    page,
  }) => {
    const manifest = readManifest();
    const wanted = new Set(manifest.map((entry) => entry.id));
    const found = new Map<string, string>();

    mkdirSync(AFTER, { recursive: true });

    for (const url of PAGES) {
      // oxlint-disable-next-line no-await-in-loop -- one page at a time in one browser tab
      await openPage(page, url, scheme);

      // oxlint-disable-next-line no-await-in-loop -- reads the examples on this page
      const ids = await page
        .locator("[data-example]")
        .evaluateAll((nodes) =>
          nodes.map((node) => node.dataset.example ?? "")
        );

      for (const id of ids.filter(
        (name) => wanted.has(name) && !found.has(name)
      )) {
        const element = page.locator(`[data-example="${id}"]`);

        // oxlint-disable-next-line no-await-in-loop -- scrolls to each example before its screenshot
        await element.scrollIntoViewIfNeeded();
        // oxlint-disable-next-line no-await-in-loop -- one screenshot at a time
        await element.screenshot({
          animations: "disabled",
          path: path.join(AFTER, `${id}--${scheme}.png`),
        });
        found.set(id, url);
      }
    }

    for (const { id } of manifest) {
      const beforeFile = path.join(BEFORE, `${id}--${scheme}.png`);
      const afterFile = path.join(AFTER, `${id}--${scheme}.png`);
      const url = found.get(id) ?? null;

      const comparison =
        url && existsSync(beforeFile) ? compare(beforeFile, afterFile) : null;

      appendResult("catalog-match", {
        after: comparison?.after ?? null,
        before: comparison?.before ?? null,
        id,
        page: url,
        ratio: comparison?.ratio ?? null,
        scheme,
      } satisfies MatchRow);
    }

    expect([...wanted].filter((id) => !found.has(id))).toEqual([]);
  });
}
