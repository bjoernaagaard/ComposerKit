// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

import {
  BellIcon,
  ChevronDownIcon,
  FolderPlusIcon,
  ListFilterIcon,
  SearchIcon,
  SquarePenIcon,
  XIcon,
} from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import {
  MenuContent,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuRoot,
  MenuTrigger,
} from "@/components/ui/menu";
import { Tip } from "@/components/ui/tip";
import type { Conversation, Project } from "@/content/sample";

import { ConversationRow } from "./conversation-row";
import type { RowDensity } from "./conversation-row";
import { ProjectList } from "./project-list";
import { SidebarSection } from "./sidebar-section";

type RecentsFilter = "all" | "project" | "loose";

const FILTERS: { id: RecentsFilter; label: string }[] = [
  { id: "all", label: "All chats" },
  { id: "project", label: "Chats in a project" },
  { id: "loose", label: "Chats without a project" },
];

const isFilter = (value: string): value is RecentsFilter =>
  FILTERS.some((filter) => filter.id === value);

const matchesFilter = (
  conversation: Conversation,
  filter: RecentsFilter
): boolean => {
  if (filter === "project") {
    return conversation.projectId !== null;
  }

  if (filter === "loose") {
    return conversation.projectId === null;
  }

  return true;
};

export interface SidebarProps {
  conversations: Conversation[];
  projects: Project[];
  activeConversationId: string | null;
  archived: Conversation | null;
  now: number;
  density?: RowDensity;
  onNewChat: () => void;
  onOpenConversation: (id: string) => void;
  onTogglePin: (id: string) => void;
  onArchive: (id: string) => void;
  onUndoArchive: () => void;
  onAddProject: (name: string) => void;
  onStartProjectChat: (projectId: string) => void;
}

const HeaderButton = ({ onNewChat }: { onNewChat: () => void }) => (
  <button
    className="text-muted-foreground hover:bg-accent flex h-(--size-row) w-full items-center gap-2 rounded-(--radius-control) px-(--space-row-padding-x) text-left text-(length:--text-heading-size) leading-(--text-heading-leading) transition-colors duration-(--motion-duration)"
    onClick={onNewChat}
    type="button"
  >
    <SquarePenIcon aria-hidden="true" className="size-4 shrink-0" />
    New chat
  </button>
);

export const Sidebar = ({
  conversations,
  projects,
  activeConversationId,
  archived,
  now,
  density,
  onNewChat,
  onOpenConversation,
  onTogglePin,
  onArchive,
  onUndoArchive,
  onAddProject,
  onStartProjectChat,
}: SidebarProps) => {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [filter, setFilter] = useState<RecentsFilter>("all");
  // Clearing removes the button that was focused, so focus moves to what
  // the person changes next.
  const searchInput = useRef<HTMLInputElement>(null);
  const filterTrigger = useRef<HTMLButtonElement>(null);
  const [addingProject, setAddingProject] = useState(false);

  const needle = query.trim().toLowerCase();

  const visible = conversations.filter(
    (conversation) =>
      !needle || conversation.title.toLowerCase().includes(needle)
  );

  const pinned = visible.filter((conversation) => conversation.pinned);

  const recents = visible.filter(
    (conversation) =>
      !conversation.pinned && matchesFilter(conversation, filter)
  );

  const renderRow = (conversation: Conversation) => (
    <li key={conversation.id}>
      <ConversationRow
        active={conversation.id === activeConversationId}
        conversation={conversation}
        density={density}
        now={now}
        onArchive={() => onArchive(conversation.id)}
        onOpen={() => onOpenConversation(conversation.id)}
        onTogglePin={() => onTogglePin(conversation.id)}
        project={projects.find(
          (project) => project.id === conversation.projectId
        )}
      />
    </li>
  );

  return (
    <nav
      data-slot="sidebar"
      aria-label="Chats"
      className="bg-sidebar flex h-full min-h-0 w-(--size-sidebar) max-w-full flex-col"
    >
      <div className="flex flex-col gap-1.5 px-(--space-sidebar-padding) pt-2.5 pb-1">
        <div className="flex h-8 items-center">
          <MenuRoot>
            <MenuTrigger render={<Button size="lg" variant="ghost" />}>
              <span className="text-(length:--text-brand-size) leading-(--text-brand-leading) font-(--weight-semibold)">
                ComposerKit
              </span>
              <span className="sr-only">, workspace Personal, change</span>
              <ChevronDownIcon
                aria-hidden="true"
                className="text-subtle-foreground"
                data-icon="inline-end"
              />
            </MenuTrigger>
            <MenuContent label="Workspace" width="medium">
              <MenuRadioGroup value="personal">
                <MenuRadioItem label="Personal" value="personal" />
                <MenuRadioItem
                  description="Not in this demo"
                  disabled
                  label="Team"
                  value="team"
                />
              </MenuRadioGroup>
            </MenuContent>
          </MenuRoot>
          <span className="flex-1" />
          <MenuRoot>
            <Tip label="Notifications">
              <MenuTrigger
                aria-label="Notifications"
                render={<Button size="icon-sm" variant="quiet" />}
              >
                <BellIcon aria-hidden="true" />
              </MenuTrigger>
            </Tip>
            <MenuContent align="end" label="Notifications" width="wide">
              <MenuItem
                description="Finished tasks appear here."
                disabled
                label="Nothing new"
              />
            </MenuContent>
          </MenuRoot>
          <IconButton
            aria-expanded={searching}
            className="ml-1.5"
            icon={searching ? XIcon : SearchIcon}
            label={searching ? "Close search" : "Search chats"}
            onClick={() => {
              setSearching((value) => !value);
              setQuery("");
            }}
            kind="small"
          />
        </div>
        <HeaderButton onNewChat={onNewChat} />
        {searching ? (
          <div className="px-0.5">
            <label className="sr-only" htmlFor="chat-search">
              Search chats
            </label>
            <input
              // oxlint-disable-next-line jsx-a11y/no-autofocus -- focus follows the explicit Search action
              autoFocus
              className="border-input bg-background text-foreground placeholder:text-subtle-foreground focus-visible:border-ring h-(--size-row) w-full rounded-(--radius-control) border px-2 text-(length:--text-body-size) outline-none"
              id="chat-search"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setSearching(false);
                  setQuery("");
                }
              }}
              placeholder="Search chats"
              ref={searchInput}
              type="search"
              value={query}
            />
          </div>
        ) : null}
      </div>
      <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain [mask-image:linear-gradient(to_bottom,transparent,black_var(--space-sidebar-fade-start),black_calc(100%-var(--space-fade-end)),transparent)] px-(--space-sidebar-padding) pt-1 pb-4">
        {archived ? (
          <div className="bg-accent mb-2 flex items-center gap-2 rounded-(--radius-control) py-1 pr-1 pl-2 text-(length:--text-caption-size) leading-(--text-caption-leading)">
            <span className="min-w-0 flex-1 wrap-anywhere">
              “{archived.title}” archived
            </span>
            <Button
              // oxlint-disable-next-line jsx-a11y/no-autofocus -- the archived row is gone, so focus lands on its undo
              autoFocus
              onClick={onUndoArchive}
              size="sm"
              variant="ghost"
            >
              Undo
            </Button>
          </div>
        ) : null}
        {needle && pinned.length === 0 && recents.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-start gap-2 px-2 py-3 text-(length:--text-body-size)">
            <p>No chat titles contain “{query.trim()}”.</p>
            <Button
              variant="ghost"
              onClick={() => {
                setQuery("");
                searchInput.current?.focus();
              }}
            >
              Clear search
            </Button>
          </div>
        ) : null}
        {pinned.length > 0 ? (
          <SidebarSection title="Pinned">
            <ul className="flex flex-col gap-(--size-row-gap)">
              {pinned.map(renderRow)}
            </ul>
          </SidebarSection>
        ) : null}
        {needle ? null : (
          <SidebarSection
            actions={
              <IconButton
                icon={FolderPlusIcon}
                label="New project"
                onClick={() => setAddingProject(true)}
                kind="header"
              />
            }
            title="Projects"
          >
            <ProjectList
              adding={addingProject}
              onAdd={(name) => {
                onAddProject(name);
                setAddingProject(false);
              }}
              onCancelAdd={() => setAddingProject(false)}
              onStartChat={onStartProjectChat}
              projects={projects}
            />
          </SidebarSection>
        )}
        {recents.length > 0 || !needle ? (
          <SidebarSection
            actions={
              <>
                <MenuRoot>
                  <Tip label="Filter chats">
                    <MenuTrigger
                      aria-label={`Filter chats, now showing ${FILTERS.find((item) => item.id === filter)?.label.toLowerCase()}`}
                      render={
                        <Button
                          data-active={filter === "all" ? undefined : ""}
                          size="icon-header"
                          variant="quiet"
                        />
                      }
                      ref={filterTrigger}
                    >
                      <ListFilterIcon aria-hidden="true" />
                    </MenuTrigger>
                  </Tip>
                  <MenuContent align="end" label="Filter chats" width="narrow">
                    <MenuRadioGroup
                      onValueChange={(value) => {
                        if (isFilter(value)) {
                          setFilter(value);
                        }
                      }}
                      value={filter}
                    >
                      {FILTERS.map((item) => (
                        <MenuRadioItem
                          key={item.id}
                          label={item.label}
                          value={item.id}
                        />
                      ))}
                    </MenuRadioGroup>
                  </MenuContent>
                </MenuRoot>
                <IconButton
                  className="size-6"
                  icon={SquarePenIcon}
                  label="New chat"
                  onClick={onNewChat}
                  kind="small"
                />
              </>
            }
            title={
              filter === "all"
                ? "Recent"
                : `Recent, ${FILTERS.find((item) => item.id === filter)?.label.toLowerCase()}`
            }
          >
            {recents.length > 0 ? (
              <ul className="flex flex-col gap-(--size-row-gap)">
                {recents.map(renderRow)}
              </ul>
            ) : (
              <div className="text-muted-foreground flex flex-col items-start gap-2 px-2 py-2 text-(length:--text-body-size)">
                <p>No chats match this filter.</p>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setFilter("all");
                    filterTrigger.current?.focus();
                  }}
                >
                  Show all chats
                </Button>
              </div>
            )}
          </SidebarSection>
        ) : null}
      </div>
    </nav>
  );
};
