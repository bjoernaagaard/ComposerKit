// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

import { useDirection } from "@base-ui/react/direction-provider";
import { Menu } from "@base-ui/react/menu";
import { CheckIcon, ChevronRightIcon } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import type { ComponentProps, ReactNode } from "react";

import { usePopupLayer } from "@/components/ui/popup-layer";
import { themePixels } from "@/components/ui/theme-value";
import { cn } from "@/lib/utils";

// Base UI gives every menu its keyboard model: arrow keys move between
// items, Home and End jump to the ends, typing a letter moves to the next
// item that starts with it, Right and Left open and close a submenu, and
// Escape closes the menu and returns focus to the trigger. Opening with the
// keyboard focuses the first item; opening with a click focuses the menu,
// and Down then focuses the first item. Pass loopFocus={false} to stop at
// the ends instead of wrapping.
export const MenuRoot = Menu.Root;

// Renders a button. Pass render={<Button />} to pick its look.
export const MenuTrigger = Menu.Trigger;

export type MenuDensity = "regular" | "compact";

export type MenuWidth =
  | "narrow"
  | "medium"
  | "regular"
  | "wide"
  | "composer"
  | "model"
  | "actions"
  | "submenu";

// Menu widths from the size tokens. composer fits a permission menu with
// descriptions and still leaves a margin on a phone. The more-actions menu
// and its submenus have no outline, so their items fill the panel less its
// padding.
const BORDERLESS = "border-(length:--border-more-menu)";

const POPUP_WIDTH: Record<MenuWidth, string> = {
  actions: `w-(--size-more-menu-width) ${BORDERLESS}`,
  composer:
    "w-[min(var(--size-composer-menu),100vw_-_var(--space-menu-viewport-inset))]",
  medium: "w-(--size-menu-medium)",
  model: "w-(--size-model-menu-width)",
  narrow: "w-(--size-menu-narrow)",
  regular: "w-(--size-menu-width)",
  submenu: `w-(--size-submenu-width) ${BORDERLESS}`,
  wide: "w-(--size-menu-wide)",
};

export const MENU_DENSITIES: MenuDensity[] = ["regular", "compact"];

// regular: 29px items, the default.
// compact fits more items: 25px items, tighter corners to stay concentric.
const POPUP_DENSITY: Record<MenuDensity, string> = {
  compact: "rounded-(--radius-menu-compact)",
  regular: "rounded-(--radius-menu)",
};

// Used on the server and before the theme's CSS has loaded.
const FALLBACK_OFFSET = 4;
const FALLBACK_PADDING = 4;
const FALLBACK_SUBMENU_GAP = 5;
const FALLBACK_SUBMENU_ALIGN = -3;

// The panel opens and closes in one frame, with no fade or scale.
const POPUP =
  "group/menu bg-popover text-popover-foreground border-border z-50 max-h-(--available-height) max-w-(--available-width) overflow-y-auto overscroll-contain border-(length:--border-panel) p-(--space-menu-padding) shadow-(--shadow-menu) backdrop-blur-(--blur-menu) outline-none";

export interface MenuContentProps {
  children: ReactNode;
  label: string;
  align?: "start" | "center" | "end";
  alignOffset?: number;
  side?: "top" | "bottom";
  width?: MenuWidth;
  density?: MenuDensity;
  finalFocus?: ComponentProps<typeof Menu.Popup>["finalFocus"];
  emptyLabel?: string;
}

const ITEM =
  "flex min-h-(--size-menu-item) w-full items-center gap-2 rounded-(--radius-menu-item) px-(--space-menu-item-padding-x) py-(--space-menu-item-padding-y) text-start text-(length:--text-label-size) leading-(--text-label-leading) outline-none select-none data-disabled:text-subtle-foreground data-highlighted:bg-accent data-highlighted:text-accent-foreground data-popup-open:bg-accent group-data-[density=compact]/menu:min-h-0 group-data-[density=compact]/menu:rounded-(--radius-menu-item-compact) group-data-[density=compact]/menu:px-(--space-menu-item-padding-x-compact) group-data-[density=compact]/menu:py-(--space-menu-item-padding-y-compact)";

const ItemText = ({
  label,
  description,
}: {
  label: string;
  description?: string;
}) => (
  <span className="flex min-w-0 flex-1 flex-col">
    <span className="truncate">{label}</span>
    {description ? (
      <span className="text-subtle-foreground">{description}</span>
    ) : null}
  </span>
);

export interface MenuItemProps {
  label: string;
  description?: string;
  disabled?: boolean;
  icon?: ReactNode;
  onSelect?: () => void;
}

export const MenuItem = ({
  label,
  description,
  disabled,
  icon,
  onSelect,
}: MenuItemProps) => (
  <Menu.Item
    className={ITEM}
    data-slot="menu-item"
    disabled={disabled}
    label={label}
    onClick={onSelect}
  >
    {icon}
    <ItemText description={description} label={label} />
  </Menu.Item>
);

// Shows label as one dimmed item when the panel it sits in has no other
// item. It counts the items the panel rendered, not the children passed
// in, so an empty fragment, an empty list or a group with no items count
// as empty too, and it counts again whenever items come or go. The hidden
// marker finds the panel; the first count runs before paint, so a blank
// panel never shows.
const EmptyItem = ({ label }: { label: string }) => {
  const marker = useRef<HTMLSpanElement>(null);
  const [empty, setEmpty] = useState(false);

  useLayoutEffect(() => {
    const panel = marker.current?.closest('[role="menu"]');

    if (!panel) {
      return;
    }

    const count = () =>
      setEmpty(
        panel.querySelector('[role^="menuitem"]:not([data-menu-empty])') ===
          null
      );

    count();

    const observer = new MutationObserver(count);

    observer.observe(panel, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return (
    <>
      <span hidden ref={marker} />
      {empty ? (
        <Menu.Item
          className={ITEM}
          data-menu-empty=""
          data-slot="menu-item"
          disabled
          label={label}
        >
          <ItemText label={label} />
        </Menu.Item>
      ) : null}
    </>
  );
};

// Items read the density from the panel, so callers set it once. A menu
// with no items shows emptyLabel as one dimmed item, so the panel is never
// a blank strip and focus still has somewhere to land.
// finalFocus picks where focus goes when the menu closes; see Base UI's
// Menu.Popup.
export const MenuContent = ({
  children,
  label,
  align = "start",
  alignOffset = 0,
  side = "bottom",
  width = "regular",
  density = "regular",
  finalFocus,
  emptyLabel = "Nothing to show",
}: MenuContentProps) => (
  <Menu.Portal container={usePopupLayer()}>
    <Menu.Positioner
      align={align}
      alignOffset={alignOffset}
      className="isolate z-50 outline-none"
      collisionPadding={8}
      positionMethod="fixed"
      side={side}
      sideOffset={() => themePixels("--space-menu-offset", FALLBACK_OFFSET)}
    >
      <Menu.Popup
        aria-label={label}
        className={cn(POPUP, POPUP_DENSITY[density], POPUP_WIDTH[width])}
        data-density={density}
        data-slot="menu"
        finalFocus={finalFocus}
      >
        {children}
        <EmptyItem label={emptyLabel} />
      </Menu.Popup>
    </Menu.Positioner>
  </Menu.Portal>
);

// Items under a line of muted text that is not an item, such as when a
// message was sent. The arrow keys skip the line, and it names the group,
// so a screen reader reads it as focus enters the items.
export interface MenuInfoGroupProps {
  info: ReactNode;
  children: ReactNode;
}

export const MenuInfoGroup = ({ info, children }: MenuInfoGroupProps) => (
  <Menu.Group>
    <Menu.GroupLabel
      className="text-subtle-foreground flex min-h-(--size-menu-item) items-center px-(--space-menu-item-padding-x) text-(length:--text-caption-size) leading-(--text-caption-leading)"
      data-slot="menu-info"
    >
      {info}
    </Menu.GroupLabel>
    {children}
  </Menu.Group>
);

// One choice out of several. A label, when given, heads the group and names
// it for screen readers.
export interface MenuRadioGroupProps {
  label?: string;
  value: string;
  onValueChange?: (value: string) => void;
  children: ReactNode;
}

export const MenuRadioGroup = ({
  label,
  value,
  onValueChange,
  children,
}: MenuRadioGroupProps) => (
  <Menu.RadioGroup onValueChange={onValueChange} value={value}>
    {label ? (
      <Menu.GroupLabel className="text-subtle-foreground px-(--space-menu-item-padding-x) pt-1.5 pb-1 text-(length:--text-caption-size) leading-(--text-caption-leading) group-data-[density=compact]/menu:px-(--space-menu-item-padding-x-compact) group-data-[density=compact]/menu:pt-1 group-data-[density=compact]/menu:pb-0.5">
        {label}
      </Menu.GroupLabel>
    ) : null}
    {children}
  </Menu.RadioGroup>
);

// Picking a choice closes the menu, as picking an item does.
export interface MenuRadioItemProps {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

export const MenuRadioItem = ({
  value,
  label,
  description,
  disabled,
}: MenuRadioItemProps) => (
  <Menu.RadioItem
    className={ITEM}
    closeOnClick
    data-slot="menu-item"
    disabled={disabled}
    label={label}
    value={value}
  >
    <ItemText description={description} label={label} />
    <Menu.RadioItemIndicator className="text-muted-foreground flex">
      <CheckIcon aria-hidden="true" className="size-4" />
    </Menu.RadioItemIndicator>
  </Menu.RadioItem>
);

export const MenuSeparator = ({
  className,
  ...props
}: ComponentProps<typeof Menu.Separator>) => (
  <Menu.Separator
    className={cn(
      "border-input mx-2 my-1 h-0 border-t-(length:--border-hairline) group-data-[density=compact]/menu:mx-1.5 group-data-[density=compact]/menu:my-0.5",
      className
    )}
    {...props}
  />
);

// A nested menu. Its trigger is an item with a chevron, and Right or a
// click opens it beside the panel.
export interface MenuSubmenuProps {
  label: string;
  icon?: ReactNode;
  children: ReactNode;
  width?: MenuWidth;
}

export const MenuSubmenu = ({
  label,
  icon,
  children,
  width = "submenu",
}: MenuSubmenuProps) => {
  const layer = usePopupLayer();
  // Base UI opens the submenu on the side its DirectionProvider gives, so
  // the arrow follows that too.
  const direction = useDirection();

  return (
    <Menu.SubmenuRoot>
      <Menu.SubmenuTrigger className={ITEM} data-slot="menu-item" label={label}>
        {icon}
        <ItemText label={label} />
        <ChevronRightIcon
          aria-hidden="true"
          className={cn(
            "text-subtle-foreground size-4",
            direction === "rtl" && "-scale-x-100"
          )}
        />
      </Menu.SubmenuTrigger>
      <Menu.Portal container={layer}>
        {/* The panel opens a gap away from the parent panel, with its first
          item level with the item that opened it. */}
        <Menu.Positioner
          alignOffset={() =>
            themePixels("--space-submenu-align-offset", FALLBACK_SUBMENU_ALIGN)
          }
          className="isolate z-50 outline-none"
          collisionPadding={8}
          positionMethod="fixed"
          sideOffset={() =>
            themePixels("--space-menu-padding", FALLBACK_PADDING) +
            themePixels("--space-submenu-gap", FALLBACK_SUBMENU_GAP)
          }
        >
          <Menu.Popup
            aria-label={label}
            className={cn(POPUP, POPUP_DENSITY.regular, POPUP_WIDTH[width])}
            data-density="regular"
            data-slot="menu"
          >
            {children}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.SubmenuRoot>
  );
};
