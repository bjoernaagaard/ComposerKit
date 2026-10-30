// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

"use client";

import { ChevronDownIcon } from "lucide-react";
import { useId, useState } from "react";
import type { ReactNode } from "react";

export interface SidebarSectionProps {
  title: string;
  // Buttons at the heading's end, such as New project.
  actions?: ReactNode;
  children: ReactNode;
}

// A group that folds away, such as Pinned, Projects or Recent. The chevron
// turns and aria-expanded changes, so folding never depends on motion
// alone.
export const SidebarSection = ({
  title,
  actions,
  children,
}: SidebarSectionProps) => {
  const [open, setOpen] = useState(true);
  const listId = useId();

  return (
    <section
      aria-label={title}
      className="mt-4 first:mt-0"
      data-slot="sidebar-section"
    >
      <div
        className="group/heading flex h-(--size-section-heading) items-center ps-1 pe-1"
        data-slot="sidebar-section-heading"
      >
        <button
          aria-controls={listId}
          aria-expanded={open}
          className="text-subtle-foreground hover:text-muted-foreground flex h-full min-w-0 flex-1 items-center gap-1 rounded-(--radius-tab) px-1 py-0.5 text-start text-(length:--text-heading-size) leading-(--text-heading-leading) font-(--weight-medium)"
          onClick={() => setOpen((value) => !value)}
          type="button"
        >
          {title}
          <ChevronDownIcon
            aria-hidden="true"
            className={`size-3.5 opacity-0 transition duration-(--motion-duration) group-focus-within/heading:opacity-100 group-hover/heading:opacity-100 ${open ? "" : "-rotate-90 opacity-100"}`}
          />
        </button>
        {actions ? (
          <div className="flex items-center gap-1">{actions}</div>
        ) : null}
      </div>
      <div className="mt-1.5" hidden={!open} id={listId}>
        {children}
      </div>
    </section>
  );
};
