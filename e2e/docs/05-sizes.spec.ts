// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

// Check 3, part three: each number in spec/functional.md that a docs demo
// can show, measured in the browser with about 1 px of tolerance. Each
// row keeps its spec line, the expected value and what was measured.
import type { Locator, Page } from "@playwright/test";

import { composerParts, example, record, skip } from "./keyboard-support";
import type { Walked, Where } from "./keyboard-support";
import { PLAYGROUND_URL } from "./support";

const FILE = "sizes";
const PX_SUFFIX = /px$/u;
const TOLERANCE = 1;
const SETTLE_MS = 150;
const TOOLTIP_MS = 700;

const EMPTY: Where = { example: "composer--inline", url: "/composer" };

const DOCKED: Where = {
  example: "conversation--bubbles",
  url: "/conversation",
};

// The spec's conversation: the prompt in a bubble and the reply as plain
// text on the page, which is the document layout. The bubbles layout puts
// the reply in an outlined bubble too, with its own spacing.
const CONVERSATION: Where = {
  example: "conversation--document",
  url: "/conversation",
};

const MENU: Where = { example: "menu--demo", url: "/menu" };
const TIP: Where = { example: "tip--demo", url: "/tip" };
const TABS: Where = { example: "title-bar-tabs--filled", url: "/app-shell" };

const ROWS: Where = {
  example: "conversation-row--measured",
  url: "/chat-sidebar",
};

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

const sideOf = async (locator: Locator, side: keyof Box) => {
  const box = await rect(locator);

  return box[side];
};

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

// The width of a hairline edge: a CSS border, or a box-shadow ring with no
// offset and no blur, which is how some designs draw it.
const hairline = (locator: Locator) =>
  locator.evaluate((element) => {
    const style = getComputedStyle(element);
    const border = Number(style.borderTopWidth.replace("px", ""));

    const shadows =
      style.boxShadow === "none" ? [] : style.boxShadow.split(/,(?![^(]*\))/u);

    let ring = 0;

    for (const shadow of shadows) {
      const transparent = /rgba\([^)]*,\s*0\)/u.test(shadow);

      const lengths = [...shadow.matchAll(/(?<length>-?[\d.]+)px/gu)].map(
        (match) => Number(match.groups?.length ?? "0")
      );

      const [x = 0, y = 0, blur = 0, spread = 0] = lengths;

      if (!transparent && x === 0 && y === 0 && blur === 0 && spread > ring) {
        ring = spread;
      }
    }

    return { border, ring, width: border > 0 ? border : ring };
  });

const isHairline = (width: number) => width > 0 && width <= 1 + TOLERANCE;

const surfaceOf = (page: Page, where: Where) =>
  example(page, where.example).locator('[data-slot="composer-surface"]');

const dictateOf = (page: Page, where: Where) =>
  example(page, where.example).getByRole("button", { name: "Dictate" });

const settle = (page: Page) => page.waitForTimeout(SETTLE_MS);

// The composer's top and bottom measured from the example's own top, so
// the page scrolling to the field does not count as the field moving.
const edges = async (page: Page, where: Where) => {
  const frame = await rect(example(page, where.example));
  const box = await rect(surfaceOf(page, where));

  return { bottom: box.bottom - frame.top, top: box.top - frame.top };
};

const lines = (count: number) =>
  Array.from({ length: count }, (_, index) => `line ${index + 1}`).join("\n");

// --- 1. Composer > Sizes -------------------------------------------------

const COMPOSERS = [
  {
    height: 44,
    name: "empty chat",
    picker: [102, 102],
    text: 20,
    where: EMPTY,
    width: 641,
  },
  {
    height: 48,
    name: "docked",
    picker: [102, 103],
    text: 36,
    where: DOCKED,
    width: 737,
  },
] as const;

for (const composer of COMPOSERS) {
  const { name, where } = composer;

  measure(
    {
      expected: `${composer.width}`,
      line: 44,
      part: `Composer outer width, ${name}`,
    },
    where,
    async (page) => {
      const box = await rect(surfaceOf(page, where));

      return { actual: fmt(box.width), pass: near(box.width, composer.width) };
    }
  );

  measure(
    {
      expected: `${composer.height}`,
      line: 45,
      part: `Composer height with one line, ${name}`,
    },
    where,
    async (page) => {
      const box = await rect(surfaceOf(page, where));

      return {
        actual: fmt(box.height),
        pass: near(box.height, composer.height),
      };
    }
  );

  measure(
    { expected: "22", line: 46, part: `Composer corner radius, ${name}` },
    where,
    async (page) => {
      const radius = await cssNumber(
        surfaceOf(page, where),
        "border-top-left-radius"
      );

      return { actual: fmt(radius), pass: near(radius, 22) };
    }
  );

  measure(
    {
      expected: "hairline, about 0.5 to 1",
      line: 47,
      part: `Composer border, ${name}`,
    },
    where,
    async (page) => {
      const edge = await hairline(surfaceOf(page, where));

      return {
        actual: `border ${fmt(edge.border)}, box-shadow ring ${fmt(edge.ring)}`,
        pass: isHairline(edge.width),
      };
    }
  );

  measure(
    {
      expected: "8 left, 8 right",
      line: 48,
      part: `Inset from field edge to first and last control, ${name}`,
    },
    where,
    async (page) => {
      const { add, primary } = composerParts(example(page, where.example));
      const surface = await rect(surfaceOf(page, where));
      const left = (await sideOf(add, "left")) - surface.left;
      const right = surface.right - (await sideOf(primary, "right"));

      return {
        actual: `${fmt(left)} left, ${fmt(right)} right`,
        pass: near(left, 8) && near(right, 8),
      };
    }
  );

  measure(
    { expected: "29 x 28", line: 49, part: `Add button, ${name}` },
    where,
    async (page) => {
      const box = await rect(composerParts(example(page, where.example)).add);

      return {
        actual: size(box),
        pass: near(box.width, 29) && near(box.height, 28),
      };
    }
  );

  measure(
    { expected: "4", line: 50, part: `Gap from add button to text, ${name}` },
    where,
    async (page) => {
      const { add, field } = composerParts(example(page, where.example));

      const text =
        (await sideOf(field, "left")) +
        (await cssNumber(field, "padding-left"));

      const gap = text - (await sideOf(add, "right"));

      return { actual: fmt(gap), pass: near(gap, 4) };
    }
  );

  measure(
    { expected: `${composer.text} tall`, line: 51, part: `Text box, ${name}` },
    where,
    async (page) => {
      const box = await rect(composerParts(example(page, where.example)).field);

      return {
        actual: `${fmt(box.height)} tall`,
        pass: near(box.height, composer.text),
      };
    }
  );

  measure(
    {
      expected: `${composer.picker.join(" to ")} x 28`,
      line: 52,
      part: `Model picker, ${name}`,
    },
    where,
    async (page) => {
      const box = await rect(composerParts(example(page, where.example)).model);

      return {
        actual: size(box),
        pass:
          between(box.width, composer.picker[0], composer.picker[1]) &&
          near(box.height, 28),
      };
    }
  );

  measure(
    { expected: "29 x 28", line: 53, part: `Dictate button, ${name}` },
    where,
    async (page) => {
      const box = await rect(dictateOf(page, where));

      return {
        actual: size(box),
        pass: near(box.width, 29) && near(box.height, 28),
      };
    }
  );

  measure(
    { expected: "29 x 28", line: 54, part: `Trailing round button, ${name}` },
    where,
    async (page) => {
      const box = await rect(
        composerParts(example(page, where.example)).primary
      );

      return {
        actual: size(box),
        pass: near(box.width, 29) && near(box.height, 28),
      };
    }
  );

  measure(
    {
      expected: "about 7 from dictate to the round button",
      line: 55,
      part: `Gap between trailing controls, ${name}`,
    },
    where,
    async (page) => {
      const gap =
        (await sideOf(
          composerParts(example(page, where.example)).primary,
          "left"
        )) - (await sideOf(dictateOf(page, where), "right"));

      return { actual: fmt(gap), pass: near(gap, 7) };
    }
  );
}

measure(
  {
    expected: "16",
    line: 56,
    part: "Docked composer distance from the bottom of the conversation view",
  },
  DOCKED,
  async (page) => {
    const view = await rect(example(page, DOCKED.example));
    const gap = view.bottom - (await sideOf(surfaceOf(page, DOCKED), "bottom"));

    return { actual: fmt(gap), pass: near(gap, 16) };
  }
);

notMeasurable(
  {
    expected: "about 9 from a one-line disclaimer to the composer",
    line: 57,
    part: "Gap from disclaimer line to composer",
  },
  "No registry item renders a disclaimer line, and the spec does not give its text."
);

// --- 1. Composer > Growth -------------------------------------------------

const GROWTH = [
  { count: 1, height: 44, line: 65 },
  { count: 2, height: 98, line: 66 },
  { count: 3, height: 114, line: 67 },
  { count: 4, height: 134, line: 68 },
  { count: 11, height: 274, line: 69 },
  { count: 12, height: 279, line: 70 },
  { count: 16, height: 279, line: 70 },
] as const;

for (const step of GROWTH) {
  measure(
    {
      expected: `${step.height}`,
      line: step.line,
      part: `Composer height with ${step.count} lines (Shift+Enter), empty chat`,
    },
    EMPTY,
    async (page) => {
      const { field } = composerParts(example(page, EMPTY.example));

      await field.fill(lines(step.count));
      await settle(page);

      const box = await rect(surfaceOf(page, EMPTY));

      return { actual: fmt(box.height), pass: near(box.height, step.height) };
    }
  );
}

measure(
  {
    expected: "12 or more lines scroll inside the field",
    line: 70,
    part: "Text scrolls inside the field at the maximum",
  },
  EMPTY,
  async (page) => {
    const { field } = composerParts(example(page, EMPTY.example));

    await field.fill(lines(16));
    await settle(page);

    const scroll = await field.evaluate((element) => ({
      client: element.clientHeight,
      scroll: element.scrollHeight,
    }));

    return {
      actual: `scrollHeight ${scroll.scroll}, clientHeight ${scroll.client}`,
      pass: scroll.scroll > scroll.client,
    };
  }
);

measure(
  {
    expected: "top edge stays put",
    line: 72,
    part: "Empty chat composer grows downward",
  },
  EMPTY,
  async (page) => {
    const { field } = composerParts(example(page, EMPTY.example));
    const before = await edges(page, EMPTY);

    await field.fill(lines(4));
    await settle(page);

    const after = await edges(page, EMPTY);

    return {
      actual: `top ${fmt(before.top)} then ${fmt(after.top)}, bottom ${fmt(before.bottom)} then ${fmt(after.bottom)}`,
      pass: near(after.top, before.top),
    };
  }
);

measure(
  {
    expected: "bottom edge stays put",
    line: 73,
    part: "Docked composer grows upward",
  },
  DOCKED,
  async (page) => {
    const { field } = composerParts(example(page, DOCKED.example));
    const before = await edges(page, DOCKED);

    await field.fill(lines(4));
    await settle(page);

    const after = await edges(page, DOCKED);

    return {
      actual: `top ${fmt(before.top)} then ${fmt(after.top)}, bottom ${fmt(before.bottom)} then ${fmt(after.bottom)}`,
      pass: near(after.bottom, before.bottom),
    };
  }
);

// Fills the field with ever longer single lines and keeps each new height,
// with whether the expand toggle was there at that height.
const softWrap = async (page: Page, where: Where, stopAt: number) => {
  const root = example(page, where.example);
  const { field } = composerParts(root);
  const toggle = root.getByRole("button", { name: "Full height" });
  const seen: { height: number; toggle: boolean }[] = [];
  const maxWords = 240;

  for (let words = 1; words <= maxWords && seen.length < stopAt; words += 1) {
    // oxlint-disable-next-line no-await-in-loop -- each length builds on the one before
    await field.fill("word ".repeat(words).trim());
    // oxlint-disable-next-line no-await-in-loop -- the field resizes after input
    await page.waitForTimeout(30);

    // oxlint-disable-next-line no-await-in-loop -- reads the height for this length
    const { height } = await rect(surfaceOf(page, where));

    if (!seen.some((entry) => near(entry.height, height))) {
      // oxlint-disable-next-line no-await-in-loop -- reads the toggle for this height
      seen.push({ height, toggle: (await toggle.count()) > 0 });
    }
  }

  return seen;
};

measure(
  {
    expected: "44, then 98, 114, 134 and 154 as it wraps",
    line: 74,
    part: "One long line with no breaks (soft wrap), empty chat",
  },
  EMPTY,
  async (page) => {
    const seen = await softWrap(page, EMPTY, 5);
    const expected = [44, 98, 114, 134, 154];

    return {
      actual: seen.map((entry) => fmt(entry.height)).join(", "),
      pass: expected.every((height, index) =>
        near(seen[index]?.height ?? 0, height)
      ),
    };
  }
);

measure(
  {
    expected: "back to 44",
    line: 75,
    part: "Deleting the text returns the one-line height, empty chat",
  },
  EMPTY,
  async (page) => {
    const { field } = composerParts(example(page, EMPTY.example));

    await field.fill(lines(4));
    await settle(page);
    await field.fill("");
    await settle(page);

    const box = await rect(surfaceOf(page, EMPTY));

    return { actual: fmt(box.height), pass: near(box.height, 44) };
  }
);

// --- 1. Composer > Expand control ----------------------------------------

measure(
  {
    expected:
      "33 x 32, top 10 below the field top, right edge 10 inside, text area 28 narrower (713 to 685)",
    line: 80,
    part: "Expand toggle, docked",
  },
  DOCKED,
  async (page) => {
    const root = example(page, DOCKED.example);
    const { field } = composerParts(root);

    await field.fill("word ".repeat(40).trim());
    await settle(page);

    const wrapped = await rect(field);

    await field.fill(lines(2));
    await settle(page);

    const toggle = await rect(
      root.getByRole("button", { name: "Full height" })
    );

    const surface = await rect(surfaceOf(page, DOCKED));
    const text = await rect(field);
    const top = toggle.top - surface.top;
    const right = surface.right - toggle.right;
    const narrower = wrapped.width - text.width;

    return {
      actual: `${size(toggle)}, top ${fmt(top)}, right ${fmt(right)}, text area ${fmt(wrapped.width)} to ${fmt(text.width)} (${fmt(narrower)} narrower)`,
      pass:
        near(toggle.width, 33) &&
        near(toggle.height, 32) &&
        near(top, 10) &&
        near(right, 10) &&
        near(narrower, 28) &&
        near(text.width, 685),
    };
  }
);

const toggleCount = (page: Page) =>
  example(page, DOCKED.example)
    .getByRole("button", { name: "Full height" })
    .count();

measure(
  { expected: "absent", line: 86, part: "Expand toggle with one line, docked" },
  DOCKED,
  async (page) => {
    await composerParts(example(page, DOCKED.example)).field.fill("one line");
    await settle(page);

    const count = await toggleCount(page);

    return { actual: count > 0 ? "present" : "absent", pass: count === 0 };
  }
);

measure(
  {
    expected: "present from the first break (field 98)",
    line: 87,
    part: "Expand toggle with a hard line break, docked",
  },
  DOCKED,
  async (page) => {
    await composerParts(example(page, DOCKED.example)).field.fill(lines(2));
    await settle(page);

    const count = await toggleCount(page);
    const box = await rect(surfaceOf(page, DOCKED));

    return {
      actual: `${count > 0 ? "present" : "absent"} at ${fmt(box.height)}`,
      pass: count > 0 && near(box.height, 98),
    };
  }
);

measure(
  {
    expected: "absent at 98 to 134, present at 154",
    line: 88,
    part: "Expand toggle with one soft-wrapped paragraph, docked (lines 88 and 89)",
  },
  DOCKED,
  async (page) => {
    const seen = await softWrap(page, DOCKED, 5);

    const pass = seen.every((entry) =>
      entry.height > 140 ? entry.toggle : !entry.toggle
    );

    return {
      actual: seen
        .map(
          (entry) =>
            `${fmt(entry.height)} ${entry.toggle ? "present" : "absent"}`
        )
        .join(", "),
      pass: pass && seen.some((entry) => near(entry.height, 154)),
    };
  }
);

// --- 2. Conversation -----------------------------------------------------

// The bubbles example opens with a prompt, then a reply, then a prompt.
const PROMPT = 0;
const REPLY = 1;
const NEXT_PROMPT = 2;

const conversation = (page: Page) => example(page, CONVERSATION.example);

const turnAt = (page: Page, index: number) =>
  conversation(page).locator('[data-slot="turn"]').nth(index);

measure(
  { expected: "737", line: 205, part: "Message column width" },
  CONVERSATION,
  async (page) => {
    const box = await rect(
      conversation(page).locator('[data-slot="turn"]').first()
    );

    return { actual: fmt(box.width), pass: near(box.width, 737) };
  }
);

measure(
  {
    expected: "the pane less about 16 on each side",
    line: 206,
    part: "Message column in a narrow pane (viewport 820 wide)",
  },
  CONVERSATION,
  async (page) => {
    await page.setViewportSize({ height: 900, width: 820 });
    await settle(page);

    const pane = await rect(
      conversation(page).locator('[data-slot="message-scroller"]')
    );

    const column = await rect(
      conversation(page).locator('[data-slot="turn"]').first()
    );

    const expected = Math.min(737, pane.width - 32);

    return {
      actual: `pane ${fmt(pane.width)}, column ${fmt(column.width)} (expected ${fmt(expected)})`,
      pass: near(column.width, expected),
    };
  }
);

measure(
  { expected: "32", line: 207, part: "Space above the first turn" },
  CONVERSATION,
  async (page) => {
    const scroller = conversation(page).locator(
      '[data-slot="message-scroller"]'
    );

    await scroller.evaluate((element) => {
      element.scrollTop = 0;
    });

    // The first thing drawn in the first turn: an attachment or the bubble.
    const contentTop = await conversation(page)
      .locator('[data-slot="turn"]')
      .first()
      .evaluate((turn) =>
        Math.min(
          ...[...turn.querySelectorAll(":scope > *")].flatMap((child) => {
            const box = child.getBoundingClientRect();

            return box.height > 2 ? [box.top] : [];
          })
        )
      );

    const top = contentTop - (await sideOf(scroller, "top"));

    return { actual: fmt(top), pass: near(top, 32) };
  }
);

measure(
  {
    expected: "about 16 pt type, line pitch about 22.7",
    line: 208,
    part: "Reply text",
  },
  CONVERSATION,
  async (page) => {
    const text = conversation(page)
      .locator('[data-slot="turn"]')
      .nth(REPLY)
      .locator('[data-slot="rich-text"] p')
      .first();

    const fontSize = await cssNumber(text, "font-size");
    const lineHeight = await cssNumber(text, "line-height");

    return {
      actual: `${fmt(fontSize)} type, ${fmt(lineHeight)} pitch`,
      pass: near(fontSize, 16) && near(lineHeight, 22.7),
    };
  }
);

measure(
  {
    expected: "about 16",
    line: 209,
    part: "Space between paragraphs in a reply",
  },
  CONVERSATION,
  async (page) => {
    const second = conversation(page)
      .locator('[data-slot="rich-text"] p + p')
      .first();

    const gap = await second.evaluate((element) => {
      const previous = element.previousElementSibling;

      return previous
        ? element.getBoundingClientRect().top -
            previous.getBoundingClientRect().bottom
        : Number.NaN;
    });

    return { actual: fmt(gap), pass: near(gap, 16) };
  }
);

measure(
  {
    expected: "about 5 short of the column's right edge",
    line: 215,
    part: "Prompt bubble alignment",
  },
  CONVERSATION,
  async (page) => {
    const turn = turnAt(page, PROMPT);

    const gap =
      (await sideOf(turn, "right")) -
      (await sideOf(turn.locator('[data-slot="bubble"]'), "right"));

    return { actual: fmt(gap), pass: near(gap, 5) };
  }
);

measure(
  { expected: "43", line: 216, part: "Prompt bubble height with one line" },
  CONVERSATION,
  async (page) => {
    const heights = await conversation(page)
      .locator('[data-slot="bubble"]')
      .evaluateAll((bubbles) =>
        bubbles
          .filter((bubble) => {
            const text = bubble.querySelector('[data-slot="rich-text"]');

            return text !== null && text.getBoundingClientRect().height < 24;
          })
          .map((bubble) => bubble.getBoundingClientRect().height)
      );

    return {
      actual:
        heights.length === 0
          ? "no one-line bubble in the demo"
          : heights.map(fmt).join(", "),
      pass: heights.length > 0 && heights.every((height) => near(height, 43)),
    };
  }
);

measure(
  {
    expected:
      "about 10 to 12 horizontal, about 13 vertical around a 17 pt glyph box",
    line: 217,
    part: "Prompt bubble padding",
  },
  CONVERSATION,
  async (page) => {
    const bubble = conversation(page).locator('[data-slot="bubble"]').first();
    const text = bubble.locator('[data-slot="rich-text"]');
    const outer = await rect(bubble);
    const inner = await rect(text);
    const lineHeight = await cssNumber(text, "line-height");
    const glyph = 17;
    const horizontal = inner.left - outer.left;
    const vertical = inner.top - outer.top + (lineHeight - glyph) / 2;

    return {
      actual: `${fmt(horizontal)} horizontal, ${fmt(vertical)} vertical`,
      pass: between(horizontal, 10, 12) && near(vertical, 13),
    };
  }
);

measure(
  { expected: "about 18", line: 218, part: "Prompt bubble radius" },
  CONVERSATION,
  async (page) => {
    const radius = await cssNumber(
      conversation(page).locator('[data-slot="bubble"]').first(),
      "border-top-left-radius"
    );

    return { actual: fmt(radius), pass: near(radius, 18) };
  }
);

measure(
  {
    expected:
      "right-aligned, 4 below the bubble; copy 27 x 26, share 31 x 30, edit 27 x 26",
    line: 220,
    part: "Prompt action row",
  },
  CONVERSATION,
  async (page) => {
    const turn = turnAt(page, PROMPT);
    const bubble = await rect(turn.locator('[data-slot="bubble"]'));
    const row = await rect(turn.locator('[data-slot="turn-actions"]'));
    const copy = await rect(turn.getByRole("button", { name: "Copy" }));
    const share = await rect(turn.getByRole("button", { name: "Share" }));
    const edit = await rect(turn.getByRole("button", { name: "Edit" }));
    const below = row.top - bubble.bottom;

    return {
      actual: `${fmt(below)} below, right edges ${fmt(row.right)} and bubble ${fmt(bubble.right)}; copy ${size(copy)}, share ${size(share)}, edit ${size(edit)}`,
      pass:
        near(below, 4) &&
        near(row.right, bubble.right) &&
        near(copy.width, 27) &&
        near(copy.height, 26) &&
        near(share.width, 31) &&
        near(share.height, 30) &&
        near(edit.width, 27) &&
        near(edit.height, 26),
    };
  }
);

measure(
  {
    expected: "about 11",
    line: 227,
    part: "Gap from prompt action row to reply text",
  },
  CONVERSATION,
  async (page) => {
    const row = await rect(
      turnAt(page, PROMPT).locator('[data-slot="turn-actions"]')
    );

    const text = await rect(
      turnAt(page, REPLY).locator('[data-slot="rich-text"]').first()
    );

    const gap = text.top - row.bottom;

    return { actual: fmt(gap), pass: near(gap, 11) };
  }
);

measure(
  {
    expected: "about 49",
    line: 228,
    part: "Gap from prompt bubble bottom to reply text",
  },
  CONVERSATION,
  async (page) => {
    const bubble = await rect(
      turnAt(page, PROMPT).locator('[data-slot="bubble"]')
    );

    const text = await rect(
      turnAt(page, REPLY).locator('[data-slot="rich-text"]').first()
    );

    const gap = text.top - bubble.bottom;

    return { actual: fmt(gap), pass: near(gap, 49) };
  }
);

measure(
  {
    expected:
      "about 6 below the last line; buttons 27 x 26 or 27 x 27 on a 28 pitch; share 31 x 30; more 25 x 25",
    line: 230,
    part: "Reply action row",
  },
  CONVERSATION,
  async (page) => {
    const turn = turnAt(page, REPLY);
    const text = await rect(turn.locator('[data-slot="rich-text"]').last());
    const row = turn.locator('[data-slot="turn-actions"]');
    const below = (await sideOf(row, "top")) - text.bottom;

    const buttons = await row.getByRole("button").evaluateAll((elements) =>
      elements.map((element) => {
        const box = element.getBoundingClientRect();

        return {
          height: box.height,
          label: element.getAttribute("aria-label") ?? "",
          left: box.left,
          width: box.width,
        };
      })
    );

    const pitches = buttons
      .slice(1)
      .map((button, index) => button.left - (buttons[index]?.left ?? 0));

    const ok = buttons.every((button) => {
      if (button.label === "Share") {
        return near(button.width, 31) && near(button.height, 30);
      }

      if (button.label === "More") {
        return near(button.width, 25) && near(button.height, 25);
      }

      return near(button.width, 27) && between(button.height, 26, 27);
    });

    return {
      actual: `${fmt(below)} below; ${buttons.map((button) => `${button.label} ${fmt(button.width)} x ${fmt(button.height)}`).join(", ")}; pitch ${pitches.map(fmt).join(", ")}`,
      pass: near(below, 6) && ok && pitches.every((pitch) => near(pitch, 28)),
    };
  }
);

measure(
  {
    expected: "about 12",
    line: 232,
    part: "Gap from reply action row to the next prompt bubble",
  },
  CONVERSATION,
  async (page) => {
    const row = await rect(
      turnAt(page, REPLY).locator('[data-slot="turn-actions"]')
    );

    const bubble = await rect(
      turnAt(page, NEXT_PROMPT).locator('[data-slot="bubble"]')
    );

    const gap = bubble.top - row.bottom;

    return { actual: fmt(gap), pass: near(gap, 12) };
  }
);

const scrollToTop = async (page: Page) => {
  await conversation(page)
    .locator('[data-slot="message-scroller"]')
    .evaluate((element) => {
      element.scrollTop = 0;
    });
  await page.waitForTimeout(300);
};

const jumpOf = (page: Page) =>
  conversation(page).getByRole("button", {
    name: "Scroll to the newest message",
  });

measure(
  {
    expected: "33 x 32 (AX frame), round, 1 pt outline",
    line: 247,
    part: "Jump-to-latest control",
  },
  CONVERSATION,
  async (page) => {
    await scrollToTop(page);

    const jump = jumpOf(page);
    const box = await rect(jump);
    const radius = await cssNumber(jump, "border-top-left-radius");
    const edge = await hairline(jump);

    return {
      actual: `${size(box)}, radius ${fmt(radius)}, border ${fmt(edge.border)}, ring ${fmt(edge.ring)}`,
      pass:
        near(box.width, 33) &&
        near(box.height, 32) &&
        radius >= box.height / 2 - TOLERANCE &&
        isHairline(edge.width),
    };
  }
);

measure(
  {
    expected: "about 24",
    line: 248,
    part: "Jump-to-latest bottom edge above the composer's top edge",
  },
  CONVERSATION,
  async (page) => {
    await scrollToTop(page);

    const gap =
      (await sideOf(surfaceOf(page, CONVERSATION), "top")) -
      (await sideOf(jumpOf(page), "bottom"));

    return { actual: fmt(gap), pass: near(gap, 24) };
  }
);

const HEADINGS = [
  {
    index: PROMPT,
    line: 258,
    part: "Heading at the start of each prompt turn",
  },
  {
    index: REPLY,
    line: 259,
    part: "Heading at the start of each reply turn",
  },
] as const;

for (const heading of HEADINGS) {
  measure(
    {
      expected: "level 4, visually hidden",
      line: heading.line,
      part: heading.part,
    },
    CONVERSATION,
    async (page) => {
      const found = await conversation(page)
        .locator('[data-slot="turn"]')
        .nth(heading.index)
        .evaluate((turn) => {
          const first = turn.querySelector("h1, h2, h3, h4, h5, h6");

          return first
            ? {
                tag: first.tagName.toLowerCase(),
                text: first.textContent ?? "",
                width: first.getBoundingClientRect().width,
              }
            : null;
        });

      return {
        actual: found
          ? `${found.tag} "${found.text}", ${fmt(found.width)} wide`
          : "no heading",
        pass: found?.tag === "h4" && found.width <= 2,
      };
    }
  );
}

measure(
  {
    expected: "a level-4 heading marking the latest response",
    line: 260,
    part: "Heading before the composer",
  },
  CONVERSATION,
  async (page) => {
    const found = await surfaceOf(page, CONVERSATION).evaluate((surface) => {
      // Every element in document order, so "before the composer" is an
      // index comparison.
      const all = [
        ...(surface
          .closest('[data-slot="conversation-view"]')
          ?.querySelectorAll("*") ?? []),
      ];

      const at = all.indexOf(surface);

      const before = all.findLast(
        (element, index) => index < at && /^H[1-6]$/u.test(element.tagName)
      );

      return before
        ? { tag: before.tagName.toLowerCase(), text: before.textContent ?? "" }
        : null;
    });

    return {
      actual: found ? `${found.tag} "${found.text}"` : "no heading",
      pass: found?.tag === "h4",
    };
  }
);

// --- 3. Buttons and icon buttons -----------------------------------------

measure(
  {
    expected: "27 x 26 (some 27 x 27, share 31 x 30)",
    line: 271,
    part: "Message action buttons",
  },
  CONVERSATION,
  async (page) => {
    const buttons = await conversation(page)
      .locator('[data-slot="turn-actions"]')
      .getByRole("button")
      .evaluateAll((elements) =>
        elements.map((element) => {
          const box = element.getBoundingClientRect();

          return {
            height: box.height,
            label: element.getAttribute("aria-label") ?? "",
            width: box.width,
          };
        })
      );

    const wrong = buttons.filter((button) =>
      button.label === "Share"
        ? !(near(button.width, 31) && near(button.height, 30))
        : !(near(button.width, 27) && between(button.height, 26, 27))
    );

    const distinct = [
      ...new Set(
        buttons.map(
          (button) =>
            `${button.label} ${fmt(button.width)} x ${fmt(button.height)}`
        )
      ),
    ];

    return {
      actual: distinct.join(", "),
      pass: buttons.length > 0 && wrong.length === 0,
    };
  }
);

measure(
  {
    expected: "29 x 28",
    line: 272,
    part: "Composer icon buttons (add, dictate)",
  },
  EMPTY,
  async (page) => {
    const add = await rect(composerParts(example(page, EMPTY.example)).add);
    const dictate = await rect(dictateOf(page, EMPTY));

    return {
      actual: `add ${size(add)}, dictate ${size(dictate)}`,
      pass: [add, dictate].every(
        (box) => near(box.width, 29) && near(box.height, 28)
      ),
    };
  }
);

measure(
  {
    expected: "29 x 28, a filled 28 pt circle",
    line: 273,
    part: "Composer send, voice and stop",
  },
  EMPTY,
  async (page) => {
    const { primary } = composerParts(example(page, EMPTY.example));
    const box = await rect(primary);
    const radius = await cssNumber(primary, "border-top-left-radius");

    return {
      actual: `${size(box)}, radius ${fmt(radius)}`,
      pass: near(box.width, 29) && near(box.height, 28) && radius >= 13,
    };
  }
);

notMeasurable(
  { expected: "28 x 28", line: 274, part: "Title-bar and header icon buttons" },
  "The title bar tabs example shows only the tab strip; the back, forward, sidebar and view buttons are not in any example."
);

// The demo app's sidebar header: its notifications button and the chat
// sidebar's search button.
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

notMeasurable(
  {
    expected: "36 x 36, selected radius about 8",
    line: 276,
    part: "Icon rail buttons",
  },
  "No example renders the icon rail."
);

measure(
  {
    expected: "20 x 20 or 20 x 21",
    line: 277,
    part: "Sidebar row trailing buttons (more, pin)",
  },
  ROWS,
  async (page) => {
    const row = example(page, ROWS.example).locator("li").first();

    await row.hover();

    const buttons = row
      .getByRole("button")
      .filter({ hasNot: page.locator("span span") });

    const boxes = await buttons.evaluateAll((elements) =>
      elements
        .filter((element) => element.getAttribute("aria-label") !== null)
        .map((element) => ({
          height: element.getBoundingClientRect().height,
          width: element.getBoundingClientRect().width,
        }))
    );

    return {
      actual: boxes
        .map((box) => `${fmt(box.width)} x ${fmt(box.height)}`)
        .join(", "),
      pass:
        boxes.length > 0 &&
        boxes.every(
          (box) => near(box.width, 20) && between(box.height, 20, 21)
        ),
    };
  }
);

measure(
  { expected: "32 x 32", line: 278, part: "Jump-to-latest button size" },
  CONVERSATION,
  async (page) => {
    await scrollToTop(page);

    const box = await rect(jumpOf(page));

    return {
      actual: size(box),
      pass: near(box.width, 32) && near(box.height, 32),
    };
  }
);

// The ring a keyboard user sees on a message action button.
const ringOn = async (page: Page) => {
  const button = conversation(page)
    .locator('[data-slot="turn-actions"]')
    .getByRole("button", { name: "Copy" })
    .first();

  await page.keyboard.press("Tab");
  await button.focus();

  return button.evaluate((element) => {
    const style = getComputedStyle(element);
    const box = element.getBoundingClientRect();

    return {
      focusVisible: element.matches(":focus-visible"),
      offset: Number(style.outlineOffset.replace("px", "")),
      style: style.outlineStyle,
      width: Number(style.outlineWidth.replace("px", "")),
      x: box.width,
    };
  });
};

measure(
  {
    expected:
      "2 pt solid, just outside with no gap, spanning about 31 to 32 on a 27 to 29 button",
    line: 288,
    part: "Focus ring on a message action",
  },
  CONVERSATION,
  async (page) => {
    const ring = await ringOn(page);
    const span = ring.x + 2 * (ring.width + ring.offset);

    return {
      actual: `focus-visible ${ring.focusVisible}, ${fmt(ring.width)} ${ring.style}, offset ${fmt(ring.offset)}, span ${fmt(span)} on a ${fmt(ring.x)} button`,
      pass:
        ring.focusVisible &&
        near(ring.width, 2) &&
        ring.style === "solid" &&
        between(ring.offset, -1, 0) &&
        between(span, 31, 32),
    };
  }
);

measure(
  {
    expected: "ring outer edge 1 outside the button (631 for a button at 632)",
    line: 292,
    part: "Focus ring position",
  },
  CONVERSATION,
  async (page) => {
    const ring = await ringOn(page);
    const outside = ring.width + ring.offset;

    return {
      actual: `outer edge ${fmt(outside)} outside`,
      pass: near(outside, 1),
    };
  }
);

// --- 4. Menus > A. Add menu ----------------------------------------------

const openAdd = async (page: Page) => {
  const { add, listbox } = composerParts(example(page, DOCKED.example));

  await add.click();
  await listbox.waitFor();

  return listbox;
};

measure(
  {
    expected: "directly above, same width as the composer (737), 4 gap",
    line: 302,
    part: "Add menu placement",
  },
  DOCKED,
  async (page) => {
    const menu = await rect(await openAdd(page));
    const surface = await rect(surfaceOf(page, DOCKED));
    const gap = surface.top - menu.bottom;

    return {
      actual: `width ${fmt(menu.width)} (composer ${fmt(surface.width)}), gap ${fmt(gap)} ${menu.bottom <= surface.top ? "above" : "not above"}`,
      pass:
        near(menu.width, surface.width) &&
        near(menu.width, 737) &&
        near(gap, 4),
    };
  }
);

measure(
  {
    expected: "1 pt border, padding 5, radius about 18",
    line: 303,
    part: "Add menu panel",
  },
  DOCKED,
  async (page) => {
    const listbox = await openAdd(page);
    const edge = await hairline(listbox);

    const padding =
      (await sideOf(listbox.getByRole("option").first(), "left")) -
      (await sideOf(listbox, "left"));

    const radius = await cssNumber(listbox, "border-top-left-radius");

    return {
      actual: `border ${fmt(edge.border)}, ring ${fmt(edge.ring)}, padding ${fmt(padding)}, radius ${fmt(radius)}`,
      pass: isHairline(edge.width) && near(padding, 5) && near(radius, 18),
    };
  }
);

measure(
  {
    expected: "up to 320, then it scrolls",
    line: 304,
    part: "Add menu height",
  },
  DOCKED,
  async (page) => {
    const listbox = await openAdd(page);
    const maxHeight = await css(listbox, "max-height");
    const overflow = await css(listbox, "overflow-y");

    return {
      actual: `max-height ${maxHeight}, overflow-y ${overflow}`,
      pass:
        near(pixels(maxHeight), 320) && ["auto", "scroll"].includes(overflow),
    };
  }
);

measure(
  {
    expected: "full width less padding (727), 28.6 pitch",
    line: 305,
    part: "Add menu item",
  },
  DOCKED,
  async (page) => {
    const listbox = await openAdd(page);
    const options = listbox.getByRole("option");
    const first = await rect(options.nth(0));
    const second = await rect(options.nth(1));
    const pitch = second.top - first.top;

    return {
      actual: `${fmt(first.width)} wide, pitch ${fmt(pitch)}`,
      pass: near(first.width, 727) && near(pitch, 28.6),
    };
  }
);

measure(
  {
    expected: "pill fill, 29 tall, fully rounded",
    line: 306,
    part: "Add menu highlight",
  },
  DOCKED,
  async (page) => {
    const listbox = await openAdd(page);

    const highlighted = listbox.locator(
      '[role="option"][aria-selected="true"]'
    );

    const box = await rect(highlighted);
    const radius = await cssNumber(highlighted, "border-top-left-radius");

    return {
      actual: `${fmt(box.height)} tall, radius ${fmt(radius)}`,
      pass: near(box.height, 29) && radius >= box.height / 2 - TOLERANCE,
    };
  }
);

// --- 4. Menus > B. Model picker ------------------------------------------

const openModel = async (page: Page) => {
  const { model } = composerParts(example(page, DOCKED.example));

  await model.click();

  const menu = page.getByRole("menu").last();

  await menu.waitFor();

  return { menu, trigger: model };
};

measure(
  {
    expected: "above the trigger, right-aligned with it, about 4 gap",
    line: 341,
    part: "Model picker placement",
  },
  DOCKED,
  async (page) => {
    const { menu, trigger } = await openModel(page);
    const panel = await rect(menu);
    const button = await rect(trigger);
    const gap = button.top - panel.bottom;

    return {
      actual: `${panel.bottom <= button.top ? "above" : "not above"}, gap ${fmt(gap)}, right edges ${fmt(panel.right)} and ${fmt(button.right)}`,
      pass: near(gap, 4) && near(panel.right, button.right),
    };
  }
);

measure(
  {
    expected: "256 x 86 outside, padding 4, radius about 14",
    line: 342,
    part: "Model picker panel",
  },
  DOCKED,
  async (page) => {
    const { menu } = await openModel(page);
    const box = await rect(menu);
    const padding = await cssNumber(menu, "padding-top");
    const radius = await cssNumber(menu, "border-top-left-radius");

    return {
      actual: `${size(box)}, padding ${fmt(padding)}, radius ${fmt(radius)}`,
      pass:
        near(box.width, 256) &&
        near(box.height, 86) &&
        near(padding, 4) &&
        near(radius, 14),
    };
  }
);

measure(
  {
    expected: "a 36 tall header row, then a 32 tall slider row",
    line: 343,
    part: "Model picker rows",
  },
  DOCKED,
  async (page) => {
    const { menu } = await openModel(page);
    const rows = menu.locator('[role^="menuitem"]');
    const header = await rect(rows.nth(0));
    const slider = await rect(rows.nth(1));

    return {
      actual: `${fmt(header.height)} then ${fmt(slider.height)}`,
      pass: near(header.height, 36) && near(slider.height, 32),
    };
  }
);

measure(
  {
    expected:
      "replaces the panel in place; items 29 to 30 tall; 254 wide inside the border",
    line: 344,
    part: "Model picker submenu",
  },
  DOCKED,
  async (page) => {
    const { menu } = await openModel(page);
    const before = await rect(menu);

    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await settle(page);

    const menus = await page.getByRole("menu").count();
    const panel = page.getByRole("menu").last();
    const after = await rect(panel);
    const border = await cssNumber(panel, "border-left-width");

    const heights = await panel
      .locator('[role^="menuitem"]')
      .evaluateAll((items) =>
        items.map((item) => item.getBoundingClientRect().height)
      );

    const inner = after.width - 2 * border;

    return {
      actual: `${menus} menu open, left ${fmt(before.left)} then ${fmt(after.left)}, inner width ${fmt(inner)}, items ${heights.map(fmt).join(", ")}, panel ${fmt(after.height)} tall for ${heights.length} items`,
      pass:
        menus === 1 &&
        near(after.left, before.left) &&
        near(inner, 254) &&
        heights.every((height) => between(height, 29, 30)),
    };
  }
);

// --- 4. Menus > C. Row more menu -----------------------------------------

const openRowMenu = async (page: Page) => {
  const trigger = example(page, MENU.example);

  await trigger.click();

  // By name, so it stays the parent menu once a submenu opens.
  const menu = page.getByRole("menu", { name: "More actions" });

  await menu.waitFor();

  return { menu, trigger };
};

measure(
  {
    expected: "above the trigger, left edge 2 right of the trigger's, 4 gap",
    line: 365,
    part: "Row more menu placement",
  },
  MENU,
  async (page) => {
    const { menu, trigger } = await openRowMenu(page);
    const panel = await rect(menu);
    const button = await rect(trigger);
    const above = panel.bottom <= button.top;
    const gap = above ? button.top - panel.bottom : panel.top - button.bottom;
    const shift = panel.left - button.left;

    return {
      actual: `${above ? "above" : "below"}, gap ${fmt(gap)}, left edge ${fmt(shift)} right of the trigger's`,
      pass: above && near(gap, 4) && near(shift, 2),
    };
  }
);

measure(
  {
    expected: "193 wide, items inset 4",
    line: 366,
    part: "Row more menu panel",
  },
  MENU,
  async (page) => {
    const { menu } = await openRowMenu(page);
    const panel = await rect(menu);

    const inset =
      (await sideOf(menu.locator('[role="menuitem"]').first(), "left")) -
      panel.left;

    return {
      actual: `${fmt(panel.width)} wide, items inset ${fmt(inset)}`,
      pass: near(panel.width, 193) && near(inset, 4),
    };
  }
);

measure(
  { expected: "185 x 29 or 30", line: 367, part: "Row more menu items" },
  MENU,
  async (page) => {
    const { menu } = await openRowMenu(page);

    const items = await menu
      .locator('[role="menuitem"], [data-slot="menu-info"]')
      .evaluateAll((elements) =>
        elements.map((element) => ({
          height: element.getBoundingClientRect().height,
          text: element.textContent?.trim() ?? "",
          width: element.getBoundingClientRect().width,
        }))
      );

    return {
      actual: items
        .map((item) => `${item.text} ${fmt(item.width)} x ${fmt(item.height)}`)
        .join(", "),
      pass: items.every(
        (item) => near(item.width, 185) && between(item.height, 29, 30)
      ),
    };
  }
);

notMeasurable(
  {
    expected: "none seen in this menu",
    line: 368,
    part: "Row more menu separators",
  },
  "Separators are content the app passes in. The menu demo adds one on purpose to show the MenuSeparator part."
);

measure(
  {
    expected:
      "opens right, left edge 5 right of the parent panel, top 3 above the parent item, 180 wide, items 172 x 29 or 30",
    line: 369,
    part: "Row more submenu",
  },
  MENU,
  async (page) => {
    const { menu } = await openRowMenu(page);
    const parentItem = menu.getByRole("menuitem", { name: "Redo with" });

    await parentItem.focus();
    await page.keyboard.press("ArrowRight");
    await settle(page);

    const parent = await rect(menu);
    const item = await rect(parentItem);
    const submenu = page.getByRole("menu", { name: "Redo with" });
    const panel = await rect(submenu);

    const items = await boxesOf(submenu.locator('[role^="menuitem"]'));

    const right = panel.left - parent.right;
    const above = item.top - panel.top;

    return {
      actual: `left edge ${fmt(right)} right of the parent, top ${fmt(above)} above the parent item, ${fmt(panel.width)} wide, items ${items.map((entry) => `${fmt(entry.width)} x ${fmt(entry.height)}`).join(", ")}`,
      pass:
        near(right, 5) &&
        near(above, 3) &&
        near(panel.width, 180) &&
        items.every(
          (entry) => near(entry.width, 172) && between(entry.height, 29, 30)
        ),
    };
  }
);

// --- 5. Tooltips ---------------------------------------------------------

const openTip = async (page: Page) => {
  const trigger = example(page, TIP.example);

  await trigger.hover();
  await page.waitForTimeout(TOOLTIP_MS);

  return { tip: page.locator('[data-slot="tooltip"]').first(), trigger };
};

measure(
  { expected: "centered on the trigger", line: 400, part: "Tooltip placement" },
  TIP,
  async (page) => {
    const { tip, trigger } = await openTip(page);
    const popup = await rect(tip);
    const button = await rect(trigger);

    const offset =
      (popup.left + popup.right) / 2 - (button.left + button.right) / 2;

    return {
      actual: `center ${fmt(offset)} from the trigger's center, ${popup.bottom <= button.top ? "above" : "below"}`,
      pass: near(offset, 0),
    };
  }
);

measure(
  {
    expected: "2 between the trigger edge and the tooltip edge",
    line: 401,
    part: "Tooltip offset",
  },
  TIP,
  async (page) => {
    const { tip, trigger } = await openTip(page);
    const popup = await rect(tip);
    const button = await rect(trigger);

    const gap =
      popup.bottom <= button.top
        ? button.top - popup.bottom
        : popup.top - button.bottom;

    return { actual: fmt(gap), pass: near(gap, 2) };
  }
);

measure(
  {
    expected: "30, including a 1 pt border",
    line: 402,
    part: "Tooltip height",
  },
  TIP,
  async (page) => {
    const { tip } = await openTip(page);
    const box = await rect(tip);
    const edge = await hairline(tip);

    return {
      actual: `${fmt(box.height)}, border ${fmt(edge.border)}`,
      pass: near(box.height, 30) && near(edge.width, 1),
    };
  }
);

measure(
  {
    expected: "about 12 to 14 from the border to the label ink",
    line: 403,
    part: "Tooltip horizontal padding",
  },
  TIP,
  async (page) => {
    const { tip } = await openTip(page);

    const padding = await tip.evaluate((element) => {
      const range = document.createRange();

      range.selectNodeContents(element);

      return (
        range.getBoundingClientRect().left -
        element.getBoundingClientRect().left -
        Number(getComputedStyle(element).borderLeftWidth.replace("px", ""))
      );
    });

    return { actual: fmt(padding), pass: between(padding, 12, 14) };
  }
);

measure(
  { expected: "about 10 to 12", line: 404, part: "Tooltip radius" },
  TIP,
  async (page) => {
    const { tip } = await openTip(page);
    const radius = await cssNumber(tip, "border-top-left-radius");

    return { actual: fmt(radius), pass: between(radius, 10, 12) };
  }
);

measure(
  { expected: "about 13 pt, single line", line: 405, part: "Tooltip type" },
  TIP,
  async (page) => {
    const { tip } = await openTip(page);
    const fontSize = await cssNumber(tip, "font-size");
    const lineHeight = await cssNumber(tip, "line-height");
    const box = await rect(tip);
    const oneLine = box.height < 2 * lineHeight;

    return {
      actual: `${fmt(fontSize)} pt, ${oneLine ? "single line" : "wraps"}`,
      pass: near(fontSize, 13) && oneLine,
    };
  }
);

// --- 6. App shell --------------------------------------------------------

measure(
  {
    expected: "231 x 32, radius about 6, 1 pt border",
    line: 427,
    part: "Title bar tab",
  },
  TABS,
  async (page) => {
    const tab = example(page, TABS.example).getByRole("tab").first();
    const box = await rect(tab);
    const radius = await cssNumber(tab, "border-top-left-radius");
    const edge = await hairline(tab);

    return {
      actual: `${size(box)}, radius ${fmt(radius)}, border ${fmt(edge.width)}`,
      pass:
        near(box.width, 231) &&
        near(box.height, 32) &&
        near(radius, 6) &&
        near(edge.width, 1),
    };
  }
);

// WCAG 2.5.8 asks for a target of at least 24 by 24. The open tab shows
// its close button.
measure(
  {
    expected: "a close button at least 24 x 24 inside the tab",
    line: 427,
    part: "Title bar tab close button",
  },
  TABS,
  async (page) => {
    const item = example(page, TABS.example)
      .locator('[data-slot="tab-item"]')
      .first();

    const tab = await rect(item.getByRole("tab"));
    const close = await rect(item.locator('[data-slot="tab-close"]'));

    return {
      actual: `${size(close)}, ${fmt(tab.right - close.right)} from the tab's end`,
      pass:
        close.width >= 24 &&
        close.height >= 24 &&
        close.left >= tab.left &&
        close.right <= tab.right + TOLERANCE,
    };
  }
);

measure(
  {
    expected:
      "30 tall on a 31 pitch, 261 to 272 wide, 8 text inset, radius about 8; on hover two 20 pt buttons 8 apart",
    line: 434,
    part: "Chat row",
  },
  ROWS,
  async (page) => {
    const list = example(page, ROWS.example);
    const first = list.locator("li").nth(0);
    const row = first.getByRole("button").first();
    const box = await rect(row);

    const pitch =
      (await sideOf(list.locator("li").nth(1), "top")) -
      (await sideOf(first, "top"));

    const inset =
      (await sideOf(row.locator("span").first(), "left")) - box.left;

    const radius = await cssNumber(row, "border-top-left-radius");

    await first.hover();

    const trailing = await boxesOf(first.locator("button[aria-label]"));

    const apart =
      trailing.length === 2
        ? (trailing[1]?.left ?? 0) - (trailing[0]?.right ?? 0)
        : Number.NaN;

    return {
      actual: `${fmt(box.height)} tall, pitch ${fmt(pitch)}, ${fmt(box.width)} wide, inset ${fmt(inset)}, radius ${fmt(radius)}, ${trailing.length} trailing buttons ${trailing.map((entry) => `${fmt(entry.width)} x ${fmt(entry.height)}`).join(" and ")} ${fmt(apart)} apart`,
      pass:
        near(box.height, 30) &&
        near(pitch, 31) &&
        between(box.width, 261, 272) &&
        near(inset, 8) &&
        near(radius, 8) &&
        trailing.length === 2 &&
        trailing.every((entry) => near(entry.width, 20)) &&
        near(apart, 8),
    };
  }
);

for (const variant of ["pill", "segmented", "underline"]) {
  const where: Where = {
    example: `mode-toggle--${variant}`,
    url: "/app-shell",
  };

  measure(
    {
      expected: "two 113 x 36 toggle buttons",
      line: 435,
      part: `Mode switch, ${variant} variant`,
    },
    where,
    async (page) => {
      const boxes = await boxesOf(
        example(page, where.example).getByRole("button")
      );

      return {
        actual: boxes
          .map((box) => `${fmt(box.width)} x ${fmt(box.height)}`)
          .join(", "),
        pass:
          boxes.length === 2 &&
          boxes.every((box) => near(box.width, 113) && near(box.height, 36)),
      };
    }
  );
}

// The title bar and the rail render together only in the playground's
// demo app, which runs the shipped app-shell parts.
const APP: Where = { example: "app-shell", url: `${PLAYGROUND_URL}/` };

measure(
  {
    expected:
      "44 tall, back and forward 28 x 28 6 apart, sidebar toggle 28 x 28",
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

    return {
      actual: `${fmt(box.height)} tall, back ${size(back)} and forward ${size(forward)} ${fmt(apart)} apart, sidebar toggle ${size(toggle)}`,
      pass:
        near(box.height, 44) &&
        [back, forward, toggle].every(
          (button) => near(button.width, 28) && near(button.height, 28)
        ) &&
        near(apart, 6),
    };
  }
);

measure(
  {
    expected: "52 wide, 36 x 36 buttons, 8 inset, 44 pitch",
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

    return {
      actual: `${fmt(box.width)} wide, buttons ${[...new Set(buttons.map(size))].join(", ")}, inset ${fmt(inset)}, pitch ${fmt(pitch)}`,
      pass:
        near(box.width, 52) &&
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

// The chat sidebar in the demo app, which runs the shipped chat-sidebar
// parts with the demo's own workspace menu and notifications in its header.
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
    "This part of the playground app shell is not a registry item and no docs example renders it."
  );
}
