// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

import type { LucideIcon } from "lucide-react";
import type { ComponentProps } from "react";

import { Button } from "@/components/ui/button";
import { Tip } from "@/components/ui/tip";

// control: 28px, rounded square, for title bars and headers.
// composer: 29 by 28 with a round fill, inside the composer.
// action: 27 by 26 with a rounded square fill, under a message.
// jump: a 32px outlined circle that floats over content.
// header, pill, row and small are smaller or older shapes.
export type IconButtonKind =
  | "action"
  | "composer"
  | "control"
  | "header"
  | "jump"
  | "pill"
  | "row"
  | "small";

const KIND_SIZE = {
  action: "icon-action",
  composer: "icon-composer",
  control: "icon",
  header: "icon-header",
  jump: "icon-jump",
  pill: "icon-round",
  row: "icon-xs",
  small: "icon-sm",
} as const;

const KIND_VARIANT = {
  action: "inset",
  composer: "inset",
  control: "quiet",
  header: "quiet",
  jump: "jump",
  pill: "quiet",
  row: "inset",
  small: "quiet",
} as const;

// An icon-only button. aria-label names it and a tooltip shows the same
// words, so the tooltip never carries the accessible name alone.
export const IconButton = ({
  icon: IconGlyph,
  label,
  kind = "control",
  tipSide = "bottom",
  floating = false,
  ...props
}: Omit<
  ComponentProps<typeof Button>,
  "aria-label" | "children" | "size" | "variant"
> & {
  icon: LucideIcon;
  label: string;
  kind?: IconButtonKind;
  tipSide?: "top" | "right" | "bottom" | "left";
  floating?: boolean;
}) => (
  <Tip label={label} side={tipSide}>
    <Button
      aria-label={label}
      data-kind={kind}
      data-slot="icon-button"
      size={KIND_SIZE[kind]}
      variant={floating ? "floating" : KIND_VARIANT[kind]}
      {...props}
    >
      <IconGlyph aria-hidden="true" />
    </Button>
  </Tip>
);
