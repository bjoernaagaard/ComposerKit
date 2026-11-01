// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

"use client";

import { useState } from "react";

import { ChatSidebar } from "@/components/chat-sidebar/chat-sidebar";
import type {
  ChatSidebarConversation,
  ChatSidebarProject,
} from "@/components/chat-sidebar/conversation-row";
import {
  SAMPLE_CONVERSATIONS,
  SAMPLE_NOW,
  SAMPLE_PROJECTS,
} from "@/content/sample";

const NOW = new Date(SAMPLE_NOW);

// The whole sidebar on sample data. The app owns the chats and projects,
// and the sidebar asks for each change: open, pin, archive and undo, a
// new project. Search and the Recent filter work on their own.
export const ChatSidebarDemo = () => {
  const [conversations, setConversations] =
    useState<ChatSidebarConversation[]>(SAMPLE_CONVERSATIONS);

  const [projects, setProjects] =
    useState<ChatSidebarProject[]>(SAMPLE_PROJECTS);

  const [activeId, setActiveId] = useState<string | null>(null);

  const [archived, setArchived] = useState<{
    conversation: ChatSidebarConversation;
    index: number;
  } | null>(null);

  const archive = (id: string) => {
    const index = conversations.findIndex((item) => item.id === id);
    const conversation = conversations[index];

    if (conversation) {
      setArchived({ conversation, index });
      setConversations((list) => list.filter((item) => item.id !== id));
    }
  };

  const undoArchive = () => {
    if (archived) {
      setConversations((list) => [
        ...list.slice(0, archived.index),
        archived.conversation,
        ...list.slice(archived.index),
      ]);
      setArchived(null);
    }
  };

  return (
    <div className="border-border h-120 w-(--size-sidebar) max-w-full overflow-hidden rounded-(--radius-menu) border-(length:--border-hairline)">
      <ChatSidebar
        activeConversationId={activeId}
        archived={archived?.conversation ?? null}
        conversations={conversations}
        header={
          <span className="ps-2 text-(length:--text-brand-size) leading-(--text-brand-leading) font-(--weight-semibold)">
            Acme
          </span>
        }
        now={NOW}
        onAddProject={(name) =>
          setProjects((list) => [...list, { id: `p-${list.length}`, name }])
        }
        onArchive={archive}
        onNewChat={() => setActiveId(null)}
        onOpenConversation={setActiveId}
        onStartProjectChat={() => setActiveId(null)}
        onTogglePin={(id) =>
          setConversations((list) =>
            list.map((item) =>
              item.id === id ? { ...item, pinned: !item.pinned } : item
            )
          )
        }
        onUndoArchive={undoArchive}
        projects={projects}
      />
    </div>
  );
};
