<!-- SPDX-FileCopyrightText: 2026 Bjørn Aagaard -->

<!-- SPDX-License-Identifier: MIT -->

# Docs E2E report

Written by `npm run e2e:docs` on 2026-10-30. It runs against the real static export of apps/docs, served from `apps/docs/out`. Raw results, including the rows that pass, are in `results/`. Page screenshots are in `pages/`.

## 1. Registry files match the published shadcn schema

Schemas fetched at run time from ui.shadcn.com. Validator: ajv 8 (draft-07), strict mode, allErrors, ajv-formats.

| File | Schema | Result | Errors |
| --- | --- | --- | --- |
| apps/docs/public/r/app-shell.json | https://ui.shadcn.com/schema/registry-item.json | pass |  |
| apps/docs/public/r/button.json | https://ui.shadcn.com/schema/registry-item.json | pass |  |
| apps/docs/public/r/chat-app.json | https://ui.shadcn.com/schema/registry-item.json | pass |  |
| apps/docs/public/r/chat-sidebar.json | https://ui.shadcn.com/schema/registry-item.json | pass |  |
| apps/docs/public/r/composer.json | https://ui.shadcn.com/schema/registry-item.json | pass |  |
| apps/docs/public/r/conversation.json | https://ui.shadcn.com/schema/registry-item.json | pass |  |
| apps/docs/public/r/menu.json | https://ui.shadcn.com/schema/registry-item.json | pass |  |
| apps/docs/public/r/registry.json | https://ui.shadcn.com/schema/registry.json | pass |  |
| apps/docs/public/r/sample-data.json | https://ui.shadcn.com/schema/registry-item.json | pass |  |
| apps/docs/public/r/theme.json | https://ui.shadcn.com/schema/registry-item.json | pass |  |
| apps/docs/public/r/tip.json | https://ui.shadcn.com/schema/registry-item.json | pass |  |

## 2. A new app installs every item and the sample data, takes every example from its Code tab, then type checks and builds

The export was copied to /var/folders/sw/93tnyz5n6fj_b6n1rr00gxd80000gn/T/composerkit-e2e-Y3Dn3y/site. In that copy only, https://bjoernaagaard.github.io/ComposerKit/r/ was replaced with http://127.0.0.1:5881/r/ in r/app-shell.json, r/button.json, r/chat-app.json, r/chat-sidebar.json, r/composer.json, r/conversation.json, r/menu.json, r/registry.json, r/sample-data.json, r/tip.json, so registry dependencies also come from the local server. The temp folder is removed when the test ends.

| Command | Folder | Exit code | Seconds |
| --- | --- | --- | --- |
| npx -y shadcn@latest init -d -y -n consumer --no-monorepo | . | 0 | 24 |
| npx -y shadcn@latest add http://127.0.0.1:5881/r/theme.json -y -o | consumer | 0 | 1 |
| npx -y shadcn@latest add http://127.0.0.1:5881/r/button.json -y -o | consumer | 0 | 1 |
| npx -y shadcn@latest add http://127.0.0.1:5881/r/tip.json -y -o | consumer | 0 | 1 |
| npx -y shadcn@latest add http://127.0.0.1:5881/r/menu.json -y -o | consumer | 0 | 1 |
| npx -y shadcn@latest add http://127.0.0.1:5881/r/composer.json -y -o | consumer | 0 | 1 |
| npx -y shadcn@latest add http://127.0.0.1:5881/r/conversation.json -y -o | consumer | 0 | 1 |
| npx -y shadcn@latest add http://127.0.0.1:5881/r/app-shell.json -y -o | consumer | 0 | 1 |
| npx -y shadcn@latest add http://127.0.0.1:5881/r/chat-sidebar.json -y -o | consumer | 0 | 1 |
| npx -y shadcn@latest add http://127.0.0.1:5881/r/chat-app.json -y -o | consumer | 0 | 1 |
| npx -y shadcn@latest add http://127.0.0.1:5881/r/sample-data.json -y -o | consumer | 0 | 1 |
| npx tsc --noEmit | consumer | 0 | 2 |
| npx next build | consumer | 0 | 6 |

Temp folder: `/var/folders/sw/93tnyz5n6fj_b6n1rr00gxd80000gn/T/composerkit-e2e-Y3Dn3y` (outside the repo).

### Examples copied from the Code tab

Every example file on the item pages, copied with the docs' Copy button into `components/examples/` of the new app before tsc and next build. Same as the file means the copied text equals the example file minus its license header.

### The chat-app page

next start served `http://127.0.0.1:5882/chat`. Shell in the server HTML: yes. Heading: Start with a task. Landmarks: banner, navigation Main, complementary Sidebar, navigation Chats, main. Console errors: none.

Expected: the Code tab files in each item page's built HTML, /theme 2, /button 3, /tip 2, /menu 2, /composer 2, /conversation 2, /app-shell 3, /chat-sidebar 3, /chat-app 2; 21 files in all. Copied: 21. Missing: none. Extra: none.

| Page | First example | File | Tab | Characters | Same as the file |
| --- | --- | --- | --- | --- | --- |
| /theme | theme--demo | theme-demo.tsx | Code | 806 | yes |
| /theme | palette--swatches | palette.tsx | Code | 1141 | yes |
| /button | button--demo | button-demo.tsx | Code | 468 | yes |
| /button | button--default | button-row.tsx | Code | 772 | yes |
| /button | icon-button--small | icon-button-pair.tsx | Code | 993 | yes |
| /tip | tip--demo | tip-demo.tsx | Code | 476 | yes |
| /tip | tip--icon-buttons | tip-icon-buttons.tsx | Code | 799 | yes |
| /menu | menu--demo | menu-demo.tsx | Code | 1859 | yes |
| /menu | menu--regular | menu-density.tsx | Code | 1421 | yes |
| /composer | composer--demo | composer-layout.tsx | Code | 1142 | yes |
| /composer | composer-state--empty | composer-state.tsx | Code | 1174 | yes |
| /conversation | conversation--demo | conversation-demo.tsx | Code | 795 | yes |
| /conversation | conversation--bubbles | conversation-layout.tsx | Code | 1146 | yes |
| /app-shell | app-shell--demo | app-shell-demo.tsx | Code | 2774 | yes |
| /app-shell | app-shell--controlled | app-shell-controlled.tsx | Code | 2919 | yes |
| /app-shell | title-bar-tabs--filled | tab-strip.tsx | Code | 2104 | yes |
| /chat-sidebar | chat-sidebar--demo | chat-sidebar-demo.tsx | Code | 2640 | yes |
| /chat-sidebar | chat-sidebar--links | chat-sidebar-links.tsx | Code | 1915 | yes |
| /chat-sidebar | conversation-row--compact | conversation-rows.tsx | Code | 3122 | yes |
| /chat-app | chat-app--demo | chat-app-demo.tsx | Code | 534 | yes |
| /chat-app | mode-toggle--pill | mode-toggle.tsx | Code | 541 | yes |

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
| /chat-sidebar | light  | none       |
| /chat-app     | light  | none       |
| /sample-data  | light  | none       |
| /             | dark   | none       |
| /theme        | dark   | none       |
| /button       | dark   | none       |
| /tip          | dark   | none       |
| /menu         | dark   | none       |
| /composer     | dark   | none       |
| /conversation | dark   | none       |
| /app-shell    | dark   | none       |
| /chat-sidebar | dark   | none       |
| /chat-app     | dark   | none       |
| /sample-data  | dark   | none       |

### Page sections in order

Only the component items have the eight sections. The home page and Sample data are short pages without them, so this check skips them; axe, the link check and the stress keyboard walk cover every page.

| Page | Result | Headings found |
| --- | --- | --- |
| /theme | pass | Install, Demo, Anatomy, Examples, API reference, Keyboard, Accessibility, Theming |
| /button | pass | Install, Demo, Anatomy, Examples, API reference, Keyboard, Accessibility, Theming |
| /tip | pass | Install, Demo, Anatomy, Examples, API reference, Keyboard, Accessibility, Theming |
| /menu | pass | Install, Demo, Anatomy, Examples, API reference, Keyboard, Accessibility, Theming |
| /composer | pass | Install, Demo, Anatomy, Examples, API reference, Keyboard, Accessibility, Theming |
| /conversation | pass | Install, Demo, Anatomy, Examples, API reference, Keyboard, Accessibility, Theming |
| /app-shell | pass | Install, Demo, Anatomy, Examples, API reference, Keyboard, Accessibility, Theming |
| /chat-sidebar | pass | Install, Demo, Anatomy, Examples, API reference, Keyboard, Accessibility, Theming |
| /chat-app | pass | Install, Demo, Anatomy, Examples, API reference, Keyboard, Accessibility, Theming |

### Keyboard rows from spec/functional.md

Keyboard and size rows are listed, not gated. A mismatch does not fail the run; every one is in the list at the end. The spec describes a reference app, so each row is a finding to review, not a test that ComposerKit must pass.

| Rows | Pass | Mismatch | Not checkable |
| ---- | ---- | -------- | ------------- |
| 64   | 55   | 3        | 6             |

### Size rows from spec/functional.md (about 1 px tolerance)

| Rows | Pass | Mismatch | Not checkable |
| ---- | ---- | -------- | ------------- |
| 105  | 84   | 15       | 6             |

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
| composer--inline | /composer | 641 x 84 | 641 x 85 | 1.2% | 1.2% |
| composer--roomy | /composer | 641 x 177 | 641 x 178 | 0.5% | 0.6% |
| composer--stacked | /composer | 641 x 138 | 641 x 139 | 0.7% | 0.7% |
| composer-state--attached | /composer | 640 x 212 | 641 x 213 | 1.8% | 1.7% |
| composer-state--chat-mode | /composer | 640 x 98 | 641 x 99 | 1.7% | 1.8% |
| composer-state--empty | /composer | 640 x 98 | 641 x 99 | 1.7% | 1.7% |
| composer-state--listening | /composer | 640 x 98 | 641 x 99 | 1.7% | 1.7% |
| composer-state--long-draft | /composer | 640 x 279 | 641 x 280 | 0.7% | 0.7% |
| composer-state--no-limits | /composer | 640 x 98 | 641 x 99 | 1.7% | 1.7% |
| composer-state--send-failed | /composer | 640 x 130 | 641 x 131 | 1.5% | 1.5% |
| composer-state--sending | /composer | 640 x 98 | 641 x 99 | 1.6% | 1.6% |
| composer-state--too-large | /composer | 640 x 155 | 641 x 155 | 0.5% | 0.5% |
| composer-state--typing | /composer | 640 x 98 | 641 x 99 | 1.7% | 1.6% |
| composer-state--unsupported | /composer | 640 x 98 | 641 x 99 | 1.7% | 1.7% |
| composer-state--upload-offline | /composer | 640 x 155 | 641 x 156 | 1.5% | 1.5% |
| composer-state--uploading | /composer | 640 x 155 | 641 x 155 | 0.7% | 0.7% |
| conversation--bubbles | /conversation | 1104 x 640 | 1059 x 641 | 6.9% | 6.9% |
| conversation--document | /conversation | 1104 x 640 | 1059 x 641 | 6.4% | 6.4% |
| conversation--transcript | /conversation | 1104 x 640 | 1059 x 641 | 7.0% | 7.0% |
| conversation-row--compact | /chat-sidebar | 288 x 217 | 288 x 217 | 0.0% | 0.0% |
| conversation-row--measured | /chat-sidebar | 288 x 265 | 288 x 265 | 0.0% | 0.0% |
| conversation-row--two-line | /chat-sidebar | 288 x 377 | 288 x 377 | 0.0% | 0.0% |
| icon-button--control | /button | 111 x 28 | 110 x 29 | 4.3% | 4.3% |
| icon-button--pill | /button | 87 x 28 | 87 x 29 | 4.3% | 3.9% |
| icon-button--row | /button | 79 x 24 | 79 x 25 | 6.0% | 6.1% |
| icon-button--small | /button | 94 x 28 | 94 x 29 | 3.4% | 3.4% |
| menu--compact | /menu | 279 x 28 | 279 x 29 | 4.1% | 4.1% |
| menu--regular | /menu | 181 x 28 | 181 x 29 | 3.4% | 3.4% |
| mode-toggle--pill | /chat-app | 289 x 36 | 289 x 37 | 4.5% | 4.4% |
| mode-toggle--segmented | /chat-app | 332 x 36 | 331 x 37 | 6.2% | 5.3% |
| mode-toggle--underline | /chat-app | 283 x 36 | 283 x 37 | 4.9% | 4.9% |
| palette--swatches | /theme | 1104 x 312 | 1059 x 313 | 11.7% | 11.7% |
| title-bar-tabs--filled | /app-shell | 1104 x 78 | 1059 x 79 | 5.4% | 5.4% |
| title-bar-tabs--underline | /app-shell | 1104 x 78 | 1059 x 79 | 5.4% | 5.4% |

## 5. next build passes and next-validate-link finds no broken links

| Step | Result | Detail |
| --- | --- | --- |
| npm run build --workspace @composerkit/docs | exit 0 | 3 s |
| next-validate-link on content/docs/*.mdx | no broken links | 11 files, 11 known URLs |

## 6. Stress

Listed, not gated. 3 rows below still show a flag or a break.

### Every docs example at 320 and 1440 wide, in each design

In the base design, one image per example and width, light on the left and dark on the right, in `stress/render/`. In the other designs each example is inspected in light, and an image is kept only when it has a flag. A flag is sideways page scroll, a box wider than the window, text cut off with no ellipsis, text over other text, a control pushed out of view, or an empty field too narrow for its placeholder. Content inside a box that scrolls sideways, such as a code block or the tab strip, counts as reachable.

| Design | Width | Examples | With a flag |
| ------ | ----- | -------- | ----------- |
| base   | 320   | 49       | 0           |
| base   | 1440  | 49       | 0           |
| apple  | 320   | 49       | 0           |
| apple  | 1440  | 49       | 0           |
| glass  | 320   | 49       | 0           |
| glass  | 1440  | 49       | 0           |
| taste  | 320   | 49       | 0           |
| taste  | 1440  | 49       | 0           |
| emil   | 320   | 49       | 0           |
| emil   | 1440  | 49       | 0           |

### The demo app in every design at 320 and 1440 wide

The playground's home page, with the composer in work mode and in chat mode, inspected in light with the same flags as the examples. Images are light on the left and dark on the right, in `stress/app/`: the base design in both modes and the other designs in work mode.

| Design | Mode | Width | Flags | Errors | Image                            |
| ------ | ---- | ----- | ----- | ------ | -------------------------------- |
| base   | work | 320   | none  | none   | stress/app/base--work--320.png   |
| base   | chat | 320   | none  | none   | stress/app/base--chat--320.png   |
| apple  | work | 320   | none  | none   | stress/app/apple--work--320.png  |
| apple  | chat | 320   | none  | none   | not kept                         |
| glass  | work | 320   | none  | none   | stress/app/glass--work--320.png  |
| glass  | chat | 320   | none  | none   | not kept                         |
| taste  | work | 320   | none  | none   | stress/app/taste--work--320.png  |
| taste  | chat | 320   | none  | none   | not kept                         |
| emil   | work | 320   | none  | none   | stress/app/emil--work--320.png   |
| emil   | chat | 320   | none  | none   | not kept                         |
| base   | work | 1440  | none  | none   | stress/app/base--work--1440.png  |
| base   | chat | 1440  | none  | none   | stress/app/base--chat--1440.png  |
| apple  | work | 1440  | none  | none   | stress/app/apple--work--1440.png |
| apple  | chat | 1440  | none  | none   | not kept                         |
| glass  | work | 1440  | none  | none   | stress/app/glass--work--1440.png |
| glass  | chat | 1440  | none  | none   | not kept                         |
| taste  | work | 1440  | none  | none   | stress/app/taste--work--1440.png |
| taste  | chat | 1440  | none  | none   | not kept                         |
| emil   | work | 1440  | none  | none   | stress/app/emil--work--1440.png  |
| emil   | chat | 1440  | none  | none   | not kept                         |

### Keyboard only, every docs page and the demo app

Tab from the top of the page to the end, then Shift+Tab back, with no mouse events. Each stop is checked for a visible change against its resting look, and for a focus ring cut off by a box that clips its overflow. Every menu trigger and tooltip in the examples is opened, closed with Escape, and checked for focus back on its trigger. A list that a text field drives, such as the composer's add menu, keeps focus in that field, as spec/functional.md says. The full focus order of each page is in `results/stress-keyboard.json`.

| Page | Stops | Walk ended | Trap | No visible focus | Focus ring cut off | Not reachable by Tab | Shift+Tab gives the same order | Escape did not return focus |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| / | 37 | Tab left the last control and focus went back to the page | none | none | none | none | yes | none |
| /theme | 106 | Tab left the last control and focus went back to the page | none | none | none | none | yes | none |
| /button | 105 | Tab left the last control and focus went back to the page | none | none | none | none | yes | none |
| /tip | 68 | Tab left the last control and focus went back to the page | none | none | none | none | yes | none |
| /menu | 105 | Tab left the last control and focus went back to the page | none | none | none | none | yes | none |
| /composer | 327 | Tab left the last control and focus went back to the page | none | none | none | none | yes | none |
| /conversation | 242 | Tab left the last control and focus went back to the page | none | none | none | button "Scroll to the newest message" (4 times) | yes | none |
| /app-shell | 176 | Tab left the last control and focus went back to the page | none | none | none | none | yes | none |
| /chat-sidebar | 362 | Tab left the last control and focus went back to the page | none | none | button "Turn the onboarding steps into a checkli", bottom; button "What should go in a README for a small l", bottom; button "Write alt text for the product photos", bottom; button "Pick colors that pass contrast checks", bottom; button "Write test data for the invoice page", bottom | none | yes | none |
| /chat-app | 245 | Tab left the last control and focus went back to the page | none | none | button "Rewrite the error messages on the signup", bottom; button "Turn this spreadsheet into a chart", bottom; button "Write test data for the invoice page", bottom | none | yes | none |
| /sample-data | 38 | Tab left the last control and focus went back to the page | none | none | none | none | yes | none |
| demo app, 320 wide | 20 | Tab left the last control and focus went back to the page | none | none | none | none | yes | none |
| demo app, 1440 wide | 161 | Tab left the last control and focus went back to the page | none | none | none | none | yes | none |

### A 200 character paste into every composer, then Enter

Pasted through the clipboard. Images are in `stress/paste/`.

| Example | Label | Pasted | After Enter | Flags | Images |
| --- | --- | --- | --- | --- | --- |
| composer--demo | spaces | 200 | field cleared, turns 0 then 0 | none | stress/paste/composer--demo--spaces--pasted.png, stress/paste/composer--demo--spaces--submitted.png |
| composer--demo | word | 200 | field cleared, turns 0 then 0 | none | stress/paste/composer--demo--word--pasted.png, stress/paste/composer--demo--word--submitted.png |
| composer--inline | spaces | 200 | field cleared, turns 0 then 0 | none | stress/paste/composer--inline--spaces--pasted.png, stress/paste/composer--inline--spaces--submitted.png |
| composer--inline | word | 200 | field cleared, turns 0 then 0 | none | stress/paste/composer--inline--word--pasted.png, stress/paste/composer--inline--word--submitted.png |
| composer--roomy | spaces | 200 | field cleared, turns 0 then 0 | none | stress/paste/composer--roomy--spaces--pasted.png, stress/paste/composer--roomy--spaces--submitted.png |
| composer--roomy | word | 200 | field cleared, turns 0 then 0 | none | stress/paste/composer--roomy--word--pasted.png, stress/paste/composer--roomy--word--submitted.png |
| composer--stacked | spaces | 200 | field cleared, turns 0 then 0 | none | stress/paste/composer--stacked--spaces--pasted.png, stress/paste/composer--stacked--spaces--submitted.png |
| composer--stacked | word | 200 | field cleared, turns 0 then 0 | none | stress/paste/composer--stacked--word--pasted.png, stress/paste/composer--stacked--word--submitted.png |
| composer-state--empty | spaces | 200 | field kept 200 characters, turns 0 then 0 | none | stress/paste/composer-state--empty--spaces--pasted.png, stress/paste/composer-state--empty--spaces--submitted.png |
| composer-state--empty | word | 200 | field kept 200 characters, turns 0 then 0 | none | stress/paste/composer-state--empty--word--pasted.png, stress/paste/composer-state--empty--word--submitted.png |
| composer-state--typing | spaces | 278 | field kept 278 characters, turns 0 then 0 | none | stress/paste/composer-state--typing--spaces--pasted.png, stress/paste/composer-state--typing--spaces--submitted.png |
| composer-state--typing | word | 278 | field kept 278 characters, turns 0 then 0 | none | stress/paste/composer-state--typing--word--pasted.png, stress/paste/composer-state--typing--word--submitted.png |
| composer-state--long-draft | spaces | 788 | field kept 788 characters, turns 0 then 0 | none | stress/paste/composer-state--long-draft--spaces--pasted.png, stress/paste/composer-state--long-draft--spaces--submitted.png |
| composer-state--long-draft | word | 788 | field kept 788 characters, turns 0 then 0 | none | stress/paste/composer-state--long-draft--word--pasted.png, stress/paste/composer-state--long-draft--word--submitted.png |
| composer-state--uploading | spaces | 229 | field kept 229 characters, turns 0 then 0 | none | stress/paste/composer-state--uploading--spaces--pasted.png, stress/paste/composer-state--uploading--spaces--submitted.png |
| composer-state--uploading | word | 229 | field kept 229 characters, turns 0 then 0 | none | stress/paste/composer-state--uploading--word--pasted.png, stress/paste/composer-state--uploading--word--submitted.png |
| composer-state--attached | spaces | 200 | field kept 200 characters, turns 0 then 0 | none | stress/paste/composer-state--attached--spaces--pasted.png, stress/paste/composer-state--attached--spaces--submitted.png |
| composer-state--attached | word | 200 | field kept 200 characters, turns 0 then 0 | none | stress/paste/composer-state--attached--word--pasted.png, stress/paste/composer-state--attached--word--submitted.png |
| composer-state--too-large | spaces | 243 | field kept 243 characters, turns 0 then 0 | none | stress/paste/composer-state--too-large--spaces--pasted.png, stress/paste/composer-state--too-large--spaces--submitted.png |
| composer-state--too-large | word | 243 | field kept 243 characters, turns 0 then 0 | none | stress/paste/composer-state--too-large--word--pasted.png, stress/paste/composer-state--too-large--word--submitted.png |
| composer-state--upload-offline | spaces | 200 | field kept 200 characters, turns 0 then 0 | none | stress/paste/composer-state--upload-offline--spaces--pasted.png, stress/paste/composer-state--upload-offline--spaces--submitted.png |
| composer-state--upload-offline | word | 200 | field kept 200 characters, turns 0 then 0 | none | stress/paste/composer-state--upload-offline--word--pasted.png, stress/paste/composer-state--upload-offline--word--submitted.png |
| composer-state--sending | spaces | 78 | field kept 78 characters, turns 0 then 0 | none | stress/paste/composer-state--sending--spaces--pasted.png, stress/paste/composer-state--sending--spaces--submitted.png |
| composer-state--sending | word | 78 | field kept 78 characters, turns 0 then 0 | none | stress/paste/composer-state--sending--word--pasted.png, stress/paste/composer-state--sending--word--submitted.png |
| composer-state--send-failed | spaces | 278 | field kept 278 characters, turns 0 then 0 | none | stress/paste/composer-state--send-failed--spaces--pasted.png, stress/paste/composer-state--send-failed--spaces--submitted.png |
| composer-state--send-failed | word | 278 | field kept 278 characters, turns 0 then 0 | none | stress/paste/composer-state--send-failed--word--pasted.png, stress/paste/composer-state--send-failed--word--submitted.png |
| composer-state--listening | spaces | 200 | field kept 200 characters, turns 0 then 0 | none | stress/paste/composer-state--listening--spaces--pasted.png, stress/paste/composer-state--listening--spaces--submitted.png |
| composer-state--listening | word | 200 | field kept 200 characters, turns 0 then 0 | none | stress/paste/composer-state--listening--word--pasted.png, stress/paste/composer-state--listening--word--submitted.png |
| composer-state--unsupported | spaces | 200 | field kept 200 characters, turns 0 then 0 | none | stress/paste/composer-state--unsupported--spaces--pasted.png, stress/paste/composer-state--unsupported--spaces--submitted.png |
| composer-state--unsupported | word | 200 | field kept 200 characters, turns 0 then 0 | none | stress/paste/composer-state--unsupported--word--pasted.png, stress/paste/composer-state--unsupported--word--submitted.png |
| composer-state--no-limits | spaces | 200 | field kept 200 characters, turns 0 then 0 | none | stress/paste/composer-state--no-limits--spaces--pasted.png, stress/paste/composer-state--no-limits--spaces--submitted.png |
| composer-state--no-limits | word | 200 | field kept 200 characters, turns 0 then 0 | none | stress/paste/composer-state--no-limits--word--pasted.png, stress/paste/composer-state--no-limits--word--submitted.png |
| composer-state--chat-mode | spaces | 233 | field kept 233 characters, turns 0 then 0 | none | stress/paste/composer-state--chat-mode--spaces--pasted.png, stress/paste/composer-state--chat-mode--spaces--submitted.png |
| composer-state--chat-mode | word | 233 | field kept 233 characters, turns 0 then 0 | none | stress/paste/composer-state--chat-mode--word--pasted.png, stress/paste/composer-state--chat-mode--word--submitted.png |
| conversation--demo | spaces | 200 | field cleared, turns 2 then 4 | none | stress/paste/conversation--demo--spaces--pasted.png, stress/paste/conversation--demo--spaces--submitted.png |
| conversation--demo | word | 200 | field cleared, turns 2 then 4 | none | stress/paste/conversation--demo--word--pasted.png, stress/paste/conversation--demo--word--submitted.png |
| conversation--bubbles | spaces | 200 | field cleared, turns 8 then 10 | none | stress/paste/conversation--bubbles--spaces--pasted.png, stress/paste/conversation--bubbles--spaces--submitted.png |
| conversation--bubbles | word | 200 | field cleared, turns 8 then 10 | none | stress/paste/conversation--bubbles--word--pasted.png, stress/paste/conversation--bubbles--word--submitted.png |
| conversation--document | spaces | 200 | field cleared, turns 8 then 10 | none | stress/paste/conversation--document--spaces--pasted.png, stress/paste/conversation--document--spaces--submitted.png |
| conversation--document | word | 200 | field cleared, turns 8 then 10 | none | stress/paste/conversation--document--word--pasted.png, stress/paste/conversation--document--word--submitted.png |
| conversation--transcript | spaces | 200 | field cleared, turns 8 then 10 | none | stress/paste/conversation--transcript--spaces--pasted.png, stress/paste/conversation--transcript--spaces--submitted.png |
| conversation--transcript | word | 200 | field cleared, turns 8 then 10 | none | stress/paste/conversation--transcript--word--pasted.png, stress/paste/conversation--transcript--word--submitted.png |

### 200 character labels in every part that shows one

Rendered by the playground's dev-only stress page (`/states/stress`), which passes the label through each part's own props. demo is the normal label, spaces is a 200 character title with spaces, word is a 200 character link with nowhere to break. Images are in `stress/labels/`.

| Part | Label | Width | Flags | Errors | Image |
| --- | --- | --- | --- | --- | --- |
| button | demo | 320 | none | none | stress/labels/button--demo--320.png |
| button | spaces | 320 | none | none | stress/labels/button--spaces--320.png |
| button | word | 320 | none | none | stress/labels/button--word--320.png |
| button | demo | 1440 | none | none | stress/labels/button--demo--1440.png |
| button | spaces | 1440 | none | none | stress/labels/button--spaces--1440.png |
| button | word | 1440 | none | none | stress/labels/button--word--1440.png |
| icon-button | demo | 320 | none | none | stress/labels/icon-button--demo--320.png |
| icon-button | spaces | 320 | none | none | stress/labels/icon-button--spaces--320.png |
| icon-button | word | 320 | none | none | stress/labels/icon-button--word--320.png |
| icon-button | demo | 1440 | none | none | stress/labels/icon-button--demo--1440.png |
| icon-button | spaces | 1440 | none | none | stress/labels/icon-button--spaces--1440.png |
| icon-button | word | 1440 | none | none | stress/labels/icon-button--word--1440.png |
| tooltip | demo | 320 | none | none | stress/labels/tooltip--demo--320.png |
| tooltip | spaces | 320 | none | none | stress/labels/tooltip--spaces--320.png |
| tooltip | word | 320 | none | none | stress/labels/tooltip--word--320.png |
| tooltip | demo | 1440 | none | none | stress/labels/tooltip--demo--1440.png |
| tooltip | spaces | 1440 | none | none | stress/labels/tooltip--spaces--1440.png |
| tooltip | word | 1440 | none | none | stress/labels/tooltip--word--1440.png |
| menu | demo | 320 | none | none | stress/labels/menu--demo--320.png |
| menu | spaces | 320 | none | none | stress/labels/menu--spaces--320.png |
| menu | word | 320 | none | none | stress/labels/menu--word--320.png |
| menu | demo | 1440 | none | none | stress/labels/menu--demo--1440.png |
| menu | spaces | 1440 | none | none | stress/labels/menu--spaces--1440.png |
| menu | word | 1440 | none | none | stress/labels/menu--word--1440.png |
| tabs | demo | 320 | none | none | stress/labels/tabs--demo--320.png |
| tabs | spaces | 320 | none | none | stress/labels/tabs--spaces--320.png |
| tabs | word | 320 | none | none | stress/labels/tabs--word--320.png |
| tabs | demo | 1440 | none | none | stress/labels/tabs--demo--1440.png |
| tabs | spaces | 1440 | none | none | stress/labels/tabs--spaces--1440.png |
| tabs | word | 1440 | none | none | stress/labels/tabs--word--1440.png |
| row | demo | 320 | none | none | stress/labels/row--demo--320.png |
| row | spaces | 320 | none | none | stress/labels/row--spaces--320.png |
| row | word | 320 | none | none | stress/labels/row--word--320.png |
| row | demo | 1440 | none | none | stress/labels/row--demo--1440.png |
| row | spaces | 1440 | none | none | stress/labels/row--spaces--1440.png |
| row | word | 1440 | none | none | stress/labels/row--word--1440.png |
| turns | demo | 320 | none | none | stress/labels/turns--demo--320.png |
| turns | spaces | 320 | none | none | stress/labels/turns--spaces--320.png |
| turns | word | 320 | none | none | stress/labels/turns--word--320.png |
| turns | demo | 1440 | none | none | stress/labels/turns--demo--1440.png |
| turns | spaces | 1440 | none | none | stress/labels/turns--spaces--1440.png |
| turns | word | 1440 | none | none | stress/labels/turns--word--1440.png |

### Empty states

Images are in `stress/empty/`.

| Part | Attack | Verdict | What happened | Image |
| --- | --- | --- | --- | --- |
| turns | a conversation with zero turns | held up | the part shows: "Stress conversation New message Auto Brief effort, choose model". no errors | stress/empty/turns.png |
| menu | a menu with zero items | held up | an open menu panel 193 x 37 with 1 item: "Nothing to show". no errors | stress/empty/menu.png |
| menu | a menu whose only child is an empty fragment | held up | an open menu panel 193 x 37 with 1 item: "Nothing to show". no errors | stress/empty/menu--fragment.png |
| menu | a menu whose items are an empty list in a fragment | held up | an open menu panel 193 x 37 with 1 item: "Nothing to show". no errors | stress/empty/menu--map.png |
| menu | a menu with a radio group that has no items | held up | an open menu panel 193 x 37 with 1 item: "Nothing to show". no errors | stress/empty/menu--radio-group.png |
| sidebar | a sidebar with no projects and no chats | held up | the part shows: "New chat Projects Recent No chats yet.". no errors | stress/empty/sidebar.png |
| tabs | a tab strip with zero tabs | held up | the part shows: "No tabs". no errors | stress/empty/tabs.png |
| composer--stacked | Enter with no text | held up | nothing was sent, field "", height 98 then 98 (spec: 98 for 1 line), primary button stays "Start voice chat" | stress/empty/composer--stacked--enter-empty.png |
| composer--stacked | Enter with only spaces and a line break | held up | nothing was sent, field " \n ", height 98 then 98 (spec: 98 for 2 lines), primary button stays "Start voice chat" | stress/empty/composer--stacked--enter-whitespace.png |
| composer--stacked | paste 200 characters, select all, delete, then Enter | held up | nothing was sent, field "", height 98 then 98 (spec: 98 for 1 line), primary button stays "Start voice chat" | stress/empty/composer--stacked--paste-delete.png |
| conversation--demo | Enter with no text | held up | nothing was sent, field "", height 48 then 48 (spec: 48 for 1 line), primary button stays "Send" | stress/empty/conversation--demo--enter-empty.png |
| conversation--demo | Enter with only spaces and a line break | held up | nothing was sent, field " \n ", height 48 then 98 (spec: 98 for 2 lines), primary button stays "Send" | stress/empty/conversation--demo--enter-whitespace.png |
| conversation--demo | paste 200 characters, select all, delete, then Enter | held up | nothing was sent, field "", height 48 then 48 (spec: 48 for 1 line), primary button stays "Send" | stress/empty/conversation--demo--paste-delete.png |
| composer-state--attached | remove the last attachment with the keyboard | held up | 2 attachments removed with Enter, 0 left; height 211 then 98; focus after each removal: button "Remove household budget by month and category (final version).xlsx", textarea "Describe a task" | stress/empty/composer-state--attached--remove-last.png |

## 7. Design directions

The Design picker in the docs sidebar footer, on the pages with the most examples, in light and dark. Each row picks the design through the real select, runs axe on the whole page, then reloads. First frame counts the animation frames before the load event that showed the page, and how many were already in the design, so a flash of the base look fails. Kept after navigation means a sidebar link click reached the next page with the design and without a document load. Screenshots are in `designs/`. Gated: axe, first frame, navigation and console errors.

| Page | Design | Scheme | axe violations | First frame | Kept after navigation | Console errors |
| --- | --- | --- | --- | --- | --- | --- |
| /composer | apple | light | none | pass, 1 of 1 frames | yes | none |
| /composer | glass | light | none | pass, 2 of 2 frames | yes | none |
| /composer | taste | light | none | pass, 2 of 2 frames | yes | none |
| /composer | emil | light | none | pass, 1 of 1 frames | yes | none |
| /conversation | apple | light | none | pass, 2 of 2 frames | yes | none |
| /conversation | glass | light | none | pass, 1 of 1 frames | yes | none |
| /conversation | taste | light | none | pass, 2 of 2 frames | yes | none |
| /conversation | emil | light | none | pass, 1 of 1 frames | yes | none |
| /app-shell | apple | light | none | pass, 2 of 2 frames | yes | none |
| /app-shell | glass | light | none | pass, 2 of 2 frames | yes | none |
| /app-shell | taste | light | none | pass, 2 of 2 frames | yes | none |
| /app-shell | emil | light | none | pass, 1 of 1 frames | yes | none |
| /chat-app | apple | light | none | pass, 2 of 2 frames | yes | none |
| /chat-app | glass | light | none | pass, 2 of 2 frames | yes | none |
| /chat-app | taste | light | none | pass, 2 of 2 frames | yes | none |
| /chat-app | emil | light | none | pass, 2 of 2 frames | yes | none |
| /composer | apple | dark | none | pass, 1 of 1 frames | yes | none |
| /composer | glass | dark | none | pass, 1 of 1 frames | yes | none |
| /composer | taste | dark | none | pass, 1 of 1 frames | yes | none |
| /composer | emil | dark | none | pass, 1 of 1 frames | yes | none |
| /conversation | apple | dark | none | pass, 2 of 2 frames | yes | none |
| /conversation | glass | dark | none | pass, 1 of 1 frames | yes | none |
| /conversation | taste | dark | none | pass, 2 of 2 frames | yes | none |
| /conversation | emil | dark | none | pass, 2 of 2 frames | yes | none |
| /app-shell | apple | dark | none | pass, 2 of 2 frames | yes | none |
| /app-shell | glass | dark | none | pass, 2 of 2 frames | yes | none |
| /app-shell | taste | dark | none | pass, 2 of 2 frames | yes | none |
| /app-shell | emil | dark | none | pass, 2 of 2 frames | yes | none |
| /chat-app | apple | dark | none | pass, 2 of 2 frames | yes | none |
| /chat-app | glass | dark | none | pass, 2 of 2 frames | yes | none |
| /chat-app | taste | dark | none | pass, 2 of 2 frames | yes | none |
| /chat-app | emil | dark | none | pass, 2 of 2 frames | yes | none |

## Every mismatch

### axe violations

None.

### Keyboard mismatches

| Spec line | Keys and context | Spec says | What happened | Where |
| --- | --- | --- | --- | --- |
| 140 | Tab, Tab order, one-row layout, starting from the add button | add button, text field, model picker, dictate, then the trailing button when it is enabled | button "Add files and more" → button "Project rules, change permissions" → textarea "Describe a task" → button "Sparrow 3 Balanced effort, choose model" → button "Dictate" | /composer [data-example="composer--inline"] |
| 251 | Click on the jump button, After clicking jump to latest | Stays on the jump button | focus on the page (body), jump button still on the page: false | /conversation [data-example="conversation--document"] |
| 381 | Right, On a submenu item | Opens the submenu and focuses its first item. The parent item reports expanded. | focus on menuitemradio "Same length", parent aria-expanded=null | /menu [data-example="menu--demo"] |

### Size mismatches

| Spec line | Part | Spec says | Measured | Where |
| --- | --- | --- | --- | --- |
| 50 | Gap from add button to text, empty chat | 4 | 38 | /composer [data-example="composer--inline"] |
| 52 | Model picker, empty chat | 102 to 102 x 28 | 99.9 x 28 | /composer [data-example="composer--inline"] |
| 52 | Model picker, docked | 102 to 103 x 28 | 66 x 28 | /conversation [data-example="conversation--bubbles"] |
| 220 | Prompt action row | right-aligned, 4 below the bubble; copy 27 x 26, share 31 x 30, edit 27 x 26 | 4 below, right edges 1210 and bubble 1210; copy 27 x 26, share 27 x 26, edit 27 x 26 | /conversation [data-example="conversation--document"] |
| 228 | Gap from prompt bubble bottom to reply text | about 49 | 45 | /conversation [data-example="conversation--document"] |
| 230 | Reply action row | about 6 below the last line; buttons 27 x 26 or 27 x 27 on a 28 pitch; share 31 x 30; more 25 x 25 | 6 below; Copy 27 x 26, Helpful 27 x 26, This browser can’t read aloud 27 x 26, Share 27 x 26, Write again 27 x 26, More 27 x 26; pitch 28, 28, 28, 28, 28 | /conversation [data-example="conversation--document"] |
| 258 | Heading at the start of each prompt turn | level 4, visually hidden | h2 "You said:", 1 wide | /conversation [data-example="conversation--document"] |
| 259 | Heading at the start of each reply turn | level 4, visually hidden | h2 "Assistant said:", 1 wide | /conversation [data-example="conversation--document"] |
| 260 | Heading before the composer | a level-4 heading marking the latest response | h2 "New message" | /conversation [data-example="conversation--document"] |
| 271 | Message action buttons | 27 x 26 (some 27 x 27, share 31 x 30) | Copy 27 x 26, Share 27 x 26, Edit 27 x 26, Helpful 27 x 26, This browser can’t read aloud 27 x 26, Write again 27 x 26, More 27 x 26 | /conversation [data-example="conversation--document"] |
| 277 | Sidebar row trailing buttons (more, pin) | 20 x 20 or 20 x 21 | 24 x 24, 24 x 24 | /chat-sidebar [data-example="conversation-row--measured"] |
| 434 | Chat row | 30 tall on a 31 pitch, 261 to 272 wide, 8 text inset, radius about 8; on hover two 20 pt buttons 8 apart | 30 tall, pitch 31, 270 wide, inset 8, radius 12.5, 2 trailing buttons 24 x 24 and 24 x 24 4 apart | /chat-sidebar [data-example="conversation-row--measured"] |
| 435 | Mode switch, pill variant | two 113 x 36 toggle buttons |  | /app-shell [data-example="mode-toggle--pill"] |
| 435 | Mode switch, segmented variant | two 113 x 36 toggle buttons |  | /app-shell [data-example="mode-toggle--segmented"] |
| 435 | Mode switch, underline variant | two 113 x 36 toggle buttons |  | /app-shell [data-example="mode-toggle--underline"] |

### Rows that could not be checked

| Spec line | Row | Spec says | Why not |
| --- | --- | --- | --- |
| 142 | Shift+Escape, Focus outside the composer | Opens a confirmation dialog for a bulk mark-as-read action. | ComposerKit has no bulk mark-as-read action or dialog. This is app behavior of the reference app, not part of any registry item. |
| 155 | Typing a letter, A sidebar chat row | Composer. The field receives it. | No docs page puts a sidebar row and a type-to-focus composer together; the rows are on /chat-sidebar, the composer on /conversation. |
| 156 | Typing a letter, A chat tab in the title bar | Composer. The field receives it. | No docs page puts title bar tabs and a type-to-focus composer together; the tabs are on /app-shell, the composer on /conversation. |
| 160 | Typing a letter, A modal dialog (focus on its checkbox) | Dialog keeps focus. The composer does not receive it. | No registry item opens a modal dialog, so no demo has one. |
| 184 | Enter, then Escape in the system dialog, Run an add-menu item, then cancel the system dialog it opened | Text field | A headless browser opens no system file dialog to cancel; Playwright only reports that a file chooser was requested (lines 132 and 318 check that). |
| 384 | Enter or Space, On an item | Not tested, because it would run the action | The spec gives no expected result for this row. |
| 57 | Gap from disclaimer line to composer | about 9 from a one-line disclaimer to the composer | No registry item renders a disclaimer line, and the spec does not give its text. |
| 274 | Title-bar and header icon buttons | 28 x 28 | The title bar tabs example shows only the tab strip; the back, forward, sidebar and view buttons are not in any example. |
| 276 | Icon rail buttons | 36 x 36, selected radius about 8 | No example renders the icon rail. |
| 368 | Row more menu separators | none seen in this menu | Separators are content the app passes in. The menu demo adds one on purpose to show the MenuSeparator part. |
| 428 | Title bar right side | two 28 x 28 view toggles, 6 apart | This part of the playground app shell is not a registry item and no docs example renders it. |
| 436 | Empty chat | heading 34 tall, composer 24 below, suggestion rows 40 tall | This part of the playground app shell is not a registry item and no docs example renders it. |
