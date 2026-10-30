// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

// The shell tokens in the playground's demo app: the current page in the
// icon rail keeps a visible cue in forced colors, reduced motion keeps the
// short color fades and drops the movement, and switching the color scheme
// swaps every color at once instead of fading each element on its own.
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { openApp } from "./stress-support";

const REDUCED_FADE = "0.15s";

// How long the spec listens for transitions after a change: longer than
// any shell fade, so one that started would be seen.
const LISTEN_MS = 400;

declare global {
  interface Window {
    // The transitions that started since listenForTransitions, each as
    // "slot property", where slot is the target's data-slot or tag name.
    shellTransitions?: string[];
  }
}

const listenForTransitions = (page: Page) =>
  page.evaluate(() => {
    window.shellTransitions = [];
    document.addEventListener("transitionrun", (event) => {
      const { target } = event;

      const slot =
        target instanceof HTMLElement
          ? (target.dataset.slot ?? target.tagName.toLowerCase())
          : String(target);

      window.shellTransitions?.push(`${slot} ${event.propertyName}`);
    });
  });

const startedTransitions = async (page: Page) => {
  await page.waitForTimeout(LISTEN_MS);

  return page.evaluate(() => window.shellTransitions ?? []);
};

const rail = (page: Page) => page.getByRole("navigation", { name: "Main" });

test("forced colors: the current rail item draws a Highlight bar the others don't", async ({
  page,
}) => {
  await page.emulateMedia({ forcedColors: "active" });
  await openApp(page, "base", "light");

  const home = rail(page).getByRole("button", { name: "Home" });
  const inbox = rail(page).getByRole("button", { name: "Inbox" });

  await expect(home).toHaveAttribute("aria-current", "page");
  await expect(inbox).not.toHaveAttribute("aria-current");

  const bar = (button: typeof home) =>
    button.evaluate((element) => {
      const after = getComputedStyle(element, "::after");

      return {
        background: after.backgroundColor,
        content: after.content,
        width: after.width,
      };
    });

  const highlight = await page.evaluate(() => {
    const probe = document.createElement("span");

    probe.style.color = "Highlight";
    document.body.append(probe);
    const { color } = getComputedStyle(probe);

    probe.remove();

    return color;
  });

  const current = await bar(home);
  const other = await bar(inbox);

  expect(current.content).not.toBe("none");
  expect(current.width).toBe("2px");
  expect(current.background).toBe(highlight);
  expect(current.background).not.toBe("rgba(0, 0, 0, 0)");
  expect(other.content).toBe("none");
});

test("reduced motion: the mode toggle's labels still fade and its thumb does not slide", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openApp(page, "base", "light");

  const toggle = page.locator('[data-slot="mode-toggle"]').first();
  const thumb = toggle.locator('[data-slot="mode-toggle-thumb"]');
  const label = toggle.getByRole("button", { name: "Chat" });

  const transition = (element: typeof thumb) =>
    element.evaluate((node) => {
      const style = getComputedStyle(node);

      return {
        duration: style.transitionDuration,
        property: style.transitionProperty,
      };
    });

  const labelTransition = await transition(label);
  const thumbTransition = await transition(thumb);

  expect(labelTransition.property).toContain("color");
  expect(labelTransition.duration).toBe(REDUCED_FADE);
  expect(thumbTransition.property).not.toMatch(/transform|translate/u);

  // Moving the choice changes both labels' color and the thumb's place.
  const thumbBefore = await thumb.boundingBox();

  await listenForTransitions(page);
  await label.click();
  await expect(label).toHaveAttribute("aria-pressed", "true");

  const started = await startedTransitions(page);

  expect(await thumb.boundingBox()).not.toEqual(thumbBefore);
  expect(started).toContain("button color");
  expect(
    started.filter((entry) => entry.startsWith("mode-toggle-thumb"))
  ).toEqual([]);
});

test("theme switch: picking the other scheme starts no transitions", async ({
  page,
}) => {
  await openApp(page, "base", "light");
  await rail(page).getByRole("button", { name: "Appearance" }).click();

  const dark = page.getByRole("menuitemradio", { name: "Dark" });

  await expect(dark).toBeVisible();

  // The frame after the root's class changes, when every color has swapped.
  await page.evaluate(() => {
    const observer = new MutationObserver(() => {
      observer.disconnect();
      requestAnimationFrame(() => {
        document.documentElement.dataset.shellFrameTransitions = String(
          document
            .getAnimations()
            .filter(
              (animation) =>
                animation instanceof CSSTransition &&
                animation.playState === "running"
            ).length
        );
      });
    });

    observer.observe(document.documentElement, { attributeFilter: ["class"] });
  });
  await listenForTransitions(page);
  await dark.click();

  await expect(page.locator("html")).toHaveClass(/\bdark\b/u);
  await expect(page.locator("html")).toHaveAttribute(
    "data-shell-frame-transitions",
    "0"
  );
  expect(await startedTransitions(page)).toEqual([]);
  await expect(page.locator("html")).not.toHaveAttribute(
    "data-theme-switching"
  );
});
