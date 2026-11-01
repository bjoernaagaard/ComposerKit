// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

// Each App shell number in spec/functional.md that the playground's demo
// app shows, measured in the browser with about 1 px of tolerance. Each
// row keeps its spec line, the expected value and what was measured.
import type { Locator, Page } from "@playwright/test";

import { record, skip } from "./keyboard-support";
import type { Walked, Where } from "./keyboard-support";
import { PLAYGROUND_URL } from "./support";

const FILE = "sizes";
const PX_SUFFIX = /px$/u;
const TOLERANCE = 1;

interface SizeRow {
  line: number;
  part: string;
  expected: string;
}

const measure = (
  row: SizeRow,
  where: Where,
  steps: (page: Page) => Promise<Walked>
) => record(FILE, `line ${row.line}: ${row.part}`, row, where, steps);

const notMeasurable = (row: SizeRow, reason: string) =>
  skip(FILE, `line ${row.line}: ${row.part}`, row, reason);

interface Box {
  bottom: number;
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
}

const rect = (locator: Locator): Promise<Box> =>
  locator.evaluate((element) => {
    const box = element.getBoundingClientRect();

    return {
      bottom: box.bottom,
      height: box.height,
      left: box.left,
      right: box.right,
      top: box.top,
      width: box.width,
    };
  });

// Every match's box, for checks over a list of items.
const boxesOf = (locator: Locator): Promise<Box[]> =>
  locator.evaluateAll((elements) =>
    elements.map((element) => {
      const box = element.getBoundingClientRect();

      return {
        bottom: box.bottom,
        height: box.height,
        left: box.left,
        right: box.right,
        top: box.top,
        width: box.width,
      };
    })
  );

const css = (locator: Locator, property: string): Promise<string> =>
  locator.evaluate(
    (element, name) => getComputedStyle(element).getPropertyValue(name),
    property
  );

// Computed lengths come back as "12px".
const pixels = (value: string) => Number(value.replace(PX_SUFFIX, ""));

const cssNumber = async (locator: Locator, property: string) =>
  pixels(await css(locator, property));

const near = (actual: number, expected: number) =>
  Math.abs(actual - expected) <= TOLERANCE;

const between = (actual: number, low: number, high: number) =>
  actual >= low - TOLERANCE && actual <= high + TOLERANCE;

const fmt = (value: number) => `${Math.round(value * 10) / 10}`;

const size = (box: Box) => `${fmt(box.width)} x ${fmt(box.height)}`;

const isHairline = (width: number) => width > 0 && width <= 1 + TOLERANCE;

measure(
  {
    expected: "28 x 28",
    line: 275,
    part: "Sidebar header buttons (activity, search)",
  },
  { example: "app-shell", url: `${PLAYGROUND_URL}/` },
  async (page) => {
    const header = page
      .getByRole("navigation", { name: "Chats" })
      .locator('[data-slot="sidebar-header"]');

    const boxes = await boxesOf(
      header.getByRole("button", {
        name: /^(?:Notifications|Search chats)$/u,
      })
    );

    return {
      actual: boxes.map(size).join(", "),
      pass:
        boxes.length === 2 &&
        boxes.every((box) => near(box.width, 28) && near(box.height, 28)),
    };
  }
);

// The title bar and the rail render together only in the playground's
// demo app, which runs the shipped app-shell parts.
const APP: Where = { example: "app-shell", url: `${PLAYGROUND_URL}/` };

measure(
  {
    expected:
      "44 tall with a hairline divider at the bottom, back and forward 28 x 28 6 apart, sidebar toggle 28 x 28",
    line: 426,
    part: "Title bar",
  },
  APP,
  async (page) => {
    const bar = page.getByRole("banner");
    const box = await rect(bar);
    const back = await rect(bar.getByRole("button", { name: "Back" }));
    const forward = await rect(bar.getByRole("button", { name: "Forward" }));

    const toggle = await rect(
      bar.getByRole("button", { name: "Hide sidebar" })
    );

    const apart = forward.left - back.right;
    const divider = await cssNumber(bar, "border-bottom-width");

    return {
      actual: `${fmt(box.height)} tall with a ${fmt(divider)} divider at the bottom, back ${size(back)} and forward ${size(forward)} ${fmt(apart)} apart, sidebar toggle ${size(toggle)}`,
      pass:
        near(box.height, 44) &&
        isHairline(divider) &&
        [back, forward, toggle].every(
          (button) => near(button.width, 28) && near(button.height, 28)
        ) &&
        near(apart, 6),
    };
  }
);

// The title bar draws this divider past the end of its leading group, so
// the line is read from that group's ::after box.
measure(
  {
    expected:
      "a hairline vertical divider the title bar's height, in line with the sidebar edge",
    line: 427,
    part: "Title bar divider",
  },
  APP,
  async (page) => {
    const bar = page.getByRole("banner");
    const box = await rect(bar);

    const sidebar = await rect(
      page.getByRole("complementary", { name: "Sidebar" })
    );

    const line = await bar
      .locator('[data-slot="title-bar-nav"]')
      .evaluate((element) => {
        const after = getComputedStyle(element, "::after");
        const width = Number(after.width.replace("px", ""));
        const end = Number(after.insetInlineEnd.replace("px", ""));
        const right = element.getBoundingClientRect().right - end;

        return {
          height: Number(after.height.replace("px", "")),
          left: right - width,
          shown: after.display !== "none",
          width,
        };
      });

    return {
      actual: line.shown
        ? `${fmt(line.width)} wide, ${fmt(line.height)} tall, ${fmt(line.left - sidebar.right)} from the sidebar's edge`
        : "no divider",
      pass:
        line.shown &&
        isHairline(line.width) &&
        near(line.height, box.height) &&
        near(line.left, sidebar.right),
    };
  }
);

measure(
  {
    expected:
      "52 wide with a hairline divider on its inline-end edge, 36 x 36 buttons, 8 inset, 44 pitch",
    line: 429,
    part: "Icon rail",
  },
  APP,
  async (page) => {
    const rail = page.getByRole("navigation", { name: "Main" });
    const box = await rect(rail);
    const buttons = await boxesOf(rail.getByRole("button"));
    const [first, second] = buttons;
    const inset = (first?.left ?? 0) - box.left;
    const pitch = (second?.top ?? 0) - (first?.top ?? 0);
    const divider = await cssNumber(rail, "border-inline-end-width");

    return {
      actual: `${fmt(box.width)} wide with a ${fmt(divider)} divider on its inline-end edge, buttons ${[...new Set(buttons.map(size))].join(", ")}, inset ${fmt(inset)}, pitch ${fmt(pitch)}`,
      pass:
        near(box.width, 52) &&
        isHairline(divider) &&
        buttons.length > 1 &&
        buttons.every(
          (button) => near(button.width, 36) && near(button.height, 36)
        ) &&
        near(inset, 8) &&
        near(pitch, 44),
    };
  }
);

measure(
  {
    expected: "288 wide, rail plus sidebar 340, a 16 wide splitter on its edge",
    line: 430,
    part: "Sidebar",
  },
  APP,
  async (page) => {
    const rail = await rect(page.getByRole("navigation", { name: "Main" }));

    const sidebar = await rect(
      page.getByRole("complementary", { name: "Sidebar" })
    );

    const splitter = await rect(
      page.getByRole("separator", { name: "Resize sidebar" })
    );

    const both = sidebar.right - rail.left;
    const middle = (splitter.left + splitter.right) / 2;

    return {
      actual: `${fmt(sidebar.width)} wide, rail plus sidebar ${fmt(both)}, splitter ${fmt(splitter.width)} wide centered at ${fmt(middle - sidebar.right)} from the sidebar's edge`,
      pass:
        near(sidebar.width, 288) &&
        near(both, 340) &&
        near(splitter.width, 16) &&
        near(middle, sidebar.right),
    };
  }
);

const chats = (page: Page) => page.getByRole("navigation", { name: "Chats" });

measure(
  {
    expected: "mode switcher about 109 x 32, two 28 x 28 buttons 6 apart",
    line: 431,
    part: "Sidebar header",
  },
  APP,
  async (page) => {
    const header = chats(page).locator('[data-slot="sidebar-header"]');

    const menu = await rect(
      header.getByRole("button", { name: /^ComposerKit/u })
    );

    const bell = await rect(
      header.getByRole("button", { exact: true, name: "Notifications" })
    );

    const search = await rect(
      header.getByRole("button", { exact: true, name: "Search chats" })
    );

    const apart = search.left - bell.right;

    return {
      actual: `workspace menu ${size(menu)}, notifications ${size(bell)} and search ${size(search)} ${fmt(apart)} apart`,
      pass:
        near(menu.height, 32) &&
        [bell, search].every(
          (button) => near(button.width, 28) && near(button.height, 28)
        ) &&
        near(apart, 6),
    };
  }
);

measure(
  { expected: "272 x 30", line: 432, part: "New chat row" },
  APP,
  async (page) => {
    const box = await rect(chats(page).locator('[data-slot="new-chat"]'));

    return {
      actual: size(box),
      pass: near(box.width, 272) && near(box.height, 30),
    };
  }
);

measure(
  {
    expected: "25 tall, 16 to 20 between sections",
    line: 433,
    part: "Section header",
  },
  APP,
  async (page) => {
    const headings = await boxesOf(
      chats(page).locator('[data-slot="sidebar-section-heading"]')
    );

    const sections = await boxesOf(
      chats(page).locator('[data-slot="sidebar-section"]')
    );

    const [first, second] = sections;
    const gap = (second?.top ?? 0) - (first?.bottom ?? 0);

    return {
      actual: `${[...new Set(headings.map((box) => fmt(box.height)))].join(", ")} tall, ${fmt(gap)} between the first two sections`,
      pass:
        headings.length > 1 &&
        headings.every((box) => near(box.height, 25)) &&
        between(gap, 16 - TOLERANCE, 20 + TOLERANCE),
    };
  }
);

const SHELL_ONLY = [
  {
    expected: "two 28 x 28 view toggles, 6 apart",
    line: 428,
    part: "Title bar right side",
  },
  {
    expected: "heading 34 tall, composer 24 below, suggestion rows 40 tall",
    line: 436,
    part: "Empty chat",
  },
] as const;

for (const row of SHELL_ONLY) {
  notMeasurable(
    row,
    "This part of the playground app shell is not a registry item and has no size check yet."
  );
}
