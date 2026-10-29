// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

// What the demo's composer menus offer. The names are made up for the
// demo; an app passes its own through the composer's `options` prop.

import type { ComposerOptions } from "@/components/composer/options";

export const COMPOSER_OPTIONS: ComposerOptions = {
  efforts: [
    {
      description: "The shortest answer that works",
      id: "brief",
      label: "Brief",
    },
    { description: "Answers right away", id: "quick", label: "Quick" },
    {
      description: "Thinks a little first",
      id: "balanced",
      label: "Balanced",
    },
    {
      description: "Checks its work before answering",
      id: "careful",
      label: "Careful",
    },
    {
      description: "Takes as long as the task needs",
      id: "exhaustive",
      label: "Exhaustive",
    },
  ],
  models: [
    {
      description: "Picks a model for each message",
      id: "auto",
      label: "Auto",
    },
    { id: "sparrow-3", label: "Sparrow 3" },
    { id: "sparrow-3-mini", label: "Sparrow 3 Mini" },
    { id: "heron-2", label: "Heron 2" },
    { id: "heron-2-long", label: "Heron 2 Long" },
  ],
  permissions: [
    {
      description:
        "Checks with you before it edits files outside the project or goes online",
      id: "ask",
      label: "Ask first",
    },
    {
      description: "Asks only when an action looks risky",
      id: "trusted",
      label: "Trust safe actions",
    },
    {
      caution: true,
      description: "Can change any file and use the network without asking",
      id: "open",
      label: "No limits",
    },
    {
      description: "Follows the rules saved with the project",
      id: "project",
      label: "Project rules",
    },
  ],
};

export const DEFAULT_CHOICES = {
  effort: "balanced",
  model: "sparrow-3",
  permission: "project",
} as const;
