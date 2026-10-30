// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

// The app shell in the playground's demo app: the current page in the
// icon rail keeps a visible cue in forced colors, reduced motion keeps the
// short color fades and drops the movement, and switching the color scheme
// swaps every color at once instead of fading each element on its own.
// The skip link, the landmarks, the sidebar shortcut, the sidebar's motion,
// and its state across a close and a reload.
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

const sidebar = (page: Page) =>
  page.getByRole("complementary", { name: "Sidebar" });

const hideToggle = (page: Page) =>
  page.getByRole("button", { name: "Hide sidebar" });

const showToggle = (page: Page) =>
  page.getByRole("button", { name: "Show sidebar" });

// The sidebar's own moving parts: the spacer and the panel.
const sidebarMotion = (started: string[]) =>
  started.filter((entry) => entry.startsWith("sidebar-"));

test("skip link: the first Tab shows Skip to content, and Enter moves focus to main", async ({
  page,
}) => {
  await openApp(page, "base", "light");
  await page.keyboard.press("Tab");

  const skip = page.getByRole("link", { name: "Skip to content" });

  await expect(skip).toBeFocused();
  const shown = await skip.boundingBox();

  expect(shown?.width).toBeGreaterThan(24);

  await page.keyboard.press("Enter");

  await expect(page.getByRole("main")).toBeFocused();
});

test("landmarks: banner, the Main navigation, the Sidebar complementary and main, in that order", async ({
  page,
}) => {
  await openApp(page, "base", "light");

  await expect(page.locator("body")).toMatchAriaSnapshot(`
    - link "Skip to content"
    - banner
    - navigation "Main"
    - complementary "Sidebar"
    - main
  `);
  await expect(page.getByRole("banner")).toHaveCount(1);
  await expect(page.getByRole("complementary")).toHaveCount(1);
  await expect(page.getByRole("main")).toHaveCount(1);
});

test("shortcut: Meta+B, or Control+B off Apple platforms, hides and shows the sidebar at once", async ({
  page,
}) => {
  await openApp(page, "base", "light");

  // The toggle names its own shortcut, Meta+B or Control+B by platform.
  const keys = await hideToggle(page).getAttribute("aria-keyshortcuts");

  expect(keys).toMatch(/^(?:Meta|Control)\+B$/u);

  await listenForTransitions(page);
  await page.keyboard.press(keys ?? "");

  await expect(sidebar(page)).toBeHidden();
  await expect(showToggle(page)).toHaveAttribute("aria-expanded", "false");
  expect(await startedTransitions(page)).toEqual([]);

  await listenForTransitions(page);
  await page.keyboard.press(keys ?? "");

  await expect(sidebar(page)).toBeVisible();
  await expect(hideToggle(page)).toHaveAttribute("aria-expanded", "true");
  expect(await startedTransitions(page)).toEqual([]);
});

test("pointer: a click on the sidebar toggle slides the sidebar out and back", async ({
  page,
}) => {
  await openApp(page, "base", "light");
  await listenForTransitions(page);
  await hideToggle(page).click();

  const closing = await startedTransitions(page);

  await expect(sidebar(page)).toBeHidden();
  expect(closing).toContain("sidebar-gap width");
  expect(closing).toContain("sidebar-panel translate");

  await listenForTransitions(page);
  await showToggle(page).click();

  const opening = await startedTransitions(page);

  await expect(sidebar(page)).toBeVisible();
  expect(opening).toContain("sidebar-gap width");
  expect(opening).toContain("sidebar-panel translate");
});

test("reload: a hidden sidebar is still hidden on the first frame", async ({
  page,
}) => {
  await openApp(page, "base", "light");
  await hideToggle(page).click();
  await expect(sidebar(page)).toBeHidden();

  // The layout is saved in the composerkit_shell cookie.
  await expect
    .poll(async () => {
      const cookies = await page.context().cookies();

      return cookies
        .filter((cookie) => cookie.name === "composerkit_shell")
        .map((cookie) => decodeURIComponent(cookie.value));
    })
    .toEqual([expect.stringContaining("open=false")]);

  // Notes the shell's state in the first DOM React writes, before any
  // effect runs or the page paints.
  await page.addInitScript(() => {
    const observer = new MutationObserver(() => {
      const shell = document.querySelector<HTMLElement>(
        '[data-slot="app-shell"]'
      );

      if (shell) {
        observer.disconnect();
        document.documentElement.dataset.firstSidebar =
          shell.dataset.sidebar ?? "";
      }
    });

    observer.observe(document, { childList: true, subtree: true });
  });
  await page.reload();
  await page.locator('[data-slot="composer"]').first().waitFor();

  await expect(page.locator("html")).toHaveAttribute(
    "data-first-sidebar",
    "collapsed"
  );
  await expect(sidebar(page)).toBeHidden();
  await expect(showToggle(page)).toBeVisible();
});

test("state: the sidebar keeps its search text and scroll position when it closes and opens", async ({
  page,
}) => {
  await openApp(page, "base", "light");
  await sidebar(page).getByRole("button", { name: "Search chats" }).click();

  const search = sidebar(page).getByRole("searchbox", { name: "Search chats" });

  await search.fill("e");

  // The list scrolls under the pointer, so its first row moves up.
  const row = sidebar(page).getByRole("listitem").first();
  const resting = await row.boundingBox();

  await row.hover();
  await page.mouse.wheel(0, 200);
  await expect
    .poll(async () => {
      const box = await row.boundingBox();

      return box?.y;
    })
    .toBeLessThan(resting?.y ?? 0);

  const before = await row.boundingBox();

  await hideToggle(page).click();
  await expect(sidebar(page)).toBeHidden();
  await showToggle(page).click();
  await expect(sidebar(page)).toBeVisible();

  await expect(search).toHaveValue("e");
  await expect.poll(() => row.boundingBox()).toEqual(before);
});

test("reduced motion: the sidebar toggle fades the sidebar and does not slide it", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openApp(page, "base", "light");
  await listenForTransitions(page);
  await hideToggle(page).click();

  const started = sidebarMotion(await startedTransitions(page));

  await expect(sidebar(page)).toBeHidden();
  expect(started).toContain("sidebar-panel opacity");
  expect(
    started.filter((entry) => /translate|transform|width/u.test(entry))
  ).toEqual([]);
});
