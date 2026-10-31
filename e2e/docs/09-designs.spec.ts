// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

// Check 7: the Design picker in the sidebar footer. For each design, page
// and scheme it picks the design through the real select, runs axe on the
// whole page, reloads and checks every frame with page content was already
// in the design, then clicks a sidebar link and checks the design is kept
// without a document load. Any console error fails the test.
import { mkdirSync } from "node:fs";
import path from "node:path";

import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import {
  ARTIFACTS,
  DESIGNS,
  DESIGN_PAGES,
  SCHEMES,
  appendResult,
  openPage,
} from "./support";
import type { Scheme } from "./support";

const SHOTS = path.join(ARTIFACTS, "designs");

// Each page's sidebar link to click for the client-side navigation.
const NEXT = new Map([
  ["/app-shell", "/composer"],
  ["/chat-app", "/app-shell"],
  ["/composer", "/conversation"],
  ["/conversation", "/app-shell"],
]);

declare global {
  interface Window {
    // body[data-design] on each animation frame that had page content.
    designFrames?: (string | null)[];
    // Set before a client-side navigation; a document load clears it.
    designMarker?: boolean;
  }
}

interface DesignRow {
  page: string;
  design: string;
  scheme: Scheme;
  firstFrames: (string | null)[];
  keptAfterNavigation: boolean;
  consoleErrors: string[];
  violations: {
    id: string;
    impact: string | null | undefined;
    help: string;
    nodes: number;
    targets: string[];
  }[];
}

// Runs before any page script. Records the design on every frame until
// the load event, from the first frame that shows the docs page. A page
// can finish loading before its first frame, so it records at least one.
const recordFrames = () => {
  const frames: (string | null)[] = [];
  let loaded = false;

  window.designFrames = frames;
  window.addEventListener("load", () => {
    loaded = true;
  });

  const frame = () => {
    if (loaded && frames.length > 0) {
      return;
    }

    if (document.querySelector("#nd-page")) {
      frames.push(document.body.dataset.design ?? null);
    }

    requestAnimationFrame(frame);
  };

  requestAnimationFrame(frame);
};

for (const scheme of SCHEMES) {
  for (const url of DESIGN_PAGES) {
    const target = NEXT.get(url);

    if (target === undefined) {
      throw new Error(`NEXT has no sidebar link to follow from ${url}`);
    }

    for (const design of DESIGNS) {
      test(`${design} ${url} ${scheme}`, async ({ page }) => {
        const errors: string[] = [];

        page.on("console", (message) => {
          if (message.type() === "error") {
            errors.push(message.text());
          }
        });
        page.on("pageerror", (error) => {
          errors.push(error.message);
        });

        await openPage(page, url, scheme);
        await page.getByLabel("Design direction").selectOption(design);
        await expect(page.locator("body")).toHaveAttribute(
          "data-design",
          design
        );

        const result = await new AxeBuilder({ page }).analyze();

        expect
          .soft(result.violations.map((violation) => violation.id))
          .toEqual([]);

        mkdirSync(SHOTS, { recursive: true });
        await page.screenshot({
          path: path.join(SHOTS, `${url.slice(1)}--${design}--${scheme}.png`),
        });

        await page.addInitScript(recordFrames);
        await page.reload();
        await page.waitForLoadState("networkidle");

        const firstFrames = await page.evaluate(
          () => window.designFrames ?? []
        );

        expect.soft(firstFrames.length).toBeGreaterThan(0);
        expect
          .soft(firstFrames.filter((frame) => frame !== design))
          .toEqual([]);

        if (design === "emil") {
          await page.locator("#nd-page h1").first().click();
          await expect
            .soft(page.locator("html"))
            .toHaveAttribute("data-input", "pointer");
        }

        await page.evaluate(() => {
          window.designMarker = true;
        });
        await page.locator(`#nd-sidebar a[href="${target}"]`).click();
        await expect.soft(page).toHaveURL(target);
        await expect
          .soft(page.locator("body"))
          .toHaveAttribute("data-design", design);

        const keptAfterNavigation = await page.evaluate(
          ({ expected, pathname }) =>
            window.location.pathname === pathname &&
            window.designMarker === true &&
            document.body.dataset.design === expected,
          { expected: design, pathname: target }
        );

        expect.soft(keptAfterNavigation).toBe(true);

        appendResult("designs", {
          consoleErrors: errors,
          design,
          firstFrames,
          keptAfterNavigation,
          page: url,
          scheme,
          violations: result.violations.map((violation) => ({
            help: violation.help,
            id: violation.id,
            impact: violation.impact,
            nodes: violation.nodes.length,
            targets: violation.nodes.map((node) => node.target.join(" ")),
          })),
        } satisfies DesignRow);

        expect(errors).toEqual([]);
      });
    }
  }
}
