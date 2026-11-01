// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

"use client";

import { ChatApp } from "@/blocks/chat-app/chat-app";

// The whole chat app on the sample data. This one sits inside a docs page
// that already has its own main region, so it is embedded: its sidebar
// renders as a <section>, its main region as a <div>, and it doesn't save
// its layout. On a page of its own, leave embedded out.
export const ChatAppDemo = () => (
  <div className="border-border h-180 overflow-hidden rounded-(--radius-menu) border-(length:--border-hairline)">
    <ChatApp embedded />
  </div>
);
