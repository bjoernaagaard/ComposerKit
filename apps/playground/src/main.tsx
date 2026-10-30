// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

import "@/main.css";
import "@/designs/emil/emil.css";
import "@/designs/apple/apple.css";
import "@/designs/glass/glass.css";
import "@/designs/taste/taste.css";
import { lazy, StrictMode, Suspense, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";

import { ChatApp } from "@/blocks/chat-app/chat-app";
import { readDocumentShellCookie } from "@/components/app-shell/persist";
import type { ConversationLayout } from "@/components/conversation/layouts";
import { DirectionSelector, startDirection } from "@/designs/direction";
import { startTheme } from "@/theme/apply";

import { AppearanceMenu } from "./appearance-menu";
import { readConversationLayout, saveConversationLayout } from "./saved-layout";
import { ComposerStates } from "./states/composer/composer-states";

// The stress harness is for the docs E2E only. In a production build the
// condition is false, so the bundler drops the import.
const Stress = import.meta.env.DEV
  ? lazy(async () => {
      const module = await import("./states/stress/stress");

      return { default: module.Stress };
    })
  : null;

startTheme(document.documentElement);

startDirection();

// The sidebar's saved state and width are read before the first render,
// so the first frame matches the last visit.
const Demo = () => {
  const shell = useMemo(() => readDocumentShellCookie(), []);

  const [conversationLayout, setConversationLayout] = useState(
    readConversationLayout
  );

  const changeLayout = (layout: ConversationLayout) => {
    saveConversationLayout(layout);
    setConversationLayout(layout);
  };

  return (
    <ChatApp
      conversationLayout={conversationLayout}
      defaultOpen={shell.open}
      defaultWidth={shell.width}
      railFooter={
        <AppearanceMenu
          conversationLayout={conversationLayout}
          onConversationLayoutChange={changeLayout}
        />
      }
      titleBarEnd={<DirectionSelector />}
    />
  );
};

const root = document.querySelector("#root");

if (!root) {
  throw new Error("index.html is missing the #root element");
}

// /states/composer is the state-machine harness for the composer. The
// component catalog now lives in the docs site (apps/docs). Routes match the
// end of the path, because GitHub Pages serves the harness both under the
// playground's base (/ComposerKit/playground/states/composer/) and at its
// older link outside it (/ComposerKit/states/composer/). Pages also adds a
// trailing slash to each route.
const TRAILING_SLASH = /\/$/u;

const path = window.location.pathname.replace(TRAILING_SLASH, "");

const page = (): ReactNode => {
  if (path.endsWith("/states/composer")) {
    return <ComposerStates />;
  }

  if (Stress && path.endsWith("/states/stress")) {
    return (
      <Suspense>
        <Stress />
      </Suspense>
    );
  }

  return <Demo />;
};

createRoot(root).render(<StrictMode>{page()}</StrictMode>);
