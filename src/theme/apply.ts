// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

// Colors and sizes are CSS variables in tokens.css, generated from
// crates/composerkit-theme/design-tokens.json. This file only picks the
// scheme: it sets the .dark class on the root element, which tokens.css keys
// the dark colors on.

export type Variant = "light" | "dark";

export type Scheme = Variant | "system";

export interface ThemeState {
  scheme: Scheme;
  variant: Variant;
}

const SCHEME_KEY = "composerkit-scheme";

// In the order a picker shows them.
export const SCHEMES: readonly { id: Scheme; label: string }[] = [
  { id: "system", label: "Same as system" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];

const systemDark = window.matchMedia("(prefers-color-scheme: dark)");
const listeners = new Set<() => void>();
const systemVariant = (): Variant => (systemDark.matches ? "dark" : "light");

let root: HTMLElement | null = null;
let state: ThemeState = { scheme: "system", variant: systemVariant() };

const render = (): void => {
  if (!root) {
    return;
  }

  root.classList.toggle("dark", state.variant === "dark");
  root.style.colorScheme = state.variant;
};

const update = (scheme: Scheme): void => {
  state = {
    scheme,
    variant: scheme === "system" ? systemVariant() : scheme,
  };
  render();

  // Blocked storage only means the choice isn't kept for next time.
  try {
    localStorage.setItem(SCHEME_KEY, scheme);
  } catch {
    // Nothing to do: the scheme still applies for this visit.
  }

  for (const listener of listeners) {
    listener();
  }
};

export const getThemeState = (): ThemeState => state;

// "system" follows the OS until light or dark is picked.
export const setScheme = (scheme: Scheme): void => update(scheme);

// Returns a function that stops listening.
export const onThemeChange = (listener: () => void): (() => void) => {
  listeners.add(listener);

  return () => listeners.delete(listener);
};

// An unknown, missing or unreadable value falls back to "system".
const readSaved = (): Scheme => {
  try {
    const saved = localStorage.getItem(SCHEME_KEY);

    return SCHEMES.find((option) => option.id === saved)?.id ?? "system";
  } catch {
    return "system";
  }
};

// Restores the saved scheme and follows the OS while it is "system".
export const startTheme = (element: HTMLElement): void => {
  root = element;
  update(readSaved());
  systemDark.addEventListener("change", () => {
    if (state.scheme === "system") {
      update("system");
    }
  });
};
