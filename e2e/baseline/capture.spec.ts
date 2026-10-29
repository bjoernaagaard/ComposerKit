// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

/* oxlint-disable no-await-in-loop -- one page, so each screenshot has to wait for the scroll before it */
import { mkdirSync, writeFileSync } from "node:fs";

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const OUT = new URL(
  "../../artifacts/docs-e2e/catalog-before/",
  import.meta.url
);

const SCHEMES = ["light", "dark"] as const;

const LABEL_VALUE = /[=]"(?<value>[^"]+)"/u;

const NON_WORD = /[^a-z0-9]+/gu;

const EDGE_DASH = /^-|-$/gu;

const slug = (text: string) =>
  text.toLowerCase().replaceAll(NON_WORD, "-").replaceAll(EDGE_DASH, "");

interface Entry {
  id: string;
  section: string;
  label: string;
  source: "catalog" | "states";
}

const entries = new Map<string, Entry>();

const useScheme = async (page: Page, scheme: string) => {
  await page.addInitScript((value) => {
    localStorage.setItem("composerkit-scheme", value);
    localStorage.removeItem("composerkit-design");
  }, scheme);
};

const shot = (id: string, scheme: string) => ({
  animations: "disabled" as const,
  path: new URL(`${id}--${scheme}.png`, OUT).pathname,
});

for (const scheme of SCHEMES) {
  test(`catalog, ${scheme}`, async ({ page }) => {
    mkdirSync(OUT, { recursive: true });
    await useScheme(page, scheme);
    await page.goto("/catalog");
    await expect(
      page.getByRole("heading", { name: "ComposerKit components" })
    ).toBeVisible();

    const palette = page.locator("main > section").first();

    await palette.locator("ul").screenshot(shot("palette--swatches", scheme));
    entries.set("palette--swatches", {
      id: "palette--swatches",
      label: "swatches",
      section: "Palette",
      source: "catalog",
    });

    for (const section of await page.locator("main > section").all()) {
      const heading = section.locator(":scope > h2");

      const title = await heading.evaluate(
        (node) => node.firstChild?.textContent?.trim() ?? ""
      );

      const figures = await section
        .locator("figure:has(> figcaption > code)")
        .all();

      for (const figure of figures) {
        const caption = figure.locator("figcaption code").first();
        const text = (await caption.textContent()) ?? "";
        const label = text.trim();
        const value = LABEL_VALUE.exec(label)?.groups?.value ?? label;
        const id = `${slug(title)}--${slug(value)}`;
        const body = figure.locator(":scope > :not(figcaption)").first();

        await body.scrollIntoViewIfNeeded();
        await body.screenshot(shot(id, scheme));
        entries.set(id, { id, label, section: title, source: "catalog" });
      }
    }
  });

  test(`composer states, ${scheme}`, async ({ page }) => {
    await useScheme(page, scheme);
    await page.goto("/states/composer");

    const fixtures = await page.locator("[data-entry]").evaluateAll((nodes) =>
      nodes.map((node) => ({
        id: node.dataset.entry ?? "",
        label: node.textContent?.trim() ?? "",
      }))
    );

    expect(fixtures.length).toBeGreaterThan(0);

    for (const { id, label } of fixtures) {
      const entryId = `composer-state--${id}`;
      const composer = page.locator("form").first();

      await page.goto(`/states/composer?__state=${id}`);
      await expect(composer).toBeVisible();
      await composer.screenshot(shot(entryId, scheme));
      entries.set(entryId, {
        id: entryId,
        label,
        section: "Composer states",
        source: "states",
      });
    }
  });
}

test.afterAll(() => {
  const sorted = [...entries.values()].toSorted((a, b) =>
    a.id.localeCompare(b.id)
  );

  writeFileSync(
    new URL("manifest.json", OUT),
    `${JSON.stringify(sorted, null, 2)}\n`
  );
});
