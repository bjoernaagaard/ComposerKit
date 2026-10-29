// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

// Shared pieces for the keyboard walks: one result row per spec row.
import { setTimeout as delay } from "node:timers/promises";

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

export type Status = "pass" | "mismatch" | "not checked";

export interface Where {
  url: string;
  example: string;
}

// Runs one spec row on a docs page and appends what happened to a result
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

export const notCheckable = (row: SpecRow, reason: string) =>
  skip("keyboard", keyboardTitle(row), row, reason);

// The focused element in words, such as button "Send" or textarea "Message".
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

export const example = (page: Page, name: string): Locator =>
  page.locator(`[data-example="${name}"]`);

export const composerParts = (root: Locator) => ({
  add: root.getByRole("button", { name: "Add files and more" }),
  field: root.locator("textarea"),
  listbox: root.getByRole("listbox"),
  model: root.getByRole("button", { name: /effort/u }),
  options: root.getByRole("option"),
  primary: root.locator('[data-slot="composer-primary"]'),
});

export const isFocused = (locator: Locator): Promise<boolean> =>
  locator.evaluate((element) => element === document.activeElement);

export const highlighted = async (root: Locator): Promise<string> => {
  const option = root.locator('[role="option"][aria-selected="true"]');

  return (await option.count()) === 0
    ? "none"
    : ((await option.first().textContent()) ?? "").trim().slice(0, 20);
};

export const openMenu = (page: Page): Locator => page.getByRole("menu").last();

// Waits for a file chooser for a short while, and says whether one opened.
export const fileChooserOpened = async (
  page: Page,
  action: () => Promise<void>
): Promise<boolean> => {
  const chooser = page
    .waitForEvent("filechooser", { timeout: 2000 })
    .then(() => true)
    .catch(() => false);

  await action();

  return chooser;
};

const POLL_MS = 50;
const POLL_LIMIT_MS = 2000;

// Polls a reading until it is true or two seconds pass, and says how long
// that took. The spec gives no time for these, so the walk allows two
// seconds and reports the time.
const pollUntil = async <T>(
  read: () => Promise<T>,
  done: (value: T) => boolean
) => {
  const started = Date.now();
  let value = await read();

  while (!done(value) && Date.now() - started < POLL_LIMIT_MS) {
    // oxlint-disable-next-line no-await-in-loop -- polls one reading at a time
    await delay(POLL_MS);
    // oxlint-disable-next-line no-await-in-loop -- polls one reading at a time
    value = await read();
  }

  return { ms: Date.now() - started, value };
};

// Waits until the reply streams: the primary button reads "Stop reply",
// not "Stop sending".
export const replyRunning = (page: Page, primary: Locator) =>
  primary.and(page.getByRole("button", { name: "Stop reply" })).waitFor();

export const stoppedWithin = async (primary: Locator) => {
  const { ms, value } = await pollUntil(
    () => primary.getAttribute("aria-label"),
    (label) => label !== "Stop reply"
  );

  return { label: value, ms };
};

export const menusClosed = async (page: Page) => {
  const { ms, value } = await pollUntil(
    () => page.getByRole("menu").count(),
    (count) => count === 0
  );

  return { count: value, ms };
};

export const textOf = async (locator: Locator): Promise<string> => {
  const text = await locator.textContent();

  return text?.trim() ?? "";
};
