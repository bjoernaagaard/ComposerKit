// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

const MS_PER_SECOND = 1000;
const PIXELS = /px$/u;
const MILLISECONDS = /ms$/u;
const SECONDS = /s$/u;

const read = (name: string): string =>
  typeof document === "undefined"
    ? ""
    : getComputedStyle(document.documentElement).getPropertyValue(name).trim();

// "12px" as 12. Anything else, such as an empty string, is NaN.
export const pixelsOf = (length: string): number =>
  PIXELS.test(length) ? Number(length.replace(PIXELS, "")) : Number.NaN;

// A length such as --space-tooltip-offset: 2px, in pixels. Popups take
// their offsets as numbers, so they read them from the theme here and the
// token file stays the one place they are set. `fallback` covers the
// server and a page without the theme.
export const themePixels = (name: string, fallback: number): number => {
  const amount = pixelsOf(read(name));

  return Number.isNaN(amount) ? fallback : amount;
};

// "200ms" or "0.2s" as 200. Anything else is NaN.
export const millisecondsOf = (time: string): number => {
  const value = time.trim();

  if (MILLISECONDS.test(value)) {
    return Number(value.replace(MILLISECONDS, ""));
  }

  if (SECONDS.test(value)) {
    return Number(value.replace(SECONDS, "")) * MS_PER_SECOND;
  }

  return Number.NaN;
};

// A time such as --motion-tooltip-delay: 200ms, in milliseconds.
export const themeMilliseconds = (name: string, fallback: number): number => {
  const amount = millisecondsOf(read(name));

  return Number.isNaN(amount) ? fallback : amount;
};
