// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

// Files dropped on the demo app's composer, or pasted into it, attach as if
// the file picker had chosen them. A desktop drag reaches the page only as
// dragenter, dragover and drop with a DataTransfer, so the spec builds one
// in the page and sends those events, as the browser does.
import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { JSHandle, Locator, Page } from "@playwright/test";

import { press } from "./keyboard-support";
import { openApp } from "./stress-support";
import { DESIGNS, PLAYGROUND_URL, SCHEMES } from "./support";

const MEGABYTE = 1024 * 1024;

interface FakeFile {
  name: string;
  size: number;
}

const NOTES: FakeFile = { name: "notes.txt", size: 2048 };
const PHOTO: FakeFile = { name: "photo.png", size: 4096 };

const filesTransfer = (page: Page, files: FakeFile[]) =>
  page.evaluateHandle((list) => {
    const transfer = new DataTransfer();

    for (const { name, size } of list) {
      transfer.items.add(new File([new Uint8Array(size)], name));
    }

    return transfer;
  }, files);

const homeComposer = (page: Page) =>
  page.locator('[data-slot="home-view"] [data-slot="composer"]');

const surface = (composer: Locator) =>
  composer.locator('[data-slot="composer-surface"]');

const field = (composer: Locator) =>
  composer.locator('[data-slot="composer-field"]');

const chips = (composer: Locator) =>
  composer.getByRole("list", { name: "Attached files" }).getByRole("listitem");

const overlay = (composer: Locator) =>
  composer.getByText("Drop files to attach");

const dragOver = async (target: Locator, transfer: JSHandle<DataTransfer>) => {
  await target.dispatchEvent("dragenter", { dataTransfer: transfer });
  await target.dispatchEvent("dragover", { dataTransfer: transfer });
};

const dropOn = async (target: Locator, transfer: JSHandle<DataTransfer>) => {
  await dragOver(target, transfer);
  await target.dispatchEvent("drop", { dataTransfer: transfer });
};

test("two files dropped on the composer attach as two chips", async ({
  page,
}) => {
  await openApp(page, "base", "light");

  const composer = homeComposer(page);

  await dropOn(surface(composer), await filesTransfer(page, [NOTES, PHOTO]));

  await expect(chips(composer)).toHaveCount(2);
  await expect(chips(composer).filter({ hasText: NOTES.name })).toBeVisible();
  await expect(chips(composer).filter({ hasText: PHOTO.name })).toBeVisible();
  await expect(composer).not.toHaveAttribute("data-drop-ready");
  await expect(composer).not.toHaveAttribute("data-drop-target");
});

for (const design of ["base", ...DESIGNS]) {
  for (const scheme of SCHEMES) {
    test(`${design} ${scheme}: the composer lights up as files enter the window and clears when they leave or drop`, async ({
      page,
    }) => {
      await openApp(page, design, scheme);

      const composer = homeComposer(page);
      const body = page.locator("body");
      const transfer = await filesTransfer(page, [NOTES]);

      await body.dispatchEvent("dragenter", { dataTransfer: transfer });
      await expect(composer).toHaveAttribute("data-drop-ready", "");
      await expect(composer).not.toHaveAttribute("data-drop-target");
      await expect(overlay(composer)).toBeVisible();

      await body.dispatchEvent("dragleave", { dataTransfer: transfer });
      await expect(composer).not.toHaveAttribute("data-drop-ready");
      await expect(overlay(composer)).toHaveCount(0);

      await dragOver(surface(composer), transfer);
      await expect(composer).toHaveAttribute("data-drop-ready", "");
      await expect(composer).toHaveAttribute("data-drop-target", "");

      await surface(composer).dispatchEvent("drop", { dataTransfer: transfer });
      await expect(composer).not.toHaveAttribute("data-drop-ready");
      await expect(composer).not.toHaveAttribute("data-drop-target");
      await expect(chips(composer)).toHaveCount(1);
    });
  }
}

test("a file dropped on the conversation attaches nothing and the page stays", async ({
  page,
}) => {
  await openApp(page, "base", "light");
  await page
    .getByRole("complementary", { name: "Sidebar" })
    .getByRole("button", {
      exact: true,
      name: "Add retries to the sync client",
    })
    .click();

  const view = page.locator('[data-slot="conversation-view"]');
  const composer = view.locator('[data-slot="composer"]');
  const scroller = view.locator('[data-slot="message-scroller"]');

  await expect(composer).toBeVisible();

  const url = page.url();
  const transfer = await filesTransfer(page, [NOTES]);

  // The browser opens a dropped file in place of the app unless the page
  // refuses the drag, which shows the no-drop cursor.
  const refused = await scroller.evaluate((element, dataTransfer) => {
    const send = (type: string) => {
      const event = new DragEvent(type, {
        bubbles: true,
        cancelable: true,
        dataTransfer,
      });

      element.dispatchEvent(event);

      return event.defaultPrevented;
    };

    send("dragenter");
    const over = send("dragover");
    const effect = dataTransfer.dropEffect;
    const drop = send("drop");

    return { drop, effect, over };
  }, transfer);

  expect(refused).toEqual({ drop: true, effect: "none", over: true });
  await expect(composer).not.toHaveAttribute("data-drop-ready");
  await expect(chips(composer)).toHaveCount(0);
  expect(page.url()).toBe(url);
});

test("a file over 25 MB shows why it can't attach and is announced", async ({
  page,
}) => {
  await openApp(page, "base", "light");

  const composer = homeComposer(page);
  const big = { name: "recording.mov", size: 26 * MEGABYTE };

  await dropOn(surface(composer), await filesTransfer(page, [big]));

  await expect(chips(composer).filter({ hasText: big.name })).toContainText(
    "Larger than 25 MB."
  );
  await expect(composer.locator('[aria-live="polite"]')).toContainText(
    `${big.name}: Larger than 25 MB.`
  );
});

test("a pasted file attaches, and pasted text still lands in the field", async ({
  context,
  page,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: PLAYGROUND_URL,
  });
  await openApp(page, "base", "light");

  const composer = homeComposer(page);

  await field(composer).evaluate((element) => {
    const clipboardData = new DataTransfer();

    clipboardData.items.add(
      new File(["png"], "screenshot.png", { type: "image/png" })
    );
    element.dispatchEvent(
      new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData,
      })
    );
  });

  await expect(
    chips(composer).filter({ hasText: "screenshot.png" })
  ).toBeVisible();
  await expect(field(composer)).toHaveValue("");

  await page.evaluate(() => navigator.clipboard.writeText("Pasted words"));
  await field(composer).focus();
  await press(page, "ControlOrMeta+V");

  await expect(field(composer)).toHaveValue("Pasted words");
  await expect(chips(composer)).toHaveCount(1);
});

// Playwright's Chromium starts no native drag from a text selection, so
// the drag that carries text is the skip link, whose address drops into the
// field as text, the same way selected text does.
test("text dragged into the field lands there and lights nothing", async ({
  page,
}) => {
  await openApp(page, "base", "light");

  const composer = homeComposer(page);
  const link = page.locator('[data-slot="skip-link"]');

  await page.keyboard.press("Tab");
  await expect(link).toBeFocused();

  const address = new URL((await link.getAttribute("href")) ?? "", page.url())
    .href;

  const from = await link.boundingBox();
  const to = await field(composer).boundingBox();

  if (!(from && to)) {
    throw new Error("The link and the field need boxes to drag between");
  }

  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, {
    steps: 8,
  });
  await expect(composer).not.toHaveAttribute("data-drop-ready");
  await page.mouse.up();

  await expect(field(composer)).toHaveValue(address);
  await expect(composer).not.toHaveAttribute("data-drop-ready");
  await expect(chips(composer)).toHaveCount(0);
});

test("a file dropped while a message is sending attaches nothing", async ({
  context,
  page,
}) => {
  await openApp(page, "base", "light");

  const composer = homeComposer(page);
  const transfer = await filesTransfer(page, [NOTES]);

  // Offline, a send holds in the sending phase before it fails.
  await context.setOffline(true);
  await field(composer).fill("Summarize the notes");
  await field(composer).press("Enter");
  await expect(field(composer)).toHaveAttribute("readonly", "");

  await dropOn(surface(composer), transfer);

  await expect(
    composer.getByRole("button", { name: "Try again" })
  ).toBeVisible();
  await expect(chips(composer)).toHaveCount(0);
});

test("axe finds nothing while files are over the window", async ({ page }) => {
  await openApp(page, "base", "light");

  const composer = homeComposer(page);

  await page.locator("body").dispatchEvent("dragenter", {
    dataTransfer: await filesTransfer(page, [NOTES]),
  });
  await expect(composer).toHaveAttribute("data-drop-ready", "");
  // Mid fade, the words are too faint for axe's contrast check.
  await expect(
    composer.locator('[data-slot="composer-drop-overlay"]')
  ).toHaveCSS("opacity", "1");

  const result = await new AxeBuilder({ page })
    .include('[data-slot="home-view"] [data-slot="composer"]')
    .analyze();

  expect(result.violations.map((violation) => violation.id)).toEqual([]);
});
