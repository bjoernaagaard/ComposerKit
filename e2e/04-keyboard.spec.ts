// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

// Each App shell Keyboard row in spec/functional.md, walked on the
// playground's demo app. Each row's line number, expected result and what
// happened go to the report. A mismatch is recorded, not hidden.
import { focused, isFocused, press, walk } from "./keyboard-support";
import { PLAYGROUND_URL } from "./support";

// The whole shell renders only in the playground's demo app, which runs the
// shipped app-shell parts.
const APP = { example: "app-shell", url: `${PLAYGROUND_URL}/` };

walk(
  {
    context: "App shell, page just loaded",
    expected:
      "The first stop is the skip-to-content link. Enter moves focus to the main region.",
    keys: "Tab, then Enter",
    line: 438,
  },
  APP,
  async (page) => {
    await press(page, "Tab");

    const first = await focused(page);

    await press(page, "Enter");

    const inMain = await isFocused(page.getByRole("main"));

    return {
      actual: `first stop ${first}, after Enter focus on ${await focused(page)}`,
      pass: first.includes("Skip to content") && inMain,
    };
  }
);

walk(
  {
    context: "App shell, wide, sidebar open",
    expected:
      "Hides the sidebar at once, with no motion. The same keys show it again.",
    keys: "Cmd+B (Ctrl+B off Apple platforms)",
    line: 430,
  },
  APP,
  async (page) => {
    const sidebar = page.getByRole("complementary", { name: "Sidebar" });
    const toggle = page.getByRole("button", { name: /sidebar$/u });
    const keys = (await toggle.getAttribute("aria-keyshortcuts")) ?? "";

    await press(page, keys);

    const hidden = await sidebar.isHidden();
    const afterHide = await toggle.getAttribute("aria-label");

    await press(page, keys);

    const shown = await sidebar.isVisible();
    const afterShow = await toggle.getAttribute("aria-label");

    return {
      actual: `${keys}: sidebar hidden ${hidden}, toggle "${afterHide}"; again: sidebar shown ${shown}, toggle "${afterShow}"`,
      pass:
        keys !== "" &&
        hidden &&
        afterHide === "Show sidebar" &&
        shown &&
        afterShow === "Hide sidebar",
    };
  }
);

walk(
  {
    context: "App shell, wide, the sidebar's splitter focused",
    expected:
      "Right and Left widen and narrow the sidebar by 16 px, or 8 with Shift. Home and End jump to 220 and 480. Enter hides the sidebar and moves focus to the sidebar toggle.",
    keys: "Right, Shift+Left, Home, End, Enter",
    line: 430,
  },
  APP,
  async (page) => {
    const splitter = page.getByRole("separator", { name: "Resize sidebar" });
    const sidebar = page.getByRole("complementary", { name: "Sidebar" });
    const widths: string[] = [];

    await splitter.focus();

    for (const key of ["ArrowRight", "Shift+ArrowLeft", "Home", "End"]) {
      // oxlint-disable-next-line no-await-in-loop -- each key moves from where the last one left the edge
      await press(page, key);
      // oxlint-disable-next-line no-await-in-loop -- each key moves from where the last one left the edge
      widths.push((await splitter.getAttribute("aria-valuenow")) ?? "none");
    }

    const box = await sidebar.boundingBox();
    const drawn = Math.round(box?.width ?? 0);

    await press(page, "Enter");

    const hidden = await sidebar.isHidden();
    const after = await focused(page);

    return {
      actual: `widths ${widths.join(", ")}, drawn ${drawn}; Enter: sidebar hidden ${hidden}, focus on ${after}`,
      pass:
        widths.join(",") === "304,296,220,480" &&
        drawn === 480 &&
        hidden &&
        after.includes("Show sidebar"),
    };
  }
);

walk(
  {
    context: "App shell, a title bar tab with another tab open",
    expected:
      "Closes the focused tab at once. Focus and selection move to the tab on its right, or on its left for the last tab. The only tab can't close.",
    keys: "Delete",
    line: 427,
  },
  APP,
  async (page) => {
    const strip = page.getByRole("tablist", { name: "Open chats" });
    const tabs = strip.getByRole("tab");

    await page.getByRole("button", { exact: true, name: "New tab" }).click();
    await tabs.first().click();

    const before = await tabs.count();
    const right = await tabs.nth(1).getAttribute("data-tab-id");

    await press(page, "Delete");

    const after = await tabs.count();

    const focusedId = await strip
      .locator('[role="tab"]:focus')
      .getAttribute("data-tab-id");

    await press(page, "Delete");

    const last = await tabs.count();

    return {
      actual: `${before} tabs; Delete left ${after}, focus on tab ${focusedId}; Delete on the only tab left ${last}`,
      pass:
        before === 2 &&
        after === 1 &&
        focusedId !== null &&
        focusedId === right &&
        last === 1,
    };
  }
);
