// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

import { useCallback, useId, useMemo, useReducer, useState } from "react";

import {
  AppShell,
  AppShellMain,
  AppShellSidebar,
  AppShellSkipLink,
} from "@/components/app-shell/app-shell";
import {
  AppShellProvider,
  useAppShell,
} from "@/components/app-shell/app-shell-provider";
import { readShellCookie } from "@/components/app-shell/persist";
import {
  AppShellRail,
  AppShellRailContent,
  AppShellRailFooter,
  AppShellRailItem,
  AppShellRailSeparator,
} from "@/components/app-shell/rail";
import { AppShellTabs, appShellTabId } from "@/components/app-shell/tabs";
import type { AppShellTab } from "@/components/app-shell/tabs";
import {
  AppShellHistory,
  AppShellNewTab,
  AppShellSidebarToggle,
  AppShellTitleBar,
  AppShellTitleBarEnd,
  AppShellTitleBarStart,
  AppShellTitleBarTabs,
} from "@/components/app-shell/title-bar";
import type { ComposerMode } from "@/components/composer/composer";
import { initialComposer } from "@/components/composer/machine";
import type { ComposerState } from "@/components/composer/machine";
import { useComposerController } from "@/components/composer/use-composer-controller";
import { ConversationView } from "@/components/conversation/conversation-view";
import type { ConversationLayout } from "@/components/conversation/layouts";
import { PopupLayer } from "@/components/ui/popup-layer";
import { TipProvider } from "@/components/ui/tip";
import { COMPOSER_OPTIONS, DEFAULT_CHOICES } from "@/content/catalog";
import {
  PLACEHOLDER_REPLY,
  SAMPLE_CONVERSATION_ID,
  SAMPLE_TURNS,
} from "@/content/conversation";
import {
  SAMPLE_CONVERSATIONS,
  SAMPLE_NOW,
  SAMPLE_PROJECTS,
} from "@/content/sample";
import type { Conversation, Project } from "@/content/sample";
import { DirectionSelector } from "@/designs/direction";

import { HomeView } from "./home-view";
import { AppearanceMenu, DESTINATIONS } from "./icon-rail";
import type { Destination } from "./icon-rail";
import { PlaceholderView } from "./placeholder-view";
import { readConversationLayout, saveConversationLayout } from "./saved-layout";
import type { RowDensity } from "./sidebar/conversation-row";
import { Sidebar } from "./sidebar/sidebar";

type View =
  | { kind: "destination"; id: Destination }
  | { kind: "conversation"; id: string };

interface History {
  entries: View[];
  index: number;
}

type HistoryAction =
  | { type: "push"; view: View }
  | { type: "back" }
  | { type: "forward" };

// Each tab keeps its own back and forward history, keyed by tab id.
type TabHistories = Record<string, History>;

const HOME: View = { id: "home", kind: "destination" };
const START: History = { entries: [HOME], index: 0 };

const SAMPLE_TITLE = SAMPLE_CONVERSATIONS.find(
  (item) => item.id === SAMPLE_CONVERSATION_ID
)?.title;

const TITLE_LENGTH = 60;

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

const tabHistoriesReducer = (
  histories: TabHistories,
  action: HistoryAction & { tabId: string }
) => ({
  ...histories,
  [action.tabId]: historyReducer(histories[action.tabId] ?? START, action),
});

const titleFor = (sent: ComposerState): string => {
  const text = sent.draft.trim().replaceAll(/\s+/gu, " ");

  if (text) {
    return text.length > TITLE_LENGTH
      ? `${text.slice(0, TITLE_LENGTH)}…`
      : text;
  }

  return sent.attachments.map((attachment) => attachment.name).join(", ");
};

const placeholderReply = () => PLACEHOLDER_REPLY;

// Only the sample chat has messages. Every other chat shows a placeholder.
const ConversationMain = ({
  id,
  title,
  layout,
  projects,
  onNewChat,
}: {
  id: string;
  title: string | undefined;
  layout: ConversationLayout;
  projects: Project[];
  onNewChat: () => void;
}) => {
  if (id === SAMPLE_CONVERSATION_ID && title) {
    return (
      <ConversationView
        layout={layout}
        notice="Replies in this demo come from a script, not a model."
        options={COMPOSER_OPTIONS}
        projects={projects}
        reply={placeholderReply}
        title={title}
        turns={SAMPLE_TURNS}
      />
    );
  }

  return (
    <PlaceholderView
      actionLabel="New chat"
      message={`This demo only has messages in “${SAMPLE_TITLE}”.`}
      onAction={onNewChat}
      title={title ?? "This chat is archived"}
    />
  );
};

let nextId = 0;

const newId = (prefix: string): string => {
  nextId += 1;

  return `${prefix}-${nextId}`;
};

const ShellApp = ({ density }: { density?: RowDensity }) => {
  const shell = useAppShell();
  // The tab panel inside the main region.
  const panelId = useId();

  const [tabs, setTabs] = useState<AppShellTab[]>([
    { id: "t1", title: "Chat" },
  ]);

  const [activeTabId, setActiveTabId] = useState("t1");
  const [histories, navigate] = useReducer(tabHistoriesReducer, { t1: START });
  const history = histories[activeTabId] ?? START;
  const view = history.entries[history.index] ?? HOME;

  const [mode, setMode] = useState<ComposerMode>("work");

  const [conversationLayout, setConversationLayout] = useState(
    readConversationLayout
  );

  const [conversations, setConversations] =
    useState<Conversation[]>(SAMPLE_CONVERSATIONS);

  const [projects, setProjects] = useState<Project[]>(SAMPLE_PROJECTS);

  const [archived, setArchived] = useState<{
    conversation: Conversation;
    index: number;
  } | null>(null);

  const [announcement, setAnnouncement] = useState("");
  // Menus and tooltips mount inside main, so every part of the page sits in
  // a landmark.
  const [popupLayer, setPopupLayer] = useState<HTMLDivElement | null>(null);

  // On narrow screens the sidebar overlays the page, and the covered page
  // goes inert.
  const overlay = shell.isNarrow && shell.openNarrow;

  const onSent = useCallback((sent: ComposerState) => {
    const conversation: Conversation = {
      id: newId("c"),
      pinned: false,
      projectId: sent.projectId,
      title: titleFor(sent),
      updatedAt: new Date().toISOString(),
    };

    setConversations((list) => [conversation, ...list]);
    // The new chat goes first, so a pending undo restores one slot lower.
    setArchived((current) =>
      current ? { ...current, index: current.index + 1 } : current
    );
    setAnnouncement(
      `Sent. “${conversation.title}” is now at the top of Recent.`
    );
  }, []);

  const composer = useComposerController(
    onSent,
    initialComposer(COMPOSER_OPTIONS, DEFAULT_CHOICES)
  );

  const closeSidebarIfNarrow = () => {
    if (shell.isNarrow) {
      shell.setOpenNarrow(false);
    }
  };

  const go = (next: View) => {
    navigate({ tabId: activeTabId, type: "push", view: next });
    closeSidebarIfNarrow();
  };

  const updateConversation = (id: string, patch: Partial<Conversation>) =>
    setConversations((list) =>
      list.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );

  const archive = (id: string) => {
    const index = conversations.findIndex((item) => item.id === id);
    const conversation = conversations[index];

    if (!conversation) {
      return;
    }

    setArchived({ conversation, index });
    setConversations((list) => list.filter((item) => item.id !== id));
    setAnnouncement(
      `“${conversation.title}” is archived. Undo sits above the list.`
    );
  };

  const undoArchive = () => {
    if (!archived) {
      return;
    }

    setConversations((list) => {
      const restored = [...list];
      restored.splice(archived.index, 0, archived.conversation);

      return restored;
    });
    setArchived(null);
    setAnnouncement(`“${archived.conversation.title}” is back.`);
  };

  const openConversation = (id: string) => {
    const conversation = conversations.find((item) => item.id === id);
    setTabs((list) =>
      list.map((tab) =>
        tab.id === activeTabId
          ? { ...tab, title: conversation?.title ?? "Chat" }
          : tab
      )
    );
    go({ id, kind: "conversation" });
  };

  const newChat = () => {
    setTabs((list) =>
      list.map((tab) =>
        tab.id === activeTabId ? { ...tab, title: "Chat" } : tab
      )
    );
    go(HOME);
  };

  const conversationTitle =
    view.kind === "conversation"
      ? conversations.find((item) => item.id === view.id)?.title
      : undefined;

  const destinationLabel =
    view.kind === "destination"
      ? DESTINATIONS.find((item) => item.id === view.id)?.label
      : undefined;

  let main = (
    <HomeView
      composer={composer.state}
      dispatch={composer.dispatch}
      handlers={composer.handlers}
      mode={mode}
      onModeChange={setMode}
      options={COMPOSER_OPTIONS}
      projects={projects}
    />
  );

  if (view.kind === "conversation") {
    main = (
      <ConversationMain
        id={view.id}
        layout={conversationLayout}
        onNewChat={newChat}
        projects={projects}
        title={conversationTitle}
      />
    );
  } else if (view.id !== "home") {
    main = (
      <PlaceholderView
        actionLabel="Go home"
        message={`${destinationLabel} isn’t in this demo yet.`}
        onAction={() => go(HOME)}
        title={destinationLabel ?? "Not here yet"}
      />
    );
  }

  return (
    <TipProvider>
      <PopupLayer container={popupLayer}>
        <AppShell>
          <AppShellSkipLink />
          <AppShellTitleBar>
            <AppShellTitleBarStart>
              <AppShellHistory
                canGoBack={history.index > 0}
                canGoForward={history.index < history.entries.length - 1}
                onBack={() => navigate({ tabId: activeTabId, type: "back" })}
                onForward={() =>
                  navigate({ tabId: activeTabId, type: "forward" })
                }
              />
              <AppShellSidebarToggle />
            </AppShellTitleBarStart>
            <AppShellTitleBarTabs>
              <AppShellTabs
                activeTabId={activeTabId}
                onSelectTab={setActiveTabId}
                panelId={panelId}
                tabs={tabs}
              />
              <AppShellNewTab
                onNewTab={() => {
                  const tab = { id: newId("t"), title: "New chat" };
                  setTabs((list) => [...list, tab]);
                  setActiveTabId(tab.id);
                  closeSidebarIfNarrow();
                }}
              />
            </AppShellTitleBarTabs>
            <AppShellTitleBarEnd>
              <DirectionSelector />
            </AppShellTitleBarEnd>
          </AppShellTitleBar>
          <AppShellRail>
            <AppShellRailContent>
              {DESTINATIONS.map((item, index) => (
                <div className="contents" key={item.id}>
                  {index > 0 &&
                  DESTINATIONS[index - 1]?.group !== item.group ? (
                    <AppShellRailSeparator />
                  ) : null}
                  <AppShellRailItem
                    current={
                      (view.kind === "destination" ? view.id : "home") ===
                      item.id
                    }
                    icon={item.icon}
                    label={item.label}
                    onClick={() => go({ id: item.id, kind: "destination" })}
                  />
                </div>
              ))}
            </AppShellRailContent>
            <AppShellRailFooter>
              <AppearanceMenu
                conversationLayout={conversationLayout}
                onConversationLayoutChange={(layout) => {
                  saveConversationLayout(layout);
                  setConversationLayout(layout);
                }}
              />
            </AppShellRailFooter>
          </AppShellRail>
          <AppShellSidebar>
            <Sidebar
              density={density}
              activeConversationId={
                view.kind === "conversation" ? view.id : null
              }
              archived={archived?.conversation ?? null}
              conversations={conversations}
              now={SAMPLE_NOW}
              onAddProject={(name) =>
                setProjects((list) => [...list, { id: newId("p"), name }])
              }
              onArchive={archive}
              onNewChat={newChat}
              onOpenConversation={openConversation}
              onStartProjectChat={(projectId) => {
                setMode("work");
                composer.dispatch({ projectId, type: "projectChanged" });
                newChat();
              }}
              onTogglePin={(id) => {
                const conversation = conversations.find(
                  (item) => item.id === id
                );

                updateConversation(id, { pinned: !conversation?.pinned });
              }}
              onUndoArchive={undoArchive}
              projects={projects}
            />
          </AppShellSidebar>
          <AppShellMain>
            <div
              aria-labelledby={appShellTabId(panelId, activeTabId)}
              className="h-full"
              id={panelId}
              inert={overlay}
              role="tabpanel"
            >
              {main}
            </div>
            <div ref={setPopupLayer} />
          </AppShellMain>
          <p aria-live="polite" className="sr-only">
            {announcement}
          </p>
        </AppShell>
      </PopupLayer>
    </TipProvider>
  );
};

// The demo app on the released shell parts. The sidebar's saved state is
// read before the first render, so the first frame matches the last visit.
export const App = ({ density }: { density?: RowDensity }) => {
  const saved = useMemo(() => readShellCookie(document.cookie), []);

  return (
    <AppShellProvider defaultOpen={saved.open} defaultWidth={saved.width}>
      <ShellApp density={density} />
    </AppShellProvider>
  );
};
