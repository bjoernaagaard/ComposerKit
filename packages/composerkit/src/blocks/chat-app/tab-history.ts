// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

// Back and forward for each tab, kept in memory. An app with a router
// replaces this with its routes.
export type Destination =
  | "home"
  | "inbox"
  | "schedule"
  | "extensions"
  | "projects"
  | "files"
  | "notes";

export type View =
  | { kind: "destination"; id: Destination }
  | { kind: "conversation"; id: string };

export interface History {
  entries: View[];
  index: number;
}

type HistoryAction =
  | { type: "push"; view: View }
  | { type: "back" }
  | { type: "forward" };

export type TabHistories = Record<string, History>;

export type TabHistoryAction =
  | (HistoryAction & { tabId: string })
  | { type: "close"; tabId: string };

export const HOME: View = { id: "home", kind: "destination" };
export const START: History = { entries: [HOME], index: 0 };

const historyReducer = (history: History, action: HistoryAction): History => {
  if (action.type === "back") {
    return { ...history, index: Math.max(0, history.index - 1) };
  }

  if (action.type === "forward") {
    return {
      ...history,
      index: Math.min(history.entries.length - 1, history.index + 1),
    };
  }

  const entries = [...history.entries.slice(0, history.index + 1), action.view];

  return { entries, index: entries.length - 1 };
};

export const tabHistoriesReducer = (
  histories: TabHistories,
  action: TabHistoryAction
) => {
  if (action.type === "close") {
    return Object.fromEntries(
      Object.entries(histories).filter(([tabId]) => tabId !== action.tabId)
    );
  }

  return {
    ...histories,
    [action.tabId]: historyReducer(histories[action.tabId] ?? START, action),
  };
};
