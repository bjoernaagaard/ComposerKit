// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { KeyboardEvent, RefObject } from "react";

import {
  filterAddItems,
  NO_MATCH,
} from "@/components/composer/composer-add-menu";
import type { ComposerAddItem } from "@/components/composer/composer-add-menu";
import type { ComposerAction } from "@/components/composer/machine";
import { themeMilliseconds, themePixels } from "@/components/ui/theme-value";

// From the token file, used on the server and before the theme has loaded.
const FALLBACK = {
  addGap: 4,
  inset: 8,
  lineHeight: 20,
  stopSettleMs: 500,
};

const TEXT_INPUT_TYPES = new Set([
  "email",
  "number",
  "password",
  "search",
  "tel",
  "text",
  "url",
]);

// Elements that take typed letters themselves.
const takesText = (target: EventTarget | null): boolean => {
  if (
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  ) {
    return true;
  }

  if (target instanceof HTMLInputElement) {
    return TEXT_INPUT_TYPES.has(target.type);
  }

  return target instanceof HTMLElement && target.isContentEditable;
};

// An open menu keeps typed letters for its typeahead, and a modal dialog
// keeps everything, so nothing leaks to the page behind them.
const popupOwnsKeys = (): boolean =>
  document.querySelector(
    '[role="menu"], [role="dialog"][aria-modal="true"], [role="alertdialog"], dialog:modal'
  ) !== null;

const hasModifier = (event: globalThis.KeyboardEvent): boolean =>
  event.ctrlKey || event.metaKey || event.altKey || event.isComposing;

// Whether a key pressed outside the field should be typed into it.
const typesIntoField = (
  event: globalThis.KeyboardEvent,
  field: HTMLTextAreaElement
): boolean => {
  const printable = event.key.length === 1;
  // Space on a button or link presses it.
  const pressesControl = event.key === " " && event.target !== document.body;
  const fieldUnavailable = field.readOnly || field.closest("[inert]") !== null;

  return (
    printable &&
    !pressesControl &&
    !fieldUnavailable &&
    !event.defaultPrevented &&
    !hasModifier(event) &&
    !takesText(event.target) &&
    !popupOwnsKeys()
  );
};

// With `enabled`, a letter typed anywhere on the page lands in the field:
// focus moves there and the letter is added to the draft. A text field,
// an open menu and a modal dialog keep their keys.
export const useTypeToFocus = (
  enabled: boolean,
  field: RefObject<HTMLTextAreaElement | null>,
  dispatch: (action: ComposerAction) => void
) => {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const onKey = (event: globalThis.KeyboardEvent) => {
      const element = field.current;

      if (!(element && typesIntoField(event, element))) {
        return;
      }

      event.preventDefault();
      dispatch({ draft: `${element.value}${event.key}`, type: "draftChanged" });
      element.focus();
      requestAnimationFrame(() => {
        const end = element.value.length;
        element.setSelectionRange(end, end);
      });
    };

    document.addEventListener("keydown", onKey);

    return () => document.removeEventListener("keydown", onKey);
  }, [dispatch, enabled, field]);
};

// Whether the last input before a focus change was a key rather than a
// pointer. A text field matches :focus-visible on every focus, even a
// click, so the composer asks this to ring itself only for the keyboard.
let pointerLast = false;
let watchingInput = false;

export const focusCameFromKeyboard = (): boolean => {
  if (!watchingInput) {
    watchingInput = true;
    document.addEventListener(
      "pointerdown",
      () => {
        pointerLast = true;
      },
      true
    );
    document.addEventListener(
      "keydown",
      () => {
        pointerLast = false;
      },
      true
    );
  }

  return !pointerLast;
};

let measureCanvas: HTMLCanvasElement | null = null;

// How wide `text` is on one line in the field's font.
const textWidth = (text: string, field: HTMLElement): number => {
  measureCanvas ??= document.createElement("canvas");
  const context = measureCanvas.getContext("2d");

  if (!context) {
    return 0;
  }

  context.font = getComputedStyle(field).font;

  return context.measureText(text).width;
};

interface FieldMeasure {
  // The text no longer fits on one row beside the controls.
  overflows: boolean;
  // Lines of text, counting wrapped lines.
  lines: number;
}

// The room the text has on one row: the box less its insets, the controls
// and the gaps beside the text. It comes from the controls' widths, not the
// field's, so it is the same in both arrangements and the layout never
// flips back and forth.
const oneRowRoom = (
  boxWidth: number,
  leading: HTMLElement | null,
  trailing: HTMLElement | null
): number => {
  const inset = themePixels("--space-composer-footer-padding", FALLBACK.inset);
  const gap = themePixels("--space-composer-add-gap", FALLBACK.addGap);
  const controls = (leading?.offsetWidth ?? 0) + (trailing?.offsetWidth ?? 0);

  return boxWidth - 2 * inset - controls - 2 * gap;
};

// Sizes the field to its text and reports whether the text still fits on
// one row beside the controls, and how many lines it fills. An empty field
// shows its placeholder, so the placeholder has to fit instead. Only the
// inline layout has a one-row arrangement, and a line break always leaves
// it. An expanded field takes the height its container gives it. The
// returned refs go on the field, the box and the two groups of controls.
export const useFieldSize = ({
  draft,
  expanded,
  placeholder,
  oneRowPossible,
}: {
  draft: string;
  expanded: boolean;
  placeholder: string;
  oneRowPossible: boolean;
}) => {
  const field = useRef<HTMLTextAreaElement>(null);
  const surface = useRef<HTMLFormElement>(null);
  const leading = useRef<HTMLDivElement>(null);
  const trailing = useRef<HTMLDivElement>(null);

  const [measure, setMeasure] = useState<FieldMeasure>({
    lines: 1,
    overflows: false,
  });

  const [width, setWidth] = useState(0);

  useEffect(() => {
    const box = surface.current;

    if (!box) {
      return;
    }

    const observer = new ResizeObserver(() => setWidth(box.clientWidth));

    observer.observe(box);

    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const element = field.current;

    if (!element) {
      return;
    }

    element.style.height = "auto";
    element.style.height = expanded ? "" : `${element.scrollHeight}px`;

    const lineHeight = themePixels(
      "--text-composer-leading",
      FALLBACK.lineHeight
    );

    const room = oneRowRoom(width, leading.current, trailing.current);
    const lines = Math.max(1, Math.round(element.scrollHeight / lineHeight));
    const shown = draft === "" ? placeholder : draft;
    const overflows = oneRowPossible && textWidth(shown, element) > room;

    if (lines !== measure.lines || overflows !== measure.overflows) {
      // Measuring the DOM and updating before the browser paints is what a
      // layout effect is for; React's useLayoutEffect docs show this same
      // pattern. The check above ends the loop after one more pass.
      // oxlint-disable-next-line react/set-state-in-effect
      setMeasure({ lines, overflows });
    }
  }, [draft, expanded, measure, oneRowPossible, placeholder, width]);

  return { field, leading, measure, surface, trailing };
};

// Keeps a stopped reply's stop control for a moment, disabled.
export const useStopSettle = () => {
  const [settling, setSettling] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
      }
    },
    []
  );

  const settle = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
    }

    setSettling(true);
    timer.current = window.setTimeout(
      () => {
        timer.current = null;
        setSettling(false);
      },
      themeMilliseconds("--motion-stop-settle", FALLBACK.stopSettleMs)
    );
  }, []);

  return { settle, settling };
};

// The add menu is open. `typed` marks, for each character of `text`,
// whether the person typed it into the field since the list opened. Those
// characters filter the list.
interface AddMenuState {
  text: string;
  typed: readonly boolean[];
  highlighted: string | undefined;
}

// One edit to the draft: `removed` characters at `at` gave way to
// `inserted` new ones.
interface DraftEdit {
  at: number;
  removed: number;
  inserted: number;
}

// Works out the edit that turned `before` into `after`. It keeps at most
// `head` characters at the front and `tail` at the back as they were, which
// places the edit where the field made it when the text around it repeats.
const editBetween = (
  before: string,
  after: string,
  head = before.length,
  tail = before.length
): DraftEdit => {
  const shorter = Math.min(before.length, after.length);
  let start = 0;

  while (start < Math.min(shorter, head) && before[start] === after[start]) {
    start += 1;
  }

  let end = 0;

  while (
    end < Math.min(shorter - start, tail) &&
    before[before.length - 1 - end] === after[after.length - 1 - end]
  ) {
    end += 1;
  }

  return {
    at: start,
    inserted: after.length - start - end,
    removed: before.length - start - end,
  };
};

const applyEdit = (
  typed: readonly boolean[],
  { at, removed, inserted }: DraftEdit,
  byPerson: boolean
): boolean[] => [
  ...typed.slice(0, at),
  ...Array.from({ length: inserted }, () => byPerson),
  ...typed.slice(at + removed),
];

// The characters of `text` that were typed while the list was open, or
// the ones that were not.
const pickTyped = (
  text: string,
  typed: readonly boolean[],
  wanted: boolean
): string => {
  let picked = "";

  for (let at = 0; at < text.length; at += 1) {
    if ((typed[at] ?? false) === wanted) {
      picked += text[at];
    }
  }

  return picked;
};

// Edits that bring back earlier text rather than type new text.
const HISTORY_INPUT_TYPES = new Set(["historyUndo", "historyRedo"]);

const ARROW_STEPS = new Map([
  ["ArrowDown", 1],
  ["ArrowUp", -1],
]);

// What a screen reader hears as the add menu filters and its highlight
// moves.
const addMenuAnnouncement = (
  shown: readonly ComposerAddItem[],
  highlighted: string | undefined
): string => {
  const at = shown.findIndex((item) => item.id === highlighted);
  const item = shown[at];

  if (!item) {
    return NO_MATCH;
  }

  return `${item.label}, ${at + 1} of ${shown.length}`;
};

// The add menu's state and keys. While it is open, focus stays in the
// field: Up and Down move the highlight and wrap, typing filters the list,
// Space is typed like any letter, Enter runs the highlighted item and never
// sends, and Escape closes the list and keeps the draft. Running an item
// drops the characters typed since the list opened, wherever the caret was,
// and keeps the rest of the draft. Text that was already there never counts
// as typed, even when it was selected as the list opened. Typing over it
// replaces it as usual, and running an item does not bring it back.
export const useAddMenu = ({
  draft,
  field,
  items,
  dispatch,
  run,
}: {
  draft: string;
  field: RefObject<HTMLTextAreaElement | null>;
  items: readonly ComposerAddItem[];
  dispatch: (action: ComposerAction) => void;
  run: (item: ComposerAddItem) => void;
}) => {
  const [menu, setMenu] = useState<AddMenuState | null>(null);

  // Where the selection was as the field began its current edit, and
  // whether the edit is typing. Undo and redo bring back text instead of
  // typing it.
  const selectionBeforeEdit = useRef<{
    start: number;
    end: number;
    typing: boolean;
  } | null>(null);

  const isOpen = menu !== null;

  useEffect(() => {
    const element = field.current;

    if (!(isOpen && element)) {
      return;
    }

    const onBeforeInput = (event: InputEvent) => {
      selectionBeforeEdit.current = {
        end: element.selectionEnd,
        start: element.selectionStart,
        typing: !HISTORY_INPUT_TYPES.has(event.inputType),
      };
    };

    element.addEventListener("beforeinput", onBeforeInput);

    return () => element.removeEventListener("beforeinput", onBeforeInput);
  }, [field, isOpen]);

  // A draft changed from outside the field counts as not typed.
  const typed =
    menu && menu.text !== draft
      ? applyEdit(menu.typed, editBetween(menu.text, draft), false)
      : (menu?.typed ?? []);

  const shown = menu
    ? filterAddItems(items, pickTyped(draft, typed, true))
    : [];

  const highlighted =
    shown.find((item) => item.id === menu?.highlighted)?.id ?? shown[0]?.id;

  const close = () => setMenu(null);

  const toggle = () =>
    setMenu((current) =>
      current
        ? null
        : {
            highlighted: undefined,
            text: draft,
            typed: Array.from({ length: draft.length }, () => false),
          }
    );

  // Records an edit the person made in the field.
  const edited = (element: HTMLTextAreaElement) => {
    const selection = selectionBeforeEdit.current;
    selectionBeforeEdit.current = null;

    if (!menu) {
      return;
    }

    const after = element.value;
    const caret = element.selectionEnd;

    const edit = selection
      ? editBetween(
          draft,
          after,
          Math.min(selection.start, caret),
          Math.min(draft.length - selection.end, after.length - caret)
        )
      : editBetween(draft, after);

    setMenu({
      ...menu,
      text: after,
      typed: applyEdit(typed, edit, selection?.typing ?? true),
    });
  };

  const highlight = (id: string) =>
    setMenu((current) => (current ? { ...current, highlighted: id } : current));

  const choose = (item: ComposerAddItem) => {
    if (menu) {
      dispatch({
        draft: pickTyped(draft, typed, false),
        type: "draftChanged",
      });
    }

    close();
    run(item);
  };

  const move = (step: number) => {
    const at = shown.findIndex((item) => item.id === highlighted);
    const next = shown[(at + step + shown.length) % shown.length];

    if (next) {
      highlight(next.id);
    }
  };

  // Handles a key in the field while the menu is open. Returns whether the
  // menu took it.
  const onKey = (event: KeyboardEvent<HTMLTextAreaElement>): boolean => {
    if (!menu) {
      return false;
    }

    const step = ARROW_STEPS.get(event.key);

    if (step) {
      event.preventDefault();
      move(step);
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      const item = shown.find((entry) => entry.id === highlighted);

      if (item) {
        choose(item);
      }
    }

    return true;
  };

  return {
    announcement: menu ? addMenuAnnouncement(shown, highlighted) : "",
    handleChoose: choose,
    handleClose: close,
    handleEdit: edited,
    handleHighlight: highlight,
    handleKey: onKey,
    handleToggle: toggle,
    highlighted,
    isOpen,
    shown,
  };
};
