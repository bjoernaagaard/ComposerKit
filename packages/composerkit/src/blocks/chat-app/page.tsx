// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

import { ChatApp } from "@/blocks/chat-app/chat-app";

// The chat app as a page. It fills the window, and the shell inside it
// lays out by its own width.
const ChatPage = () => (
  <div className="h-dvh">
    <ChatApp />
  </div>
);

export default ChatPage;
