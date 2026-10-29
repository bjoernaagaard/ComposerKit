// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

import { useCallback, useEffect, useReducer, useRef, useState } from "react";

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

import { HomeView } from "./home-view";
import { DESTINATIONS, IconRail } from "./icon-rail";
import type { Destination } from "./icon-rail";
import { PlaceholderView } from "./placeholder-view";
import { readConversationLayout, saveConversationLayout } from "./saved-layout";
import type { RowDensity } from "./sidebar/conversation-row";
import { Sidebar } from "./sidebar/sidebar";
import { MAIN_PANEL_ID, SIDEBAR_TOGGLE_ID, TitleBar } from "./title-bar";
import type { Tab } from "./title-bar";

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

const WIDE_QUERY = "(min-width: 768px)";
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

export const App = ({ density }: { density?: RowDensity }) => {
  const [tabs, setTabs] = useState<Tab[]>([{ id: "t1", title: "Chat" }]);

  const [activeTabId, setActiveTabId] = useState("t1");
  const [histories, navigate] = useReducer(tabHistoriesReducer, { t1: START });
  const history = histories[activeTabId] ?? START;
  const view = history.entries[history.index] ?? HOME;

  const [isWide, setIsWide] = useState(
    () => window.matchMedia(WIDE_QUERY).matches
  );

  const [sidebarOpen, setSidebarOpen] = useState(isWide);
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

  useEffect(() => {
    const query = window.matchMedia(WIDE_QUERY);

    const sync = () => {
      setIsWide(query.matches);
      setSidebarOpen(query.matches);
    };

    query.addEventListener("change", sync);

    return () => query.removeEventListener("change", sync);
  }, []);

  // On narrow screens the sidebar overlays the page. Focus moves into it,
  // the covered page goes inert, and closing hands focus back to the toggle.
  const overlay = sidebarOpen && !isWide;
  const sidebarPanel = useRef<HTMLDivElement>(null);

  const closeOverlay = useCallback(() => {
    setSidebarOpen(false);
    document.querySelector<HTMLElement>(`#${SIDEBAR_TOGGLE_ID}`)?.focus();
  }, []);

  useEffect(() => {
    if (!overlay) {
      return;
    }

    sidebarPanel.current?.querySelector<HTMLElement>("button")?.focus();

    // An Escape that a menu already handled is skipped.
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) {
        closeOverlay();
      }
    };

    window.addEventListener("keydown", handleKey);

    return () => window.removeEventListener("keydown", handleKey);
  }, [overlay, closeOverlay]);

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
    if (!isWide) {
      setSidebarOpen(false);
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
        <div className="bg-window text-foreground flex h-full min-h-0 flex-col">
          <TitleBar
            activeTabId={activeTabId}
            canGoBack={history.index > 0}
            canGoForward={history.index < history.entries.length - 1}
            onBack={() => navigate({ tabId: activeTabId, type: "back" })}
            onForward={() => navigate({ tabId: activeTabId, type: "forward" })}
            onNewTab={() => {
              const tab = { id: newId("t"), title: "New chat" };
              setTabs((list) => [...list, tab]);
              setActiveTabId(tab.id);
              closeSidebarIfNarrow();
            }}
            onSelectTab={setActiveTabId}
            onToggleSidebar={() => setSidebarOpen((open) => !open)}
            sidebarOpen={sidebarOpen}
            tabs={tabs}
          />
          <div className="relative flex min-h-0 flex-1">
            <IconRail
              active={view.kind === "destination" ? view.id : "home"}
              conversationLayout={conversationLayout}
              onConversationLayoutChange={(layout) => {
                saveConversationLayout(layout);
                setConversationLayout(layout);
              }}
              onSelect={(id) => go({ id, kind: "destination" })}
            />
            {sidebarOpen ? (
              <div
                className="max-md:bg-window max-md:absolute max-md:inset-y-0 max-md:left-(--size-rail) max-md:z-30 max-md:max-w-[calc(100vw-var(--size-rail))] max-md:shadow-(--shadow-menu)"
                ref={sidebarPanel}
              >
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
              </div>
            ) : null}
            {overlay ? (
              <button
                aria-label="Close sidebar"
                className="absolute inset-0 z-20 bg-black/30"
                onClick={closeOverlay}
                type="button"
              />
            ) : null}
            <main
              data-slot="main"
              className={`bg-background relative min-w-0 flex-1 overflow-y-auto ${sidebarOpen && isWide ? "border-border border-l-(length:--border-hairline)" : ""}`}
            >
              <div
                aria-labelledby={`tab-${activeTabId}`}
                className="h-full"
                id={MAIN_PANEL_ID}
                inert={overlay}
                role="tabpanel"
              >
                {main}
              </div>
              <div ref={setPopupLayer} />
            </main>
          </div>
          <p aria-live="polite" className="sr-only">
            {announcement}
          </p>
        </div>
      </PopupLayer>
    </TipProvider>
  );
};
