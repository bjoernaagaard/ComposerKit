// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

// Check 3, part two: each Keyboard row in spec/functional.md, walked on the
// demo it applies to. Each row's line number, expected result and what
// happened go to the report. A mismatch is recorded, not hidden.
import type { Page } from "@playwright/test";

import {
  composerParts,
  example,
  fileChooserOpened,
  focused,
  highlighted,
  isFocused,
  menusClosed,
  notCheckable,
  openMenu,
  press,
  replyRunning,
  settledInMenu,
  stoppedWithin,
  textOf,
  walk,
} from "./keyboard-support";

const COMPOSER = { example: "composer--stacked", url: "/composer" };
const INLINE = { example: "composer--inline", url: "/composer" };
const LONG_DRAFT = { example: "composer-state--long-draft", url: "/composer" };
const CONVERSATION = { example: "conversation--demo", url: "/conversation" };

const TRANSCRIPT = {
  example: "conversation--transcript",
  url: "/conversation",
};

const MENU = { example: "menu--demo", url: "/menu" };
const TIP = { example: "tip--demo", url: "/tip" };
const ICON_BUTTON = { example: "icon-button--control", url: "/button" };

const SETTLE_MS = 300;

const parts = (page: Page, name: string) => composerParts(example(page, name));

// Types a draft into a composer and leaves focus in its field.
const draft = async (page: Page, name: string, text: string) => {
  const { field } = parts(page, name);

  await field.click();
  await page.keyboard.type(text);

  return field;
};

// Opens the add menu from the add button with the keyboard.
const openAddMenu = async (page: Page, name: string) => {
  const { add, listbox } = parts(page, name);

  await add.focus();
  await press(page, "Enter");
  await listbox.waitFor();
};

// --- 1. Composer > Keyboard --------------------------------------------

walk(
  {
    context: "Draft present, no menu open",
    expected: "Sends. Focus stays in the text field.",
    keys: "Enter",
    line: 131,
  },
  COMPOSER,
  async (page) => {
    const field = await draft(page, COMPOSER.example, "Plan the trip");

    await press(page, "Enter");
    await page.waitForTimeout(SETTLE_MS);

    const value = await field.inputValue();
    const inField = await isFocused(field);

    return {
      actual: `field value "${value}", focus on ${await focused(page)}`,
      pass: value === "" && inField,
    };
  }
);

walk(
  {
    context: "Add menu open, draft present",
    expected: "Does not send. Runs the highlighted menu item.",
    keys: "Enter",
    line: 132,
  },
  COMPOSER,
  async (page) => {
    const field = await draft(page, COMPOSER.example, "Plan the trip");

    await openAddMenu(page, COMPOSER.example);

    const picker = await fileChooserOpened(page, () =>
      page.keyboard.press("Enter")
    );

    const value = await field.inputValue();

    return {
      actual: `file picker opened: ${picker}, field value "${value}"`,
      pass: picker && value === "Plan the trip",
    };
  }
);

walk(
  {
    context: "Any",
    expected: "Inserts a new line",
    keys: "Shift+Enter",
    line: 133,
  },
  COMPOSER,
  async (page) => {
    const field = await draft(page, COMPOSER.example, "one");

    await press(page, "Shift+Enter");
    await page.keyboard.type("two");

    const value = await field.inputValue();

    return { actual: JSON.stringify(value), pass: value === "one\ntwo" };
  }
);

walk(
  {
    context: "Draft present, nothing running",
    expected: "Nothing happens. The draft stays.",
    keys: "Escape",
    line: 134,
  },
  COMPOSER,
  async (page) => {
    const field = await draft(page, COMPOSER.example, "Plan the trip");

    await press(page, "Escape");

    const value = await field.inputValue();

    return {
      actual: `field value "${value}", focus on ${await focused(page)}`,
      pass: value === "Plan the trip" && (await isFocused(field)),
    };
  }
);

walk(
  {
    context: "Field expanded",
    expected: "Nothing happens. The field stays expanded.",
    keys: "Escape",
    line: 135,
  },
  CONVERSATION,
  async (page) => {
    const root = example(page, CONVERSATION.example);
    const field = await draft(page, CONVERSATION.example, "one");

    await press(page, "Shift+Enter");
    await page.keyboard.type("two");

    const toggle = root.getByRole("button", { name: "Full height" });

    await toggle.click();
    await field.focus();
    await press(page, "Escape");

    const pressed = await toggle.getAttribute("aria-pressed");

    return {
      actual: `Full height aria-pressed=${pressed}`,
      pass: pressed === "true",
    };
  }
);

walk(
  {
    context: "Reply generating",
    expected: "Stops the reply. Focus stays in the text field.",
    keys: "Escape",
    line: 136,
  },
  CONVERSATION,
  async (page) => {
    const { field, primary } = parts(page, CONVERSATION.example);

    await draft(page, CONVERSATION.example, "Tell me more");
    await press(page, "Enter");
    await replyRunning(page, primary);
    await press(page, "Escape");

    const stopped = await stoppedWithin(primary);

    return {
      actual: `${stopped.label === "Stop reply" ? "still generating" : `stopped (primary button "${stopped.label}")`} ${stopped.ms} ms after Escape, focus on ${await focused(page)}`,
      pass: stopped.label !== "Stop reply" && (await isFocused(field)),
    };
  }
);

walk(
  {
    context: "Add menu open",
    expected: "Closes the menu. The draft stays and focus stays in the field.",
    keys: "Escape",
    line: 137,
  },
  COMPOSER,
  async (page) => {
    const { listbox } = parts(page, COMPOSER.example);
    const field = await draft(page, COMPOSER.example, "Plan the trip");

    await openAddMenu(page, COMPOSER.example);
    await press(page, "Escape");

    const open = await listbox.count();
    const value = await field.inputValue();

    return {
      actual: `menu open: ${open > 0}, field value "${value}", focus on ${await focused(page)}`,
      pass: open === 0 && value === "Plan the trip" && (await isFocused(field)),
    };
  }
);

walk(
  {
    context: "Draft present, no menu",
    expected: "No effect seen. It did not recall an earlier message.",
    keys: "Up arrow",
    line: 138,
  },
  COMPOSER,
  async (page) => {
    const field = await draft(page, COMPOSER.example, "Plan the trip");

    await press(page, "ArrowUp");

    const value = await field.inputValue();

    return {
      actual: `field value "${value}"`,
      pass: value === "Plan the trip",
    };
  }
);

walk(
  {
    context: "Focus elsewhere in the main window",
    expected: "Focus moves to the composer and the character is inserted.",
    keys: "Typing a printable character",
    line: 139,
  },
  CONVERSATION,
  async (page) => {
    const root = example(page, CONVERSATION.example);
    const { field } = composerParts(root);

    await root.getByRole("button", { name: "Copy" }).first().focus();
    await press(page, "k");

    return {
      actual: `field value "${await field.inputValue()}", focus on ${await focused(page)}`,
      pass: (await field.inputValue()) === "k" && (await isFocused(field)),
    };
  }
);

walk(
  {
    context: "Tab order, one-row layout, starting from the add button",
    expected:
      "add button, text field, model picker, dictate, then the trailing button when it is enabled",
    keys: "Tab",
    line: 140,
  },
  INLINE,
  async (page) => {
    const { add } = parts(page, INLINE.example);
    const order: string[] = [];

    await add.focus();
    order.push(await focused(page));

    for (let step = 0; step < 4; step += 1) {
      // oxlint-disable-next-line no-await-in-loop -- each Tab follows the one before
      await press(page, "Tab");
      // oxlint-disable-next-line no-await-in-loop -- reads focus after each Tab
      order.push(await focused(page));
    }

    const expected = [
      /Add files/u,
      /textarea/u,
      /Sparrow/u,
      /Dictate/u,
      /voice chat|Send/u,
    ];

    const pass = expected.every((pattern, index) =>
      pattern.test(order[index] ?? "")
    );

    return { actual: order.join(" → "), pass };
  }
);

walk(
  {
    context: "Tab order, two-row layout, starting from the text field",
    expected: "Tab goes to the add button",
    keys: "Tab",
    line: 141,
  },
  LONG_DRAFT,
  async (page) => {
    const { field } = parts(page, LONG_DRAFT.example);

    await field.focus();
    await press(page, "Tab");

    const now = await focused(page);

    return { actual: `focus on ${now}`, pass: now.includes("Add files") };
  }
);

notCheckable(
  {
    context: "Focus outside the composer",
    expected: "Opens a confirmation dialog for a bulk mark-as-read action.",
    keys: "Shift+Escape",
    line: 142,
  },
  "ComposerKit has no bulk mark-as-read action or dialog. This is app behavior of the reference app, not part of any registry item."
);

// --- 1. Composer > Type-to-focus scope ----------------------------------
// On /conversation the demo conversation mounts first, so its composer is
// the one type-to-focus fills; the other three see the key already taken.

const typeToFocus = (
  line: number,
  context: string,
  expected: string,
  setup: (page: Page) => Promise<void>,
  check: (
    page: Page,
    letter: string
  ) => Promise<{ actual: string; pass: boolean }>
) =>
  walk(
    { context, expected, keys: "Typing a letter", line },
    CONVERSATION,
    async (page) => {
      await setup(page);

      return check(page, "q");
    }
  );

const landsInComposer = async (page: Page, letter: string) => {
  const { field } = parts(page, CONVERSATION.example);

  await press(page, letter);

  const value = await field.inputValue();
  const menuOpen = (await page.getByRole("menu").count()) > 0;

  return {
    actual: `field value "${value}", focus on ${await focused(page)}, a menu open: ${menuOpen}`,
    pass: value === letter && (await isFocused(field)) && !menuOpen,
  };
};

typeToFocus(
  152,
  "Document body or a landmark region",
  "Composer. The field receives it.",
  async (page) => {
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    });
  },
  landsInComposer
);

typeToFocus(
  153,
  "An icon button outside the composer (a reply's more-actions menu button)",
  "Composer. The menu does not open.",
  async (page) => {
    await example(page, CONVERSATION.example)
      .getByRole("button", { name: "More" })
      .first()
      .focus();
  },
  landsInComposer
);

typeToFocus(
  154,
  "The composer's own add button",
  "Composer. The menu does not open.",
  async (page) => {
    await parts(page, CONVERSATION.example).add.focus();
  },
  landsInComposer
);

notCheckable(
  {
    context: "A sidebar chat row",
    expected: "Composer. The field receives it.",
    keys: "Typing a letter",
    line: 155,
  },
  "No docs page puts a sidebar row and a type-to-focus composer together; the rows are on /app-shell, the composer on /conversation."
);

notCheckable(
  {
    context: "A chat tab in the title bar",
    expected: "Composer. The field receives it.",
    keys: "Typing a letter",
    line: 156,
  },
  "No docs page puts title bar tabs and a type-to-focus composer together; the tabs are on /app-shell, the composer on /conversation."
);

walk(
  {
    context: "An open menu (reply more-actions) with a matching letter",
    expected:
      "Menu typeahead moves focus to the matching item. The field does not receive it.",
    keys: "Typing a letter",
    line: 157,
  },
  CONVERSATION,
  async (page) => {
    const { field } = parts(page, CONVERSATION.example);

    await example(page, CONVERSATION.example)
      .getByRole("button", { name: "More" })
      .first()
      .focus();
    await press(page, "Enter");
    await settledInMenu(page);

    const items = await openMenu(page).getByRole("menuitem").allTextContents();
    const target = items.at(-1)?.trim() ?? "";

    await press(page, target.charAt(0).toLowerCase());

    const now = await focused(page);

    return {
      actual: `items [${items.map((item) => item.trim()).join(", ")}], pressed "${target.charAt(0)}", focus on ${now}, field value "${await field.inputValue()}"`,
      pass: now.includes(target) && (await field.inputValue()) === "",
    };
  }
);

walk(
  {
    context: "An open menu with a letter that matches nothing",
    expected:
      "Menu keeps focus. Nothing happens. The field does not receive it.",
    keys: "Typing a letter",
    line: 158,
  },
  CONVERSATION,
  async (page) => {
    const { field } = parts(page, CONVERSATION.example);

    await example(page, CONVERSATION.example)
      .getByRole("button", { name: "More" })
      .first()
      .focus();
    await press(page, "Enter");
    await settledInMenu(page);
    await press(page, "z");

    const inMenu = await page.evaluate(
      () => document.activeElement?.closest('[role="menu"]') !== null
    );

    return {
      actual: `focus on ${await focused(page)}, inside the menu: ${inMenu}, field value "${await field.inputValue()}"`,
      pass: inMenu && (await field.inputValue()) === "",
    };
  }
);

walk(
  {
    context: "The model picker menu (container focused)",
    expected:
      "Menu keeps focus. The setting did not change. The field does not receive it.",
    keys: "Typing a letter",
    line: 159,
  },
  CONVERSATION,
  async (page) => {
    const { field, model } = parts(page, CONVERSATION.example);
    const before = await textOf(model);

    await model.click();
    await openMenu(page).waitFor();
    await settledInMenu(page);
    await press(page, "x");

    const inMenu = await page.evaluate(
      () => document.activeElement?.closest('[role="menu"]') !== null
    );

    const after = await textOf(model);

    return {
      actual: `focus on ${await focused(page)}, inside the menu: ${inMenu}, picker "${before}" then "${after}", field value "${await field.inputValue()}"`,
      pass: inMenu && before === after && (await field.inputValue()) === "",
    };
  }
);

notCheckable(
  {
    context: "A modal dialog (focus on its checkbox)",
    expected: "Dialog keeps focus. The composer does not receive it.",
    keys: "Typing a letter",
    line: 160,
  },
  "No registry item opens a modal dialog, so no demo has one."
);

walk(
  {
    context: "Any text input, including the composer",
    expected: "That input",
    keys: "Typing a letter",
    line: 161,
  },
  { example: "conversation--bubbles", url: "/conversation" },
  async (page) => {
    const other = parts(page, "conversation--bubbles").field;
    const { field } = parts(page, CONVERSATION.example);

    await other.focus();
    await press(page, "w");

    return {
      actual: `this field "${await other.inputValue()}", the demo's field "${await field.inputValue()}"`,
      pass:
        (await other.inputValue()) === "w" && (await field.inputValue()) === "",
    };
  }
);

// --- 1. Composer > Focus after actions ----------------------------------

walk(
  {
    context: "Send with Enter",
    expected: "Text field",
    keys: "Enter",
    line: 179,
  },
  CONVERSATION,
  async (page) => {
    const field = await draft(page, CONVERSATION.example, "Hello");

    await press(page, "Enter");
    await page.waitForTimeout(SETTLE_MS);

    return {
      actual: `focus on ${await focused(page)}`,
      pass: await isFocused(field),
    };
  }
);

walk(
  {
    context: "Send by clicking the send button with the mouse",
    expected:
      "The document itself (the web area). Not the text field and not the button.",
    keys: "Mouse click on send",
    line: 180,
  },
  TRANSCRIPT,
  async (page) => {
    const { primary } = parts(page, TRANSCRIPT.example);

    await draft(page, TRANSCRIPT.example, "Hello");
    await primary.click();
    await page.waitForTimeout(150);

    const now = await focused(page);

    return { actual: `focus on ${now}`, pass: now === "the page (body)" };
  }
);

walk(
  {
    context: "Stop by clicking the stop control",
    expected:
      "Text field. Focus was in the field before the click and stayed there.",
    keys: "Mouse click on stop",
    line: 181,
  },
  TRANSCRIPT,
  async (page) => {
    const { field, primary } = parts(page, TRANSCRIPT.example);

    await draft(page, TRANSCRIPT.example, "Hello");
    await press(page, "Enter");
    await replyRunning(page, primary);
    await field.focus();
    await primary.click();
    await page.waitForTimeout(SETTLE_MS);

    return {
      actual: `focus on ${await focused(page)}`,
      pass: await isFocused(field),
    };
  }
);

walk(
  {
    context: "Stop with Escape",
    expected: "Text field",
    keys: "Escape",
    line: 182,
  },
  TRANSCRIPT,
  async (page) => {
    const { field, primary } = parts(page, TRANSCRIPT.example);

    await draft(page, TRANSCRIPT.example, "Hello");
    await press(page, "Enter");
    await replyRunning(page, primary);
    await press(page, "Escape");

    const stopped = await stoppedWithin(primary);

    return {
      actual: `primary button "${stopped.label}" ${stopped.ms} ms after Escape, focus on ${await focused(page)}`,
      pass: await isFocused(field),
    };
  }
);

walk(
  {
    context: "Close the add menu with Escape",
    expected: "Text field",
    keys: "Escape",
    line: 183,
  },
  COMPOSER,
  async (page) => {
    const { field } = parts(page, COMPOSER.example);

    await openAddMenu(page, COMPOSER.example);
    await press(page, "Escape");

    return {
      actual: `focus on ${await focused(page)}`,
      pass: await isFocused(field),
    };
  }
);

notCheckable(
  {
    context: "Run an add-menu item, then cancel the system dialog it opened",
    expected: "Text field",
    keys: "Enter, then Escape in the system dialog",
    line: 184,
  },
  "A headless browser opens no system file dialog to cancel; Playwright only reports that a file chooser was requested (lines 132 and 318 check that)."
);

walk(
  {
    context:
      "Close the model picker with Escape after opening it with a mouse click",
    expected:
      "The element that had focus before the picker opened. A mouse click on the picker does not focus it.",
    keys: "Escape",
    line: 185,
  },
  COMPOSER,
  async (page) => {
    const { field, model } = parts(page, COMPOSER.example);

    await field.focus();
    await model.click();
    await openMenu(page).waitFor();
    await settledInMenu(page);
    await press(page, "Escape");

    return {
      actual: `focus on ${await focused(page)}`,
      pass: await isFocused(field),
    };
  }
);

// --- 4. Menus > A. Add menu (composer) ----------------------------------

walk(
  {
    context: "On the focused add button",
    expected: "Opens the menu. Focus moves to the text field.",
    keys: "Enter or Space",
    line: 313,
  },
  COMPOSER,
  async (page) => {
    const { add, field, listbox } = parts(page, COMPOSER.example);
    const results: string[] = [];

    for (const key of ["Enter", "Space"]) {
      // oxlint-disable-next-line no-await-in-loop -- one key, then the other
      await add.focus();
      // oxlint-disable-next-line no-await-in-loop -- one key, then the other
      await press(page, key);
      // oxlint-disable-next-line no-await-in-loop -- one key, then the other
      const open = (await listbox.count()) > 0;
      // oxlint-disable-next-line no-await-in-loop -- one key, then the other
      const inField = await isFocused(field);

      results.push(`${key}: menu open ${open}, focus in field ${inField}`);
      // oxlint-disable-next-line no-await-in-loop -- one key, then the other
      await press(page, "Escape");
    }

    return {
      actual: results.join("; "),
      pass: results.every((text) => !text.includes("false")),
    };
  }
);

walk(
  {
    context: "Add menu open",
    expected: "Moves the highlight. It wraps from last to first.",
    keys: "Down, Up",
    line: 314,
  },
  COMPOSER,
  async (page) => {
    const root = example(page, COMPOSER.example);
    const { options } = composerParts(root);

    await openAddMenu(page, COMPOSER.example);

    const count = await options.count();
    const seen = [await highlighted(root)];

    for (let step = 0; step < count; step += 1) {
      // oxlint-disable-next-line no-await-in-loop -- each key follows the one before
      await press(page, "ArrowDown");
      // oxlint-disable-next-line no-await-in-loop -- reads the highlight after each key
      seen.push(await highlighted(root));
    }

    await press(page, "ArrowUp");
    seen.push(await highlighted(root));

    const firstText = await textOf(options.first());
    const first = firstText.slice(0, 20);
    const wrapped = seen.includes(first ?? "") && seen.at(-2) !== seen.at(-1);

    return {
      actual: `${count} items, highlight: ${seen.join(" → ")}`,
      pass: wrapped,
    };
  }
);

walk(
  {
    context: "Add menu open",
    expected: "No effect on the highlight",
    keys: "Home, End",
    line: 315,
  },
  COMPOSER,
  async (page) => {
    const root = example(page, COMPOSER.example);

    await openAddMenu(page, COMPOSER.example);
    await press(page, "ArrowDown");

    const before = await highlighted(root);

    await press(page, "Home");
    const afterHome = await highlighted(root);

    await press(page, "End");
    const afterEnd = await highlighted(root);

    return {
      actual: `highlight ${before}, after Home ${afterHome}, after End ${afterEnd}`,
      pass: before === afterHome && before === afterEnd,
    };
  }
);

walk(
  {
    context: "Add menu open",
    expected: "Text goes into the composer and filters the list live.",
    keys: "Typing",
    line: 316,
  },
  COMPOSER,
  async (page) => {
    const { field, options } = parts(page, COMPOSER.example);

    await openAddMenu(page, COMPOSER.example);

    const before = await options.count();

    await page.keyboard.type("ima");

    const after = await options.allTextContents();

    return {
      actual: `field "${await field.inputValue()}", ${before} items then [${after.map((text) => text.trim()).join(", ")}]`,
      pass:
        (await field.inputValue()) === "ima" &&
        after.length < before &&
        after.length > 0,
    };
  }
);

walk(
  {
    context: "An item highlighted",
    expected:
      "Types a space into the field. The menu stays open, the highlight stays, nothing runs.",
    keys: "Space",
    line: 317,
  },
  COMPOSER,
  async (page) => {
    const root = example(page, COMPOSER.example);
    const { field, listbox } = composerParts(root);

    await openAddMenu(page, COMPOSER.example);

    const before = await highlighted(root);

    const picker = await fileChooserOpened(page, () =>
      page.keyboard.press("Space")
    );

    const after = await highlighted(root);

    return {
      actual: `field ${JSON.stringify(await field.inputValue())}, menu open ${(await listbox.count()) > 0}, highlight ${before} then ${after}, file picker ${picker}`,
      pass:
        (await field.inputValue()) === " " &&
        (await listbox.count()) > 0 &&
        before === after &&
        !picker,
    };
  }
);

walk(
  {
    context: "An item highlighted",
    expected:
      "Runs the highlighted item. The menu closes on the same step. Enter never sends.",
    keys: "Enter",
    line: 318,
  },
  COMPOSER,
  async (page) => {
    const { listbox } = parts(page, COMPOSER.example);

    await openAddMenu(page, COMPOSER.example);

    const picker = await fileChooserOpened(page, () =>
      page.keyboard.press("Enter")
    );

    return {
      actual: `file picker ${picker}, menu open ${(await listbox.count()) > 0}`,
      pass: picker && (await listbox.count()) === 0,
    };
  }
);

walk(
  {
    context: "Add menu open",
    expected: "Closes the menu. The typed text stays in the composer.",
    keys: "Escape",
    line: 319,
  },
  COMPOSER,
  async (page) => {
    const { field, listbox } = parts(page, COMPOSER.example);

    await openAddMenu(page, COMPOSER.example);
    await page.keyboard.type("fil");
    await press(page, "Escape");

    return {
      actual: `menu open ${(await listbox.count()) > 0}, field "${await field.inputValue()}"`,
      pass:
        (await listbox.count()) === 0 && (await field.inputValue()) === "fil",
    };
  }
);

const enterRuns = (
  line: number,
  context: string,
  expected: string,
  before: string,
  typed: string,
  after: string
) =>
  walk(
    { context, expected, keys: "Enter on the file item", line },
    COMPOSER,
    async (page) => {
      const { field } = parts(page, COMPOSER.example);

      if (before) {
        await draft(page, COMPOSER.example, before);
      }

      await openAddMenu(page, COMPOSER.example);
      await page.keyboard.type(typed);
      // The row is about Enter on the file item, so wait until the typed
      // filter has settled with that item highlighted.
      await example(page, COMPOSER.example)
        .locator('[role="option"][aria-selected="true"]', { hasText: "Files" })
        .waitFor();

      const picker = await fileChooserOpened(page, () =>
        page.keyboard.press("Enter")
      );

      const value = await field.inputValue();

      return {
        actual: `file picker ${picker}, field ${JSON.stringify(value)}`,
        pass: picker && value === after,
      };
    }
  );

enterRuns(
  325,
  "A draft typed before the menu opened",
  "The file picker opened. The draft was not sent and was still in the field.",
  "Plan the trip",
  "",
  "Plan the trip"
);

enterRuns(
  326,
  "Only a space typed while the menu was open",
  "The file picker opened. The typed space was removed from the field.",
  "",
  " ",
  ""
);

enterRuns(
  327,
  "Filter text typed while the menu was open (one item left)",
  "The file picker opened. The filter text was removed from the field.",
  "",
  "fil",
  ""
);

// --- 4. Menus > B. Model picker ------------------------------------------

walk(
  {
    context: "Model picker",
    expected: "Focus moves to the menu container (role menu)",
    keys: "Open by click",
    line: 350,
  },
  COMPOSER,
  async (page) => {
    await parts(page, COMPOSER.example).model.click();
    await openMenu(page).waitFor();
    await settledInMenu(page);

    const now = await focused(page);

    return { actual: `focus on ${now}`, pass: now.startsWith("menu ") };
  }
);

walk(
  {
    context: "Model picker, container focused",
    expected: "Focuses the first menu item",
    keys: "Down",
    line: 351,
  },
  COMPOSER,
  async (page) => {
    await parts(page, COMPOSER.example).model.click();

    const menu = openMenu(page);

    await menu.waitFor();
    await press(page, "ArrowDown");

    const first = await menu
      .locator('[role^="menuitem"], [role="slider"]')
      .first()
      .evaluate((element) => element === document.activeElement);

    return { actual: `focus on ${await focused(page)}`, pass: first };
  }
);

const menuItems = (page: Page) =>
  openMenu(page).locator('[role^="menuitem"], [role="slider"]');

walk(
  {
    context: "Model picker",
    expected: "Move between items. Up from the first item wraps to the last.",
    keys: "Down, Up",
    line: 352,
  },
  COMPOSER,
  async (page) => {
    await parts(page, COMPOSER.example).model.click();
    await openMenu(page).waitFor();
    await settledInMenu(page);
    await press(page, "ArrowDown");

    const first = await focused(page);

    await press(page, "ArrowUp");

    const wrapped = await focused(page);

    const last = await menuItems(page)
      .last()
      .evaluate((element) => element === document.activeElement);

    return { actual: `first ${first}, Up gives ${wrapped}`, pass: last };
  }
);

walk(
  {
    context: "Model picker",
    expected: "First and last item",
    keys: "Home, End",
    line: 353,
  },
  COMPOSER,
  async (page) => {
    await parts(page, COMPOSER.example).model.click();
    await openMenu(page).waitFor();
    await settledInMenu(page);
    await press(page, "ArrowDown");
    await press(page, "End");

    const atEnd = await menuItems(page)
      .last()
      .evaluate((element) => element === document.activeElement);

    const end = await focused(page);

    await press(page, "Home");

    const atHome = await menuItems(page)
      .first()
      .evaluate((element) => element === document.activeElement);

    return {
      actual: `End: ${end}, Home: ${await focused(page)}`,
      pass: atEnd && atHome,
    };
  }
);

walk(
  {
    context: "On the submenu item",
    expected: "No effect",
    keys: "Right",
    line: 354,
  },
  COMPOSER,
  async (page) => {
    await parts(page, COMPOSER.example).model.click();
    await openMenu(page).waitFor();
    await settledInMenu(page);
    await press(page, "ArrowDown");

    const before = await focused(page);
    const menusBefore = await page.getByRole("menu").count();

    await press(page, "ArrowRight");

    const after = await focused(page);

    return {
      actual: `focus ${before} then ${after}, menus ${menusBefore} then ${await page.getByRole("menu").count()}`,
      pass: before === after,
    };
  }
);

walk(
  {
    context: "On the submenu item",
    expected: "Opens the submenu with focus on the checked item",
    keys: "Enter",
    line: 355,
  },
  COMPOSER,
  async (page) => {
    await parts(page, COMPOSER.example).model.click();
    await openMenu(page).waitFor();
    await settledInMenu(page);
    await press(page, "ArrowDown");
    await press(page, "Enter");
    await page.waitForTimeout(SETTLE_MS);

    const checked = await page.evaluate(() =>
      document.activeElement?.getAttribute("aria-checked")
    );

    return {
      actual: `focus on ${await focused(page)}, aria-checked=${checked}`,
      pass: checked === "true",
    };
  }
);

walk(
  {
    context: "On the slider row",
    expected:
      "Changes the setting. A hidden status announces the step and its position out of five.",
    keys: "Left, Right",
    line: 356,
  },
  COMPOSER,
  async (page) => {
    const { model } = parts(page, COMPOSER.example);
    const before = await textOf(model);

    await model.click();
    await openMenu(page).waitFor();
    await settledInMenu(page);
    await press(page, "ArrowDown");
    await press(page, "ArrowDown");

    const on = await focused(page);

    await press(page, "ArrowRight");
    await page.waitForTimeout(SETTLE_MS);

    const status = await openMenu(page)
      .locator('[role="status"], [aria-live]')
      .allTextContents();

    const after = await textOf(model);

    return {
      actual: `on ${on}, picker "${before}" then "${after}", status [${status.join(" | ").trim()}]`,
      pass: before !== after,
    };
  }
);

walk(
  {
    context: "In the menu",
    expected:
      "Closes everything. Focus returns to whatever had focus before the picker opened.",
    keys: "Escape",
    line: 357,
  },
  COMPOSER,
  async (page) => {
    const { field, model } = parts(page, COMPOSER.example);

    await field.focus();
    await model.click();
    await openMenu(page).waitFor();
    await settledInMenu(page);
    await press(page, "Escape");

    const closed = await menusClosed(page);

    return {
      actual: `menus open ${closed.count} after ${closed.ms} ms, focus on ${await focused(page)}`,
      pass: closed.count === 0 && (await isFocused(field)),
    };
  }
);

// --- 4. Menus > C. Row more menu ----------------------------------------

const trigger = (page: Page) => example(page, MENU.example);

walk(
  {
    context: "On the trigger",
    expected: "Opens the menu with focus on the first item",
    keys: "Enter",
    line: 376,
  },
  MENU,
  async (page) => {
    await trigger(page).focus();
    await press(page, "Enter");
    await settledInMenu(page);

    const first = await openMenu(page)
      .getByRole("menuitem")
      .first()
      .evaluate((element) => element === document.activeElement);

    return { actual: `focus on ${await focused(page)}`, pass: first };
  }
);

walk(
  {
    context: "Click on the trigger",
    expected:
      "Opens the menu with focus on the menu container. Down then focuses the first item.",
    keys: "Click, then Down",
    line: 377,
  },
  MENU,
  async (page) => {
    await trigger(page).click();
    await openMenu(page).waitFor();
    await settledInMenu(page);

    const container = await focused(page);

    await press(page, "ArrowDown");

    const first = await openMenu(page)
      .getByRole("menuitem")
      .first()
      .evaluate((element) => element === document.activeElement);

    return {
      actual: `after click ${container}, after Down ${await focused(page)}`,
      pass: container.startsWith("menu ") && first,
    };
  }
);

walk(
  {
    context: "In the menu",
    expected:
      "Move between items. No wrap: Down on the last item and Up on the first item stay put.",
    keys: "Down, Up",
    line: 378,
  },
  MENU,
  async (page) => {
    await trigger(page).focus();
    await press(page, "Enter");
    await settledInMenu(page);

    const first = await focused(page);

    await press(page, "ArrowUp");

    const upFromFirst = await focused(page);

    await press(page, "End");

    const last = await focused(page);

    await press(page, "ArrowDown");

    const downFromLast = await focused(page);

    return {
      actual: `Up on ${first} gives ${upFromFirst}; Down on ${last} gives ${downFromLast}`,
      pass: upFromFirst === first && downFromLast === last,
    };
  }
);

walk(
  {
    context: "In the menu",
    expected: "First and last item",
    keys: "Home, End",
    line: 379,
  },
  MENU,
  async (page) => {
    await trigger(page).focus();
    await press(page, "Enter");
    await settledInMenu(page);
    await press(page, "End");

    const end = await focused(page);

    await press(page, "Home");

    const home = await focused(page);

    return {
      actual: `End: ${end}, Home: ${home}`,
      pass: end.includes("Archive") && home.includes("Pin"),
    };
  }
);

walk(
  {
    context: "In the menu",
    expected:
      "Typing a letter focuses the next item whose label starts with it",
    keys: "Typeahead",
    line: 380,
  },
  MENU,
  async (page) => {
    await trigger(page).focus();
    await press(page, "Enter");
    await settledInMenu(page);
    await press(page, "a");

    const now = await focused(page);

    return {
      actual: `pressed "a", focus on ${now}`,
      pass: now.includes("Archive"),
    };
  }
);

walk(
  {
    context: "On a submenu item",
    expected:
      "Opens the submenu and focuses its first item. The parent item reports expanded.",
    keys: "Right",
    line: 381,
  },
  MENU,
  async (page) => {
    await trigger(page).focus();
    await press(page, "Enter");
    await settledInMenu(page);

    // The parent menu by name: once the submenu opens, it is the last menu.
    const parent = page
      .getByRole("menu", { name: "More actions" })
      .getByRole("menuitem", { name: "Redo with" });

    await parent.focus();
    await press(page, "ArrowRight");
    await page.waitForTimeout(SETTLE_MS);

    const now = await focused(page);
    const expanded = await parent.getAttribute("aria-expanded");

    return {
      actual: `focus on ${now}, parent aria-expanded=${expanded}`,
      pass: now.includes("Same length") && expanded === "true",
    };
  }
);

walk(
  {
    context: "In a submenu",
    expected: "Closes the submenu. Focus returns to the parent item.",
    keys: "Left",
    line: 382,
  },
  MENU,
  async (page) => {
    await trigger(page).focus();
    await press(page, "Enter");
    await settledInMenu(page);
    await page.getByRole("menuitem", { name: "Redo with" }).focus();
    await press(page, "ArrowRight");
    await page.waitForTimeout(SETTLE_MS);
    await press(page, "ArrowLeft");
    await page.waitForTimeout(SETTLE_MS);

    const now = await focused(page);

    return {
      actual: `menus open ${await page.getByRole("menu").count()}, focus on ${now}`,
      pass:
        now.includes("Redo with") &&
        (await page.getByRole("menu").count()) === 1,
    };
  }
);

walk(
  {
    context: "In the menu",
    expected: "Closes the menu. Focus returns to the trigger.",
    keys: "Escape",
    line: 383,
  },
  MENU,
  async (page) => {
    await trigger(page).focus();
    await press(page, "Enter");
    await settledInMenu(page);
    await press(page, "Escape");

    const closed = await menusClosed(page);

    return {
      actual: `menus open ${closed.count} after ${closed.ms} ms, focus on ${await focused(page)}`,
      pass: closed.count === 0 && (await isFocused(trigger(page))),
    };
  }
);

notCheckable(
  {
    context: "On an item",
    expected: "Not tested, because it would run the action",
    keys: "Enter or Space",
    line: 384,
  },
  "The spec gives no expected result for this row."
);

// --- 2. Conversation, 3. Buttons, 5. Tooltips -----------------------------

walk(
  {
    context: "After clicking jump to latest",
    expected: "Stays on the jump button",
    keys: "Click on the jump button",
    line: 251,
  },
  { example: "conversation--document", url: "/conversation" },
  async (page) => {
    const root = example(page, "conversation--document");

    await root.locator('[data-slot="message-scroller"]').evaluate((element) => {
      element.scrollTop = 0;
    });

    const jump = root.getByRole("button", {
      name: "Scroll to the newest message",
    });

    await jump.click();
    await page.waitForTimeout(SETTLE_MS);

    // The button may leave the page once the view reaches the bottom, so
    // focus is read from the document, not from the button.
    const now = await focused(page);

    return {
      actual: `focus on ${now}, jump button still on the page: ${(await jump.count()) > 0}`,
      pass: now.includes("Scroll to the newest message"),
    };
  }
);

walk(
  {
    context: "Focus visible (keyboard) on an icon button",
    expected:
      "A 2 pt solid ring just outside the control with no gap. A tooltip also opens on keyboard focus.",
    keys: "Tab",
    line: 288,
  },
  ICON_BUTTON,
  async (page) => {
    const button = example(page, ICON_BUTTON.example)
      .getByRole("button")
      .first();

    await button.evaluate((element) => {
      const before = element.closest("figure")?.querySelector("figcaption");

      if (before instanceof HTMLElement) {
        before.tabIndex = -1;
        before.focus();
      }
    });
    await press(page, "Tab");
    await page.waitForTimeout(400);

    const ring = await button.evaluate((element) => {
      const style = getComputedStyle(element);

      return {
        offset: style.outlineOffset,
        style: style.outlineStyle,
        width: style.outlineWidth,
      };
    });

    const tip = await page.locator('[data-slot="tooltip"]').count();

    return {
      actual: `focus on ${await focused(page)}, outline ${ring.width} ${ring.style} offset ${ring.offset}, tooltip open ${tip > 0}`,
      pass:
        ring.width === "2px" &&
        ring.style === "solid" &&
        ring.offset === "0px" &&
        tip > 0,
    };
  }
);

walk(
  {
    context: "Focus after a mouse click",
    expected: "No ring",
    keys: "Mouse click",
    line: 289,
  },
  ICON_BUTTON,
  async (page) => {
    const button = example(page, ICON_BUTTON.example)
      .getByRole("button")
      .first();

    await button.click();

    const ring = await button.evaluate((element) => ({
      focusVisible: element.matches(":focus-visible"),
      style: getComputedStyle(element).outlineStyle,
    }));

    return {
      actual: `:focus-visible ${ring.focusVisible}, outline ${ring.style}`,
      pass: !ring.focusVisible,
    };
  }
);

walk(
  {
    context: "A button gets keyboard focus",
    expected: "A tooltip opens",
    keys: "Tab",
    line: 408,
  },
  TIP,
  async (page) => {
    const button = example(page, TIP.example);

    await page
      .locator('[data-slot="preview"]')
      .first()
      .evaluate((element) => {
        element.tabIndex = -1;
        element.focus();
      });
    await press(page, "Tab");
    await page.waitForTimeout(400);

    const tip = page.locator('[data-slot="tooltip"]');

    return {
      actual: `focus on ${await focused(page)}, tooltip "${(await tip.count()) > 0 ? await tip.first().textContent() : "none"}"`,
      pass: (await isFocused(button)) && (await tip.count()) > 0,
    };
  }
);
