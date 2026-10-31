// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

import { useSyncExternalStore } from "react";

export type InputModality = "pointer" | "keyboard";

// Until the first key press, the kit assumes a pointer, as the shell did.
const INITIAL: InputModality = "pointer";

let current: InputModality = INITIAL;

const listeners = new Set<() => void>();

// The attribute sits on <html> because menus and tooltips mount in a portal
// outside the shell, so only an ancestor of every element can reach them.
// It is written inside the event, before React renders, so a popup that
// opens from the same event already reads the new value.
// It returns early on a repeat of the same input, so a run of clicks or
// key presses does not restyle the page.
const write = (input: InputModality) => {
  if (input === current) {
    return;
  }

  current = input;

  if (listeners.size === 0) {
    return;
  }

  document.documentElement.dataset.input = input;

  for (const listener of listeners) {
    listener();
  }
};

// For handlers that set the input before acting, such as the shell's
// Meta+B, so the change they make is drawn with no motion.
export const markInput = (input: InputModality): void => write(input);

const onPointer = () => write("pointer");
const onKey = () => write("keyboard");

// One capture listener pair serves every caller. The first caller adds it,
// and the last one to unmount removes it and the attribute, so a page with
// no kit component keeps a clean <html>.
const subscribe = (listener: () => void) => {
  if (listeners.size === 0) {
    window.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("keydown", onKey, true);
    document.documentElement.dataset.input = current;
  }

  listeners.add(listener);

  return () => {
    listeners.delete(listener);

    if (listeners.size === 0) {
      window.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("keydown", onKey, true);
      delete document.documentElement.dataset.input;
    }
  };
};

const snapshot = (): InputModality => current;

const serverSnapshot = (): InputModality => INITIAL;

// The last input type, read before any handler runs, so a change made from
// the keyboard is drawn without motion. It also keeps <html data-input>
// current while the calling component is mounted.
export const useInputModality = (): InputModality =>
  useSyncExternalStore(subscribe, snapshot, serverSnapshot);
