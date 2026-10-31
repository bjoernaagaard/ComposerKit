// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

"use client";

// The whole chat app: the app shell, the chat sidebar, the home view with
// the composer, and the conversation, on the sample data. It is starter
// code. Replace the sample data with your own chats, projects and replies,
// and the in-memory history in tab-history.ts with your routes.
import {
  BellIcon,
  BlocksIcon,
  CalendarClockIcon,
  ChevronDownIcon,
  FilesIcon,
  FolderIcon,
  HouseIcon,
  InboxIcon,
  NotebookPenIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  useCallback,
  useId,
  useImperativeHandle,
  useReducer,
  useRef,
  useState,
} from "react";
import type { ReactNode, Ref } from "react";

import {
  AppShell,
  AppShellMain,
  AppShellSidebar,
  AppShellSkipLink,
} from "@/components/app-shell/app-shell";
import { AppShellProvider } from "@/components/app-shell/app-shell-provider";
import {
  AppShellRail,
  AppShellRailContent,
  AppShellRailFooter,
  AppShellRailItem,
  AppShellRailSeparator,
} from "@/components/app-shell/rail";
import { AppShellSplitter } from "@/components/app-shell/splitter";
import { AppShellTabs, appShellTabId } from "@/components/app-shell/tabs";
import type { AppShellTab } from "@/components/app-shell/tabs";
import {
  AppShellHistory,
  AppShellSidebarToggle,
  AppShellTitleBar,
  AppShellTitleBarEnd,
  AppShellTitleBarStart,
  AppShellTitleBarTabs,
} from "@/components/app-shell/title-bar";
import { ChatSidebar } from "@/components/chat-sidebar/chat-sidebar";
import type { RowDensity } from "@/components/chat-sidebar/conversation-row";
import type { ComposerMode } from "@/components/composer/composer";
import { initialComposer } from "@/components/composer/machine";
import type { ComposerState } from "@/components/composer/machine";
import { useComposerController } from "@/components/composer/use-composer-controller";
import { ConversationView } from "@/components/conversation/conversation-view";
import { DEFAULT_CONVERSATION_LAYOUT } from "@/components/conversation/layouts";
import type { ConversationLayout } from "@/components/conversation/layouts";
import { Button } from "@/components/ui/button";
import {
  MenuContent,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuRoot,
  MenuTrigger,
} from "@/components/ui/menu";
import { PopupLayer } from "@/components/ui/popup-layer";
import { Tip, TipProvider } from "@/components/ui/tip";
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
import { PlaceholderView } from "./placeholder-view";
import { HOME, START, tabHistoriesReducer } from "./tab-history";
import type { Destination, View } from "./tab-history";

export interface ChatAppProps {
  // The height of the chat rows in the sidebar.
  density?: RowDensity;
  // How the open chat lays out its turns.
  conversationLayout?: ConversationLayout;
  // The app's own actions at the end of the title bar.
  titleBarEnd?: ReactNode;
  // The foot of the rail, such as the account button. On narrow screens it
  // moves into the drawer with the rail.
  railFooter?: ReactNode;
  // The sidebar's saved open state and width, such as readShellCookie's
  // open and width, so the first frame matches the last visit.
  defaultOpen?: boolean;
  defaultWidth?: number;
  // For an app inside a page that already has its own main region, such
  // as a docs page. The sidebar renders as a <section>, the main region as
  // a <div>, and the layout is not saved in the cookie.
  embedded?: boolean;
}

const DESTINATIONS: {
  id: Destination;
  label: string;
  icon: LucideIcon;
  group: 1 | 2;
}[] = [
  { group: 1, icon: HouseIcon, id: "home", label: "Home" },
  { group: 1, icon: InboxIcon, id: "inbox", label: "Inbox" },
  { group: 1, icon: CalendarClockIcon, id: "schedule", label: "Schedule" },
  { group: 1, icon: BlocksIcon, id: "extensions", label: "Extensions" },
  { group: 2, icon: FolderIcon, id: "projects", label: "Projects" },
  { group: 2, icon: FilesIcon, id: "files", label: "Files" },
  { group: 2, icon: NotebookPenIcon, id: "notes", label: "Notes" },
];

const SAMPLE_TITLE = SAMPLE_CONVERSATIONS.find(
  (item) => item.id === SAMPLE_CONVERSATION_ID
)?.title;

const TITLE_LENGTH = 60;

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

interface HomeComposerHandle {
  // Sets the home composer to work in the project, for a chat started from
  // the project in the sidebar.
  startProjectChat: (projectId: string) => void;
}

// The open tab's page. It stays mounted while the tab moves between pages,
// so it owns the home composer and its mode: a draft and its attachments
// wait here while another page is open, and a keystroke re-renders only
// this panel, not the rest of the shell.
const TabPanel = ({
  id,
  labelledBy,
  projects,
  onSent,
  ref,
  children,
}: {
  id: string;
  labelledBy: string;
  projects: Project[];
  onSent: (sent: ComposerState) => void;
  ref: Ref<HomeComposerHandle>;
  // The open page, or nothing for home.
  children: ReactNode;
}) => {
  const [mode, setMode] = useState<ComposerMode>("work");

  const { dispatch, handlers, state } = useComposerController(
    onSent,
    initialComposer(COMPOSER_OPTIONS, DEFAULT_CHOICES)
  );

  useImperativeHandle(
    ref,
    () => ({
      startProjectChat: (projectId) => {
        setMode("work");
        dispatch({ projectId, type: "projectChanged" });
      },
    }),
    [dispatch]
  );

  return (
    <div
      aria-labelledby={labelledBy}
      className="h-full"
      id={id}
      role="tabpanel"
    >
      {children ?? (
        <HomeView
          composer={state}
          dispatch={dispatch}
          handlers={handlers}
          mode={mode}
          onModeChange={setMode}
          options={COMPOSER_OPTIONS}
          projects={projects}
        />
      )}
    </div>
  );
};

const SidebarHeader = () => (
  <>
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
  </>
);

const SAMPLE_DATE = new Date(SAMPLE_NOW);

let nextId = 0;

const newId = (prefix: string): string => {
  nextId += 1;

  return `${prefix}-${nextId}`;
};

// The list with the tab whose id is id moved to index.
const moveTo = (
  list: AppShellTab[],
  id: string,
  index: number
): AppShellTab[] => {
  const tab = list.find((entry) => entry.id === id);

  return tab
    ? list.filter((entry) => entry !== tab).toSpliced(index, 0, tab)
    : list;
};

type ShellAppProps = Omit<ChatAppProps, "defaultOpen" | "defaultWidth">;

const ShellApp = ({
  density,
  conversationLayout = DEFAULT_CONVERSATION_LAYOUT,
  titleBarEnd,
  railFooter,
  embedded = false,
}: ShellAppProps) => {
  const panelId = useId();

  const [tabs, setTabs] = useState<AppShellTab[]>([
    { id: "t1", title: "Chat" },
  ]);

  const [activeTabId, setActiveTabId] = useState("t1");
  const [histories, navigate] = useReducer(tabHistoriesReducer, { t1: START });
  const history = histories[activeTabId] ?? START;
  const view = history.entries[history.index] ?? HOME;
  const homeComposer = useRef<HomeComposerHandle>(null);

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

  // A choice made in the narrow drawer, in the rail or the chat sidebar,
  // closes it and moves focus to the page it opened. Those parts do that
  // themselves.
  const go = (next: View) =>
    navigate({ tabId: activeTabId, type: "push", view: next });

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

  let main: ReactNode = null;

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
                onCloseTab={(id) => {
                  setTabs((list) => list.filter((tab) => tab.id !== id));
                  navigate({ tabId: id, type: "close" });
                }}
                onMoveTab={(id, index) =>
                  setTabs((list) => moveTo(list, id, index))
                }
                onNewTab={() => {
                  const tab = { id: newId("t"), title: "New chat" };
                  setTabs((list) => [...list, tab]);
                  setActiveTabId(tab.id);
                }}
                onSelectTab={setActiveTabId}
                panelId={panelId}
                tabs={tabs}
              />
            </AppShellTitleBarTabs>
            {titleBarEnd ? (
              <AppShellTitleBarEnd>{titleBarEnd}</AppShellTitleBarEnd>
            ) : null}
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
            {railFooter ? (
              <AppShellRailFooter>{railFooter}</AppShellRailFooter>
            ) : null}
          </AppShellRail>
          <AppShellSidebar render={embedded ? <section /> : undefined}>
            <ChatSidebar
              density={density}
              header={<SidebarHeader />}
              activeConversationId={
                view.kind === "conversation" ? view.id : null
              }
              archived={archived?.conversation ?? null}
              conversations={conversations}
              now={SAMPLE_DATE}
              onAddProject={(name) =>
                setProjects((list) => [...list, { id: newId("p"), name }])
              }
              onArchive={archive}
              onNewChat={newChat}
              onOpenConversation={openConversation}
              onStartProjectChat={(projectId) => {
                homeComposer.current?.startProjectChat(projectId);
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
          <AppShellSplitter />
          <AppShellMain render={embedded ? <div /> : undefined}>
            <TabPanel
              id={panelId}
              labelledBy={appShellTabId(panelId, activeTabId)}
              onSent={onSent}
              projects={projects}
              ref={homeComposer}
            >
              {main}
            </TabPanel>
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

export const ChatApp = ({
  defaultOpen,
  defaultWidth,
  ...props
}: ChatAppProps) => (
  <AppShellProvider
    defaultOpen={defaultOpen}
    defaultWidth={defaultWidth}
    persist={!props.embedded}
  >
    <ShellApp {...props} />
  </AppShellProvider>
);
