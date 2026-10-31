// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

// Every word the app shell shows or announces, with English defaults. Pass
// labels={{ … }} to AppShellProvider, or to one part, to translate or rename
// them. A string that includes a value is a function, so a translation can
// put the value where its language needs it.
export interface AppShellLabels {
  // The first Tab stop, which moves focus to the main region.
  skipToContent: string;
  // The rail's navigation landmark.
  rail: string;
  // The sidebar's complementary landmark, and the drawer's dialog name on
  // narrow shells.
  sidebar: string;
  showSidebar: string;
  hideSidebar: string;
  // The splitter on the sidebar's edge.
  resizeSidebar: string;
  // The sidebar toggle's tooltip: its action and the shortcut that runs it,
  // such as "Hide sidebar ⌘B".
  withShortcut: (action: string, keys: string) => string;
  back: string;
  forward: string;
  // The tab list's name.
  tabs: string;
  newTab: string;
  // The menu button that lists every tab, and the menu's name.
  tabMenu: string;
  // The tab menu's item that closes the open tab, such as "Close Notes".
  closeTab: (title: string) => string;
  // The tab menu's items that move the open tab one place.
  moveTabLeft: string;
  moveTabRight: string;
  // What a screen reader hears after a tab moves, such as
  // "Moved Notes to position 2 of 4".
  movedTab: (title: string, position: number, count: number) => string;
}

export const APP_SHELL_LABELS: AppShellLabels = {
  back: "Back",
  closeTab: (title) => `Close ${title}`,
  forward: "Forward",
  hideSidebar: "Hide sidebar",
  moveTabLeft: "Move left",
  moveTabRight: "Move right",
  movedTab: (title, position, count) =>
    `Moved ${title} to position ${position} of ${count}`,
  newTab: "New tab",
  rail: "Main",
  resizeSidebar: "Resize sidebar",
  showSidebar: "Show sidebar",
  sidebar: "Sidebar",
  skipToContent: "Skip to content",
  tabMenu: "All tabs",
  tabs: "Open chats",
  withShortcut: (action, keys) => `${action} ${keys}`,
};
