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
  // The sidebar's complementary landmark.
  sidebar: string;
  showSidebar: string;
  hideSidebar: string;
  // The sidebar toggle's tooltip: its action and the shortcut that runs it,
  // such as "Hide sidebar ⌘B".
  withShortcut: (action: string, keys: string) => string;
  // The scrim that closes the sidebar when it covers the page.
  closeSidebar: string;
  back: string;
  forward: string;
  // The tab list's name.
  tabs: string;
  newTab: string;
}

export const APP_SHELL_LABELS: AppShellLabels = {
  back: "Back",
  closeSidebar: "Close sidebar",
  forward: "Forward",
  hideSidebar: "Hide sidebar",
  newTab: "New tab",
  rail: "Main",
  showSidebar: "Show sidebar",
  sidebar: "Sidebar",
  skipToContent: "Skip to content",
  tabs: "Open chats",
  withShortcut: (action, keys) => `${action} ${keys}`,
};
