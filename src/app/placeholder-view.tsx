// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

import { Button } from "@/components/ui/button";

// Stands in for a place the demo has not built, with a way back.
export const PlaceholderView = ({
  title,
  message,
  actionLabel,
  onAction,
}: {
  title: string;
  message: string;
  actionLabel: string;
  onAction: () => void;
}) => (
  <div className="flex min-h-full flex-col items-center justify-center gap-3 px-6 text-center">
    <h1 className="text-foreground max-w-[40ch] text-(length:--text-brand-size) leading-(--text-brand-leading) font-(--weight-semibold) break-words">
      {title}
    </h1>
    <p className="text-muted-foreground max-w-[48ch]">{message}</p>
    <Button onClick={onAction} size="lg">
      {actionLabel}
    </Button>
  </div>
);
