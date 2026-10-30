# Changelog

The list below describes the changes in each version of the `composerkit` npm package. The shadcn registry on the docs site changes with every merge to `main`, so it has no versions.

## 0.1.1 (2026-10-30)

Version 0.1.1 adds the app shell and the chat sidebar, and it makes the components work in right-to-left pages. Nothing that 0.1.0 had changes its name or its props.

- App shell
  - The app shell is a set of parts, such as the title bar, the rail, the sidebar, the splitter and the main region, that share their state through `AppShellProvider`. Each part is its own module under `composerkit/components/app-shell/`, so an app leaves out the parts it doesn't need.
  - Cmd+B on a Mac, or Ctrl+B elsewhere, shows and hides the sidebar.
  - The shell saves whether the sidebar is open, and its width, in the `composerkit_shell` cookie. In Next.js, a server component calls `readShellCookie` from `composerkit/components/app-shell/persist` and passes the values to the provider, so the first frame matches the last visit. An app without a server calls `readDocumentShellCookie` instead.
  - On narrow widths the sidebar becomes a modal drawer with the rail inside it. Escape, a tap outside it or a swipe closes it, and focus goes back to the sidebar toggle.
  - People can resize the sidebar from 220 to 480 pixels with the splitter on its edge, by dragging it or with the arrow keys, Home and End. A double click sets the theme's width again.
  - The title bar's tabs can be closed with their close button or with Delete. Tabs that don't fit stay reachable from an overflow menu after the new-tab button.
  - A skip link is the first Tab stop and moves focus to the main region. The title bar is a banner, the rail is a navigation landmark, the sidebar is a complementary landmark, and the main region is the tab panel.
- Chat sidebar
  - `ChatSidebar` from `composerkit/components/chat-sidebar/chat-sidebar` lists the chats with New chat, search, pinned chats, projects with their own sections, and the recent chats with a filter. Each section folds away.
  - Archiving a chat shows Undo above the list, so a chat archived by mistake comes back.
  - A row can render as a link with `renderLink`, so Cmd-click, middle-click and Copy link work.
  - A tap on a row opens the chat. The row's more and pin buttons take no tap until they show, so a tap never hits a button the person couldn't see.
  - Every word the sidebar and the shell show comes from a `labels` prop, so an app can translate all of them.
- Registry
  - The `chat-app` block installs a whole chat app on one page: the app shell, the chat sidebar, a home view with the composer, and the conversation, on the sample data. It is starter code, so it is in the shadcn registry only, not in the npm package.
- Fixes
  - The current page in the rail and the sidebar keeps a visible cue in forced colors mode, such as Windows high contrast, where fills and colors alone are lost.
  - Focus stays inside the sidebar while it is a drawer on narrow widths, and it goes to the main region after someone picks or starts a chat there.
  - A tap on a chat row opens the chat on every touch device, including screens whose main pointer can hover.
  - With reduced motion, the shell stops sliding and resizing, but opacity and color still fade, so changes don't happen in a single frame.
- Components
  - A button is never wider than its container. To let a label from data end in an ellipsis, wrap it in `<span className="truncate">`.
  - The inline composer moves to two rows when its placeholder doesn't fit on one, so a narrow box no longer wraps "Send a message" a few letters to a line.
  - A code block in a reply draws its keyboard focus ring inside the block, where the block's rounded corners no longer cut it off.
  - Text from people and from the model runs in its own direction. An Arabic or Hebrew message reads right to left in an English app, and English reads left to right in a right-to-left app. Code always runs left to right.
  - Padding, margins and corners use the start and end sides instead of left and right, so the composer, the conversation and the buttons mirror in a right-to-left page. For a right-to-left app, set `dir="rtl"` on the page and wrap it in Base UI's `DirectionProvider` with `direction="rtl"`. Then submenus open to the left, their arrows point left, and the arrow keys in the model menu follow.

## 0.1.0 (2026-10-29)

Version 0.1.0 is the first version on npm. It has the same components as the shadcn registry, compiled to JavaScript with type declarations.

- Components
  - The composer, with attachments, dictation, the model and permission menus, and the Work mode tray
  - The conversation view, with three layouts, replies that stream in, copy and retry
  - The button, the icon button, the tip and the menu
- Package
  - Each source file is a module at the same path, such as `composerkit/components/composer/composer`
  - `composerkit/styles.css` adds the theme in light and dark, and it tells Tailwind CSS v4 where the component classes are
