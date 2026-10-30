// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

"use client";

import { FolderIcon, SquarePenIcon } from "lucide-react";
import { useId, useState } from "react";
import type { FormEvent } from "react";

import {
  MOUSE_HOVER_PROPS,
  MarqueeLabel,
} from "@/components/chat-sidebar/conversation-row";
import type { ChatSidebarProject } from "@/components/chat-sidebar/conversation-row";
import { chatSidebarLabels } from "@/components/chat-sidebar/labels";
import type { ChatSidebarLabels } from "@/components/chat-sidebar/labels";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";

export interface ProjectListProps {
  projects: ChatSidebarProject[];
  // Shows the form that names a new project, below the list.
  adding: boolean;
  onAdd: (name: string) => void;
  onCancelAdd: () => void;
  onStartChat: (projectId: string) => void;
  labels?: Partial<ChatSidebarLabels>;
}

// The projects, each with a button that starts a chat in it, and the form
// that adds one. The button shows like a chat row's actions: on hover or
// focus with a pointer that can hover, and always on a touch screen.
export const ProjectList = ({
  projects,
  adding,
  onAdd,
  onCancelAdd,
  onStartChat,
  labels,
}: ProjectListProps) => {
  const text = chatSidebarLabels(labels);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const nameId = useId();
  const errorId = useId();

  const cancel = () => {
    setError(null);
    setName("");
    onCancelAdd();
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();

    if (!trimmed) {
      setError(text.projectNameMissing);

      return;
    }

    if (
      projects.some(
        (project) => project.name.toLowerCase() === trimmed.toLowerCase()
      )
    ) {
      setError(text.projectNameTaken(trimmed));

      return;
    }

    onAdd(trimmed);
    setName("");
    setError(null);
  };

  return (
    <ul className="flex flex-col gap-(--size-row-gap)">
      {projects.map((project) => (
        <li
          className="relative"
          data-slot="project-row"
          key={project.id}
          {...MOUSE_HOVER_PROPS}
        >
          <div className="text-muted-foreground flex min-h-(--size-row) items-center gap-2 rounded-(--radius-control) py-(--space-row-padding-y) ps-(--space-row-padding-x) pe-8 text-(length:--text-body-size) leading-(--text-body-leading)">
            <FolderIcon
              aria-hidden="true"
              className="text-subtle-foreground size-4 shrink-0"
            />
            <MarqueeLabel text={project.name} />
          </div>
          <span
            className="absolute end-0.5 top-1/2 -translate-y-1/2 rounded-(--radius-row-actions) transition-opacity duration-(--motion-duration) ease-(--motion-ease-out)"
            data-slot="row-actions"
          >
            <IconButton
              icon={SquarePenIcon}
              label={text.newChatIn(project.name)}
              onClick={() => onStartChat(project.id)}
              kind="row"
            />
          </span>
        </li>
      ))}
      {adding ? (
        <li>
          <form className="flex flex-col gap-1 px-1 py-1" onSubmit={submit}>
            <label className="sr-only" htmlFor={nameId}>
              {text.projectName}
            </label>
            <input
              aria-describedby={error ? errorId : undefined}
              aria-invalid={error ? true : undefined}
              // oxlint-disable-next-line jsx-a11y/no-autofocus -- focus follows the explicit "Add new project" action
              autoFocus
              className="border-input bg-background text-foreground placeholder:text-subtle-foreground focus-visible:border-ring h-(--size-row) rounded-(--radius-control) border px-2 text-(length:--text-body-size) outline-none"
              id={nameId}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  cancel();
                }
              }}
              placeholder={text.projectNamePlaceholder}
              value={name}
            />
            {error ? (
              <p
                className="text-destructive px-1 text-(length:--text-caption-size) leading-(--text-caption-leading)"
                id={errorId}
                role="alert"
              >
                {error}
              </p>
            ) : null}
            <div className="flex justify-end gap-1">
              <Button onClick={cancel} variant="outline">
                {text.cancel}
              </Button>
              <Button type="submit">{text.addProject}</Button>
            </div>
          </form>
        </li>
      ) : null}
    </ul>
  );
};
