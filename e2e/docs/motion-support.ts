// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

import type { Locator, Page } from "@playwright/test";

// How long a spec listens for transitions after a change: longer than any
// fade in the kit, so one that started would be seen.
const LISTEN_MS = 400;

declare global {
  interface Window {
    // The transitions that started since listenForTransitions, each as
    // "slot property", where slot is the target's data-slot or tag name.
    shellTransitions?: string[];
  }
}

export const listenForTransitions = (page: Page) =>
  page.evaluate(() => {
    window.shellTransitions = [];
    document.addEventListener("transitionrun", (event) => {
      const { target } = event;

      const slot =
        target instanceof HTMLElement || target instanceof SVGElement
          ? (target.dataset.slot ?? target.tagName.toLowerCase())
          : String(target);

      window.shellTransitions?.push(`${slot} ${event.propertyName}`);
    });
  });

export const startedTransitions = async (page: Page) => {
  await page.waitForTimeout(LISTEN_MS);

  return page.evaluate(() => window.shellTransitions ?? []);
};

// Waits for an element's enter transition to finish. Base UI holds
// data-starting-style for a frame before the transition exists, and
// headless Chromium can hold a compositor transition at its first frame
// until the page asks for a frame, so this asks for frames until neither
// is left.
export const settleMotion = (element: Locator) =>
  element.evaluate(
    (node) =>
      // oxlint-disable-next-line promise/avoid-new -- requestAnimationFrame has no promise form
      new Promise<void>((resolve) => {
        const tick = () => {
          if (
            Object.hasOwn(node.dataset, "startingStyle") ||
            node.getAnimations().length > 0
          ) {
            requestAnimationFrame(tick);
          } else {
            resolve();
          }
        };

        requestAnimationFrame(tick);
      })
  );
