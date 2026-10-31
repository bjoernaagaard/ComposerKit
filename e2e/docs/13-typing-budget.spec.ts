// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

// Typing in the chat app's home composer stays within one frame per key on
// a slower machine. With the CPU slowed 4x, the main thread may spend at
// most 16 ms on a keystroke, from the key going down to React having
// committed the new draft.
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { openPage, writeResult } from "./support";

const CPU_SLOWDOWN = 4;
const BUDGET_MS = 16;
const TYPED = "Plan a week of meals for four.";

declare global {
  interface Window {
    // One row per keystroke typed since timeKeystrokes.
    keystrokes?: { ms: number; oneTask: boolean }[];
  }
}

// Times each keystroke from keydown, before any listener on the page runs,
// to input on window, which fires after React's root listener has handled
// the input and committed the controlled field's new value. A message
// posted at keydown arrives only in a later task, so a key whose message
// came first had idle time inside its timing.
const timeKeystrokes = (page: Page) =>
  page.evaluate(() => {
    window.keystrokes = [];
    let start = 0;
    let laterTaskRan = false;
    const channel = new MessageChannel();

    channel.port1.addEventListener("message", () => {
      laterTaskRan = true;
    });
    channel.port1.start();

    window.addEventListener(
      "keydown",
      () => {
        laterTaskRan = false;
        channel.port2.postMessage(null);
        start = performance.now();
      },
      { capture: true }
    );
    window.addEventListener("input", () => {
      window.keystrokes?.push({
        ms: performance.now() - start,
        oneTask: !laterTaskRan,
      });
    });
  });

const percentile = (sorted: number[], share: number): number =>
  sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * share))] ?? 0;

const round = (ms: number) => Math.round(ms * 100) / 100;

test(`typing ${TYPED.length} characters in the home composer with the CPU slowed ${CPU_SLOWDOWN}x takes at most ${BUDGET_MS} ms of main-thread work per key at the median`, async ({
  page,
}) => {
  await openPage(page, "/chat-app", "light");

  const field = page.locator(
    '[data-slot="home-view"] [data-slot="composer-field"]'
  );

  await field.click();
  await timeKeystrokes(page);

  const cdp = await page.context().newCDPSession(page);

  await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU_SLOWDOWN });
  await page.keyboard.type(TYPED);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });

  await expect(field).toHaveValue(TYPED);

  const keystrokes = await page.evaluate(() => window.keystrokes ?? []);
  const sorted = keystrokes.map(({ ms }) => ms).toSorted((a, b) => a - b);

  const result = {
    budgetMs: BUDGET_MS,
    cpuSlowdown: CPU_SLOWDOWN,
    keys: keystrokes.length,
    maxMs: round(sorted.at(-1) ?? 0),
    medianMs: round(percentile(sorted, 0.5)),
    p95Ms: round(percentile(sorted, 0.95)),
    perKeyMs: keystrokes.map(({ ms }) => round(ms)),
  };

  writeResult("typing-budget", result);
  // oxlint-disable-next-line no-console -- the run prints the numbers the budget is judged on
  console.log(
    `typing at ${CPU_SLOWDOWN}x CPU slowdown, ${result.keys} keys: median ${result.medianMs} ms, p95 ${result.p95Ms} ms, max ${result.maxMs} ms`
  );

  expect(keystrokes).toHaveLength(TYPED.length);
  expect(keystrokes.filter(({ oneTask }) => !oneTask)).toEqual([]);
  expect(result.medianMs).toBeLessThanOrEqual(BUDGET_MS);
});
