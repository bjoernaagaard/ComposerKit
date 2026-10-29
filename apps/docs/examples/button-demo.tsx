// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

"use client";

import { PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";

// A text button and an icon button. The icon button's label is its
// accessible name and its tooltip.
export const ButtonDemo = () => (
  <div className="flex items-center gap-3">
    <Button>Start a new chat</Button>
    <IconButton icon={PlusIcon} kind="composer" label="Attach files" />
  </div>
);
