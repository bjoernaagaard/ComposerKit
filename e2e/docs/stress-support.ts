// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

// Shared pieces for the stress spec: what counts as broken on screen, the
// side-by-side light and dark image, and opening a harness page.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { Page } from "@playwright/test";
import { PNG } from "pngjs";

import { ARTIFACTS, PLAYGROUND_URL } from "./support";
import type { Scheme } from "./support";

export const STRESS = path.join(ARTIFACTS, "stress");

export const WIDTHS = [320, 1440] as const;

export type Width = (typeof WIDTHS)[number];

// Both exactly 200 characters, the same as the harness uses: a long but
// real chat title, and a shared file link with nowhere to break.
export const LABELS = {
  spaces:
    "Summarize the quarterly infrastructure review from the Kraków and Wrocław offices, including the database migration timeline, the new on-call rotation and every open question Aleksandra raised in June",
  word: "https://northwind-industries-holdings.example.com/shared/aleksandra.wisniewska-kowalczyk/quarterly-infrastructure-review/2026-Q3/database-migration-timeline-and-on-call-rotation-final-revisions-12.pdf",
} as const;

export type LabelKind = keyof typeof LABELS;

export interface Flag {
  kind:
    | "page scrolls sideways"
    | "wider than the viewport"
    | "clipped text"
    | "overlapping text"
    | "control out of view"
    | "squeezed placeholder";
  detail: string;
}

// Looks at everything inside the roots that match the selector and returns
// what a reader would see as broken. Text cut off by an ellipsis or by the
// sidebar's scrolling title is a design choice, not a break, so it is left
// out; text cut off with no sign of more is a break. Content inside a box
// that scrolls sideways, such as a code block or the tab strip, can be
// scrolled into view, so only the scrolling box itself has to fit.
// The rows the stress spec writes to results/, read back by the report.
export interface RenderRow {
  id: string;
  page: string;
  design: string;
  width: Width;
  image: string;
  flags: Flag[];
}

// Escape returns focus to the trigger, except from a list that a text
// field drives, where focus stayed in the field the whole time and the
// spec keeps it there.
export interface EscapeRow {
  stop: string;
  kind: "menu" | "tooltip";
  opened: boolean;
  closed: boolean;
  focusAfter: string;
  expectedFocus: string;
  focusAsExpected: boolean;
}

export interface KeyboardStressRow {
  page: string;
  stops: string[];
  end: string;
  trap: string | null;
  noIndicator: string[];
  unreachable: string[];
  reverseMatches: boolean;
  reverseDifference: string;
  escapes: EscapeRow[];
  cutRings: string[];
}

// The demo app in one design, width and composer mode.
export interface AppRow {
  design: string;
  width: Width;
  mode: string;
  image: string | null;
  flags: Flag[];
  errors: string[];
}

export interface PasteRow {
  id: string;
  page: string;
  label: LabelKind;
  pastedLength: number;
  afterSubmit: string;
  turnsBefore: number;
  turnsAfter: number;
  pastedImage: string;
  submittedImage: string;
  flagsPasted: Flag[];
  flagsSubmitted: Flag[];
}

export interface LabelRow {
  part: string;
  data: string;
  width: Width;
  image: string;
  flags: Flag[];
  errors: string[];
}

export interface EmptyRow {
  part: string;
  attack: string;
  happened: string;
  broken: boolean;
  image: string;
}

// page.evaluate sends this one function to the browser, so its helpers
// have to live inside it.
/* oxlint-disable unicorn/consistent-function-scoping, complexity */
export const inspect = (page: Page, selector: string): Promise<Flag[]> =>
  page.evaluate((rootSelector) => {
    const flags: Flag[] = [];
    const roots = [...document.querySelectorAll(rootSelector)];

    const describe = (node: Element) => {
      const label =
        node.getAttribute("aria-label") ?? node.textContent?.trim() ?? "";

      const slot = node instanceof HTMLElement ? node.dataset.slot : undefined;

      return `${node.tagName.toLowerCase()}${slot ? `[${slot}]` : ""} "${label.slice(0, 48)}"`;
    };

    const shown = (node: Element) => {
      const box = node.getBoundingClientRect();
      const style = getComputedStyle(node);

      return (
        box.width > 2 &&
        box.height > 2 &&
        style.visibility !== "hidden" &&
        style.opacity !== "0" &&
        node.closest('[aria-hidden="true"], [inert], [hidden]') === null
      );
    };

    const clipping = (node: Element) => {
      const style = getComputedStyle(node);

      return style.overflowX === "hidden" || style.overflowX === "clip";
    };

    const scrolls = (node: Element) => {
      const style = getComputedStyle(node);

      return style.overflowX === "auto" || style.overflowX === "scroll";
    };

    // The part of a box a reader can see: the box cut to the text's own
    // element and every ancestor that hides or scrolls its overflow.
    const seen = (node: Element, box: DOMRect) => {
      let { left, right, top, bottom } = box;

      for (
        let parent: Element | null = node;
        parent && parent !== document.body;
        parent = parent.parentElement
      ) {
        if (getComputedStyle(parent).overflowX !== "visible") {
          const edge = parent.getBoundingClientRect();

          left = Math.max(left, edge.left);
          right = Math.min(right, edge.right);
          top = Math.max(top, edge.top);
          bottom = Math.min(bottom, edge.bottom);
        }
      }

      return { bottom, left, right, top };
    };

    // An ellipsis only shows on a block box: text-overflow does nothing on
    // a flex or grid container, so a truncate class there cuts text with
    // no sign of more.
    const ellipsis = (node: Element) => {
      const style = getComputedStyle(node);

      return (
        style.textOverflow === "ellipsis" &&
        !style.display.includes("flex") &&
        !style.display.includes("grid")
      );
    };

    const allowedCut = (node: Element) =>
      node.closest('[data-overflowing="true"]') !== null ||
      ellipsis(node) ||
      getComputedStyle(node).webkitLineClamp !== "none";

    if (document.documentElement.scrollWidth > window.innerWidth + 1) {
      flags.push({
        detail: `page is ${document.documentElement.scrollWidth} wide in a ${window.innerWidth} viewport`,
        kind: "page scrolls sideways",
      });
    }

    const textRects: {
      owner: Element;
      box: DOMRect;
      visible: { left: number; right: number; top: number; bottom: number };
    }[] = [];

    for (const root of roots) {
      const rootBox = root.getBoundingClientRect();

      if (rootBox.right > window.innerWidth + 1) {
        flags.push({
          detail: `${describe(root)} ends at ${Math.round(rootBox.right)} in a ${window.innerWidth} viewport`,
          kind: "wider than the viewport",
        });
      }

      for (const node of [root, ...root.querySelectorAll("*")]) {
        if (!shown(node)) {
          continue;
        }

        for (const child of node.childNodes) {
          if (child.nodeType !== Node.TEXT_NODE || !child.textContent?.trim()) {
            continue;
          }

          const range = document.createRange();

          range.selectNodeContents(child);

          for (const box of range.getClientRects()) {
            if (box.width > 1 && box.height > 1) {
              textRects.push({ box, owner: node, visible: seen(node, box) });
            }
          }
        }
      }

      for (const control of root.querySelectorAll(
        'button, a[href], input, textarea, select, [role="tab"], [role^="menuitem"], [role="option"]'
      )) {
        if (!shown(control)) {
          continue;
        }

        const scroller = (() => {
          for (
            let parent = control.parentElement;
            parent && parent !== document.body;
            parent = parent.parentElement
          ) {
            if (scrolls(parent)) {
              return parent;
            }
          }

          return null;
        })();

        const box = (scroller ?? control).getBoundingClientRect();

        if (box.right > window.innerWidth + 1 || box.left < -1) {
          flags.push({
            detail: `${describe(control)} spans ${Math.round(box.left)} to ${Math.round(box.right)} in a ${window.innerWidth} viewport`,
            kind: "control out of view",
          });
          continue;
        }

        if (scroller) {
          continue;
        }

        for (
          let parent = control.parentElement;
          parent && parent !== document.body;
          parent = parent.parentElement
        ) {
          const style = getComputedStyle(parent);
          const parentBox = parent.getBoundingClientRect();

          const cuts =
            style.overflowX !== "visible" &&
            (box.right > parentBox.right + 1 || box.left < parentBox.left - 1);

          if (cuts) {
            flags.push({
              detail: `${describe(control)} spans ${Math.round(box.left)} to ${Math.round(box.right)}, past ${describe(parent)} at ${Math.round(parentBox.left)} to ${Math.round(parentBox.right)} (overflow ${style.overflowX})`,
              kind: "control out of view",
            });
            break;
          }
        }
      }
    }

    for (const { owner, box } of textRects) {
      for (
        let parent: Element | null = owner;
        parent && parent !== document.body;
        parent = parent.parentElement
      ) {
        if (scrolls(parent)) {
          break;
        }

        if (!clipping(parent)) {
          continue;
        }

        const parentBox = parent.getBoundingClientRect();

        const cut =
          box.right > parentBox.right + 1 || box.left < parentBox.left - 1;

        if (cut && !allowedCut(owner) && !allowedCut(parent)) {
          flags.push({
            detail: `${describe(owner)} runs to ${Math.round(box.right)}, cut at ${Math.round(parentBox.right)} by ${describe(parent)}`,
            kind: "clipped text",
          });
        }

        break;
      }
    }

    // An empty field shows its placeholder on one line. One that is too
    // narrow for it wraps it, often a few letters to a line.
    const canvas = document.createElement("canvas").getContext("2d");

    for (const root of roots) {
      for (const field of root.querySelectorAll<
        HTMLTextAreaElement | HTMLInputElement
      >("textarea[placeholder], input[placeholder]")) {
        if (!(canvas && shown(field)) || field.value !== "") {
          continue;
        }

        const style = getComputedStyle(field);

        canvas.font = style.font;

        const needs = canvas.measureText(field.placeholder).width;

        const room =
          field.clientWidth -
          Number(style.paddingLeft.replace("px", "")) -
          Number(style.paddingRight.replace("px", ""));

        if (needs > room + 1) {
          flags.push({
            detail: `${describe(field)} needs ${Math.round(needs)} px for "${field.placeholder}" and has ${Math.round(room)}`,
            kind: "squeezed placeholder",
          });
        }
      }
    }

    const limit = Math.min(textRects.length, 600);

    for (let first = 0; first < limit; first += 1) {
      for (let second = first + 1; second < limit; second += 1) {
        const one = textRects[first];
        const two = textRects[second];

        if (
          !one ||
          !two ||
          one.owner === two.owner ||
          one.owner.contains(two.owner) ||
          two.owner.contains(one.owner)
        ) {
          continue;
        }

        const width =
          Math.min(one.visible.right, two.visible.right) -
          Math.max(one.visible.left, two.visible.left);

        const height =
          Math.min(one.visible.bottom, two.visible.bottom) -
          Math.max(one.visible.top, two.visible.top);

        if (width > 2 && height > 2) {
          flags.push({
            detail: `${describe(one.owner)} and ${describe(two.owner)} overlap by ${Math.round(width)} x ${Math.round(height)}`,
            kind: "overlapping text",
          });
        }
      }
    }

    // One row per distinct finding.
    return [
      ...new Map(
        flags.map((flag) => [`${flag.kind}${flag.detail}`, flag])
      ).values(),
    ];
  }, selector);
/* oxlint-enable unicorn/consistent-function-scoping, complexity */

const GAP = 16;
const GAP_SHADE = 128;
const OPAQUE = 255;

// Light on the left, dark on the right, on a mid-gray backing.
export const sideBySide = (light: Buffer, dark: Buffer, file: string) => {
  const left = PNG.sync.read(light);
  const right = PNG.sync.read(dark);
  const width = left.width + GAP + right.width;
  const height = Math.max(left.height, right.height);
  const canvas = new PNG({ height, width });

  for (let offset = 0; offset < canvas.data.length; offset += 4) {
    canvas.data[offset] = GAP_SHADE;
    canvas.data[offset + 1] = GAP_SHADE;
    canvas.data[offset + 2] = GAP_SHADE;
    canvas.data[offset + 3] = OPAQUE;
  }

  PNG.bitblt(left, canvas, 0, 0, left.width, left.height, 0, 0);
  PNG.bitblt(
    right,
    canvas,
    0,
    0,
    right.width,
    right.height,
    left.width + GAP,
    0
  );
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, PNG.sync.write(canvas));
};

// Opens the playground's stress harness. The playground keeps its color
// scheme in localStorage under composerkit-scheme.
export const openHarness = async (
  page: Page,
  query: string,
  scheme: Scheme
) => {
  await page.emulateMedia({ colorScheme: scheme });
  await page.addInitScript((value) => {
    localStorage.setItem("composerkit-scheme", value);
  }, scheme);
  await page.goto(`${PLAYGROUND_URL}/states/stress?${query}&bare`);
  await page.locator("[data-stress-stage]").waitFor();
  await page.waitForLoadState("networkidle");
};

// Opens the demo app, the playground's home page, in a design and color
// scheme. The design is kept in localStorage under composerkit-design.
export const openApp = async (page: Page, design: string, scheme: Scheme) => {
  await page.emulateMedia({ colorScheme: scheme });
  await page.addInitScript(
    ({ chosen, colors }) => {
      localStorage.setItem("composerkit-design", chosen);
      localStorage.setItem("composerkit-scheme", colors);
    },
    { chosen: design, colors: scheme }
  );
  await page.goto(`${PLAYGROUND_URL}/`);
  await page.locator('[data-slot="composer"]').first().waitFor();
  await page.waitForLoadState("networkidle");
};

export const relative = (file: string) => path.relative(ARTIFACTS, file);
