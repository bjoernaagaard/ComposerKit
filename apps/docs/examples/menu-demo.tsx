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

// Every part of the menu: an info line, items, a submenu with one choice
// out of several, and a separator.
export const MenuDemo = () => {
  const [style, setStyle] = useState("same");

  return (
    <MenuRoot>
      <MenuTrigger
        render={
          <Button aria-label="More actions" size="icon" variant="quiet">
            <EllipsisIcon aria-hidden="true" />
          </Button>
        }
      />
      <MenuContent label="More actions" width="actions">
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
        <MenuItem
          description="You can undo it right away"
          label="Archive chat"
        />
      </MenuContent>
    </MenuRoot>
  );
};
