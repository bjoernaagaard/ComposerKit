// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

import { FolderIcon, SquarePenIcon } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import type { Project } from "@/content/sample";

import { MarqueeLabel } from "./conversation-row";

export const ProjectList = ({
  projects,
  adding,
  onAdd,
  onCancelAdd,
  onStartChat,
}: {
  projects: Project[];
  adding: boolean;
  onAdd: (name: string) => void;
  onCancelAdd: () => void;
  onStartChat: (projectId: string) => void;
}) => {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();

    if (!trimmed) {
      setError("Type a name for the project, or choose Cancel.");

      return;
    }

    if (
      projects.some(
        (project) => project.name.toLowerCase() === trimmed.toLowerCase()
      )
    ) {
      setError(
        `There is already a project called “${trimmed}”. Try another name.`
      );

      return;
    }

    onAdd(trimmed);
    setName("");
    setError(null);
  };

  return (
    <ul className="flex flex-col gap-(--size-row-gap)">
      {projects.map((project) => (
        <li className="group relative" key={project.id}>
          <div className="text-muted-foreground flex min-h-(--size-row) items-center gap-2 rounded-(--radius-control) py-(--space-row-padding-y) pr-8 pl-(--space-row-padding-x) text-(length:--text-body-size) leading-(--text-body-leading)">
            <FolderIcon
              aria-hidden="true"
              className="text-subtle-foreground size-4 shrink-0"
            />
            <MarqueeLabel text={project.name} />
          </div>
          <span className="absolute top-1/2 right-0.5 -translate-y-1/2 opacity-0 transition-opacity duration-(--motion-duration) group-focus-within:opacity-100 group-hover:opacity-100">
            <IconButton
              icon={SquarePenIcon}
              label={`New chat in ${project.name}`}
              onClick={() => onStartChat(project.id)}
              kind="row"
            />
          </span>
        </li>
      ))}
      {adding ? (
        <li>
          <form className="flex flex-col gap-1 px-1 py-1" onSubmit={submit}>
            <label className="sr-only" htmlFor="new-project-name">
              New project name
            </label>
            <input
              aria-describedby={error ? "new-project-error" : undefined}
              aria-invalid={error ? true : undefined}
              // oxlint-disable-next-line jsx-a11y/no-autofocus -- focus follows the explicit "Add new project" action
              autoFocus
              className="border-input bg-background text-foreground placeholder:text-subtle-foreground focus-visible:border-ring h-(--size-row) rounded-(--radius-control) border px-2 text-(length:--text-body-size) outline-none"
              id="new-project-name"
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setError(null);
                  setName("");
                  onCancelAdd();
                }
              }}
              placeholder="Project name"
              value={name}
            />
            {error ? (
              <p
                className="text-destructive px-1 text-(length:--text-caption-size) leading-(--text-caption-leading)"
                id="new-project-error"
                role="alert"
              >
                {error}
              </p>
            ) : null}
            <div className="flex justify-end gap-1">
              <Button
                onClick={() => {
                  setError(null);
                  setName("");
                  onCancelAdd();
                }}
                variant="outline"
              >
                Cancel
              </Button>
              <Button type="submit">Add project</Button>
            </div>
          </form>
        </li>
      ) : null}
    </ul>
  );
};
