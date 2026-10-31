// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";

import { useInputModality } from "@/components/ui/input-modality";
import { cn } from "@/lib/utils";

// shadcn's base button, sized and colored from the ComposerKit tokens.
// default is the one action a view asks for, outline sits beside it, ghost
// is for inline actions such as Undo, and quiet is for icon-only controls
// that should not draw the eye until hovered. caution is quiet in the
// warning color, and floating sits over content on its own card.
// A quiet button shows its state: pressed (aria-pressed), the current page
// (aria-current) or a filter that is on (data-active). The current page and
// an active filter also get a 2px bar on the inline-start edge, in the text
// color, because the fill alone is too faint to see (about 1.12:1). In
// forced colors the fill is gone and the bar is Highlight. inset is quiet with
// its fill drawn inside the hit area, in the shape the size gives it, so a
// round fill can sit in a slightly wider button.
// Hover changes within a frame, without a fade. A press from a pointer
// shrinks the button to --press-scale over --motion-press, and only scale
// moves, so the fill still changes at once. From the keyboard, and under
// reduced motion, a press doesn't move.
// The keyboard focus ring is 2px, drawn just outside the button, and
// follows its corners. Buttons with an inset fill are round, so their ring
// is round too.
// A button is never wider than its container, so a label from data can
// end in an ellipsis: wrap it in <span className="truncate">.
const PRESS_MOTION =
  "transition-[scale] duration-(--motion-press) ease-(--motion-ease-out) motion-safe:in-data-[input=pointer]:active:not-disabled:not-aria-disabled:scale-(--press-scale)";

const buttonVariants = cva(
  "group/button focus-visible:outline-ring aria-invalid:border-destructive relative inline-flex max-w-full shrink-0 items-center justify-center rounded-full border border-transparent bg-clip-padding font-(--weight-medium) whitespace-nowrap select-none focus-visible:outline-(length:--border-focus-width) focus-visible:outline-offset-(--border-focus-offset) focus-visible:outline-solid disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    defaultVariants: {
      size: "default",
      variant: "default",
    },
    variants: {
      size: {
        default:
          "h-(--size-button-medium) gap-1 px-2.5 text-(length:--text-label-size) has-data-[icon=inline-end]:pe-2 has-data-[icon=inline-start]:ps-2 [&_svg:not([class*='size-'])]:size-3.5",
        icon: "size-(--size-icon-button) rounded-(--radius-control)",
        // 27 by 26 with a rounded square fill, for actions under a message.
        "icon-action":
          "h-(--size-action-button-height) w-(--size-action-button-width) rounded-full before:-inset-px before:rounded-(--radius-action)",
        // 29 by 28 with a round 28px fill, for controls inside the composer.
        "icon-composer":
          "h-(--size-composer-control) w-(--size-composer-control-width) rounded-full before:-inset-px before:m-auto before:size-(--size-composer-control) before:rounded-full",
        // 24px, for actions in a section header.
        "icon-header": "size-(--size-header-action) rounded-(--radius-small)",
        // A 32px circle with an outline, such as the jump to the newest
        // message.
        "icon-jump":
          "size-(--size-jump-button) rounded-full [&_svg:not([class*='size-'])]:size-3.5",
        "icon-lg":
          "size-(--size-rail-button) rounded-(--radius-control) [&_svg:not([class*='size-'])]:size-(--size-rail-icon)",
        "icon-round": "size-(--size-composer-control) rounded-full",
        "icon-sm": "size-(--size-icon-button) rounded-(--radius-small)",
        // A 20px fill inside a 24px button, so it sits in a row and still
        // meets WCAG 2.5.8's 24px target. Use it with the inset variant.
        "icon-xs":
          "size-[calc(var(--size-row-action)+4px)] rounded-(--radius-small) before:inset-0.5 before:rounded-(--radius-small) [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-(--size-button-large) gap-1.5 px-3.5 text-(length:--text-label-size) has-data-[icon=inline-end]:pe-3 has-data-[icon=inline-start]:ps-3",
        // A pill in the composer footer or tray, in caption text.
        pill: "h-(--size-composer-control) min-w-0 shrink gap-1 px-2 text-(length:--text-caption-size) leading-(--text-caption-leading) font-(--weight-regular) has-data-[icon=inline-start]:px-1.5 [&_svg:not([class*='size-'])]:size-4",
        sm: "h-(--size-button-small) gap-1 px-2 text-(length:--text-caption-size) has-data-[icon=inline-end]:pe-1.5 has-data-[icon=inline-start]:ps-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        // The tray spaces its icons wider and tightens in a narrow composer.
        tray: "h-(--size-composer-control) min-w-0 gap-1.5 px-2 text-(length:--text-caption-size) leading-(--text-caption-leading) font-(--weight-regular) @max-[480px]/composer:px-1.5 [&_svg:not([class*='size-'])]:size-4",
      },
      variant: {
        caution: "text-warning hover:bg-accent data-popup-open:bg-accent",
        default: "bg-primary text-primary-foreground hover:bg-primary/85",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30",
        floating:
          "border-input bg-card text-muted-foreground hover:bg-accent border-(length:--border-hairline) shadow-(--shadow-menu)",
        ghost:
          "text-foreground hover:bg-accent aria-expanded:bg-accent data-popup-open:bg-accent",
        inset:
          "text-subtle-foreground hover:before:bg-accent data-popup-open:before:bg-accent aria-pressed:text-link aria-pressed:before:bg-accent aria-expanded:before:bg-accent isolate before:absolute before:-z-10 disabled:hover:before:bg-transparent aria-disabled:opacity-40 aria-disabled:hover:before:bg-transparent",
        // The outline of a floating round button, on the page color.
        jump: "bg-background text-muted-foreground hover:bg-accent border-input border-(length:--border-panel)",
        link: "text-link underline-offset-4 hover:underline",
        outline:
          "border-input text-foreground hover:bg-accent aria-expanded:bg-accent data-popup-open:bg-accent border-(length:--border-hairline)",
        quiet:
          "text-subtle-foreground hover:bg-accent hover:text-muted-foreground data-popup-open:bg-accent aria-pressed:bg-accent aria-pressed:text-link aria-[current=page]:bg-accent aria-[current=page]:text-foreground data-active:bg-accent data-active:text-foreground [&:is([aria-current=page],[data-active])]:after:bg-foreground disabled:hover:bg-transparent aria-disabled:hover:bg-transparent [&:is([aria-current=page],[data-active])]:after:pointer-events-none [&:is([aria-current=page],[data-active])]:after:absolute [&:is([aria-current=page],[data-active])]:after:inset-y-2 [&:is([aria-current=page],[data-active])]:after:start-0 [&:is([aria-current=page],[data-active])]:after:w-0.5 [&:is([aria-current=page],[data-active])]:after:rounded-full forced-colors:[&:is([aria-current=page],[data-active])]:after:bg-[Highlight] forced-colors:[&:is([aria-current=page],[data-active])]:after:[forced-color-adjust:none]",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 aria-expanded:bg-secondary",
        // Like inset, with a fill that is always there, for the composer's send
        // and stop. A disabled one dims the whole circle.
        solid:
          "text-primary-foreground before:bg-primary hover:before:bg-primary/85 aria-disabled:hover:before:bg-primary isolate before:absolute before:-z-10 aria-disabled:opacity-40",
      },
    },
  }
);

export type ButtonProps = ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants>;

const Button = ({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonProps) => {
  // Keeps <html data-input> current, which the press reads.
  useInputModality();

  return (
    <ButtonPrimitive
      className={cn(PRESS_MOTION, buttonVariants({ className, size, variant }))}
      data-size={size}
      data-slot="button"
      data-variant={variant}
      {...props}
    />
  );
};

export { Button, buttonVariants };
