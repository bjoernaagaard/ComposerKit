// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

export const installEmilInteractions = (root: HTMLElement): (() => void) => {
  const pointer = () => {
    root.dataset.emilInput = "pointer";
  };

  const keyboard = () => {
    root.dataset.emilInput = "keyboard";
  };

  document.addEventListener("pointerdown", pointer, true);
  document.addEventListener("keydown", keyboard, true);

  return () => {
    document.removeEventListener("pointerdown", pointer, true);
    document.removeEventListener("keydown", keyboard, true);
    delete root.dataset.emilInput;
  };
};
