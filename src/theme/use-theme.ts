// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

import { useSyncExternalStore } from "react";

import { getThemeState, onThemeChange } from "./apply";

// The chosen scheme and the variant on screen, kept in sync.
export const useTheme = () =>
  useSyncExternalStore(onThemeChange, getThemeState);
