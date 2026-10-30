// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

"use client";

import {
  FolderPlusIcon,
  ListFilterIcon,
  SearchIcon,
  SquarePenIcon,
  XIcon,
} from "lucide-react";
import { useRef, useState } from "react";
import type { ReactNode } from "react";

import { useOptionalAppShell } from "@/components/app-shell/app-shell-provider";
import { ConversationRow } from "@/components/chat-sidebar/conversation-row";
import type {
  ChatSidebarConversation,
  ChatSidebarProject,
  ChatSidebarRenderLink,
  RowDensity,
} from "@/components/chat-sidebar/conversation-row";
import { chatSidebarLabels } from "@/components/chat-sidebar/labels";
import type {
  ChatSidebarFilter,
  ChatSidebarLabels,
} from "@/components/chat-sidebar/labels";
import { ProjectList } from "@/components/chat-sidebar/project-list";
import { SidebarSection } from "@/components/chat-sidebar/sidebar-section";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import {
  MenuContent,
  MenuRadioGroup,
  MenuRadioItem,
  MenuRoot,
  MenuTrigger,
} from "@/components/ui/menu";
import { Tip } from "@/components/ui/tip";

const FILTERS: ChatSidebarFilter[] = ["all", "project", "loose"];

const isFilter = (value: unknown): value is ChatSidebarFilter =>
  FILTERS.some((filter) => filter === value);

const matchesFilter = (
  conversation: ChatSidebarConversation,
  filter: ChatSidebarFilter
): boolean => {
  if (filter === "project") {
    return conversation.projectId !== null;
  }

  if (filter === "loose") {
    return conversation.projectId === null;
  }

  return true;
};

// What Recent shows with no rows. Only a filter that hides chats offers a
// way back; with no filter the list is empty because there are no chats,
// or because every chat is pinned above.
const RecentsEmpty = ({
  filtered,
  pinned,
  onShowAll,
  labels,
}: {
  filtered: boolean;
  pinned: boolean;
  onShowAll: () => void;
  labels: ChatSidebarLabels;
}) => {
  if (!filtered) {
    return (
      <p className="text-muted-foreground px-2 py-2 text-(length:--text-body-size)">
        {pinned ? labels.noOtherChats : labels.noChatsYet}
      </p>
    );
  }

  return (
    <div className="text-muted-foreground flex flex-col items-start gap-2 px-2 py-2 text-(length:--text-body-size)">
      <p>{labels.noFilterMatches}</p>
      <Button variant="ghost" onClick={onShowAll}>
        {labels.showAllChats}
      </Button>
    </div>
  );
};

const NewChatButton = ({
  label,
  onNewChat,
}: {
  label: string;
  onNewChat: () => void;
}) => (
  <button
    className="text-muted-foreground hover:bg-accent flex h-(--size-row) w-full items-center gap-2 rounded-(--radius-control) px-(--space-row-padding-x) text-start text-(length:--text-heading-size) leading-(--text-heading-leading) transition-colors duration-(--motion-duration)"
    data-slot="new-chat"
    onClick={onNewChat}
    type="button"
  >
    <SquarePenIcon aria-hidden="true" className="size-4 shrink-0" />
    {label}
  </button>
);

export interface ChatSidebarProps {
  conversations: ChatSidebarConversation[];
  projects: ChatSidebarProject[];
  // The chat on screen, if any.
  activeConversationId: string | null;
  // The chat archived last, while its Undo still shows above the list.
  archived: ChatSidebarConversation | null;
  // When chat ages are measured from. Defaults to the current time, read
  // once the row is on screen and again each minute.
  now?: Date;
  density?: RowDensity;
  // The top of the sidebar, before the search button, such as the app's
  // name, a workspace menu or notifications.
  header?: ReactNode;
  // Renders each chat row as a link instead of a button. See
  // ConversationRow.
  renderLink?: ChatSidebarRenderLink;
  onNewChat: () => void;
  onOpenConversation: (id: string) => void;
  onTogglePin: (id: string) => void;
  onArchive: (id: string) => void;
  onUndoArchive: () => void;
  onAddProject: (name: string) => void;
  onStartProjectChat: (projectId: string) => void;
  labels?: Partial<ChatSidebarLabels>;
}

// The sidebar of a chat app: New chat, search, the pinned chats, the
// projects and the recent chats with a filter, and Undo after an archive.
// It is a navigation landmark named by labels.chats. The app owns the
// data and gets a callback for each change. Inside an AppShellSidebar on a
// narrow shell, picking a chat or starting one closes the drawer and moves
// focus to the main region.
export const ChatSidebar = ({
  conversations,
  projects,
  activeConversationId,
  archived,
  now,
  density,
  header,
  renderLink,
  onNewChat,
  onOpenConversation,
  onTogglePin,
  onArchive,
  onUndoArchive,
  onAddProject,
  onStartProjectChat,
  labels,
}: ChatSidebarProps) => {
  const text = chatSidebarLabels(labels);
  const shell = useOptionalAppShell();
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [filter, setFilter] = useState<ChatSidebarFilter>("all");
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

  const thenShowMain =
    <T extends unknown[]>(action: (...args: T) => void) =>
    (...args: T) => {
      action(...args);
      shell?.closeNarrowAndFocusMain();
    };

  const newChat = thenShowMain(onNewChat);

  const renderRow = (conversation: ChatSidebarConversation) => (
    <li key={conversation.id}>
      <ConversationRow
        active={conversation.id === activeConversationId}
        conversation={conversation}
        density={density}
        labels={text}
        now={now}
        onArchive={() => onArchive(conversation.id)}
        onOpen={thenShowMain(() => onOpenConversation(conversation.id))}
        onTogglePin={() => onTogglePin(conversation.id)}
        project={projects.find(
          (project) => project.id === conversation.projectId
        )}
        renderLink={renderLink}
      />
    </li>
  );

  return (
    <nav
      aria-label={text.chats}
      className="bg-sidebar flex h-full min-h-0 w-(--size-sidebar) max-w-full flex-col"
      data-slot="sidebar"
    >
      <div
        className="flex flex-col gap-1.5 px-(--space-sidebar-padding) pt-2.5 pb-1"
        data-slot="sidebar-header"
      >
        <div className="flex h-8 items-center">
          <div className="flex min-w-0 flex-1 items-center">{header}</div>
          <IconButton
            aria-expanded={searching}
            className="ms-1.5"
            icon={searching ? XIcon : SearchIcon}
            label={searching ? text.closeSearch : text.searchChats}
            onClick={() => {
              setSearching((value) => !value);
              setQuery("");
            }}
            kind="small"
          />
        </div>
        <NewChatButton label={text.newChat} onNewChat={newChat} />
        {searching ? (
          <div className="px-0.5">
            <input
              aria-label={text.searchChats}
              // oxlint-disable-next-line jsx-a11y/no-autofocus -- focus follows the explicit Search action
              autoFocus
              className="border-input bg-background text-foreground placeholder:text-subtle-foreground focus-visible:border-ring h-(--size-row) w-full rounded-(--radius-control) border px-2 text-(length:--text-body-size) outline-none"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setSearching(false);
                  setQuery("");
                }
              }}
              placeholder={text.searchChats}
              ref={searchInput}
              type="search"
              value={query}
            />
          </div>
        ) : null}
      </div>
      <div
        className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain [mask-image:linear-gradient(to_bottom,transparent,black_var(--space-sidebar-fade-start),black_calc(100%-var(--space-fade-end)),transparent)] px-(--space-sidebar-padding) pt-1 pb-4"
        data-slot="sidebar-list"
      >
        {archived ? (
          <div className="bg-accent mb-2 flex items-center gap-2 rounded-(--radius-control) py-1 ps-2 pe-1 text-(length:--text-caption-size) leading-(--text-caption-leading)">
            <span className="min-w-0 flex-1 wrap-anywhere">
              {text.archived(archived.title)}
            </span>
            <Button
              // oxlint-disable-next-line jsx-a11y/no-autofocus -- the archived row is gone, so focus lands on its undo
              autoFocus
              onClick={onUndoArchive}
              size="sm"
              variant="ghost"
            >
              {text.undo}
            </Button>
          </div>
        ) : null}
        {needle && pinned.length === 0 && recents.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-start gap-2 px-2 py-3 text-(length:--text-body-size)">
            <p>{text.noSearchMatches(query.trim())}</p>
            <Button
              variant="ghost"
              onClick={() => {
                setQuery("");
                searchInput.current?.focus();
              }}
            >
              {text.clearSearch}
            </Button>
          </div>
        ) : null}
        {pinned.length > 0 ? (
          <SidebarSection title={text.pinned}>
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
                label={text.newProject}
                onClick={() => setAddingProject(true)}
                kind="header"
              />
            }
            title={text.projects}
          >
            <ProjectList
              adding={addingProject}
              labels={text}
              onAdd={(name) => {
                onAddProject(name);
                setAddingProject(false);
              }}
              onCancelAdd={() => setAddingProject(false)}
              onStartChat={thenShowMain(onStartProjectChat)}
              projects={projects}
            />
          </SidebarSection>
        )}
        {recents.length > 0 || !needle ? (
          <SidebarSection
            actions={
              <>
                <MenuRoot>
                  <Tip label={text.filterChats}>
                    <MenuTrigger
                      aria-label={text.filterButton(filter)}
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
                  <MenuContent
                    align="end"
                    label={text.filterChats}
                    width="narrow"
                  >
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
                          key={item}
                          label={text.filterOption(item)}
                          value={item}
                        />
                      ))}
                    </MenuRadioGroup>
                  </MenuContent>
                </MenuRoot>
                <IconButton
                  className="size-6"
                  icon={SquarePenIcon}
                  label={text.newChat}
                  onClick={newChat}
                  kind="small"
                />
              </>
            }
            title={text.recent(filter)}
          >
            {recents.length > 0 ? (
              <ul className="flex flex-col gap-(--size-row-gap)">
                {recents.map(renderRow)}
              </ul>
            ) : (
              <RecentsEmpty
                filtered={filter !== "all"}
                labels={text}
                onShowAll={() => {
                  setFilter("all");
                  filterTrigger.current?.focus();
                }}
                pinned={pinned.length > 0}
              />
            )}
          </SidebarSection>
        ) : null}
      </div>
    </nav>
  );
};
