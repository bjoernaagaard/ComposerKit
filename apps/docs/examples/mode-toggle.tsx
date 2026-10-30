// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

"use client";

import { useState } from "react";

import { ModeToggle } from "@/blocks/chat-app/mode-toggle";
import type { ModeToggleAppearance } from "@/blocks/chat-app/mode-toggle";
import type { ComposerMode } from "@/components/composer/composer";

// The Chat and Work switch in one appearance.
export const ModeToggleExample = ({
  appearance,
}: {
  appearance: ModeToggleAppearance;
}) => {
  const [mode, setMode] = useState<ComposerMode>("work");

  return <ModeToggle appearance={appearance} mode={mode} onChange={setMode} />;
};
