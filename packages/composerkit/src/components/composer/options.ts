// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

// What the composer's menus offer. The app passes these in, so the
// composer never hard-codes model names or permission levels.

export interface ComposerChoice {
  id: string;
  label: string;
  description?: string;
}

export interface PermissionChoice extends ComposerChoice {
  // Shown with a warning icon and color, such as unrestricted access.
  caution?: boolean;
}

export interface ComposerOptions {
  models: readonly ComposerChoice[];
  efforts: readonly ComposerChoice[];
  permissions: readonly PermissionChoice[];
}

export interface ComposerProject {
  id: string;
  name: string;
}

export const choiceLabel = (
  choices: readonly ComposerChoice[],
  id: string
): string => choices.find((choice) => choice.id === id)?.label ?? id;
