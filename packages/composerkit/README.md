# composerkit

composerkit is a set of React components for chat apps. It has a message box, called the composer, and a conversation view that shows the chat above the composer. It also has an app shell for the window around them, a chat sidebar that lists the chats, and the buttons, menus and tooltips that the other components use. The components are built on [Base UI](https://base-ui.com) and styled with Tailwind CSS v4.

![A short chat in the conversation view, with a draft in the composer at the bottom](https://raw.githubusercontent.com/Snestra/ComposerKit/main/.github/assets/conversation.png)

You can try every component together in the [demo app](https://snestra.github.io/ComposerKit/playground/). The same components are also a shadcn registry, so you can copy the source into your app instead of installing the package. The [GitHub repository](https://github.com/Snestra/ComposerKit) explains both options.

## Install

Your app needs React 19 and Tailwind CSS v4. Install the package, and then import its stylesheet after Tailwind in your main CSS file.

```bash
npm install composerkit
```

```css
@import "tailwindcss";
@import "composerkit/styles.css";
```

The stylesheet adds the ComposerKit theme in light and dark, and the app shell's and the chat sidebar's rules. It also tells Tailwind to scan the components for the classes they use. Without the import, the components render with no styles.

## Import paths

The package has no main entry. Each component is its own module, so you import it by its path, and your bundler only includes the modules you use.

```text
composerkit/
├── styles.css                                   # the theme and the Tailwind setup
├── components/composer/composer                 # Composer, the message box
├── components/composer/machine                  # the composer state, its actions and the reducer
├── components/composer/use-composer-controller  # useComposerController, which runs the composer
├── components/composer/options                  # the types for the model, effort and permission menus
├── components/conversation/conversation-view    # ConversationView, an open chat with the composer
├── components/conversation/types                # Turn, Block and toBlocks
├── components/app-shell/app-shell-provider      # AppShellProvider and useAppShell, the shell's state and Cmd+B
├── components/app-shell/app-shell               # AppShell, AppShellSkipLink, AppShellSidebar and AppShellMain
├── components/app-shell/title-bar               # the title bar, back and forward, and the sidebar toggle
├── components/app-shell/rail                    # the rail of destinations
├── components/app-shell/tabs                    # the title bar's tabs, which people can close and move
├── components/app-shell/splitter                # the splitter that resizes the sidebar
├── components/app-shell/persist                 # readShellCookie, which reads the saved layout
├── components/chat-sidebar/chat-sidebar         # ChatSidebar, the list of chats and projects
├── components/chat-sidebar/conversation-row     # the chat and project types, and one chat row
├── components/ui/button                         # Button and buttonVariants
├── components/ui/icon-button                    # IconButton, a button with a tip
├── components/ui/menu                           # the menu parts
├── components/ui/tip                            # Tip and TipProvider
└── lib/utils                                    # cn, which joins class names
```

The shadcn registry items use the shadcn import paths. Each module in the package has the same path as its source file, so you can change an import from a registry item by replacing `@/` with `composerkit/`.

```diff
-import { Composer } from "@/components/composer/composer";
+import { Composer } from "composerkit/components/composer/composer";
```

## Show a conversation

The conversation view needs the first turns of the chat, the choices for the composer's menus, and a `reply` function. When someone sends a message, the view calls `reply` and shows the answer a few characters at a time.

```tsx
import type { ComposerOptions } from "composerkit/components/composer/options";
import { ConversationView } from "composerkit/components/conversation/conversation-view";
import { toBlocks } from "composerkit/components/conversation/types";
import type { Turn } from "composerkit/components/conversation/types";

const options: ComposerOptions = {
  efforts: [{ id: "normal", label: "Normal" }],
  models: [{ id: "fast", label: "Fast" }],
  permissions: [{ id: "ask", label: "Ask first" }],
};

const turns: Turn[] = [
  {
    attachments: [],
    blocks: toBlocks([
      { kind: "paragraph", text: "What does ComposerKit draw?" },
    ]),
    id: "t1",
    role: "user",
  },
  {
    attachments: [],
    blocks: toBlocks([
      { kind: "paragraph", text: "A message box and the chat above it." },
    ]),
    id: "t2",
    role: "assistant",
  },
];

export const App = () => (
  <div className="bg-background text-foreground h-screen">
    <ConversationView
      options={options}
      projects={[]}
      reply={() => [{ kind: "paragraph", text: "Thanks. Here is a reply." }]}
      title="Help chat"
      turns={turns}
    />
  </div>
);
```

The conversation view fills its container, so give the container a height. The `bg-background` and `text-foreground` classes give the page the theme's colors.

## Lay out a chat app

The app shell is a set of parts that share their state through `AppShellProvider`. Leave out the parts you don't need, such as the tabs or the rail. When you pass `onMoveTab` to the tabs, people can move a tab by dragging it, with Ctrl+Shift+ArrowLeft and ArrowRight, or from the tab menu, and your app puts the tab at the new index in its own list. Cmd+B on a Mac, or Ctrl+B elsewhere, shows and hides the sidebar, and on narrow widths the sidebar becomes a drawer with the rail inside it. The chat sidebar goes inside `AppShellSidebar`. Your app owns the chats and gets a callback for each change.

The rail items take an icon from `lucide-react`. The package depends on it, but add it to your app's dependencies too, so your imports don't rely on the package's.

```tsx
"use client";

import {
  AppShell,
  AppShellMain,
  AppShellSidebar,
  AppShellSkipLink,
} from "composerkit/components/app-shell/app-shell";
import { AppShellProvider } from "composerkit/components/app-shell/app-shell-provider";
import {
  AppShellRail,
  AppShellRailContent,
  AppShellRailItem,
} from "composerkit/components/app-shell/rail";
import { AppShellSplitter } from "composerkit/components/app-shell/splitter";
import {
  AppShellSidebarToggle,
  AppShellTitleBar,
  AppShellTitleBarStart,
} from "composerkit/components/app-shell/title-bar";
import { ChatSidebar } from "composerkit/components/chat-sidebar/chat-sidebar";
import type { ChatSidebarConversation } from "composerkit/components/chat-sidebar/conversation-row";
import { HomeIcon, InboxIcon } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";

const firstChats: ChatSidebarConversation[] = [
  {
    id: "c1",
    pinned: false,
    projectId: null,
    title: "Plan the launch",
    updatedAt: "2026-10-30T09:00:00Z",
  },
];

export const ChatLayout = ({
  defaultOpen,
  defaultWidth,
  children,
}: {
  defaultOpen?: boolean;
  defaultWidth?: number;
  children: ReactNode;
}) => {
  const [chats, setChats] = useState(firstChats);
  const [activeId, setActiveId] = useState<string | null>("c1");
  const [archived, setArchived] = useState<ChatSidebarConversation | null>(
    null
  );

  const archive = (id: string) => {
    setArchived(chats.find((chat) => chat.id === id) ?? null);
    setChats(chats.filter((chat) => chat.id !== id));
  };

  return (
    <AppShellProvider defaultOpen={defaultOpen} defaultWidth={defaultWidth}>
      <AppShell>
        <AppShellSkipLink />
        <AppShellTitleBar>
          <AppShellTitleBarStart>
            <AppShellSidebarToggle />
          </AppShellTitleBarStart>
        </AppShellTitleBar>
        <AppShellRail>
          <AppShellRailContent>
            <AppShellRailItem current icon={HomeIcon} label="Home" />
            <AppShellRailItem icon={InboxIcon} label="Inbox" />
          </AppShellRailContent>
        </AppShellRail>
        <AppShellSidebar>
          <ChatSidebar
            activeConversationId={activeId}
            archived={archived}
            conversations={chats}
            onAddProject={() => undefined}
            onArchive={archive}
            onNewChat={() => setActiveId(null)}
            onOpenConversation={setActiveId}
            onStartProjectChat={() => undefined}
            onTogglePin={(id) =>
              setChats(
                chats.map((chat) =>
                  chat.id === id ? { ...chat, pinned: !chat.pinned } : chat
                )
              )
            }
            onUndoArchive={() => {
              if (archived) {
                setChats([archived, ...chats]);
              }
              setArchived(null);
            }}
            projects={[]}
          />
        </AppShellSidebar>
        <AppShellSplitter />
        <AppShellMain>{children}</AppShellMain>
      </AppShell>
    </AppShellProvider>
  );
};
```

The shell fills its container, so give the container a height, such as `h-dvh`.

The provider saves whether the sidebar is open, and its width, in the `composerkit_shell` cookie. An app without a server passes the saved values in before it renders, so the first frame matches the last visit.

```tsx
import { readDocumentShellCookie } from "composerkit/components/app-shell/persist";

const shell = readDocumentShellCookie();

export const App = () => (
  <div className="bg-background text-foreground h-dvh">
    <ChatLayout defaultOpen={shell.open} defaultWidth={shell.width}>
      <h1 className="p-6 text-2xl">Hello</h1>
    </ChatLayout>
  </div>
);
```

## Use the composer on its own

The composer draws a state that your component owns. The `useComposerController` hook keeps the state in a reducer, and it gives the composer handlers for sending, uploads and dictation. When someone sends a message, the hook calls your function with the state that was sent, and then it clears the draft.

```tsx
import { Composer } from "composerkit/components/composer/composer";
import { initialComposer } from "composerkit/components/composer/machine";
import type { ComposerOptions } from "composerkit/components/composer/options";
import { useComposerController } from "composerkit/components/composer/use-composer-controller";

const options: ComposerOptions = {
  efforts: [{ id: "normal", label: "Normal" }],
  models: [{ id: "fast", label: "Fast" }],
  permissions: [{ id: "ask", label: "Ask first" }],
};

export const MessageBox = ({ onSend }: { onSend: (text: string) => void }) => {
  const composer = useComposerController(
    (sent) => onSend(sent.draft),
    initialComposer(options)
  );

  return (
    <Composer
      dispatch={composer.dispatch}
      handlers={composer.handlers}
      mode="chat"
      options={options}
      projects={[]}
      state={composer.state}
    />
  );
};
```

The hook doesn't upload files to a server. It moves each file's progress bar on a timer, so you can see the upload states. To upload files for real, write your own `ComposerHandlers` and dispatch the actions from `composerkit/components/composer/machine` as your upload runs.

## Dark theme and your own colors

The theme is a set of CSS variables, with light values on `:root` and dark values on `.dark`. Add the `dark` class to an element, such as `<html>`, to show the dark theme inside it.

To change a color or a size, set its variable after the import. Put the rule outside any `@layer`, so it comes after the theme in the cascade.

```css
@import "tailwindcss";
@import "composerkit/styles.css";

:root {
  --primary: #0a7d4f;
}

.dark {
  --primary: #5fd3a0;
}
```

`theme/tokens.css` in the package lists every variable.

## Next.js and React Server Components

Every module in the package starts with the `"use client"` directive, so Next.js loads the components on the client. A server component can't pass a function prop, such as `reply`, to a client component. Render the conversation view, the composer and the app shell from a file that starts with `"use client"`.

`composerkit/components/app-shell/persist` has no hooks and no `"use client"`, so a server component can read the saved layout from the cookie and pass it to the shell. Next.js 16 apps made with `create-next-app` turn on Cache Components, which needs the cookie read inside `<Suspense>`:

```tsx
import { readShellCookie } from "composerkit/components/app-shell/persist";
import { cookies } from "next/headers";
import { Suspense } from "react";

import { ChatLayout } from "./chat-layout";

const Shell = async () => {
  const shell = readShellCookie((await cookies()).toString());

  return (
    <ChatLayout defaultOpen={shell.open} defaultWidth={shell.width}>
      <h1 className="p-6 text-2xl">Hello</h1>
    </ChatLayout>
  );
};

export default function Home() {
  return (
    <div className="bg-background text-foreground h-dvh">
      <Suspense>
        <Shell />
      </Suspense>
    </div>
  );
}
```

## License

MIT
