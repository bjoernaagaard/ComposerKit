// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

"use client";

import { RotateCwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

const SIZES = ["sm", "default", "lg"] as const;

// Each size of one variant, with a leading icon and the disabled state.
export const ButtonRow = ({
  variant,
}: {
  variant: "default" | "outline" | "ghost";
}) => (
  <div className="flex flex-wrap items-center gap-3">
    {SIZES.map((size) => (
      <Button key={size} size={size} variant={variant}>
        {size === "lg" ? "Start a new chat" : "Show all chats"}
      </Button>
    ))}
    <Button size="sm" variant={variant}>
      <RotateCwIcon aria-hidden="true" data-icon="inline-start" />
      Try again
    </Button>
    <Button disabled variant={variant}>
      Disabled
    </Button>
  </div>
);
