// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

"use client";

import { ListFilterIcon, PanelLeftIcon, PinIcon, PlusIcon } from "lucide-react";

import { IconButton } from "@/components/ui/icon-button";

// The icon buttons from the catalog. Each one wraps its button in a Tip
// that shows the button's label.
const BUTTONS = [
  { icon: PanelLeftIcon, kind: "small", label: "Hide sidebar" },
  { icon: ListFilterIcon, kind: "control", label: "Filter chats" },
  { icon: PlusIcon, kind: "pill", label: "Attach files" },
  { icon: PinIcon, kind: "row", label: "Pin chat" },
] as const;

export const TipOnIconButtons = () => (
  <div className="flex items-center gap-3">
    {BUTTONS.map((item) => (
      <IconButton
        icon={item.icon}
        key={item.kind}
        kind={item.kind}
        label={item.label}
      />
    ))}
  </div>
);
