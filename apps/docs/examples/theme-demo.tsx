// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

"use client";

import { Button } from "@/components/ui/button";

// A card drawn only with theme colors: page, card, border, text, muted text
// and the primary action. Switch the docs between light and dark to see
// both schemes.
export const ThemeDemo = () => (
  <div className="bg-card text-card-foreground border-border flex max-w-md flex-col gap-3 rounded-(--radius-menu) border-(length:--border-hairline) p-4">
    <p className="font-(--weight-semibold)">Archive this chat?</p>
    <p className="text-muted-foreground text-(length:--text-caption-size) leading-(--text-caption-leading)">
      It leaves the sidebar. You can find it again under Archived.
    </p>
    <div className="flex gap-2">
      <Button>Archive</Button>
      <Button variant="outline">Keep it</Button>
    </div>
  </div>
);
