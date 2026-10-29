// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

import { ChevronDownIcon } from "lucide-react";
import { useId, useState } from "react";
import type { ReactNode } from "react";

// A group that folds away, such as Pinned, Projects or Recent. The chevron
// turns and aria-expanded changes, so folding never depends on motion alone.
export const SidebarSection = ({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) => {
  const [open, setOpen] = useState(true);
  const listId = useId();

  return (
    <section aria-label={title} className="mt-2 first:mt-0">
      <div className="group/heading flex h-(--size-section-heading) items-center pr-1 pl-1">
        <button
          aria-controls={listId}
          aria-expanded={open}
          className="text-subtle-foreground hover:text-muted-foreground flex h-full min-w-0 flex-1 items-center gap-1 rounded-(--radius-tab) px-1 py-0.5 text-left text-(length:--text-heading-size) leading-(--text-heading-leading) font-(--weight-medium)"
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
