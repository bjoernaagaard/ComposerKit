// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

// Stress: every docs example at 320 and 1440 wide in light and dark, a
// keyboard-only walk of every docs page, a 200 character paste into every
// composer, 200 character labels in every part that shows one, and the
// empty states. Each finding has a screenshot under artifacts/docs-e2e/stress.
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import { press } from "./keyboard-support";
import {
  LABELS,
  STRESS,
  WIDTHS,
  inspect,
  openHarness,
  relative,
  sideBySide,
} from "./stress-support";
import type {
  EmptyRow,
  EscapeRow,
  Flag,
  KeyboardStressRow,
  LabelRow,
  PasteRow,
  RenderRow,
} from "./stress-support";
import { DOCS_URL, PAGES, SCHEMES, appendResult, openPage } from "./support";

const MINUTE = 60_000;
const HEIGHT = 900;
const TOOLTIP_WAIT_MS = 350;
const SEND_SETTLE_MS = 600;
const MAX_STOPS = 700;
const EXAMPLE = "[data-example]";

const exampleSelector = (id: string) => `[data-example="${id}"]`;

// --- 1. Every example at 320 and 1440, light and dark --------------------

for (const width of WIDTHS) {
  test(`every docs example at ${width} wide, light and dark`, async ({
    page,
  }) => {
    test.setTimeout(15 * MINUTE);
    await page.setViewportSize({ height: HEIGHT, width });

    const shots = new Map<string, Map<string, Buffer>>();
    const found = new Map<string, { page: string; flags: Flag[] }>();

    for (const scheme of SCHEMES) {
      for (const url of PAGES) {
        // oxlint-disable-next-line no-await-in-loop -- one page at a time in one tab
        await openPage(page, url, scheme);

        // oxlint-disable-next-line no-await-in-loop -- reads this page's examples
        const ids = await page
          .locator(EXAMPLE)
          .evaluateAll((nodes) =>
            nodes.map((node) => node.dataset.example ?? "")
          );

        for (const id of ids) {
          const element = page.locator(exampleSelector(id));

          // oxlint-disable-next-line no-await-in-loop -- scrolls to each example in turn
          await element.scrollIntoViewIfNeeded();

          // oxlint-disable-next-line no-await-in-loop -- one screenshot at a time
          const image = await element.screenshot({ animations: "disabled" });
          const byScheme = shots.get(id) ?? new Map<string, Buffer>();

          byScheme.set(scheme, image);
          shots.set(id, byScheme);

          if (scheme === "light") {
            // oxlint-disable-next-line no-await-in-loop -- inspects the example in place
            const flags = await inspect(page, exampleSelector(id));

            found.set(id, { flags, page: url });
          }
        }
      }
    }

    for (const [id, byScheme] of shots) {
      const light = byScheme.get("light");
      const dark = byScheme.get("dark");
      const image = path.join(STRESS, "render", `${id}--${width}.png`);

      if (light && dark) {
        sideBySide(light, dark, image);
      }

      appendResult("stress-render", {
        flags: found.get(id)?.flags ?? [],
        id,
        image: relative(image),
        page: found.get(id)?.page ?? "",
        width,
      } satisfies RenderRow);
    }
  });
}

// --- 2. Keyboard only on every docs page ---------------------------------

interface Stop {
  index: number;
  name: string;
  popup: string | null;
  inPreview: boolean;
  isButton: boolean;
  isBody: boolean;
  seen: number;
}

// Marks the focused element with its stop number and describes it.
const readStop = (page: Page, index: number): Promise<Stop> =>
  page.evaluate((next) => {
    const element = document.activeElement;

    if (!(element instanceof HTMLElement) || element === document.body) {
      return {
        inPreview: false,
        index: next,
        isBody: true,
        isButton: false,
        name: "the page (body)",
        popup: null,
        seen: -1,
      };
    }

    const seen = Number(element.dataset.stressStop ?? "-1");

    if (seen < 0) {
      element.dataset.stressStop = String(next);
    }

    const label =
      element.getAttribute("aria-label") ??
      element.textContent?.trim().slice(0, 40) ??
      "";

    return {
      inPreview: element.closest('[data-slot="preview"]') !== null,
      index: next,
      isBody: false,
      isButton: element.tagName === "BUTTON",
      name: `${element.getAttribute("role") ?? element.tagName.toLowerCase()} "${label}"`,
      popup: element.getAttribute("aria-haspopup"),
      seen,
    };
  }, index);

// What a focus indicator could change: the element and three ancestors.
const focusLook = (page: Page) =>
  page.evaluate(() =>
    Object.fromEntries(
      [...document.querySelectorAll<HTMLElement>("[data-stress-stop]")].map(
        (element) => {
          const look: string[] = [];

          for (
            let depth = 0, node: Element | null = element;
            node && depth < 4;
            depth += 1, node = node.parentElement
          ) {
            const style = getComputedStyle(node);

            look.push(
              [
                style.outlineStyle,
                style.outlineWidth,
                style.outlineColor,
                style.boxShadow,
                style.borderTopColor,
                style.backgroundColor,
              ].join(" ")
            );
          }

          return [element.dataset.stressStop ?? "", look.join("|")];
        }
      )
    )
  );

const lookOfFocused = (page: Page) =>
  page.evaluate(() => {
    const look: string[] = [];

    for (
      let depth = 0, node: Element | null = document.activeElement;
      node && depth < 4;
      depth += 1, node = node.parentElement
    ) {
      const style = getComputedStyle(node);

      look.push(
        [
          style.outlineStyle,
          style.outlineWidth,
          style.outlineColor,
          style.boxShadow,
          style.borderTopColor,
          style.backgroundColor,
        ].join(" ")
      );
    }

    return look.join("|");
  });

const focusedName = (page: Page) =>
  page.evaluate(() => {
    const element = document.activeElement;

    if (!element || element === document.body) {
      return "the page (body)";
    }

    const label =
      element.getAttribute("aria-label") ??
      element.textContent?.trim().slice(0, 40) ??
      "";

    return `${element.getAttribute("role") ?? element.tagName.toLowerCase()} "${label}"`;
  });

const isStopFocused = (page: Page, index: number) =>
  page.evaluate(
    (stop) =>
      document.activeElement instanceof HTMLElement &&
      document.activeElement.dataset.stressStop === String(stop),
    index
  );

const POLL_MS = 50;

// Polls a reading for up to a second.
const within = async (read: () => Promise<boolean>, limitMs = 1000) => {
  const started = Date.now();

  while (Date.now() - started < limitMs) {
    // oxlint-disable-next-line no-await-in-loop -- polls one reading at a time
    if (await read()) {
      return true;
    }

    // oxlint-disable-next-line no-await-in-loop -- polls one reading at a time
    await delay(POLL_MS);
  }

  return read();
};

const openPopups = (page: Page) =>
  page
    .locator(
      '[role="menu"]:visible, [role="listbox"]:visible, [role="dialog"]:visible'
    )
    .count();

const visibleTooltip = (page: Page) =>
  page.locator('[data-slot="tooltip"]:visible').first();

// Opens a popup from its focused trigger with Enter, closes it with
// Escape, and says where focus went. If focus did not come back, the walk
// puts it back on the trigger so the Tab order carries on from there.
const escapeMenu = async (page: Page, stop: Stop): Promise<EscapeRow> => {
  const before = await openPopups(page);

  await press(page, "Enter");

  const opened = await within(async () => (await openPopups(page)) > before);

  await press(page, "Escape");

  const closed = await within(async () => (await openPopups(page)) <= before);
  const focusAfter = await focusedName(page);
  const backOnTrigger = await isStopFocused(page, stop.index);

  if (!backOnTrigger) {
    await page
      .locator(`[data-stress-stop="${stop.index}"]`)
      .evaluate((element) => {
        if (element instanceof HTMLElement) {
          element.focus();
        }
      });
  }

  return {
    backOnTrigger,
    closed,
    focusAfter,
    kind: "menu",
    opened,
    stop: stop.name,
  };
};

const escapeTooltip = async (
  page: Page,
  stop: Stop
): Promise<EscapeRow | null> => {
  const shown = await within(
    async () => (await visibleTooltip(page).count()) > 0,
    TOOLTIP_WAIT_MS
  );

  if (!shown) {
    return null;
  }

  await press(page, "Escape");

  const closed = await within(
    async () => (await visibleTooltip(page).count()) === 0
  );

  return {
    backOnTrigger: await isStopFocused(page, stop.index),
    closed,
    focusAfter: await focusedName(page),
    kind: "tooltip",
    opened: true,
    stop: stop.name,
  };
};

const MENU_POPUPS = new Set(["menu", "listbox", "true", "dialog"]);

for (const url of PAGES) {
  test(`keyboard only on ${url}`, async ({ page }) => {
    test.setTimeout(15 * MINUTE);
    await openPage(page, url, "light");

    const stops: Stop[] = [];
    const focusedLooks = new Map<number, string>();
    const escapes: EscapeRow[] = [];
    let end = `stopped after ${MAX_STOPS} stops`;
    let trap: string | null = null;

    for (let index = 0; index < MAX_STOPS; index += 1) {
      // oxlint-disable-next-line no-await-in-loop -- each Tab follows the one before
      await press(page, "Tab");

      // oxlint-disable-next-line no-await-in-loop -- reads where focus went
      const stop = await readStop(page, index);

      if (stop.isBody) {
        end = "Tab left the last control and focus went back to the page";
        break;
      }

      if (stop.seen === 0) {
        end = "Tab wrapped from the last control to the first";
        break;
      }

      if (stop.seen > 0) {
        trap = `Tab went back to stop ${stop.seen} (${stop.name}) instead of moving on`;
        end = "focus trap";
        break;
      }

      stops.push(stop);
      // oxlint-disable-next-line no-await-in-loop -- reads the focused look in place
      focusedLooks.set(index, await lookOfFocused(page));

      if (stop.popup && MENU_POPUPS.has(stop.popup)) {
        // oxlint-disable-next-line no-await-in-loop -- one popup at a time
        escapes.push(await escapeMenu(page, stop));
      } else if (stop.isButton && stop.inPreview) {
        // oxlint-disable-next-line no-await-in-loop -- one tooltip at a time
        const tooltip = await escapeTooltip(page, stop);

        if (tooltip) {
          escapes.push(tooltip);
        }
      }
    }

    // Every stop's look without focus, to compare with its focused look.
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    });

    const restingLooks = await focusLook(page);

    const noIndicator = stops.flatMap((stop) =>
      restingLooks[String(stop.index)] === focusedLooks.get(stop.index)
        ? [`${stop.index}: ${stop.name}`]
        : []
    );

    // Shift+Tab from the end should give the same stops backwards.
    const reverse: number[] = [];

    for (const _stop of stops) {
      // oxlint-disable-next-line no-await-in-loop -- each Shift+Tab follows the one before
      await press(page, "Shift+Tab");

      // oxlint-disable-next-line no-await-in-loop -- reads where focus went
      const index = await page.evaluate(() =>
        document.activeElement instanceof HTMLElement
          ? Number(document.activeElement.dataset.stressStop ?? "-1")
          : -1
      );

      reverse.push(index);
    }

    const expected = stops.map((stop) => stop.index).toReversed();

    const firstDifference = expected.findIndex(
      (value, position) => reverse[position] !== value
    );

    const unreachable = await page.evaluate(() =>
      [
        ...document.querySelectorAll(
          'a[href], button, input, textarea, select, [tabindex], [contenteditable="true"]'
        ),
      ].flatMap((element) => {
        const box = element.getBoundingClientRect();

        const disabled =
          element.hasAttribute("disabled") ||
          element.closest('[inert], [aria-hidden="true"], [hidden]') !== null;

        const missed =
          element instanceof HTMLElement &&
          element.tabIndex >= 0 &&
          !disabled &&
          box.width > 0 &&
          box.height > 0 &&
          getComputedStyle(element).visibility !== "hidden" &&
          !Object.hasOwn(element.dataset, "stressStop");

        if (!missed) {
          return [];
        }

        const label =
          element.getAttribute("aria-label") ??
          element.textContent?.trim().slice(0, 40) ??
          "";

        return [
          `${element.getAttribute("role") ?? element.tagName.toLowerCase()} "${label}"`,
        ];
      })
    );

    appendResult("stress-keyboard", {
      end,
      escapes,
      noIndicator,
      page: url,
      reverseDifference:
        firstDifference === -1
          ? ""
          : `step ${firstDifference + 1}: expected stop ${expected[firstDifference]}, got ${reverse[firstDifference]}`,
      reverseMatches: firstDifference === -1,
      stops: stops.map((stop) => stop.name),
      trap,
      unreachable,
    } satisfies KeyboardStressRow);
  });
}

// --- 3. A 200 character paste into every composer ------------------------

const COMPOSER_PAGES = ["/composer", "/conversation"];

const turnCount = (root: Locator) => root.locator('[data-slot="turn"]').count();

const paste = async (page: Page, field: Locator, text: string) => {
  await page.evaluate((value) => navigator.clipboard.writeText(value), text);
  await field.focus();
  await press(page, "ControlOrMeta+V");
};

for (const url of COMPOSER_PAGES) {
  test(`paste 200 characters into every composer on ${url}`, async ({
    browser,
  }) => {
    test.setTimeout(15 * MINUTE);

    const context = await browser.newContext({
      viewport: { height: HEIGHT, width: 1440 },
    });

    await context.grantPermissions(["clipboard-read", "clipboard-write"], {
      origin: DOCS_URL,
    });

    const page = await context.newPage();

    await openPage(page, `${DOCS_URL}${url}`, "light");

    const ids = await page
      .locator(`${EXAMPLE}:has(textarea)`)
      .evaluateAll((nodes) => nodes.map((node) => node.dataset.example ?? ""));

    for (const id of ids) {
      for (const label of ["spaces", "word"] as const) {
        // oxlint-disable-next-line no-await-in-loop -- a fresh page for each paste
        await openPage(page, `${DOCS_URL}${url}`, "light");

        const root = page.locator(exampleSelector(id));
        const field = root.locator("textarea");
        const base = path.join(STRESS, "paste", `${id}--${label}`);

        // oxlint-disable-next-line no-await-in-loop -- counts turns before sending
        const turnsBefore = await turnCount(root);

        // oxlint-disable-next-line no-await-in-loop -- pastes through the clipboard
        await paste(page, field, LABELS[label]);

        // oxlint-disable-next-line no-await-in-loop -- reads the pasted text
        const pasted = await field.inputValue();

        // oxlint-disable-next-line no-await-in-loop -- one screenshot at a time
        await root.screenshot({ path: `${base}--pasted.png` });

        // oxlint-disable-next-line no-await-in-loop -- inspects before sending
        const flagsPasted = await inspect(page, exampleSelector(id));

        // oxlint-disable-next-line no-await-in-loop -- sends with Enter
        await press(page, "Enter");
        // oxlint-disable-next-line no-await-in-loop -- lets the turn render
        await page.waitForTimeout(SEND_SETTLE_MS);

        // oxlint-disable-next-line no-await-in-loop -- reads the field after sending
        const after = await field.inputValue();

        // oxlint-disable-next-line no-await-in-loop -- counts turns after sending
        const turnsAfter = await turnCount(root);

        // oxlint-disable-next-line no-await-in-loop -- one screenshot at a time
        await root.screenshot({ path: `${base}--submitted.png` });

        // oxlint-disable-next-line no-await-in-loop -- inspects after sending
        const flagsSubmitted = await inspect(page, exampleSelector(id));

        appendResult("stress-paste", {
          afterSubmit:
            after === ""
              ? "field cleared"
              : `field kept ${after.length} characters`,
          flagsPasted,
          flagsSubmitted,
          id,
          label,
          page: url,
          pastedImage: relative(`${base}--pasted.png`),
          pastedLength: pasted.length,
          submittedImage: relative(`${base}--submitted.png`),
          turnsAfter,
          turnsBefore,
        } satisfies PasteRow);
      }
    }

    await context.close();
  });
}

// --- 4. 200 character labels in every part that shows one ----------------

const HARNESS_ROOTS =
  '[data-stress-stage], [role="menu"], [data-slot="tooltip"]';

// Parts whose label shows in a tooltip: Tab to the button and wait for it.
const TOOLTIP_PARTS = new Set(["icon-button", "tooltip"]);

const showPart = async (page: Page, part: string) => {
  if (TOOLTIP_PARTS.has(part)) {
    await press(page, "Tab");
    await within(async () => (await visibleTooltip(page).count()) > 0);
  }

  if (part === "menu") {
    await page.getByRole("menu").first().waitFor();
  }
};

const LABEL_PARTS = [
  "button",
  "icon-button",
  "tooltip",
  "menu",
  "tabs",
  "row",
  "turns",
] as const;

for (const part of LABEL_PARTS) {
  test(`200 character labels in ${part}`, async ({ page }) => {
    test.setTimeout(10 * MINUTE);

    const errors: string[] = [];

    page.on("pageerror", (error) => errors.push(error.message));

    for (const width of WIDTHS) {
      // oxlint-disable-next-line no-await-in-loop -- one width at a time
      await page.setViewportSize({ height: HEIGHT, width });

      for (const data of ["demo", "spaces", "word"] as const) {
        const images = new Map<string, Buffer>();
        let flags: Flag[] = [];

        for (const scheme of SCHEMES) {
          // oxlint-disable-next-line no-await-in-loop -- one harness page at a time
          await openHarness(page, `part=${part}&data=${data}`, scheme);
          // oxlint-disable-next-line no-await-in-loop -- opens the tooltip or menu
          await showPart(page, part);

          // oxlint-disable-next-line no-await-in-loop -- one screenshot at a time
          const shot = await page.screenshot({
            animations: "disabled",
            fullPage: true,
          });

          images.set(scheme, shot);

          if (scheme === "light") {
            // oxlint-disable-next-line no-await-in-loop -- inspects the part in place
            flags = await inspect(page, HARNESS_ROOTS);
          }
        }

        const image = path.join(
          STRESS,
          "labels",
          `${part}--${data}--${width}.png`
        );

        const light = images.get("light");
        const dark = images.get("dark");

        if (light && dark) {
          sideBySide(light, dark, image);
        }

        appendResult("stress-labels", {
          data,
          errors: [...errors],
          flags,
          image: relative(image),
          part,
          width,
        } satisfies LabelRow);
        errors.length = 0;
      }
    }
  });
}

// --- 5. Empty states -----------------------------------------------------

const shotBoth = async (
  page: Page,
  open: (scheme: (typeof SCHEMES)[number]) => Promise<void>,
  file: string
) => {
  const images = new Map<string, Buffer>();

  for (const scheme of SCHEMES) {
    // oxlint-disable-next-line no-await-in-loop -- one scheme at a time
    await open(scheme);

    // oxlint-disable-next-line no-await-in-loop -- one screenshot at a time
    const shot = await page.screenshot({
      animations: "disabled",
      fullPage: true,
    });

    images.set(scheme, shot);
  }

  const light = images.get("light");
  const dark = images.get("dark");

  if (light && dark) {
    sideBySide(light, dark, file);
  }
};

// shot names the image; query adds to part= and data=empty.
const EMPTY_HARNESS = [
  {
    attack: "a conversation with zero turns",
    part: "turns",
    query: "",
    shot: "turns",
  },
  { attack: "a menu with zero items", part: "menu", query: "", shot: "menu" },
  {
    attack: "a menu whose only child is an empty fragment",
    part: "menu",
    query: "&empty=fragment",
    shot: "menu--fragment",
  },
  {
    attack: "a menu whose items are an empty list in a fragment",
    part: "menu",
    query: "&empty=map",
    shot: "menu--map",
  },
  {
    attack: "a menu with a radio group that has no items",
    part: "menu",
    query: "&empty=radio-group",
    shot: "menu--radio-group",
  },
  {
    attack: "a sidebar with no projects and no chats",
    part: "sidebar",
    query: "",
    shot: "sidebar",
  },
  {
    attack: "a tab strip with zero tabs",
    part: "tabs",
    query: "",
    shot: "tabs",
  },
] as const;

for (const { attack, part, query, shot } of EMPTY_HARNESS) {
  test(`empty state: ${attack}`, async ({ page }) => {
    const errors: string[] = [];

    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") {
        errors.push(message.text());
      }
    });

    const image = path.join(STRESS, "empty", `${shot}.png`);

    await shotBoth(
      page,
      async (scheme) => {
        await openHarness(page, `part=${part}&data=empty${query}`, scheme);
        await showPart(page, part);
      },
      image
    );

    const stage = page.locator("[data-stress-stage]");
    const [shownText = ""] = await stage.allInnerTexts();
    const text = shownText.replaceAll(/\s+/gu, " ").trim();
    const menu = page.getByRole("menu").first();

    const menuBox =
      part === "menu" && (await menu.count()) > 0
        ? await menu.boundingBox()
        : null;

    // Every kind of item: plain, checkbox and radio.
    const menuItems = await menu
      .locator('[role^="menuitem"]')
      .allTextContents();

    const flags = await inspect(page, HARNESS_ROOTS);

    const shown = menuBox
      ? `an open menu panel ${Math.round(menuBox.width)} x ${Math.round(menuBox.height)} with ${menuItems.length} item${menuItems.length === 1 ? "" : "s"}${menuItems.length > 0 ? `: "${menuItems.join('", "')}"` : ""}`
      : `the part shows: "${text.slice(0, 160)}"`;

    // An empty menu that opens as a blank panel gives focus nowhere to go,
    // and the sidebar's way back from a filter makes no sense when no
    // filter is on.
    const misleading = [
      menuBox && menuItems.length === 0
        ? "the menu opens as a blank panel"
        : null,
      part === "sidebar" && text.includes("Show all chats")
        ? "it offers to clear a filter that is not on"
        : null,
    ].filter((problem) => problem !== null);

    appendResult("stress-empty", {
      attack,
      broken: errors.length > 0 || flags.length > 0 || misleading.length > 0,
      happened: [
        shown,
        ...misleading,
        errors.length > 0 ? `errors: ${errors.join("; ")}` : "no errors",
        ...flags.map((flag) => `${flag.kind}: ${flag.detail}`),
      ].join(". "),
      image: relative(image),
      part,
    } satisfies EmptyRow);
  });
}

const COMPOSERS = [
  { id: "composer--stacked", url: "/composer" },
  { id: "conversation--demo", url: "/conversation" },
] as const;

interface ComposerReading {
  value: string;
  primary: string;
  turns: number;
  height: number;
}

const readComposer = async (root: Locator): Promise<ComposerReading> => {
  const surface = await root
    .locator('[data-slot="composer-surface"]')
    .boundingBox();

  return {
    height: Math.round(surface?.height ?? 0),
    primary:
      (await root
        .locator('[data-slot="composer-primary"]')
        .getAttribute("aria-label")) ?? "",
    turns: await turnCount(root),
    value: await root.locator("textarea").inputValue(),
  };
};

const SPEC_HEIGHT_BY_LINES = new Map([
  [2, 98],
  [3, 114],
  [4, 134],
]);

// What an attack did to a composer. It is broken if something was sent,
// or if the field's height is not the spec's growth table (lines 61 to 70)
// for the lines left in it: one line keeps the resting height.
const judgeComposer = (before: ComposerReading, after: ComposerReading) => {
  const sent = after.turns > before.turns;
  const lines = after.value.split("\n").length;
  const expected = lines > 1 ? SPEC_HEIGHT_BY_LINES.get(lines) : before.height;

  const primary =
    after.primary === before.primary
      ? `primary button stays "${after.primary}"`
      : `primary button "${before.primary}" then "${after.primary}"`;

  return {
    broken: sent || after.height !== expected,
    happened: [
      sent
        ? `sent: turns ${before.turns} then ${after.turns}`
        : "nothing was sent",
      `field ${JSON.stringify(after.value)}`,
      `height ${before.height} then ${after.height} (spec: ${expected ?? "not listed"} for ${lines} line${lines === 1 ? "" : "s"})`,
      primary,
    ].join(", "),
  };
};

const ATTACKS = [
  {
    attack: "Enter with no text",
    name: "enter-empty",
    run: async (page: Page) => {
      await press(page, "Enter");
    },
  },
  {
    attack: "Enter with only spaces and a line break",
    name: "enter-whitespace",
    run: async (page: Page) => {
      await page.keyboard.type("   ");
      await press(page, "Shift+Enter");
      await page.keyboard.type("  ");
      await press(page, "Enter");
    },
  },
  {
    attack: "paste 200 characters, select all, delete, then Enter",
    name: "paste-delete",
    run: async (page: Page) => {
      await page.evaluate(
        (value) => navigator.clipboard.writeText(value),
        LABELS.spaces
      );
      await press(page, "ControlOrMeta+V");
      await press(page, "ControlOrMeta+A");
      await press(page, "Backspace");
      await press(page, "Enter");
    },
  },
] as const;

for (const composer of COMPOSERS) {
  for (const { attack, name, run } of ATTACKS) {
    test(`empty state: ${composer.id}, ${attack}`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { height: HEIGHT, width: 1440 },
      });

      await context.grantPermissions(["clipboard-read", "clipboard-write"], {
        origin: DOCS_URL,
      });

      const page = await context.newPage();
      const root = page.locator(exampleSelector(composer.id));
      const image = path.join(STRESS, "empty", `${composer.id}--${name}.png`);
      let before: ComposerReading | null = null;
      let after: ComposerReading | null = null;

      const images = new Map<string, Buffer>();

      for (const scheme of SCHEMES) {
        // oxlint-disable-next-line no-await-in-loop -- one scheme at a time
        await openPage(page, `${DOCS_URL}${composer.url}`, scheme);
        // oxlint-disable-next-line no-await-in-loop -- reads the composer at rest
        before = await readComposer(root);
        // oxlint-disable-next-line no-await-in-loop -- focuses the field
        await root.locator("textarea").focus();
        // oxlint-disable-next-line no-await-in-loop -- runs the attack
        await run(page);
        // oxlint-disable-next-line no-await-in-loop -- lets a send, if any, render
        await page.waitForTimeout(SEND_SETTLE_MS);
        // oxlint-disable-next-line no-await-in-loop -- reads the composer after
        after = await readComposer(root);
        // oxlint-disable-next-line no-await-in-loop -- one screenshot at a time
        images.set(scheme, await root.screenshot({ animations: "disabled" }));
      }

      const light = images.get("light");
      const dark = images.get("dark");

      if (light && dark) {
        sideBySide(light, dark, image);
      }

      if (!before || !after) {
        throw new Error(`${composer.id} was never read`);
      }

      appendResult("stress-empty", {
        attack,
        ...judgeComposer(before, after),
        image: relative(image),
        part: composer.id,
      } satisfies EmptyRow);

      await context.close();
    });
  }
}

test("empty state: remove the last attachment", async ({ page }) => {
  const id = "composer-state--attached";
  const image = path.join(STRESS, "empty", `${id}--remove-last.png`);
  const images = new Map<string, Buffer>();
  let happened = "";
  let broken = false;

  for (const scheme of SCHEMES) {
    // oxlint-disable-next-line no-await-in-loop -- one scheme at a time
    await openPage(page, "/composer", scheme);

    const root = page.locator(exampleSelector(id));
    const removers = root.getByRole("button", { name: /^Remove /u });
    // oxlint-disable-next-line no-await-in-loop -- reads the starting height
    const startBox = await root.boundingBox();
    const startHeight = startBox?.height ?? 0;
    // oxlint-disable-next-line no-await-in-loop -- counts attachments
    const count = await removers.count();
    const focusTrail: string[] = [];

    for (let removed = 0; removed < count; removed += 1) {
      // oxlint-disable-next-line no-await-in-loop -- focuses the next remove button
      await removers.first().focus();
      // oxlint-disable-next-line no-await-in-loop -- removes with the keyboard
      await press(page, "Enter");
      // oxlint-disable-next-line no-await-in-loop -- reads where focus went
      focusTrail.push(await focusedName(page));
    }

    // oxlint-disable-next-line no-await-in-loop -- reads the final height
    const endBox = await root.boundingBox();
    const endHeight = endBox?.height ?? 0;
    // oxlint-disable-next-line no-await-in-loop -- counts what is left
    const left = await removers.count();

    // oxlint-disable-next-line no-await-in-loop -- one screenshot at a time
    images.set(scheme, await root.screenshot({ animations: "disabled" }));

    if (scheme === "light") {
      const lostFocus = focusTrail.includes("the page (body)");

      broken = left > 0 || lostFocus;
      happened = `${count} attachments removed with Enter, ${left} left; height ${Math.round(startHeight)} then ${Math.round(endHeight)}; focus after each removal: ${focusTrail.join(", ")}`;
    }
  }

  const light = images.get("light");
  const dark = images.get("dark");

  if (light && dark) {
    sideBySide(light, dark, image);
  }

  appendResult("stress-empty", {
    attack: "remove the last attachment with the keyboard",
    broken,
    happened,
    image: relative(image),
    part: id,
  } satisfies EmptyRow);
});
