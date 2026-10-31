// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Browser, Locator, Page } from "@playwright/test";

import { listenForTransitions, startedTransitions } from "./motion-support";
import { openApp, openHarness } from "./stress-support";
import { DESIGNS, PLAYGROUND_URL, REPO, run } from "./support";

const REDUCED_FADE = "0.15s";

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
  // The click also closes the Appearance menu, which a pointer closes with
  // motion. Nothing else may move.
  const started = await startedTransitions(page);

  expect(started.filter((entry) => !entry.startsWith("menu "))).toEqual([]);
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

// The slides running on the main region, which the shell plays with the
// Web Animations API rather than a CSS transition.
const mainSlides = (page: Page) =>
  page
    .getByRole("main")
    .evaluate(
      (node) =>
        node
          .getAnimations()
          .filter((item) => item.id === "app-shell-main-slide").length
    );

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

  const keys = await hideToggle(page).getAttribute("aria-keyshortcuts");

  expect(keys).toMatch(/^(?:Meta|Control)\+B$/u);

  await listenForTransitions(page);
  await page.keyboard.press(keys ?? "");
  expect(await mainSlides(page)).toBe(0);

  await expect(sidebar(page)).toBeHidden();
  await expect(showToggle(page)).toHaveAttribute("aria-expanded", "false");
  expect(await startedTransitions(page)).toEqual([]);

  await listenForTransitions(page);
  await page.keyboard.press(keys ?? "");
  expect(await mainSlides(page)).toBe(0);

  await expect(sidebar(page)).toBeVisible();
  await expect(hideToggle(page)).toHaveAttribute("aria-expanded", "true");
  expect(await startedTransitions(page)).toEqual([]);
});

test("pointer: a click on the sidebar toggle slides the sidebar and the main region out and back, with no width animation", async ({
  page,
}) => {
  await openApp(page, "base", "light");
  await listenForTransitions(page);
  await hideToggle(page).click();

  expect(await mainSlides(page)).toBe(1);

  const closing = await startedTransitions(page);

  await expect(sidebar(page)).toBeHidden();
  expect(closing).toContain("sidebar-panel translate");
  expect(closing).not.toContain("sidebar-gap width");

  await listenForTransitions(page);
  await showToggle(page).click();

  expect(await mainSlides(page)).toBe(1);

  const opening = await startedTransitions(page);

  await expect(sidebar(page)).toBeVisible();
  expect(opening).toContain("sidebar-panel translate");
  expect(opening).not.toContain("sidebar-gap width");
  await expect(page.locator('[data-slot="app-shell"]')).not.toHaveAttribute(
    "data-sliding"
  );
});

test("keyboard mid slide: Meta+B or Control+B during a pointer slide stops it, and the main region sits where it belongs", async ({
  page,
}) => {
  await openApp(page, "base", "light");

  const main = page.getByRole("main");
  const resting = await main.boundingBox();
  const keys = await hideToggle(page).getAttribute("aria-keyshortcuts");

  await hideToggle(page).click();
  await page.keyboard.press(keys ?? "");

  expect(await mainSlides(page)).toBe(0);
  await expect(sidebar(page)).toBeVisible();
  expect(await main.boundingBox()).toEqual(resting);
});

test("pointer: four fast clicks on the sidebar toggle leave one slide running and end where they started", async ({
  page,
}) => {
  await openApp(page, "base", "light");

  const main = page.getByRole("main");
  const resting = await main.boundingBox();

  for (let click = 0; click < 4; click += 1) {
    // oxlint-disable-next-line no-await-in-loop -- each click follows the one before
    await page
      .getByRole("button", { name: /^(?:Hide|Show) sidebar$/u })
      .click();
  }

  expect(await mainSlides(page)).toBeLessThanOrEqual(1);
  await expect.poll(() => mainSlides(page)).toBe(0);
  expect(await main.boundingBox()).toEqual(resting);
});

test("reload: a hidden sidebar is still hidden on the first frame", async ({
  page,
}) => {
  await openApp(page, "base", "light");
  await hideToggle(page).click();
  await expect(sidebar(page)).toBeHidden();

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
  expect(await mainSlides(page)).toBe(0);
});

// The shell as an app gets it from the npm package.
const savedShell = async (page: Page) => {
  const cookies = await page.context().cookies();

  return cookies
    .filter((cookie) => cookie.name === "composerkit_shell")
    .map((cookie) => decodeURIComponent(cookie.value));
};

test('npm package: persist.js has no "use client", so a server component can call readShellCookie', async () => {
  const build = await run(
    "bun",
    ["run", "--filter", "composerkit", "build"],
    REPO
  );

  expect(build.exitCode).toBe(0);

  const file = path.join(
    REPO,
    "packages/composerkit/dist/components/app-shell/persist.js"
  );

  expect(readFileSync(file, "utf-8").slice(0, 200)).not.toContain("use client");

  // SAFETY: persist.js is built from persist.ts, which exports
  // readShellCookie with this signature.
  const persist = (await import(pathToFileURL(file).href)) as {
    readShellCookie: (header: string) => { open?: boolean; width?: number };
  };

  expect(
    persist.readShellCookie("composerkit_shell=open%3Dfalse%26width%3D300")
  ).toEqual({ open: false, width: 300 });

  const provider = readFileSync(
    path.join(
      REPO,
      "packages/composerkit/dist/components/app-shell/app-shell-provider.js"
    ),
    "utf-8"
  );

  expect(provider.slice(0, 200)).toContain('"use client"');
});

test("cookie: a sidebar closed before anyone picks a width saves no width, and a reload keeps the design's width", async ({
  page,
}) => {
  await openApp(page, "base", "light");

  const designBox = await sidebar(page).boundingBox();

  await hideToggle(page).click();
  await expect(sidebar(page)).toBeHidden();
  await expect.poll(() => savedShell(page)).toEqual(["open=false"]);

  await showToggle(page).click();
  await expect(sidebar(page)).toBeVisible();
  await expect.poll(() => savedShell(page)).toEqual(["open=true"]);

  await page.reload();
  await expect(sidebar(page)).toBeVisible();
  const reloadedBox = await sidebar(page).boundingBox();

  expect(reloadedBox?.width).toBe(designBox?.width);
});

test("blocked cookies: in a sandboxed iframe the playground renders one shell and no error", async ({
  page,
}) => {
  const errors: string[] = [];

  page.on("pageerror", (error) => errors.push(error.message));
  // A sandboxed frame has an opaque origin, so its module scripts need a
  // CORS header, which the Vite dev server only sends to localhost. The
  // header is added here, as a host that serves the app to embeds would.
  await page.route(`${PLAYGROUND_URL}/**`, async (route) => {
    const response = await route.fetch();

    await route.fulfill({
      headers: { ...response.headers(), "access-control-allow-origin": "*" },
      response,
    });
  });
  await page.setContent(
    `<iframe sandbox="allow-scripts" src="${PLAYGROUND_URL}/" style="width:1200px;height:800px"></iframe>`
  );

  const frame = page.frameLocator("iframe");

  await expect(frame.locator('[data-slot="app-shell"]')).toHaveCount(1);
  await expect(frame.getByRole("main")).toBeVisible();
  expect(errors).toEqual([]);
});

const NARROW_SIZES = [
  { height: 844, width: 390 },
  { height: 640, width: 320 },
] as const;

const WIDE = { height: 900, width: 1440 } as const;

const drawer = (page: Page) => page.getByRole("dialog", { name: "Sidebar" });

const focusInDrawer = (page: Page) =>
  page.locator('[role="dialog"]:focus-within');

const openDrawer = async (page: Page) => {
  await showToggle(page).click();
  await expect(drawer(page)).toBeVisible();
};

for (const size of NARROW_SIZES) {
  test(`${size.width} wide: the drawer takes focus, and Tab and Shift+Tab stay inside it`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await openApp(page, "base", "light");
    await openDrawer(page);

    await expect(focusInDrawer(page)).toHaveCount(1);

    await expect(drawer(page)).toHaveAttribute("aria-modal", "true");
    await expect(page.getByRole("banner")).toHaveCount(0);

    await page.keyboard.press("Shift+Tab");
    await expect(focusInDrawer(page)).toHaveCount(1);
    await page.keyboard.press("Shift+Tab");
    await expect(focusInDrawer(page)).toHaveCount(1);
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expect(focusInDrawer(page)).toHaveCount(1);
    await expect(drawer(page)).toBeVisible();
  });

  test(`${size.width} wide: Escape closes the drawer and focuses the sidebar toggle`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await openApp(page, "base", "light");
    await openDrawer(page);
    await page.keyboard.press("Escape");

    await expect(drawer(page)).toBeHidden();
    await expect(showToggle(page)).toBeFocused();
    await expect(showToggle(page)).toHaveAttribute("aria-expanded", "false");
  });

  test(`${size.width} wide: picking a chat closes the drawer and focuses main`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await openApp(page, "base", "light");
    await openDrawer(page);
    await drawer(page)
      .getByRole("button", {
        exact: true,
        name: "Add retries to the sync client",
      })
      .click();

    await expect(drawer(page)).toBeHidden();
    await expect(page.getByRole("main")).toBeFocused();
    await expect(
      page.getByRole("tab", { name: "Add retries to the sync client" })
    ).toHaveAttribute("aria-selected", "true");
  });

  test(`${size.width} wide: a strip of backdrop at least 48 px wide stays to tap, and a tap there closes the drawer`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await openApp(page, "base", "light");
    await openDrawer(page);

    // Measured once the drawer has slid all the way in.
    await expect
      .poll(async () => {
        const box = await drawer(page).boundingBox();

        return box?.x;
      })
      .toBe(0);

    const panel = await drawer(page).boundingBox();
    const panelEnd = (panel?.x ?? 0) + (panel?.width ?? size.width);

    expect(size.width - panelEnd).toBeGreaterThanOrEqual(48);

    await page.mouse.click(size.width - 24, size.height / 2);

    await expect(drawer(page)).toBeHidden();
  });

  test(`${size.width} wide: the rail's destinations sit at the top of the drawer, and none beside the page`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await openApp(page, "base", "light");

    await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(0);
    await expect(page.locator("[data-rail-item]").first()).toBeHidden();

    await showToggle(page).focus();
    await page.keyboard.press("Enter");
    await expect(drawer(page)).toBeVisible();

    const destinations = drawer(page).getByRole("navigation", { name: "Main" });

    await expect(
      destinations.getByRole("button", { name: "Home" })
    ).toBeFocused();
    await expect(
      destinations.getByRole("button", { name: "Notes" })
    ).toBeAttached();
    await expect(
      destinations.getByRole("button", { name: "Appearance" })
    ).toBeVisible();

    const row = await destinations.boundingBox();

    const chats = await drawer(page)
      .getByRole("navigation", { name: "Chats" })
      .boundingBox();

    expect((row?.y ?? 0) + (row?.height ?? 0)).toBeLessThanOrEqual(
      (chats?.y ?? 0) + 1
    );

    await destinations.getByRole("button", { name: "Inbox" }).click();

    await expect(drawer(page)).toBeHidden();
    await expect(page.getByRole("main")).toBeFocused();
    await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();
  });
}

test("container: a shell 600 px wide on a 1440 px page uses the drawer", async ({
  page,
}) => {
  await openApp(page, "base", "light");
  await page.addStyleTag({ content: "#root { width: 600px; }" });

  const shell = page.locator('[data-slot="app-shell"]');

  await expect(shell).toHaveAttribute("data-sidebar-variant", "overlay");
  await expect(page.getByRole("complementary")).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(0);

  await openDrawer(page);
  await expect(
    drawer(page).getByRole("navigation", { name: "Main" })
  ).toBeVisible();

  const shellBox = await shell.boundingBox();

  await expect
    .poll(async () => {
      const box = await drawer(page).boundingBox();

      return box?.x;
    })
    .toBe(shellBox?.x);

  const panel = await drawer(page).boundingBox();

  expect((panel?.x ?? 0) + (panel?.width ?? 0)).toBeLessThanOrEqual(
    (shellBox?.x ?? 0) + (shellBox?.width ?? 0) - 48
  );
});

test("resize: going narrow and back keeps the wide sidebar's open state", async ({
  page,
}) => {
  await openApp(page, "base", "light");
  await hideToggle(page).click();
  await expect(sidebar(page)).toBeHidden();

  await page.setViewportSize(NARROW_SIZES[0]);
  await openDrawer(page);
  await page.keyboard.press("Escape");
  await expect(drawer(page)).toBeHidden();

  await page.setViewportSize(WIDE);
  await expect(showToggle(page)).toHaveAttribute("aria-expanded", "false");
  await expect(sidebar(page)).toBeHidden();

  await showToggle(page).click();
  await expect(sidebar(page)).toBeVisible();

  await page.setViewportSize(NARROW_SIZES[0]);
  await expect(drawer(page)).toBeHidden();
  await expect(showToggle(page)).toHaveAttribute("aria-expanded", "false");

  await page.setViewportSize(WIDE);
  await expect(sidebar(page)).toBeVisible();
  await expect(hideToggle(page)).toHaveAttribute("aria-expanded", "true");
});

const tabStrip = (page: Page) =>
  page.getByRole("tablist", { name: "Open chats" });

const shellTabs = (page: Page) => tabStrip(page).getByRole("tab");

const newTabButton = (page: Page) =>
  page.getByRole("button", { exact: true, name: "New tab" });

const tabMenuButton = (page: Page) =>
  page.getByRole("button", { exact: true, name: "All tabs" });

const tabMenu = (page: Page) => page.getByRole("menu", { name: "All tabs" });

// The close buttons are hidden from assistive technology, which closes a
// tab with Delete or from the tab menu, so they are found by their hook.
const closeButton = (page: Page, index: number) =>
  tabStrip(page)
    .locator('[data-slot="tab-item"]')
    .nth(index)
    .locator('[data-slot="tab-close"]');

const tabIds = (page: Page) =>
  shellTabs(page).evaluateAll((tabs) =>
    tabs.map((tab) => (tab instanceof HTMLElement ? tab.dataset.tabId : ""))
  );

const focusedTab = (page: Page) => tabStrip(page).locator('[role="tab"]:focus');

const MOVE_AND_CLOSE_KEYS =
  "Delete Control+Shift+ArrowLeft Control+Shift+ArrowRight";

test("tabs: Delete closes the focused tab and focuses the one to its right, or to its left for the last tab, and the only tab can't close", async ({
  page,
}) => {
  await openApp(page, "base", "light");
  await newTabButton(page).click();
  await newTabButton(page).click();
  await expect(shellTabs(page)).toHaveCount(3);

  const [, second, third] = await tabIds(page);

  await shellTabs(page).first().click();
  await expect(shellTabs(page).first()).toHaveAttribute(
    "aria-keyshortcuts",
    MOVE_AND_CLOSE_KEYS
  );

  // A key closes the tab at once, with no motion to wait for.
  await page.keyboard.press("Delete");
  expect(await tabIds(page)).toEqual([second, third]);
  await expect(focusedTab(page)).toHaveAttribute("data-tab-id", second ?? "");
  await expect(focusedTab(page)).toHaveAttribute("aria-selected", "true");

  await page.keyboard.press("End");
  await expect(focusedTab(page)).toHaveAttribute("data-tab-id", third ?? "");
  await page.keyboard.press("Delete");
  expect(await tabIds(page)).toEqual([second]);
  await expect(focusedTab(page)).toHaveAttribute("data-tab-id", second ?? "");
  await expect(focusedTab(page)).toHaveAttribute("aria-selected", "true");

  await expect(shellTabs(page).first()).not.toHaveAttribute(
    "aria-keyshortcuts"
  );
  await expect(tabStrip(page).locator('[data-slot="tab-close"]')).toHaveCount(
    0
  );
  await page.keyboard.press("Delete");
  expect(await tabIds(page)).toEqual([second]);
});

test("tabs: Delete on the open tab while another shrinks out opens and focuses the tab that stays", async ({
  page,
}) => {
  await openApp(page, "base", "light");
  await newTabButton(page).click();
  await newTabButton(page).click();
  await expect(shellTabs(page)).toHaveCount(3);

  const [, second, third] = await tabIds(page);

  await shellTabs(page).first().click();
  // The second tab shrinks out over 140 ms, and focus stays on the first,
  // where Delete closes it before the second is gone.
  await closeButton(page, 1).click();
  await expect(focusedTab(page)).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Delete");
  expect(await tabIds(page)).toEqual([second, third]);

  await expect.poll(() => tabIds(page)).toEqual([third]);

  const tab = shellTabs(page).first();
  const tabId = await tab.getAttribute("id");
  const panelId = await tab.getAttribute("aria-controls");

  await expect(tab).toHaveAttribute("aria-selected", "true");
  await expect(tab).toHaveAttribute("tabindex", "0");
  await expect(tab).toBeFocused();
  await expect(page.locator(`[id="${panelId}"]`)).toHaveAttribute(
    "aria-labelledby",
    tabId ?? ""
  );
});

test("tabs: ArrowRight while the next tab shrinks out skips it and opens the one after", async ({
  page,
}) => {
  await openApp(page, "base", "light");
  await newTabButton(page).click();
  await newTabButton(page).click();
  await expect(shellTabs(page)).toHaveCount(3);

  const [, second, third] = await tabIds(page);

  await shellTabs(page).first().click();
  await closeButton(page, 1).click();
  await page.keyboard.press("ArrowRight");
  expect(await tabIds(page)).toContain(second);

  await expect.poll(() => tabIds(page)).toHaveLength(2);
  await expect(focusedTab(page)).toHaveAttribute("data-tab-id", third ?? "");
  await expect(focusedTab(page)).toHaveAttribute("aria-selected", "true");
});

test("tabs: a tab pressed and dragged off holds focus without opening, and Delete there focuses the tab to its right", async ({
  page,
}) => {
  await openApp(page, "base", "light");
  await newTabButton(page).click();
  await newTabButton(page).click();
  await expect(shellTabs(page)).toHaveCount(3);

  const [first, , third] = await tabIds(page);

  await shellTabs(page).first().click();

  // A press on the second tab focuses it, and letting go away from it
  // cancels the click that would open it.
  const box = await shellTabs(page).nth(1).boundingBox();

  await page.mouse.move(
    (box?.x ?? 0) + (box?.width ?? 0) / 2,
    (box?.y ?? 0) + (box?.height ?? 0) / 2
  );
  await page.mouse.down();
  await page.mouse.move(700, 600, { steps: 4 });
  await page.mouse.up();
  await expect(shellTabs(page).nth(1)).toBeFocused();
  await expect(shellTabs(page).first()).toHaveAttribute(
    "aria-selected",
    "true"
  );

  await page.keyboard.press("Delete");
  expect(await tabIds(page)).toEqual([first, third]);
  await expect(focusedTab(page)).toHaveAttribute("data-tab-id", third ?? "");
  await expect(shellTabs(page).first()).toHaveAttribute(
    "aria-selected",
    "true"
  );
});

test("tabs with a pointer: close buttons show on hover and on the open tab, a click closes one, and so does a middle click", async ({
  page,
}) => {
  await openApp(page, "base", "light");
  await newTabButton(page).click();
  await newTabButton(page).click();
  await expect(shellTabs(page)).toHaveCount(3);

  const [, second, third] = await tabIds(page);

  await page.mouse.move(700, 600);
  await expect(closeButton(page, 2)).toHaveCSS("opacity", "1");
  await expect(closeButton(page, 0)).toHaveCSS("opacity", "0");
  await expect(closeButton(page, 0)).toHaveAttribute("aria-hidden", "true");
  await expect(closeButton(page, 0)).toHaveAttribute("tabindex", "-1");

  await expect(tabStrip(page)).not.toHaveAttribute("data-overflow");
  await expect(tabMenuButton(page)).toBeHidden();

  await shellTabs(page).first().hover();
  await expect(closeButton(page, 0)).toHaveCSS("opacity", "1");

  // WCAG 2.5.8: a target at least 24 by 24.
  const box = await closeButton(page, 0).boundingBox();

  expect(box?.width).toBeGreaterThanOrEqual(24);
  expect(box?.height).toBeGreaterThanOrEqual(24);

  await closeButton(page, 0).click();
  await expect.poll(() => tabIds(page)).toEqual([second, third]);
  await expect(shellTabs(page).last()).toHaveAttribute("aria-selected", "true");

  await shellTabs(page).first().click({ button: "middle" });
  await expect.poll(() => tabIds(page)).toEqual([third]);
  await expect(shellTabs(page).first()).toHaveAttribute(
    "aria-selected",
    "true"
  );
});

test("tab motion: a new tab grows in over --motion-tab-enter, a clicked close shrinks it over --motion-tab-exit", async ({
  page,
}) => {
  await openApp(page, "base", "light");

  // Clicked in the page, and read on the next frame, long before the
  // animation ends.
  const entering = await page.evaluate(async () => {
    const button = document.querySelector<HTMLElement>(
      '[aria-label="New tab"]'
    );

    button?.click();
    // React commits a click's update in a microtask queued before this one.
    await Promise.resolve();

    const items = [...document.querySelectorAll('[data-slot="tab-item"]')];

    return [...(items.at(-1)?.getAnimations() ?? [])].map(
      (animation) => animation.effect?.getTiming().duration
    );
  });

  expect(entering).toEqual([180]);
  await expect(shellTabs(page)).toHaveCount(2);

  const leaving = await page.evaluate(() => {
    const [item] = document.querySelectorAll('[data-slot="tab-item"]');

    item?.querySelector<HTMLElement>('[data-slot="tab-close"]')?.click();

    return {
      durations: [...(item?.getAnimations() ?? [])].map(
        (animation) => animation.effect?.getTiming().duration
      ),
      stillThere: item?.isConnected,
    };
  });

  expect(leaving).toEqual({ durations: [140], stillThere: true });
  await expect(shellTabs(page)).toHaveCount(1);
});

test("tabs on touch: every close button shows, the tab menu shows without overflow, and its Close item closes the open tab", async ({
  browser,
}) => {
  const context = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: { height: 900, width: 1440 },
  });

  const page = await context.newPage();

  await openApp(page, "base", "light");
  await newTabButton(page).tap();
  await expect(shellTabs(page)).toHaveCount(2);

  await expect(closeButton(page, 0)).toHaveCSS("opacity", "1");
  await expect(closeButton(page, 1)).toHaveCSS("opacity", "1");
  await expect(tabStrip(page)).not.toHaveAttribute("data-overflow");
  await expect(tabMenuButton(page)).toBeVisible();

  await tabMenuButton(page).tap();
  await expect(tabMenu(page).getByRole("menuitemradio")).toHaveCount(2);
  await tabMenu(page)
    .getByRole("menuitem", { exact: true, name: "Close New chat" })
    .tap();

  await expect(shellTabs(page)).toHaveCount(1);
  await expect(shellTabs(page).first()).toHaveAccessibleName("Chat");
  await expect(shellTabs(page).first()).toHaveAttribute(
    "aria-selected",
    "true"
  );
  await context.close();
});

test("tab overflow: ten tabs at 1024 px fade at the clipped edge, and the tab menu lists every tab and opens a hidden one", async ({
  page,
}) => {
  await page.setViewportSize({ height: 768, width: 1024 });
  await openApp(page, "base", "light");

  for (let opened = 1; opened < 10; opened += 1) {
    // oxlint-disable-next-line no-await-in-loop -- each tab follows the one before
    await newTabButton(page).click();
  }

  await expect(shellTabs(page)).toHaveCount(10);

  await expect(tabStrip(page)).toHaveAttribute("data-overflow", "start");
  expect(
    await tabStrip(page).evaluate((strip) => getComputedStyle(strip).maskImage)
  ).not.toBe("none");

  await tabMenuButton(page).click();

  const choices = tabMenu(page).getByRole("menuitemradio");

  await expect(choices).toHaveCount(10);
  await expect(choices.last()).toHaveAttribute("aria-checked", "true");
  await expect(choices.first()).toHaveAttribute("aria-checked", "false");
  await choices.first().click();

  const first = shellTabs(page).first();

  await expect(first).toHaveAttribute("aria-selected", "true");
  await expect(first).toHaveAccessibleName("Chat");
  await expect(tabStrip(page)).toHaveAttribute("data-overflow", "end");

  const strip = await tabStrip(page).boundingBox();
  const shown = await first.boundingBox();

  expect(shown?.x).toBeGreaterThanOrEqual((strip?.x ?? 0) - 1);
  expect((shown?.x ?? 0) + (shown?.width ?? 0)).toBeLessThanOrEqual(
    (strip?.x ?? 0) + (strip?.width ?? 0) + 1
  );
});

test("tab ids: a lone surrogate such as \\uD800 in a tab id renders, and its tabs open by click and by arrow key", async ({
  page,
}) => {
  const errors: string[] = [];

  page.on("pageerror", (error) => errors.push(error.message));
  await openHarness(page, "part=tabs&data=demo", "light");

  const tabs = page.getByRole("tab");

  await expect(tabs).toHaveCount(3);
  expect(await tabs.first().getAttribute("data-tab-id")).toContain("\uD800");

  await tabs.nth(1).click();
  await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowRight");
  await expect(tabs.nth(2)).toHaveAttribute("aria-selected", "true");
  await expect(tabs.nth(2)).toBeFocused();
  await expect(page.getByRole("tabpanel")).toHaveAccessibleName(
    ((await tabs.nth(2).textContent()) ?? "").trim()
  );
  expect(errors).toEqual([]);
});

const EMPTY_ID_TABS = "part=tabs&id=a&id=&id=c";

test("tab ids: a tab whose id is empty takes focus when Delete closes the tab before it, and Delete on it focuses the next", async ({
  page,
}) => {
  await openHarness(page, EMPTY_ID_TABS, "light");

  const tab = (title: string) => page.getByRole("tab", { name: title });

  await tab("[a]").click();
  await page.keyboard.press("Delete");
  await expect(tab("[a]")).toHaveCount(0);
  await expect(tab("[]")).toHaveAttribute("aria-selected", "true");
  await expect(tab("[]")).toBeFocused();

  await page.keyboard.press("Delete");
  await expect(tab("[]")).toHaveCount(0);
  await expect(tab("[c]")).toHaveAttribute("aria-selected", "true");
  await expect(tab("[c]")).toBeFocused();
});

test("tab ids: Delete on the last tab focuses the open tab to its left, also when that tab's id is empty", async ({
  page,
}) => {
  await openHarness(page, EMPTY_ID_TABS, "light");

  const tab = (title: string) => page.getByRole("tab", { name: title });

  await tab("[]").click();
  // Focus without opening, as a tab pressed and dragged off does.
  await tab("[c]").focus();
  await page.keyboard.press("Delete");
  await expect(tab("[c]")).toHaveCount(0);
  await expect(tab("[]")).toHaveAttribute("aria-selected", "true");
  await expect(tab("[]")).toBeFocused();
});

const moveAnnouncement = (page: Page) =>
  page.locator('[data-slot="tabs"]').getByRole("status");

const openThreeTabs = async (page: Page) => {
  await openApp(page, "base", "light");
  await newTabButton(page).click();
  await newTabButton(page).click();
  await expect(shellTabs(page)).toHaveCount(3);

  return tabIds(page);
};

test("tabs: move with Ctrl+Shift+ArrowRight puts the first tab second, keeps focus and selection on it, and announces where it went", async ({
  page,
}) => {
  const [first, second, third] = await openThreeTabs(page);

  await shellTabs(page).first().click();
  await expect(shellTabs(page).first()).toHaveAttribute(
    "aria-keyshortcuts",
    MOVE_AND_CLOSE_KEYS
  );
  await page.keyboard.press("Control+Shift+ArrowRight");

  expect(await tabIds(page)).toEqual([second, first, third]);
  await expect(shellTabs(page)).toHaveText(["New chat", "Chat", "New chat"]);
  await expect(shellTabs(page).nth(1)).toHaveAccessibleName("Chat");
  await expect(shellTabs(page).nth(1)).toBeFocused();
  await expect(shellTabs(page).nth(1)).toHaveAttribute("aria-selected", "true");
  await expect(moveAnnouncement(page)).toHaveText(
    "Moved Chat to position 2 of 3"
  );
});

test("tabs: move stops at either end and never wraps", async ({ page }) => {
  const [first, second, third] = await openThreeTabs(page);

  await shellTabs(page).last().click();
  await page.keyboard.press("Control+Shift+ArrowRight");
  expect(await tabIds(page)).toEqual([first, second, third]);
  await expect(shellTabs(page).last()).toBeFocused();

  await page.keyboard.press("Home");
  await page.keyboard.press("Control+Shift+ArrowLeft");
  expect(await tabIds(page)).toEqual([first, second, third]);
  await expect(shellTabs(page).first()).toBeFocused();
  await expect(shellTabs(page).first()).toHaveAttribute(
    "aria-selected",
    "true"
  );
  await expect(moveAnnouncement(page)).toHaveText("");
});

test("tabs: move in right-to-left layouts follows the screen, so Ctrl+Shift+ArrowLeft moves the tab toward the end", async ({
  page,
}) => {
  const [first, second, third] = await openThreeTabs(page);

  await page.evaluate(() => {
    document.documentElement.dir = "rtl";
  });
  await shellTabs(page).first().click();

  await page.keyboard.press("Control+Shift+ArrowLeft");
  expect(await tabIds(page)).toEqual([second, first, third]);
  await expect(focusedTab(page)).toHaveAttribute("data-tab-id", first ?? "");

  await page.keyboard.press("Control+Shift+ArrowRight");
  expect(await tabIds(page)).toEqual([first, second, third]);
  await expect(focusedTab(page)).toHaveAttribute("data-tab-id", first ?? "");
  await expect(moveAnnouncement(page)).toHaveText(
    "Moved Chat to position 1 of 3"
  );
});

test("tabs: move from the tab menu on touch: Move left moves the open tab, and is disabled for the first tab", async ({
  browser,
}) => {
  const context = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: { height: 900, width: 1440 },
  });

  const page = await context.newPage();

  await openApp(page, "base", "light");
  await newTabButton(page).tap();
  await newTabButton(page).tap();
  await expect(shellTabs(page)).toHaveCount(3);

  const [first, second, third] = await tabIds(page);

  const item = (name: string) =>
    tabMenu(page).getByRole("menuitem", { exact: true, name });

  await tabMenuButton(page).tap();
  await expect(item("Move right")).toBeDisabled();
  await item("Move left").tap();

  expect(await tabIds(page)).toEqual([first, third, second]);
  await expect(shellTabs(page).nth(1)).toHaveAttribute("aria-selected", "true");
  await expect(moveAnnouncement(page)).toHaveText(
    "Moved New chat to position 2 of 3"
  );

  await shellTabs(page).first().tap();
  await tabMenuButton(page).tap();
  await expect(item("Move left")).toBeDisabled();
  await expect(item("Move right")).toBeEnabled();
  await context.close();
});

test("tabs: move keys leave plain arrows selecting and Delete closing", async ({
  page,
}) => {
  const [first, second, third] = await openThreeTabs(page);

  await shellTabs(page).first().click();
  await page.keyboard.press("Control+Shift+ArrowRight");
  expect(await tabIds(page)).toEqual([second, first, third]);

  await page.keyboard.press("ArrowRight");
  await expect(focusedTab(page)).toHaveAttribute("data-tab-id", third ?? "");
  await expect(focusedTab(page)).toHaveAttribute("aria-selected", "true");
  expect(await tabIds(page)).toEqual([second, first, third]);

  await page.keyboard.press("Delete");
  expect(await tabIds(page)).toEqual([second, first]);
  await expect(focusedTab(page)).toHaveAttribute("data-tab-id", first ?? "");
  await expect(focusedTab(page)).toHaveAttribute("aria-selected", "true");
});

test("tabs: move without onMoveTab: the keys do nothing and the tab menu has no move items", async ({
  browser,
}) => {
  const context = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: { height: 900, width: 1440 },
  });

  const page = await context.newPage();

  await openHarness(page, "part=tabs&data=demo&fixed", "light");

  const tabs = page.getByRole("tab");

  const ids = () =>
    tabs.evaluateAll((all) =>
      all.map((tab) => (tab instanceof HTMLElement ? tab.dataset.tabId : ""))
    );

  const before = await ids();

  await tabs.first().tap();
  await expect(tabs.first()).toHaveAttribute("aria-keyshortcuts", "Delete");
  await page.keyboard.press("Control+Shift+ArrowRight");
  expect(await ids()).toEqual(before);
  await expect(tabs.first()).toBeFocused();
  await expect(tabs.first()).toHaveAttribute("aria-selected", "true");

  await page.getByRole("button", { exact: true, name: "All tabs" }).tap();

  const menu = page.getByRole("menu", { name: "All tabs" });

  await expect(menu.getByRole("menuitemradio")).toHaveCount(3);
  await expect(menu.getByRole("menuitem", { name: /^Move/u })).toHaveCount(0);
  await expect(menu.getByRole("menuitem", { name: /^Close/u })).toHaveCount(1);
  await context.close();
});

const shellRoot = (page: Page) => page.locator('[data-slot="app-shell"]');

const tabCenter = async (page: Page, index: number) => {
  const box = await shellTabs(page).nth(index).boundingBox();

  return {
    x: (box?.x ?? 0) + (box?.width ?? 0) / 2,
    y: (box?.y ?? 0) + (box?.height ?? 0) / 2,
  };
};

// The horizontal distance that carries one tab's center 10 px past
// another's, which is past that tab's midpoint.
const pastTab = async (page: Page, from: number, to: number) => {
  const start = await tabCenter(page, from);
  const end = await tabCenter(page, to);
  const dx = end.x - start.x;

  return dx + Math.sign(dx) * 10;
};

const dragTab = async (
  page: Page,
  index: number,
  dx: number,
  { hold = false, steps = 8 } = {}
) => {
  const { x, y } = await tabCenter(page, index);

  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y, { steps });

  if (!hold) {
    await page.mouse.up();
  }
};

const tabTransforms = (page: Page) =>
  tabStrip(page)
    .locator('[data-slot="tab-item"]')
    .evaluateAll((items) =>
      items.map((item) =>
        item instanceof HTMLElement ? item.style.transform : ""
      )
    );

test("tabs: drag past the next tab's midpoint moves the tab there, marks the shell while the button is held, keeps it open and announces the move", async ({
  page,
}) => {
  const [first, second, third] = await openThreeTabs(page);

  await shellTabs(page).first().click();
  await dragTab(page, 0, await pastTab(page, 0, 1), { hold: true });

  await expect(shellRoot(page)).toHaveAttribute("data-dragging", "");
  await expect(tabStrip(page)).toHaveAttribute("data-dragging", "");
  expect(await tabIds(page)).toEqual([first, second, third]);

  await page.mouse.up();

  expect(await tabIds(page)).toEqual([second, first, third]);
  await expect(shellRoot(page)).not.toHaveAttribute("data-dragging");
  await expect(shellTabs(page).nth(1)).toHaveAccessibleName("Chat");
  await expect(shellTabs(page).nth(1)).toHaveAttribute("aria-selected", "true");
  await expect(moveAnnouncement(page)).toHaveText(
    "Moved Chat to position 2 of 3"
  );
  await expect.poll(() => tabTransforms(page)).toEqual(["", "", ""]);
});

test("tabs: drag shorter than 4 px is a click, so it opens the tab and moves nothing", async ({
  page,
}) => {
  const ids = await openThreeTabs(page);

  await expect(shellTabs(page).last()).toHaveAttribute("aria-selected", "true");
  await dragTab(page, 0, 3, { steps: 3 });

  await expect(shellTabs(page).first()).toHaveAttribute(
    "aria-selected",
    "true"
  );
  await expect(shellRoot(page)).not.toHaveAttribute("data-dragging");
  expect(await tabIds(page)).toEqual(ids);
});

test("tabs: drag then Escape while the button is held puts the tab back, and nothing moves or opens", async ({
  page,
}) => {
  const ids = await openThreeTabs(page);

  await dragTab(page, 0, await pastTab(page, 0, 1), { hold: true });
  await expect(shellRoot(page)).toHaveAttribute("data-dragging", "");

  await page.keyboard.press("Escape");
  await expect(shellRoot(page)).not.toHaveAttribute("data-dragging");
  await page.mouse.up();

  expect(await tabIds(page)).toEqual(ids);
  await expect(shellTabs(page).last()).toHaveAttribute("aria-selected", "true");
  await expect(moveAnnouncement(page)).toHaveText("");
  await expect.poll(() => tabTransforms(page)).toEqual(["", "", ""]);
});

test("tabs: drag toward the start of an overflowing strip at 1024 px scrolls it", async ({
  page,
}) => {
  await page.setViewportSize({ height: 768, width: 1024 });
  await openApp(page, "base", "light");

  for (let opened = 1; opened < 10; opened += 1) {
    // oxlint-disable-next-line no-await-in-loop -- each tab follows the one before
    await newTabButton(page).click();
  }

  await expect(shellTabs(page)).toHaveCount(10);
  await expect(tabStrip(page)).toHaveAttribute("data-overflow", "start");
  // The last tab scrolls the row to the end once it has grown in.
  await expect
    .poll(() =>
      tabStrip(page).evaluate(
        (strip) => strip.getAnimations({ subtree: true }).length
      )
    )
    .toBe(0);

  const scrolled = () =>
    tabStrip(page).evaluate((strip) => Math.abs(strip.scrollLeft));

  const before = await scrolled();
  const strip = await tabStrip(page).boundingBox();
  const { x } = await tabCenter(page, 9);

  await dragTab(page, 9, (strip?.x ?? 0) + 4 - x, { hold: true, steps: 24 });
  await expect.poll(scrolled).toBeLessThan(before - 40);

  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(shellTabs(page)).toHaveCount(10);
});

test("tabs: drag in right-to-left layouts moves the tab the way the pointer goes", async ({
  page,
}) => {
  const [first, second, third] = await openThreeTabs(page);

  await page.evaluate(() => {
    document.documentElement.dir = "rtl";
  });

  const dx = await pastTab(page, 0, 1);

  expect(dx).toBeLessThan(0);
  await dragTab(page, 0, dx);
  expect(await tabIds(page)).toEqual([second, first, third]);

  await dragTab(page, 1, await pastTab(page, 1, 2));
  expect(await tabIds(page)).toEqual([second, third, first]);
});

test("tabs: drag lifts the tab with --shadow-menu, and the tabs it passes slide with a transform transition", async ({
  page,
}) => {
  await openThreeTabs(page);
  await listenForTransitions(page);
  await dragTab(page, 0, await pastTab(page, 0, 1), { hold: true });

  const shadows = await page.evaluate(() => {
    const tab = document.querySelector(
      '[data-slot="tab-item"][data-dragging] [data-slot="tab"]'
    );

    const probe = document.createElement("div");

    probe.style.boxShadow = "var(--shadow-menu)";
    tab?.parentElement?.append(probe);

    const expected = getComputedStyle(probe).boxShadow;

    probe.remove();

    return { actual: tab ? getComputedStyle(tab).boxShadow : "", expected };
  });

  expect(shadows.expected).not.toBe("none");
  expect(shadows.actual).toBe(shadows.expected);

  const started = await startedTransitions(page);

  await page.mouse.up();
  expect(started).toContain("tab-item transform");
});

test("tabs: drag under reduced motion moves the tab, and no tab slides with a transition", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });

  const [first, second, third] = await openThreeTabs(page);

  await listenForTransitions(page);
  await dragTab(page, 0, await pastTab(page, 0, 1), { hold: true });

  const started = await startedTransitions(page);

  await page.mouse.up();
  expect(
    started.filter((entry) => /transform|translate|scale/u.test(entry))
  ).toEqual([]);
  expect(await tabIds(page)).toEqual([second, first, third]);
});

test("tabs: drag passes axe on the title bar while the tab is held", async ({
  page,
}) => {
  await openThreeTabs(page);
  await dragTab(page, 0, await pastTab(page, 0, 1), { hold: true });
  await expect(shellRoot(page)).toHaveAttribute("data-dragging", "");

  const result = await new AxeBuilder({ page })
    .include('[data-slot="title-bar"]')
    .analyze();

  await page.mouse.up();
  expect(result.violations.map((violation) => violation.id)).toEqual([]);
});

// Longer than --motion-drag-press, so the finger has lifted the tab.
const PAST_DRAG_PRESS_MS = 450;
const SHORT_TOUCH_MS = 200;

const openTouchApp = async (
  browser: Browser,
  viewport: { height: number; width: number }
) => {
  const context = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport,
  });

  const page = await context.newPage();

  await openApp(page, "base", "light");

  return { context, page };
};

// A finger through CDP, which can hold still and move, unlike
// Playwright's tap.
const fingerDown = async (page: Page, x: number, y: number) => {
  const cdp = await page.context().newCDPSession(page);
  let at = x;

  await cdp.send("Input.dispatchTouchEvent", {
    touchPoints: [{ x, y }],
    type: "touchStart",
  });

  return {
    lift: async () => {
      await cdp.send("Input.dispatchTouchEvent", {
        touchPoints: [],
        type: "touchEnd",
      });
      await cdp.detach();
    },
    moveBy: async (dx: number, steps = 8) => {
      const from = at;

      at += dx;

      for (let step = 1; step <= steps; step += 1) {
        // oxlint-disable-next-line no-await-in-loop -- each move follows the one before
        await cdp.send("Input.dispatchTouchEvent", {
          touchPoints: [{ x: from + (dx * step) / steps, y }],
          type: "touchMove",
        });
      }
    },
  };
};

test("tabs: touch drag after a 400 ms press lifts the tab, moves it past the next tab's midpoint, and announces the move", async ({
  browser,
}) => {
  const { context, page } = await openTouchApp(browser, WIDE);

  await newTabButton(page).tap();
  await newTabButton(page).tap();
  await expect(shellTabs(page)).toHaveCount(3);

  const [first, second, third] = await tabIds(page);
  const { x, y } = await tabCenter(page, 0);
  const dx = await pastTab(page, 0, 1);
  const finger = await fingerDown(page, x, y);

  await page.waitForTimeout(PAST_DRAG_PRESS_MS);
  await expect(
    tabStrip(page).locator('[data-slot="tab-item"]').first()
  ).toHaveAttribute("data-drag-pressed", "");

  await finger.moveBy(dx);
  await expect(shellRoot(page)).toHaveAttribute("data-dragging", "");
  await finger.lift();

  expect(await tabIds(page)).toEqual([second, first, third]);
  await expect(shellRoot(page)).not.toHaveAttribute("data-dragging");
  await expect(moveAnnouncement(page)).toHaveText(
    "Moved Chat to position 2 of 3"
  );
  await expect.poll(() => tabTransforms(page)).toEqual(["", "", ""]);
  await context.close();
});

test("tabs: touch drag that moves 40 px at once scrolls the strip and moves nothing", async ({
  browser,
}) => {
  const { context, page } = await openTouchApp(browser, {
    height: 768,
    width: 1024,
  });

  for (let opened = 1; opened < 10; opened += 1) {
    // oxlint-disable-next-line no-await-in-loop -- each tab follows the one before
    await newTabButton(page).tap();
  }

  await expect(shellTabs(page)).toHaveCount(10);
  await expect(tabStrip(page)).toHaveAttribute("data-overflow", "start");
  await expect
    .poll(() =>
      tabStrip(page).evaluate(
        (strip) => strip.getAnimations({ subtree: true }).length
      )
    )
    .toBe(0);

  const ids = await tabIds(page);

  const scrolled = () =>
    tabStrip(page).evaluate((strip) => Math.abs(strip.scrollLeft));

  const before = await scrolled();
  const { x, y } = await tabCenter(page, 8);
  const finger = await fingerDown(page, x, y);

  await finger.moveBy(40);
  await finger.lift();

  await expect.poll(scrolled).toBeLessThan(before - 10);
  expect(await tabIds(page)).toEqual(ids);
  await expect(shellRoot(page)).not.toHaveAttribute("data-dragging");
  await expect(tabStrip(page).locator("[data-drag-pressed]")).toHaveCount(0);
  await context.close();
});

test("tabs: touch drag held 200 ms and released is a tap, so it opens the tab and moves nothing", async ({
  browser,
}) => {
  const { context, page } = await openTouchApp(browser, WIDE);

  await newTabButton(page).tap();
  await newTabButton(page).tap();
  await expect(shellTabs(page)).toHaveCount(3);
  await expect(shellTabs(page).last()).toHaveAttribute("aria-selected", "true");

  const ids = await tabIds(page);
  const { x, y } = await tabCenter(page, 0);
  const finger = await fingerDown(page, x, y);

  await page.waitForTimeout(SHORT_TOUCH_MS);
  await finger.lift();

  await expect(shellTabs(page).first()).toHaveAttribute(
    "aria-selected",
    "true"
  );
  expect(await tabIds(page)).toEqual(ids);
  await expect(tabStrip(page).locator("[data-drag-pressed]")).toHaveCount(0);
  await context.close();
});

test("tabs: touch drag waits --motion-drag-press, 400ms in every design and under reduced motion", async ({
  page,
}) => {
  const dragPress = () =>
    tabStrip(page)
      .locator('[data-slot="tab-item"]')
      .first()
      .evaluate((item) =>
        getComputedStyle(item).getPropertyValue("--motion-drag-press").trim()
      );

  for (const design of DESIGNS) {
    // oxlint-disable-next-line no-await-in-loop -- one design at a time
    await openApp(page, design, "light");
    // oxlint-disable-next-line no-await-in-loop -- one design at a time
    expect(await dragPress(), design).toBe("400ms");
  }

  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await dragPress()).toBe("400ms");
});

test("resize: a drawer open when the shell goes wide is closed when it turns narrow again, and focus stays put", async ({
  page,
}) => {
  await page.setViewportSize(NARROW_SIZES[0]);
  await openApp(page, "base", "light");
  await openDrawer(page);

  await page.setViewportSize(WIDE);
  await expect(sidebar(page)).toBeVisible();
  await page.getByRole("main").focus();

  await page.setViewportSize(NARROW_SIZES[0]);
  await expect(page.locator('[data-slot="app-shell"]')).toHaveAttribute(
    "data-sidebar-variant",
    "overlay"
  );
  await expect(drawer(page)).toBeHidden();
  await expect(showToggle(page)).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("main")).toBeFocused();
});

// The drawer's swipe distance as an element computes it.
const swipeOf = (element: Locator) =>
  element.evaluate((node) =>
    getComputedStyle(node).getPropertyValue("--drawer-swipe-movement-x")
  );

test("touch: a 220 px swipe toward the leading edge closes the drawer", async ({
  browser,
}) => {
  const context = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: NARROW_SIZES[1],
  });

  const page = await context.newPage();

  await openApp(page, "base", "light");
  await openDrawer(page);
  await expect
    .poll(async () => {
      const box = await drawer(page).boundingBox();

      return box?.x;
    })
    .toBe(0);

  const cdp = await context.newCDPSession(page);
  const y = 300;
  const steps = [220, 200, 180, 160, 140, 120, 100, 80, 60, 40, 20];

  await cdp.send("Input.dispatchTouchEvent", {
    touchPoints: [{ x: 240, y }],
    type: "touchStart",
  });

  for (const x of steps) {
    // oxlint-disable-next-line no-await-in-loop -- each move follows the one before
    await cdp.send("Input.dispatchTouchEvent", {
      touchPoints: [{ x, y }],
      type: "touchMove",
    });
  }

  // Mid swipe, only the drawer holds the swipe distance. A chat row
  // doesn't inherit it, so the rows aren't restyled on each move.
  expect(await swipeOf(drawer(page))).not.toBe("0px");
  expect(await swipeOf(drawer(page).getByRole("listitem").first())).toBe("0px");

  await cdp.send("Input.dispatchTouchEvent", {
    touchPoints: [],
    type: "touchEnd",
  });

  await expect(page.locator('[data-slot="sidebar-panel"]')).toHaveAttribute(
    "data-state",
    "closed"
  );
  await expect(drawer(page)).toBeHidden();
  await context.close();
});

const splitter = (page: Page) =>
  page.getByRole("separator", { name: "Resize sidebar" });

const expectWidth = async (page: Page, px: number) => {
  await expect(splitter(page)).toHaveAttribute("aria-valuenow", String(px));
  await expect
    .poll(async () => {
      const box = await sidebar(page).boundingBox();

      return box?.width;
    })
    .toBe(px);
};

const dragSplitter = async (page: Page, dx: number, hold = false) => {
  const box = await splitter(page).boundingBox();
  const x = (box?.x ?? 0) + (box?.width ?? 0) / 2;
  const y = (box?.y ?? 0) + (box?.height ?? 0) / 2;

  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y, { steps: 8 });

  if (!hold) {
    await page.mouse.up();
  }
};

test("splitter: a WAI-ARIA window splitter that names the sidebar and its range", async ({
  page,
}) => {
  await openApp(page, "base", "light");

  const sidebarId = await sidebar(page).getAttribute("id");

  await expect(splitter(page)).toHaveAttribute("aria-orientation", "vertical");
  await expect(splitter(page)).toHaveAttribute("aria-valuemin", "220");
  await expect(splitter(page)).toHaveAttribute("aria-valuemax", "480");
  await expect(splitter(page)).toHaveAttribute(
    "aria-controls",
    sidebarId ?? ""
  );
  await expect(splitter(page)).toHaveAttribute("tabindex", "0");
  await expectWidth(page, 288);
});

test("splitter: arrow keys move the edge 16 px, or 8 with Shift, and Home and End jump to 220 and 480", async ({
  page,
}) => {
  await openApp(page, "base", "light");
  await splitter(page).focus();

  await page.keyboard.press("ArrowRight");
  await expectWidth(page, 304);
  await page.keyboard.press("Shift+ArrowRight");
  await expectWidth(page, 312);
  await page.keyboard.press("ArrowLeft");
  await expectWidth(page, 296);
  await page.keyboard.press("Shift+ArrowLeft");
  await expectWidth(page, 288);

  await page.keyboard.press("Home");
  await expectWidth(page, 220);
  await page.keyboard.press("ArrowLeft");
  await expectWidth(page, 220);

  await page.keyboard.press("End");
  await expectWidth(page, 480);
  await page.keyboard.press("ArrowRight");
  await expectWidth(page, 480);
});

test("splitter: dragging from 288 to 400 sets 400 with no transition, and the cookie is written when the drag ends", async ({
  page,
}) => {
  await openApp(page, "base", "light");
  await listenForTransitions(page);
  await dragSplitter(page, 112, true);

  const shell = page.locator('[data-slot="app-shell"]');

  await expectWidth(page, 400);
  await expect(shell).toHaveAttribute("data-resizing", "");
  expect(await savedShell(page)).toEqual([]);

  await page.mouse.up();

  await expect(shell).not.toHaveAttribute("data-resizing");
  await expect
    .poll(() => savedShell(page))
    .toEqual([expect.stringContaining("width=400")]);
  const started = await startedTransitions(page);

  expect(started.filter((entry) => entry.endsWith(" width"))).toEqual([]);
  expect(await page.evaluate(() => getSelection()?.toString() ?? "")).toBe("");

  await dragSplitter(page, 200);
  await expectWidth(page, 480);
});

test("splitter: a chosen width is drawn on the first frame after a reload", async ({
  page,
}) => {
  await openApp(page, "base", "light");
  await dragSplitter(page, 112);
  await expectWidth(page, 400);
  await expect
    .poll(() => savedShell(page))
    .toEqual([expect.stringContaining("width=400")]);

  // Notes the sidebar's width in the first DOM React writes, before any
  // effect runs or the page paints.
  await page.addInitScript(() => {
    const observer = new MutationObserver(() => {
      const gap = document.querySelector('[data-slot="sidebar-gap"]');

      if (gap) {
        observer.disconnect();
        document.documentElement.dataset.firstSidebarWidth = String(
          gap.getBoundingClientRect().width
        );
      }
    });

    observer.observe(document, { childList: true, subtree: true });
  });
  await page.reload();
  await page.locator('[data-slot="composer"]').first().waitFor();

  await expect(page.locator("html")).toHaveAttribute(
    "data-first-sidebar-width",
    "400"
  );
  await expectWidth(page, 400);
});

test("splitter: a double click goes back to 288, and the cookie keeps no width", async ({
  page,
}) => {
  await openApp(page, "base", "light");
  await splitter(page).focus();
  await page.keyboard.press("End");
  await expectWidth(page, 480);

  await splitter(page).dblclick();

  await expectWidth(page, 288);
  await expect.poll(() => savedShell(page)).toEqual(["open=true"]);
});

test("splitter: Enter hides the sidebar and focuses the toggle, and Enter there shows it at the same width", async ({
  page,
}) => {
  await openApp(page, "base", "light");
  await splitter(page).focus();
  await page.keyboard.press("ArrowRight");
  await expectWidth(page, 304);

  await page.keyboard.press("Enter");

  await expect(sidebar(page)).toBeHidden();
  await expect(showToggle(page)).toBeFocused();
  await expect(splitter(page)).toHaveCount(0);

  await page.keyboard.press("Enter");

  await expect(sidebar(page)).toBeVisible();
  await expectWidth(page, 304);
});

test("splitter: in right-to-left layouts, ArrowLeft and a drag to the left widen the sidebar", async ({
  page,
}) => {
  await openApp(page, "base", "light");
  await page.evaluate(() => {
    document.documentElement.dir = "rtl";
  });
  await splitter(page).focus();

  await page.keyboard.press("ArrowLeft");
  await expectWidth(page, 304);
  await page.keyboard.press("ArrowRight");
  await expectWidth(page, 288);

  await dragSplitter(page, -112);
  await expectWidth(page, 400);
});

test("splitter: hiding the sidebar mid drag ends the drag, and the cookie and a reload keep the width", async ({
  page,
}) => {
  await openApp(page, "base", "light");
  await dragSplitter(page, 112, true);
  await expectWidth(page, 400);

  const shell = page.locator('[data-slot="app-shell"]');

  await page.keyboard.press("ControlOrMeta+b");
  await expect(sidebar(page)).toBeHidden();
  await page.mouse.up();

  await expect(shell).not.toHaveAttribute("data-resizing");
  await expect(page.getByRole("main")).not.toHaveCSS("cursor", "col-resize");
  await expect.poll(() => savedShell(page)).toEqual(["open=false&width=400"]);

  await page.keyboard.press("ControlOrMeta+b");
  await expectWidth(page, 400);
  await expect.poll(() => savedShell(page)).toEqual(["open=true&width=400"]);

  await page.reload();
  await page.locator('[data-slot="composer"]').first().waitFor();
  await expectWidth(page, 400);
});

test("splitter: absent while the sidebar is hidden and on narrow shells", async ({
  page,
}) => {
  await openApp(page, "base", "light");
  await expect(splitter(page)).toHaveCount(1);

  await hideToggle(page).click();
  await expect(splitter(page)).toHaveCount(0);
  await showToggle(page).click();
  await expect(splitter(page)).toHaveCount(1);

  await page.setViewportSize(NARROW_SIZES[0]);
  await expect(splitter(page)).toHaveCount(0);
  await openDrawer(page);
  await expect(splitter(page)).toHaveCount(0);
});

test("splitter: a design's sidebar width holds until the person resizes", async ({
  page,
}) => {
  await openApp(page, "taste", "light");
  await expectWidth(page, 260);
  await expect(page.locator('[data-slot="app-shell"]')).not.toHaveAttribute(
    "style",
    /--size-sidebar/u
  );

  await splitter(page).focus();
  await page.keyboard.press("ArrowRight");
  await expectWidth(page, 276);
});

const RETRIES = "Add retries to the sync client";

const chatRow = (root: Locator, title: string) =>
  root.locator('[data-slot="conversation-row"]').filter({
    has: root.page().getByRole("button", { exact: true, name: title }),
  });

const pinnedRows = (root: Locator) =>
  root.getByRole("region", { name: "Pinned" }).getByRole("listitem");

const longTitleRow = (page: Page) =>
  sidebar(page)
    .locator('[data-slot="conversation-row"]')
    .filter({
      has: page.locator('[data-slot="row-title"][data-overflowing="true"]'),
    })
    .first();

// Where the title's text sits in its box: start is how far the text's
// start is past the box's start, end how far its end is past the box's end.
const titleOffsets = (row: Locator) =>
  row.evaluate((element) => {
    const title = element.querySelector('[data-slot="row-title"]');
    const track = element.querySelector('[data-slot="row-title-track"]');
    const box = title?.getBoundingClientRect();
    const text = track?.getBoundingClientRect();

    return {
      end: (text?.right ?? 0) - (box?.right ?? 0),
      start: (text?.left ?? 0) - (box?.left ?? 0),
    };
  });

const titleStart = async (row: Locator) => {
  const offsets = await titleOffsets(row);

  return offsets.start;
};

const titleEnd = async (row: Locator) => {
  const offsets = await titleOffsets(row);

  return offsets.end;
};

const heightOf = async (locator: Locator) => {
  const box = await locator.boundingBox();

  return box?.height;
};

// Longer than the marquee's 400 ms delay and the scroll of any sample title.
const MARQUEE_SETTLE_MS = 1500;

test("touch: a tap on a chat row opens the chat and never pins it, and the row's More button shows and holds Pin and Archive", async ({
  browser,
}) => {
  const context = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: NARROW_SIZES[0],
  });

  const page = await context.newPage();

  await openApp(page, "base", "light");
  await showToggle(page).tap();
  await expect(drawer(page)).toBeVisible();

  const pinned = await pinnedRows(drawer(page)).count();
  const row = chatRow(drawer(page), RETRIES);

  const more = row.getByRole("button", {
    exact: true,
    name: `More actions for ${RETRIES}`,
  });

  await expect(more).toBeVisible();
  await expect(more).toHaveCSS("opacity", "1");
  await expect(
    row.getByRole("button", { exact: true, name: `Pin ${RETRIES}` })
  ).toBeHidden();

  // 14 px from the row's end, where the hidden Pin button used to take
  // the tap, is now the More button, which opens its menu.
  // A tap on the row waits for the drawer to stop moving.
  await row.tap({ position: { x: 1, y: 1 }, trial: true });

  const box = await row.boundingBox();
  const width = box?.width ?? 0;
  const middle = (box?.height ?? 0) / 2;

  await row.tap({ position: { x: width - 14, y: middle } });

  const menu = page.getByRole("menu", { name: "More actions" });

  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitem")).toHaveText([
    "Pin chat",
    /^Archive chat/u,
  ]);
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  expect(await pinnedRows(drawer(page)).count()).toBe(pinned);

  const moreBox = await more.boundingBox();

  await row.tap({
    position: { x: (moreBox?.x ?? 0) - (box?.x ?? 0) - 4, y: middle },
  });
  await expect(drawer(page)).toBeHidden();
  await expect(page.getByRole("tab", { name: RETRIES })).toHaveAttribute(
    "aria-selected",
    "true"
  );

  await showToggle(page).tap();
  await expect(drawer(page)).toBeVisible();
  expect(await pinnedRows(drawer(page)).count()).toBe(pinned);
  await context.close();
});

test("pointer: a row's actions take no click until the row is hovered, and then show", async ({
  page,
}) => {
  await openApp(page, "base", "light");

  const row = chatRow(sidebar(page), RETRIES);
  const actions = row.locator('[data-slot="row-actions"]');

  await page.mouse.move(0, 0);
  await expect(actions).toHaveCSS("opacity", "0");
  await expect(actions).toHaveCSS("pointer-events", "none");
  await expect(actions).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");

  await row.hover();
  await expect(actions).toHaveCSS("opacity", "1");
  await expect(actions).toHaveCSS("pointer-events", "auto");
});

test("marquee: with a fine pointer, hovering a long title scrolls it from its start to its end", async ({
  page,
}) => {
  await openApp(page, "base", "light");

  const row = longTitleRow(page);

  await page.mouse.move(0, 0);
  expect(await titleStart(row)).toBeCloseTo(0, 0);

  await row.hover();

  expect(await titleStart(row)).toBeCloseTo(0, 0);

  await expect
    .poll(() => titleEnd(row), {
      timeout: 5000,
    })
    .toBeCloseTo(0, 0);
  expect(await titleStart(row)).toBeLessThan(0);
});

test("marquee: on a touch screen, a tap or a hover never scrolls a long title", async ({
  browser,
}) => {
  const context = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: WIDE,
  });

  const page = await context.newPage();

  await openApp(page, "base", "light");

  const row = longTitleRow(page);

  await row.hover();
  await row.locator('[data-slot="row-button"]').tap();
  await page.waitForTimeout(MARQUEE_SETTLE_MS);

  expect(await titleStart(row)).toBeCloseTo(0, 0);
  await context.close();
});

// A finger's tap at the middle of target, on a screen whose main pointer
// hovers, such as a touchscreen laptop. Playwright's own tap needs
// hasTouch, which also makes the page match hover: none.
const tapWithFinger = async (page: Page, target: Locator) => {
  const box = await target.boundingBox();

  const point = {
    x: (box?.x ?? 0) + (box?.width ?? 0) / 2,
    y: (box?.y ?? 0) + (box?.height ?? 0) / 2,
  };

  const cdp = await page.context().newCDPSession(page);

  await cdp.send("Input.dispatchTouchEvent", {
    touchPoints: [point],
    type: "touchStart",
  });
  await cdp.send("Input.dispatchTouchEvent", {
    touchPoints: [],
    type: "touchEnd",
  });
  await cdp.detach();
};

test("touch on a screen that hovers: a tap on a row's hidden Pin opens the chat and never pins it", async ({
  page,
}) => {
  await openApp(page, "base", "light");

  const pinned = await pinnedRows(sidebar(page)).count();
  const row = chatRow(sidebar(page), RETRIES);

  await tapWithFinger(page, row.locator('[data-row-action="pin"]'));

  await expect(page.getByRole("tab", { name: RETRIES })).toHaveAttribute(
    "aria-selected",
    "true"
  );
  await expect(pinnedRows(sidebar(page))).toHaveCount(pinned);
});

test("marquee on a screen that hovers: a finger's tap never scrolls a long title", async ({
  page,
}) => {
  await openApp(page, "base", "light");

  const row = longTitleRow(page);
  const title = row.locator('[data-slot="row-title"]');

  await tapWithFinger(page, title);
  await page.waitForTimeout(MARQUEE_SETTLE_MS);

  expect(await titleStart(row)).toBeCloseTo(0, 0);
});

const openTitleRow = async (page: Page) => {
  await openHarness(page, "part=row-title", "light");

  return page.locator('[data-stress-stage] [data-slot="conversation-row"]');
};

const renderRowTitle = (page: Page, title: string) =>
  page.getByRole("textbox", { name: "Row title" }).fill(title);

test("marquee: a row whose title changes to a long one scrolls it on hover, and stops when it changes back", async ({
  page,
}) => {
  const row = await openTitleRow(page);
  const title = row.locator('[data-slot="row-title"]');

  await renderRowTitle(page, "Short");
  await expect(title).toHaveAttribute("data-overflowing", "false");

  await renderRowTitle(page, `${RETRIES}, then the ${RETRIES.toLowerCase()}`);
  await expect(title).toHaveAttribute("data-overflowing", "true");

  await row.hover();
  await expect.poll(() => titleEnd(row), { timeout: 5000 }).toBeCloseTo(0, 0);

  await renderRowTitle(page, "Short");
  await expect(title).toHaveAttribute("data-overflowing", "false");
});

test("marquee under reduced motion: hovering a long title keeps the row 30 px tall and the title on one line", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openApp(page, "base", "light");

  const row = longTitleRow(page);
  const opener = row.locator('[data-slot="row-button"]');

  expect(await heightOf(opener)).toBeCloseTo(30, 0);

  await row.hover();
  await page.waitForTimeout(MARQUEE_SETTLE_MS);

  expect(await heightOf(opener)).toBeCloseTo(30, 0);
  expect(await titleStart(row)).toBeCloseTo(0, 0);
  await expect(row.locator('[data-slot="row-title"]')).toHaveCSS(
    "text-overflow",
    "ellipsis"
  );
});
