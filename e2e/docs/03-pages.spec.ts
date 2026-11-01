// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

// Check 3, part one: axe-core on every page in light and dark, with every
// rule axe runs by default. Also checks that each registry item page has
// the eight sections in order, and saves the top of each page.
import { mkdirSync } from "node:fs";
import path from "node:path";

import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import {
  ARTIFACTS,
  DOCS_SCHEME_KEY,
  ITEMS,
  PAGES,
  SCHEMES,
  SECTIONS,
  appendResult,
  openPage,
} from "../support";
import type { Scheme } from "../support";

const SHOTS = path.join(ARTIFACTS, "pages");

interface AxeRow {
  page: string;
  scheme: Scheme;
  violations: {
    id: string;
    impact: string | null | undefined;
    help: string;
    nodes: number;
    targets: string[];
  }[];
}

for (const scheme of SCHEMES) {
  for (const url of PAGES) {
    test(`axe ${url} ${scheme}`, async ({ page }) => {
      await openPage(page, url, scheme, DOCS_SCHEME_KEY);
      mkdirSync(SHOTS, { recursive: true });
      await page.screenshot({
        path: path.join(
          SHOTS,
          `${url === "/" ? "index" : url.slice(1)}--${scheme}.png`
        ),
      });

      const result = await new AxeBuilder({ page }).analyze();

      appendResult("axe", {
        page: url,
        scheme,
        violations: result.violations.map((violation) => ({
          help: violation.help,
          id: violation.id,
          impact: violation.impact,
          nodes: violation.nodes.length,
          targets: violation.nodes.map((node) => node.target.join(" ")),
        })),
      } satisfies AxeRow);

      expect
        .soft(result.violations.map((violation) => violation.id))
        .toEqual([]);
    });
  }
}

for (const item of ITEMS) {
  test(`/${item} has the eight sections in order`, async ({ page }) => {
    await openPage(page, `/${item}`, "light", DOCS_SCHEME_KEY);

    // Page sections only: headings inside live previews belong to examples.
    const headings = await page.locator("#nd-page h2").evaluateAll((nodes) =>
      nodes
        .filter((node) => !node.closest('[data-slot="preview"]'))
        // The heading text is its anchor link; a copy button follows it.
        .map((node) => node.querySelector("a")?.textContent?.trim() ?? "")
    );

    appendResult("sections", {
      headings,
      ok: headings.join("|") === SECTIONS.join("|"),
      page: `/${item}`,
    });
    expect(headings).toEqual(SECTIONS);
  });
}
