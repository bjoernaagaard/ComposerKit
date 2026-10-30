// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

"use client";

import { useState } from "react";

import { ConversationRow } from "@/components/chat-sidebar/conversation-row";
import { SAMPLE_CONVERSATIONS } from "@/content/sample";

const ROW_SAMPLE_SIZE = 4;

// Rows that are real links. renderLink returns the element each row
// renders, here an <a> to a hash route; with a router, return its link.
// Cmd-click, Ctrl-click and middle-click open the chat in a new tab, and
// a plain click opens it here.
export const ChatSidebarLinks = () => {
  const [conversations, setConversations] = useState(() =>
    SAMPLE_CONVERSATIONS.slice(0, ROW_SAMPLE_SIZE)
  );

  const [activeId, setActiveId] = useState<string | null>(null);

  return (
    <ul className="bg-sidebar border-border flex max-w-(--size-sidebar) flex-col gap-(--size-row-gap) rounded-(--radius-menu) border-(length:--border-hairline) p-(--space-sidebar-padding)">
      {conversations.map((conversation) => (
        <li key={conversation.id}>
          <ConversationRow
            active={conversation.id === activeId}
            conversation={conversation}
            onArchive={() =>
              setConversations((list) =>
                list.filter((item) => item.id !== conversation.id)
              )
            }
            onOpen={() => setActiveId(conversation.id)}
            onTogglePin={() =>
              setConversations((list) =>
                list.map((item) =>
                  item.id === conversation.id
                    ? { ...item, pinned: !item.pinned }
                    : item
                )
              )
            }
            // The row fills the link with the chat's title.
            // oxlint-disable-next-line jsx-a11y/anchor-has-content, jsx-a11y/control-has-associated-label -- the row renders the title inside it
            renderLink={(chat) => <a href={`#/c/${chat.id}`} />}
          />
        </li>
      ))}
    </ul>
  );
};
