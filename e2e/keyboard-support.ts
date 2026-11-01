// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

// Shared pieces for the keyboard walks: one result row per spec row.
import { test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import { appendResult, openPage } from "./support";

export interface SpecRow {
  // Line in spec/functional.md.
  line: number;
  keys: string;
  context: string;
  // What the spec says happens, from its Result column.
  expected: string;
}

export interface Walked {
  actual: string;
  pass: boolean;
}

export interface Where {
  url: string;
  example: string;
}

// Runs one spec row on a playground page and appends what happened to a result
// file. A check that throws is a mismatch too, with the error as what
// happened.
export const record = <Row extends { line: number }>(
  file: string,
  title: string,
  row: Row,
  where: Where,
  steps: (page: Page) => Promise<Walked>
) =>
  test(title, async ({ page }) => {
    await openPage(page, where.url, "light");

    let outcome: Walked;

    try {
      outcome = await steps(page);
    } catch (error) {
      outcome = {
        actual: `check failed: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`,
        pass: false,
      };
    }

    appendResult(file, {
      ...row,
      actual: outcome.actual,
      status: outcome.pass ? "pass" : "mismatch",
      where: `${where.url} [data-example="${where.example}"]`,
    });
  });

// A spec row no demo can show, with the reason.
export const skip = <Row extends { line: number }>(
  file: string,
  title: string,
  row: Row,
  reason: string
) =>
  test(`${title} (not checkable)`, () => {
    appendResult(file, {
      ...row,
      actual: reason,
      status: "not checked",
      where: "",
    });
  });

const keyboardTitle = (row: SpecRow) =>
  `line ${row.line}: ${row.keys}, ${row.context}`;

export const walk = (
  row: SpecRow,
  where: Where,
  steps: (page: Page) => Promise<Walked>
) => record("keyboard", keyboardTitle(row), row, where, steps);

export const focused = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const element = document.activeElement;

    if (!element || element === document.body) {
      return "the page (body)";
    }

    const role = element.getAttribute("role");

    const name =
      element.getAttribute("aria-label") ??
      element.textContent?.trim().slice(0, 40) ??
      "";

    return `${role ?? element.tagName.toLowerCase()} "${name}"`;
  });

export const isFocused = (locator: Locator): Promise<boolean> =>
  locator.evaluate((element) => element === document.activeElement);

export const press = async (page: Page, key: string) => {
  await page.keyboard.press(key);
  await page.evaluate(
    () =>
      // oxlint-disable-next-line promise/avoid-new -- requestAnimationFrame has no promise form
      new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      })
  );
};
