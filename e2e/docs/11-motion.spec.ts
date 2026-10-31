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
