// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

// The kit's motion, from what a person does in the demo app: a pointer
// gets motion, the keyboard gets none, and reduced motion only fades.
import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import {
  listenForTransitions,
  settleMotion,
  startedTransitions,
} from "./motion-support";
import { openApp } from "./stress-support";

const REDUCED_FADE = "0.15s";

// The demo's one chat with messages.
const SAMPLE_CHAT = "Add retries to the sync client";

const openChat = async (page: Page, design: string) => {
  await openApp(page, design, "light");
  await page
    .getByRole("complementary", { name: "Sidebar" })
    .getByRole("button", { exact: true, name: SAMPLE_CHAT })
    .click();
  await page.locator('[data-slot="turn"]').first().waitFor();
};

const moreButton = (page: Page) =>
  page
    .getByRole("main")
    .getByRole("button", { exact: true, name: "More" })
    .first();

const moreMenu = (page: Page) => page.getByRole("menu", { name: "More" });

const keyframeAnimations = (element: Locator) =>
  element.evaluate(
    (node) =>
      node
        .getAnimations()
        .filter((animation) => animation instanceof CSSAnimation).length
  );

test("menu: a click opens the menu with opacity and scale, from the trigger", async ({
  page,
}) => {
  await openChat(page, "base");
  await listenForTransitions(page);
  await moreButton(page).click();
  await expect(moreMenu(page)).toBeVisible();

  const opening = await startedTransitions(page);

  expect(opening).toContain("menu opacity");
  expect(opening).toContain("menu scale");

  const origin = await moreMenu(page).evaluate(
    (node) => getComputedStyle(node).transformOrigin
  );

  // Base UI's --transform-origin puts it at the trigger's side, not the
  // middle of the panel.
  const [, y = ""] = origin.split(" ");

  expect(Number(y.replace("px", ""))).not.toBeCloseTo(
    (await moreMenu(page).evaluate((node) => node.clientHeight)) / 2,
    0
  );
});

test("menu: a click outside closes the menu with opacity and scale", async ({
  page,
}) => {
  await openChat(page, "base");
  await moreButton(page).click();
  await expect(moreMenu(page)).toBeVisible();
  await settleMotion(moreMenu(page));

  await listenForTransitions(page);
  await page.mouse.click(900, 150);

  const closing = await startedTransitions(page);

  await expect(moreMenu(page)).toBeHidden();
  expect(closing).toContain("menu opacity");
  expect(closing).toContain("menu scale");
});

test("menu: Enter opens the menu and Escape closes it, with no motion", async ({
  page,
}) => {
  await openChat(page, "base");
  await moreButton(page).focus();
  await listenForTransitions(page);
  await page.keyboard.press("Enter");
  await expect(moreMenu(page)).toBeVisible();

  const opening = await startedTransitions(page);

  expect(opening.filter((entry) => entry.startsWith("menu "))).toEqual([]);

  await listenForTransitions(page);
  await page.keyboard.press("Escape");
  await expect(moreMenu(page)).toBeHidden();

  const closing = await startedTransitions(page);

  expect(closing.filter((entry) => entry.startsWith("menu "))).toEqual([]);
});

test("menu: a submenu opened by the pointer appears in one frame", async ({
  page,
}) => {
  await openChat(page, "base");
  await moreButton(page).click();
  await expect(moreMenu(page)).toBeVisible();
  await page.waitForTimeout(300);

  await moreMenu(page).getByRole("menuitem", { name: "Copy as" }).hover();

  const submenu = page.getByRole("menu", { name: "Copy as" });

  await expect(submenu).toBeVisible();
  expect(await submenu.evaluate((node) => node.getAnimations().length)).toBe(0);
});

test("menu under reduced motion: a click only fades the menu", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openChat(page, "base");
  await listenForTransitions(page);
  await moreButton(page).click();
  await expect(moreMenu(page)).toBeVisible();

  const opening = await startedTransitions(page);

  expect(opening).toContain("menu opacity");
  expect(opening).not.toContain("menu scale");
  expect(
    await moreMenu(page).evaluate(
      (node) => getComputedStyle(node).transitionDuration
    )
  ).toContain(REDUCED_FADE);
});

for (const design of ["apple", "glass", "emil", "taste"]) {
  test(`menu in ${design}: a click starts the same transitions and no keyframes`, async ({
    page,
  }) => {
    await openChat(page, design);
    await listenForTransitions(page);
    await moreButton(page).click();
    await expect(moreMenu(page)).toBeVisible();

    expect(await keyframeAnimations(moreMenu(page))).toBe(0);

    const opening = await startedTransitions(page);

    expect(opening).toContain("menu opacity");
    expect(opening).toContain("menu scale");
  });
}

const copyButton = (page: Page) =>
  page
    .getByRole("main")
    .getByRole("button", { exact: true, name: "Copy" })
    .first();

const sliding = (started: string[], slot: string) =>
  started.filter((entry) => entry.startsWith(`${slot} `));

test("tooltip: resting the pointer on a button fades and scales its tooltip in", async ({
  page,
}) => {
  await openChat(page, "base");
  await listenForTransitions(page);
  await copyButton(page).hover();
  await expect(page.locator('[data-slot="tooltip"]')).toBeVisible();

  const opening = await startedTransitions(page);

  expect(opening).toContain("tooltip opacity");
  expect(opening).toContain("tooltip scale");
});

test("tooltip: focus from the keyboard shows the tooltip with no motion", async ({
  page,
}) => {
  await openChat(page, "base");
  await copyButton(page).focus();
  await page.keyboard.press("Shift+Tab");
  await listenForTransitions(page);
  await page.keyboard.press("Tab");
  await expect(page.locator('[data-slot="tooltip"]')).toBeVisible();

  expect(sliding(await startedTransitions(page), "tooltip")).toEqual([]);
});

test("press: a mouse press scales the button, and hover changes its fill at once", async ({
  page,
}) => {
  await openChat(page, "base");
  await listenForTransitions(page);
  await copyButton(page).hover();

  const hovering = await startedTransitions(page);

  expect(sliding(hovering, "icon-button")).toEqual([]);

  await listenForTransitions(page);
  await page.mouse.down();

  const pressing = await startedTransitions(page);

  await page.mouse.up();
  expect(pressing).toContain("icon-button scale");
});

test("press: Space on a focused button doesn't move it", async ({ page }) => {
  await openChat(page, "base");
  await copyButton(page).focus();
  await page.keyboard.press("Shift");
  await listenForTransitions(page);
  await page.keyboard.down("Space");

  const pressing = await startedTransitions(page);

  await page.keyboard.up("Space");
  expect(sliding(pressing, "icon-button")).toEqual([]);
});

test("press and tooltip under reduced motion: a press doesn't move, and a tooltip only fades", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openChat(page, "base");
  await listenForTransitions(page);
  await copyButton(page).hover();
  await expect(page.locator('[data-slot="tooltip"]')).toBeVisible();

  const showing = await startedTransitions(page);

  expect(showing).toContain("tooltip opacity");
  expect(showing).not.toContain("tooltip scale");

  await listenForTransitions(page);
  await page.mouse.down();

  const pressing = await startedTransitions(page);

  await page.mouse.up();
  expect(sliding(pressing, "icon-button")).toEqual([]);
});

for (const design of ["base", "apple", "glass", "emil", "taste"]) {
  test(`mode toggle in ${design}: the thumb slides in 250 ms or less`, async ({
    page,
  }) => {
    await openApp(page, design, "light");

    const durations = await page
      .locator('[data-slot="mode-toggle-thumb"]')
      .first()
      .evaluate((node) =>
        getComputedStyle(node)
          .transitionDuration.split(",")
          .map((part) => Number(part.trim().replace("s", "")) * 1000)
      );

    expect(Math.max(...durations)).toBeLessThanOrEqual(250);
  });
}

const field = (page: Page) =>
  page.getByRole("main").locator('[data-slot="composer-field"]');

const turnMotion = (started: string[]) =>
  started.filter((entry) => /^(?:div|article|turn) /u.test(entry));

test("turns: opening a chat moves none of its turns", async ({ page }) => {
  await openApp(page, "base", "light");
  await listenForTransitions(page);
  await page
    .getByRole("complementary", { name: "Sidebar" })
    .getByRole("button", { exact: true, name: SAMPLE_CHAT })
    .click();
  await page.locator('[data-slot="turn"]').first().waitFor();

  expect(turnMotion(await startedTransitions(page))).toEqual([]);
  await expect(page.locator("[data-turn-id][data-entering]")).toHaveCount(0);
});

test("turns: a sent message rises in, and the reply doesn't move", async ({
  page,
}) => {
  await openChat(page, "base");

  const before = await page.locator("[data-turn-id]").count();

  await field(page).fill("Does the retry give up?");
  await listenForTransitions(page);
  await field(page).press("Enter");
  await expect(page.locator("[data-turn-id]")).toHaveCount(before + 2);

  const started = turnMotion(await startedTransitions(page));

  expect(started.toSorted()).toEqual(["div opacity", "div translate"]);

  const entering = page.locator("[data-turn-id][data-entering]");

  await expect(entering).toHaveCount(1);
  await expect(entering.locator('[data-slot="turn"]')).toContainText(
    "Does the retry give up?"
  );
});

test("turns under reduced motion: a sent message only fades in", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openChat(page, "base");
  await field(page).fill("Does the retry give up?");
  await listenForTransitions(page);
  await field(page).press("Enter");

  expect(turnMotion(await startedTransitions(page))).toEqual(["div opacity"]);
});

test("chips: an attached file eases in, and removing it doesn't move anything", async ({
  page,
}) => {
  await openChat(page, "base");
  await listenForTransitions(page);
  await page
    .getByRole("main")
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      buffer: Buffer.from("notes"),
      mimeType: "text/plain",
      name: "notes.txt",
    });

  const chip = page.locator('[data-slot="composer-attachment"]');

  await expect(chip).toHaveCount(1);

  const adding = await startedTransitions(page);

  expect(sliding(adding, "composer-attachment")).toEqual([
    "composer-attachment opacity",
    "composer-attachment scale",
  ]);

  await listenForTransitions(page);
  await chip.getByRole("button", { name: /^Remove/u }).click();
  await expect(chip).toHaveCount(0);
  expect(
    sliding(await startedTransitions(page), "composer-attachment")
  ).toEqual([]);
});

test("send to stop: the stop icon eases in after a message is sent", async ({
  page,
}) => {
  await openChat(page, "base");
  await field(page).fill("Does the retry give up?");
  await listenForTransitions(page);
  await field(page).press("Enter");

  const started = await startedTransitions(page);

  expect(started).toContain("svg opacity");
  expect(started).toContain("svg scale");
});

test("jump: scrolling away from the end eases the jump button in", async ({
  page,
}) => {
  await openChat(page, "base");
  await expect(page.locator('[data-slot="jump-to-end"]')).toHaveCount(0);
  await listenForTransitions(page);
  await page
    .locator('[data-slot="message-scroller"]')
    .evaluate((node) => node.scrollTo({ top: 0 }));
  await expect(page.locator('[data-slot="jump-to-end"]')).toBeVisible();

  const started = await startedTransitions(page);

  expect(started).toContain("jump-to-end opacity");
  expect(started).toContain("jump-to-end scale");
});
