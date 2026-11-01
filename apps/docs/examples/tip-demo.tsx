// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

"use client";

import { CopyIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tip } from "@/components/ui/tip";

// Hover the button or move focus to it with Tab. The button keeps its own
// accessible name; the tip only shows it.
export const TipDemo = () => (
  <Tip label="Copy message" side="top">
    <Button aria-label="Copy message" size="icon-action" variant="inset">
      <CopyIcon aria-hidden="true" />
    </Button>
  </Tip>
);
