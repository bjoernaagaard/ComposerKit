// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

"use client";

import { EllipsisIcon, PinIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  MenuContent,
  MenuInfoGroup,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuRoot,
  MenuSeparator,
  MenuSubmenu,
  MenuTrigger,
} from "@/components/ui/menu";
import { themePixels } from "@/components/ui/theme-value";

const FALLBACK_ALIGN_OFFSET = 2;

// Every part of the menu: an info line, items, a submenu with one choice
// out of several, and a separator. It opens like the more-actions menu
// under a reply: above the trigger, and the arrow keys stop at the ends.
export const MenuDemo = () => {
  const [style, setStyle] = useState("same");

  return (
    <MenuRoot loopFocus={false}>
      <MenuTrigger
        render={
          <Button aria-label="More actions" size="icon" variant="quiet">
            <EllipsisIcon aria-hidden="true" />
          </Button>
        }
      />
      <MenuContent
        alignOffset={themePixels(
          "--space-more-menu-align-offset",
          FALLBACK_ALIGN_OFFSET
        )}
        label="More actions"
        side="top"
        width="actions"
      >
        <MenuInfoGroup info="Sent today at 09:41">
          <MenuItem
            icon={<PinIcon aria-hidden="true" className="size-4" />}
            label="Pin chat"
          />
          <MenuSubmenu label="Redo with">
            <MenuRadioGroup onValueChange={setStyle} value={style}>
              <MenuRadioItem label="Same length" value="same" />
              <MenuRadioItem label="Shorter" value="shorter" />
              <MenuRadioItem label="Longer" value="longer" />
            </MenuRadioGroup>
          </MenuSubmenu>
        </MenuInfoGroup>
        <MenuSeparator />
        <MenuItem label="Archive chat" />
      </MenuContent>
    </MenuRoot>
  );
};
