<!-- SPDX-FileCopyrightText: 2026 Bjørn Aagaard -->

<!-- SPDX-License-Identifier: MIT -->

# Docs E2E report

Written by `npm run e2e:docs` on 2026-10-29. It runs against the real static export of apps/docs, served from `apps/docs/out`. Raw results, including the rows that pass, are in `results/`. Page screenshots are in `pages/`.

## 1. Registry files match the published shadcn schema

Schemas fetched at run time from ui.shadcn.com. Validator: ajv 8 (draft-07), strict mode, allErrors, ajv-formats.

| File | Schema | Result | Errors |
| --- | --- | --- | --- |
| apps/docs/public/r/button.json | https://ui.shadcn.com/schema/registry-item.json | pass |  |
| apps/docs/public/r/composer.json | https://ui.shadcn.com/schema/registry-item.json | pass |  |
| apps/docs/public/r/conversation.json | https://ui.shadcn.com/schema/registry-item.json | pass |  |
| apps/docs/public/r/menu.json | https://ui.shadcn.com/schema/registry-item.json | pass |  |
| apps/docs/public/r/registry.json | https://ui.shadcn.com/schema/registry.json | pass |  |
| apps/docs/public/r/theme.json | https://ui.shadcn.com/schema/registry-item.json | pass |  |
| apps/docs/public/r/tip.json | https://ui.shadcn.com/schema/registry-item.json | pass |  |

## 2. A new app installs every item with shadcn add, then type checks and builds

The export was copied to /var/folders/sw/93tnyz5n6fj_b6n1rr00gxd80000gn/T/composerkit-e2e-hlPZuc/site. In that copy only, https://bjoernaagaard.github.io/ComposerKit/r/ was replaced with http://127.0.0.1:4321/r/ in r/button.json, r/composer.json, r/conversation.json, r/menu.json, r/registry.json, r/tip.json, so registry dependencies also come from the local server.

| Command | Folder | Exit code | Seconds |
| --- | --- | --- | --- |
| npx -y shadcn@latest init -d -y -n consumer --no-monorepo | . | 0 | 18 |
| npx -y shadcn@latest add http://127.0.0.1:4321/r/theme.json -y -o | consumer | 0 | 1 |
| npx -y shadcn@latest add http://127.0.0.1:4321/r/button.json -y -o | consumer | 0 | 1 |
| npx -y shadcn@latest add http://127.0.0.1:4321/r/tip.json -y -o | consumer | 0 | 1 |
| npx -y shadcn@latest add http://127.0.0.1:4321/r/menu.json -y -o | consumer | 0 | 1 |
| npx -y shadcn@latest add http://127.0.0.1:4321/r/composer.json -y -o | consumer | 0 | 1 |
| npx -y shadcn@latest add http://127.0.0.1:4321/r/conversation.json -y -o | consumer | 0 | 1 |
| npx tsc --noEmit | consumer | 0 | 1 |
| npx next build | consumer | 0 | 4 |

Temp folder: `/var/folders/sw/93tnyz5n6fj_b6n1rr00gxd80000gn/T/composerkit-e2e-hlPZuc` (outside the repo).

## 3. Accessibility, keyboard and sizes on the static export

### axe-core, every rule axe runs by default

| Page          | Scheme | Violations |
| ------------- | ------ | ---------- |
| /             | light  | none       |
| /theme        | light  | none       |
| /button       | light  | none       |
| /tip          | light  | none       |
| /menu         | light  | none       |
| /composer     | light  | none       |
| /conversation | light  | none       |
| /app-shell    | light  | none       |
| /             | dark   | none       |
| /theme        | dark   | none       |
| /button       | dark   | none       |
| /tip          | dark   | none       |
| /menu         | dark   | none       |
| /composer     | dark   | none       |
| /conversation | dark   | none       |
| /app-shell    | dark   | none       |

### Page sections in order

| Page | Result | Headings found |
| --- | --- | --- |
| /theme | pass | Install, Demo, Anatomy, Examples, API reference, Keyboard, Accessibility, Theming |
| /button | pass | Install, Demo, Anatomy, Examples, API reference, Keyboard, Accessibility, Theming |
| /tip | pass | Install, Demo, Anatomy, Examples, API reference, Keyboard, Accessibility, Theming |
| /menu | pass | Install, Demo, Anatomy, Examples, API reference, Keyboard, Accessibility, Theming |
| /composer | pass | Install, Demo, Anatomy, Examples, API reference, Keyboard, Accessibility, Theming |
| /conversation | pass | Install, Demo, Anatomy, Examples, API reference, Keyboard, Accessibility, Theming |

### Keyboard rows from spec/functional.md

Keyboard and size rows are listed, not gated. A mismatch does not fail the run; every one is in the list at the end. The spec describes a reference app, so each row is a finding to review, not a test that ComposerKit must pass.

| Rows | Pass | Mismatch | Not checkable |
| ---- | ---- | -------- | ------------- |
| 60   | 47   | 7        | 6             |

### Size rows from spec/functional.md (about 1 px tolerance)

| Rows | Pass | Mismatch | Not checkable |
| ---- | ---- | -------- | ------------- |
| 104  | 67   | 24       | 13            |

## 4. Every old catalog screenshot has a docs example

Baseline: 37 ids, light and dark, in `catalog-before/`. Docs screenshots in `docs-after/`. The ratio is the share of pixels that differ after padding both images to the same size, so a size change counts.

| Ids | Found in light and dark | Missing |
| --- | ----------------------- | ------- |
| 37  | 37                      | none    |

| Id | Page | Light before | Light after | Light diff | Dark diff |
| --- | --- | --- | --- | --- | --- |
| button--default | /button | 1104 x 32 | 1059 x 33 | 6.9% | 6.9% |
| button--ghost | /button | 1104 x 32 | 1059 x 33 | 6.9% | 6.9% |
| button--outline | /button | 1104 x 32 | 1059 x 33 | 6.9% | 6.9% |
| composer--inline | /composer | 641 x 84 | 641 x 85 | 3.1% | 2.8% |
| composer--roomy | /composer | 641 x 177 | 641 x 178 | 1.7% | 1.6% |
| composer--stacked | /composer | 641 x 138 | 641 x 139 | 2.2% | 2.0% |
| composer-state--attached | /composer | 640 x 212 | 641 x 212 | 0.9% | 0.5% |
| composer-state--chat-mode | /composer | 640 x 98 | 641 x 99 | 2.8% | 2.7% |
| composer-state--empty | /composer | 640 x 98 | 641 x 99 | 2.7% | 2.6% |
| composer-state--listening | /composer | 640 x 98 | 641 x 99 | 2.5% | 2.4% |
| composer-state--long-draft | /composer | 640 x 279 | 641 x 280 | 5.3% | 5.2% |
| composer-state--no-limits | /composer | 640 x 98 | 641 x 99 | 2.7% | 2.6% |
| composer-state--send-failed | /composer | 640 x 130 | 641 x 131 | 4.5% | 4.4% |
| composer-state--sending | /composer | 640 x 98 | 641 x 99 | 4.3% | 4.1% |
| composer-state--too-large | /composer | 640 x 155 | 641 x 156 | 1.2% | 1.2% |
| composer-state--typing | /composer | 640 x 98 | 641 x 99 | 4.3% | 4.1% |
| composer-state--unsupported | /composer | 640 x 98 | 641 x 99 | 2.7% | 2.6% |
| composer-state--upload-offline | /composer | 640 x 155 | 641 x 155 | 0.6% | 0.6% |
| composer-state--uploading | /composer | 640 x 155 | 641 x 156 | 2.0% | 2.0% |
| conversation--bubbles | /conversation | 1104 x 640 | 1059 x 641 | 6.2% | 6.4% |
| conversation--document | /conversation | 1104 x 640 | 1059 x 641 | 6.3% | 6.3% |
| conversation--transcript | /conversation | 1104 x 640 | 1059 x 641 | 6.9% | 6.9% |
| conversation-row--compact | /app-shell | 288 x 217 | 288 x 218 | 5.9% | 7.2% |
| conversation-row--measured | /app-shell | 288 x 265 | 288 x 266 | 5.1% | 6.1% |
| conversation-row--two-line | /app-shell | 288 x 377 | 288 x 378 | 4.4% | 5.1% |
| icon-button--control | /button | 111 x 28 | 110 x 29 | 4.3% | 4.3% |
| icon-button--pill | /button | 87 x 28 | 87 x 29 | 4.3% | 3.9% |
| icon-button--row | /button | 79 x 24 | 79 x 25 | 6.0% | 6.1% |
| icon-button--small | /button | 94 x 28 | 94 x 29 | 3.4% | 3.4% |
| menu--compact | /menu | 279 x 28 | 279 x 29 | 17.8% | 14.5% |
| menu--regular | /menu | 181 x 28 | 181 x 29 | 19.5% | 16.3% |
| mode-toggle--pill | /app-shell | 289 x 36 | 289 x 37 | 3.6% | 4.2% |
| mode-toggle--segmented | /app-shell | 332 x 36 | 331 x 37 | 5.3% | 4.5% |
| mode-toggle--underline | /app-shell | 283 x 36 | 283 x 37 | 6.0% | 4.9% |
| palette--swatches | /theme | 1104 x 312 | 1059 x 313 | 11.1% | 11.2% |
| title-bar-tabs--filled | /app-shell | 1104 x 78 | 1059 x 79 | 7.0% | 7.5% |
| title-bar-tabs--underline | /app-shell | 1104 x 78 | 1059 x 79 | 7.5% | 7.6% |

## 5. next build passes and next-validate-link finds no broken links

| Step | Result | Detail |
| --- | --- | --- |
| npm run build --workspace @composerkit/docs | exit 0 | 3 s |
| next-validate-link on content/docs/*.mdx | no broken links | 8 files, 8 known URLs |

## Every mismatch

### axe violations

None.

### Keyboard mismatches

| Spec line | Keys and context | Spec says | What happened | Where |
| --- | --- | --- | --- | --- |
| 140 | Tab, Tab order, one-row layout, starting from the add button | add button, text field, model picker, dictate, then the trailing button when it is enabled | button "Add files and more" → button "Project rules, change permissions" → textarea "Describe a task" → button "Sparrow 3 Balanced effort, choose model" → button "Dictate" | /composer [data-example="composer--inline"] |
| 251 | Click on the jump button, After clicking jump to latest | Stays on the jump button | focus on the page (body), jump button still on the page: false | /conversation [data-example="conversation--document"] |
| 318 | Enter, An item highlighted | Runs the highlighted item. The menu closes on the same step. Enter never sends. | file picker false, menu open false | /composer [data-example="composer--stacked"] |
| 352 | Down, Up, Model picker | Move between items. Up from the first item wraps to the last. | first menuitem "Model: Sparrow 3", Up gives menuitem "Model: Sparrow 3" | /composer [data-example="composer--stacked"] |
| 377 | Click, then Down, Click on the trigger | Opens the menu with focus on the menu container. Down then focuses the first item. | after click button "More actions", after Down menuitem "Pin chat" | /menu [data-example="menu--demo"] |
| 378 | Down, Up, In the menu | Move between items. No wrap: Down on the last item and Up on the first item stay put. | Up on button "More actions" gives menuitem "Archive chatYou can undo it right away"; Down on menuitem "Archive chatYou can undo it right away" gives menuitem "Archive chatYou can undo it right away" | /menu [data-example="menu--demo"] |
| 381 | Right, On a submenu item | Opens the submenu and focuses its first item. The parent item reports expanded. | focus on menuitemradio "Same length", parent aria-expanded=null | /menu [data-example="menu--demo"] |

### Size mismatches

| Spec line | Part | Spec says | Measured | Where |
| --- | --- | --- | --- | --- |
| 50 | Gap from add button to text, empty chat | 4 | 38 | /composer [data-example="composer--inline"] |
| 51 | Text box, docked | 36 tall | 20 tall | /conversation [data-example="conversation--bubbles"] |
| 52 | Model picker, empty chat | 102 to 102 x 28 | 99.9 x 28 | /composer [data-example="composer--inline"] |
| 52 | Model picker, docked | 102 to 103 x 28 | 66 x 28 | /conversation [data-example="conversation--bubbles"] |
| 208 | Reply text | about 16 pt type, line pitch about 22.7 | 14 type, 20 pitch | /conversation [data-example="conversation--bubbles"] |
| 215 | Prompt bubble alignment | about 5 short of the column's right edge | 0 | /conversation [data-example="conversation--bubbles"] |
| 216 | Prompt bubble height with one line | 43 | 40, 40, 40 | /conversation [data-example="conversation--bubbles"] |
| 217 | Prompt bubble padding | about 10 to 12 horizontal, about 13 vertical around a 17 pt glyph box | 16 horizontal, 11.5 vertical | /conversation [data-example="conversation--bubbles"] |
| 218 | Prompt bubble radius | about 18 | 20 | /conversation [data-example="conversation--bubbles"] |
| 220 | Prompt action row | right-aligned, 4 below the bubble; copy 27 x 26, share 31 x 30, edit 27 x 26 | 6 below, right edges 1215 and bubble 1215; copy 27 x 26, share 27 x 26, edit 27 x 26 | /conversation [data-example="conversation--bubbles"] |
| 227 | Gap from prompt action row to reply text | about 11 | 27 | /conversation [data-example="conversation--bubbles"] |
| 228 | Gap from prompt bubble bottom to reply text | about 49 | 63 | /conversation [data-example="conversation--bubbles"] |
| 230 | Reply action row | about 6 below the last line; buttons 27 x 26 or 27 x 27 on a 28 pitch; share 31 x 30; more 25 x 25 | 17 below; Copy 27 x 26, Helpful 27 x 26, This browser can’t read aloud 27 x 26, Share 27 x 26, Write again 27 x 26, More 27 x 26; pitch 28, 28, 28, 28, 28 | /conversation [data-example="conversation--bubbles"] |
| 232 | Gap from reply action row to the next prompt bubble | about 12 | 16 | /conversation [data-example="conversation--bubbles"] |
| 258 | Heading at the start of each prompt turn | level 4, visually hidden | h2 "You said:", 1 wide | /conversation [data-example="conversation--bubbles"] |
| 259 | Heading at the start of each reply turn | level 4, visually hidden | h2 "Assistant said:", 1 wide | /conversation [data-example="conversation--bubbles"] |
| 260 | Heading before the composer | a level-4 heading marking the latest response | h2 "New message" | /conversation [data-example="conversation--bubbles"] |
| 271 | Message action buttons | 27 x 26 (some 27 x 27, share 31 x 30) | Copy 27 x 26, Share 27 x 26, Edit 27 x 26, Helpful 27 x 26, This browser can’t read aloud 27 x 26, Write again 27 x 26, More 27 x 26 | /conversation [data-example="conversation--bubbles"] |
| 277 | Sidebar row trailing buttons (more, pin) | 20 x 20 or 20 x 21 | 24 x 24, 24 x 24 | /app-shell [data-example="conversation-row--measured"] |
| 365 | Row more menu placement | above the trigger, left edge 2 right of the trigger's, 4 gap | below, gap 4.5, left edge 0 right of the trigger's | /menu [data-example="menu--demo"] |
| 367 | Row more menu items | 185 x 29 or 30 | Sent today at 09:41 183 x 29, Pin chat 183 x 29, Redo with 183 x 29, Archive chatYou can undo it right away 183 x 47.2 | /menu [data-example="menu--demo"] |
| 369 | Row more submenu | opens right, left edge 5 right of the parent panel, top 3 above the parent item, 180 wide, items 172 x 29 or 30 | left edge 4 right of the parent, top 3 above the parent item, 180 wide, items 170 x 29, 170 x 29, 170 x 29 | /menu [data-example="menu--demo"] |
| 434 | Chat row | 30 tall on a 31 pitch, 261 to 272 wide, 8 text inset, radius about 8; on hover two 20 pt buttons 8 apart | 30 tall, pitch 31, 270 wide, inset 8, radius 12.5, 2 trailing buttons 24 x 24 and 24 x 24 4 apart | /app-shell [data-example="conversation-row--measured"] |
| 435 | Mode switch, segmented variant | two 113 x 36 toggle buttons | 109 x 30, 109 x 30 | /app-shell [data-example="mode-toggle--segmented"] |

### Rows that could not be checked

| Spec line | Row | Spec says | Why not |
| --- | --- | --- | --- |
| 142 | Shift+Escape, Focus outside the composer | Opens a confirmation dialog for a bulk mark-as-read action. | ComposerKit has no bulk mark-as-read action or dialog. This is app behavior of the reference app, not part of any registry item. |
| 155 | Typing a letter, A sidebar chat row | Composer. The field receives it. | No docs page puts a sidebar row and a type-to-focus composer together; the rows are on /app-shell, the composer on /conversation. |
| 156 | Typing a letter, A chat tab in the title bar | Composer. The field receives it. | No docs page puts title bar tabs and a type-to-focus composer together; the tabs are on /app-shell, the composer on /conversation. |
| 160 | Typing a letter, A modal dialog (focus on its checkbox) | Dialog keeps focus. The composer does not receive it. | No registry item opens a modal dialog, so no demo has one. |
| 184 | Enter, then Escape in the system dialog, Run an add-menu item, then cancel the system dialog it opened | Text field | A headless browser opens no system file dialog to cancel; Playwright only reports that a file chooser was requested (lines 132 and 318 check that). |
| 384 | Enter or Space, On an item | Not tested, because it would run the action | The spec gives no expected result for this row. |
| 57 | Gap from disclaimer line to composer | about 9 from a one-line disclaimer to the composer | No registry item renders a disclaimer line, and the spec does not give its text. |
| 274 | Title-bar and header icon buttons | 28 x 28 | The title bar tabs example shows only the tab strip; the back, forward, sidebar and view buttons are not in any example. |
| 275 | Sidebar header buttons (activity, search) | 28 x 28 | No example renders the sidebar header. |
| 276 | Icon rail buttons | 36 x 36, selected radius about 8 | No example renders the icon rail. |
| 368 | Row more menu separators | none seen in this menu | Separators are content the app passes in. The menu demo adds one on purpose to show the MenuSeparator part. |
| 426 | Title bar | 44 tall, back and forward 28 x 28 6 apart, sidebar toggle 28 x 28 | This part of the playground app shell is not a registry item and no docs example renders it. |
| 428 | Title bar right side | two 28 x 28 view toggles, 6 apart | This part of the playground app shell is not a registry item and no docs example renders it. |
| 429 | Icon rail | 52 wide, 36 x 36 buttons, 8 inset, 44 pitch | This part of the playground app shell is not a registry item and no docs example renders it. |
| 430 | Sidebar | 288 wide, 16 pt splitter | This part of the playground app shell is not a registry item and no docs example renders it. |
| 431 | Sidebar header | mode switcher about 109 x 32, two 28 x 28 buttons 6 apart | This part of the playground app shell is not a registry item and no docs example renders it. |
| 432 | New chat row | 272 x 30 | This part of the playground app shell is not a registry item and no docs example renders it. |
| 433 | Section header | 25 tall, 16 to 20 between sections | This part of the playground app shell is not a registry item and no docs example renders it. |
| 436 | Empty chat | heading 34 tall, composer 24 below, suggestion rows 40 tall | This part of the playground app shell is not a registry item and no docs example renders it. |
