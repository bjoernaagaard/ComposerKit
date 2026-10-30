// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

// Every word the chat sidebar shows or announces, with English defaults.
// Pass labels={{ … }} to ChatSidebar, or to one part, to translate or
// rename them. A string that includes a value is a function, so a
// translation can put the value where its language needs it, and each
// sentence is built whole.

// Which chats Recent lists: all of them, the ones in a project, or the
// ones in none.
export type ChatSidebarFilter = "all" | "project" | "loose";

export interface ChatSidebarLabels {
  // The chat list's navigation landmark.
  chats: string;
  newChat: string;
  // The search toggle, the search field's name and its placeholder.
  searchChats: string;
  closeSearch: string;
  // Shown when no chat title contains the search text.
  noSearchMatches: (query: string) => string;
  clearSearch: string;
  // The note above the list after a chat is archived, and its button.
  archived: (title: string) => string;
  undo: string;
  pinned: string;
  projects: string;
  newProject: string;
  // The Recent heading, which names the filter that is on.
  recent: (filter: ChatSidebarFilter) => string;
  // The filter menu's name and tooltip.
  filterChats: string;
  // The filter button's name, which says which chats Recent shows.
  filterButton: (filter: ChatSidebarFilter) => string;
  // Each choice in the filter menu.
  filterOption: (filter: ChatSidebarFilter) => string;
  noOtherChats: string;
  noChatsYet: string;
  noFilterMatches: string;
  showAllChats: string;
  // The row's More button: its tooltip and menu name, and its name, which
  // says which chat it acts on.
  moreActions: string;
  moreActionsFor: (title: string) => string;
  pinChat: string;
  unpinChat: string;
  // The row's Pin button, which says which chat it pins.
  pin: (title: string) => string;
  unpin: (title: string) => string;
  archiveChat: string;
  archiveChatDescription: string;
  // The two-line row's second line: how long ago, and the project if the
  // chat is in one.
  rowDetails: (age: string, project: string | undefined) => string;
  // The button on a project row that starts a chat in it.
  newChatIn: (project: string) => string;
  // The form that adds a project.
  projectName: string;
  projectNamePlaceholder: string;
  projectNameMissing: string;
  projectNameTaken: (name: string) => string;
  cancel: string;
  addProject: string;
}

const FILTER_OPTIONS: Record<ChatSidebarFilter, string> = {
  all: "All chats",
  loose: "Chats without a project",
  project: "Chats in a project",
};

const RECENT: Record<ChatSidebarFilter, string> = {
  all: "Recent",
  loose: "Recent chats without a project",
  project: "Recent chats in a project",
};

const FILTER_BUTTONS: Record<ChatSidebarFilter, string> = {
  all: "Filter chats, now showing all chats",
  loose: "Filter chats, now showing chats without a project",
  project: "Filter chats, now showing chats in a project",
};

export const CHAT_SIDEBAR_LABELS: ChatSidebarLabels = {
  addProject: "Add project",
  archiveChat: "Archive chat",
  archiveChatDescription: "You can undo it right away",
  archived: (title) => `“${title}” archived`,
  cancel: "Cancel",
  chats: "Chats",
  clearSearch: "Clear search",
  closeSearch: "Close search",
  filterButton: (filter) => FILTER_BUTTONS[filter],
  filterChats: "Filter chats",
  filterOption: (filter) => FILTER_OPTIONS[filter],
  moreActions: "More actions",
  moreActionsFor: (title) => `More actions for ${title}`,
  newChat: "New chat",
  newChatIn: (project) => `New chat in ${project}`,
  newProject: "New project",
  noChatsYet: "No chats yet.",
  noFilterMatches: "No chats match this filter.",
  noOtherChats: "No other chats.",
  noSearchMatches: (query) => `No chat titles contain “${query}”.`,
  pin: (title) => `Pin ${title}`,
  pinChat: "Pin chat",
  pinned: "Pinned",
  projectName: "New project name",
  projectNameMissing: "Type a name for the project, or choose Cancel.",
  projectNamePlaceholder: "Project name",
  projectNameTaken: (name) =>
    `There is already a project called “${name}”. Try another name.`,
  projects: "Projects",
  recent: (filter) => RECENT[filter],
  rowDetails: (age, project) => (project ? `${age} · ${project}` : age),
  searchChats: "Search chats",
  showAllChats: "Show all chats",
  undo: "Undo",
  unpin: (title) => `Unpin ${title}`,
  unpinChat: "Unpin chat",
};

// The defaults with a part's own labels on top.
export const chatSidebarLabels = (
  labels?: Partial<ChatSidebarLabels>
): ChatSidebarLabels => ({ ...CHAT_SIDEBAR_LABELS, ...labels });
