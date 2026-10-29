// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

"use client";

import { ConversationView } from "@/components/conversation/conversation-view";
import { COMPOSER_OPTIONS } from "@/content/catalog";
import { PLACEHOLDER_REPLY, SAMPLE_TURNS } from "@/content/conversation";
import { SAMPLE_PROJECTS } from "@/content/sample";

const DEMO_TURNS = SAMPLE_TURNS.slice(0, 2);

const placeholderReply = () => PLACEHOLDER_REPLY;

// A short chat. Send a message to watch a reply stream in.
export const ConversationDemo = () => (
  <div className="bg-background border-border h-120 overflow-hidden rounded-(--radius-menu) border-(length:--border-hairline)">
    <ConversationView
      options={COMPOSER_OPTIONS}
      projects={SAMPLE_PROJECTS}
      reply={placeholderReply}
      title="Demo conversation"
      turns={DEMO_TURNS}
    />
  </div>
);
