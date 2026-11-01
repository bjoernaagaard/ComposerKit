// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

"use client";

import { ChevronDownIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  MenuContent,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuRoot,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";
import type { MenuDensity } from "@/components/ui/menu";
import { COMPOSER_OPTIONS, DEFAULT_CHOICES } from "@/content/catalog";

// The same items in each density, so only the spacing differs.
export const MenuDensityExample = ({ density }: { density: MenuDensity }) => {
  const [effort, setEffort] = useState<string>(DEFAULT_CHOICES.effort);

  return (
    <MenuRoot>
      <MenuTrigger
        render={
          <Button variant="outline">
            Open the {density} menu
            <ChevronDownIcon aria-hidden="true" data-icon="inline-end" />
          </Button>
        }
      />
      <MenuContent density={density} label={`${density} menu`}>
        <MenuRadioGroup label="Effort" onValueChange={setEffort} value={effort}>
          {COMPOSER_OPTIONS.efforts.map((item) => (
            <MenuRadioItem key={item.id} label={item.label} value={item.id} />
          ))}
        </MenuRadioGroup>
        <MenuSeparator />
        <MenuItem label="Pin chat" />
        <MenuItem
          description="You can undo it right away"
          label="Archive chat"
        />
      </MenuContent>
    </MenuRoot>
  );
};
