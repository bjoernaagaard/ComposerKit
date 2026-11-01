// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

"use client";

import { ListFilterIcon, PanelLeftIcon, PinIcon, PlusIcon } from "lucide-react";

import { IconButton } from "@/components/ui/icon-button";
import type { IconButtonKind } from "@/components/ui/icon-button";

const SAMPLES = {
  control: { icon: ListFilterIcon, label: "Filter chats" },
  pill: { icon: PlusIcon, label: "Attach files" },
  row: { icon: PinIcon, label: "Pin chat" },
  small: { icon: PanelLeftIcon, label: "Hide sidebar" },
} as const;

// One kind of icon button, enabled and disabled. Each shows its label in a
// tooltip on hover and on keyboard focus.
export const IconButtonPair = ({
  kind,
}: {
  kind: Extract<IconButtonKind, keyof typeof SAMPLES>;
}) => {
  const { icon, label } = SAMPLES[kind];

  return (
    <div className="flex items-center gap-3">
      <IconButton icon={icon} kind={kind} label={label} />
      <IconButton
        disabled
        icon={icon}
        kind={kind}
        label={`${label} (disabled)`}
      />
    </div>
  );
};
