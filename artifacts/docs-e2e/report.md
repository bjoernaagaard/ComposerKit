<!-- SPDX-FileCopyrightText: 2026 Bjørn Aagaard -->

<!-- SPDX-License-Identifier: MIT -->

# Docs E2E report

Written by `npm run e2e:docs` on 2026-10-30. It runs against the real static export of apps/docs, served from `apps/docs/out`. Raw results, including the rows that pass, are in `results/`. Page screenshots are in `pages/`.

## 1. Registry files match the published shadcn schema

No result. The spec did not run or stopped early.

## 2. A new app installs every item and the sample data, takes every example from its Code tab, then type checks and builds

No result. The spec did not run or stopped early.

## 3. Accessibility, keyboard and sizes on the static export

### axe-core, every rule axe runs by default

No result. The spec did not run or stopped early.

### Page sections in order

Only the component items have the eight sections. The home page and Sample data are short pages without them, so this check skips them; axe, the link check and the stress keyboard walk cover every page.

No result. The spec did not run or stopped early.

### Keyboard rows from spec/functional.md

Keyboard and size rows are listed, not gated. A mismatch does not fail the run; every one is in the list at the end. The spec describes a reference app, so each row is a finding to review, not a test that ComposerKit must pass.

| Rows | Pass | Mismatch | Not checkable |
| ---- | ---- | -------- | ------------- |
| 0    | 0    | 0        | 0             |

### Size rows from spec/functional.md (about 1 px tolerance)

| Rows | Pass | Mismatch | Not checkable |
| ---- | ---- | -------- | ------------- |
| 0    | 0    | 0        | 0             |

## 4. Every old catalog screenshot has a docs example

Baseline: 37 ids, light and dark, in `catalog-before/`. Docs screenshots in `docs-after/`. The ratio is the share of pixels that differ after padding both images to the same size, so a size change counts.

| Ids | Found in light and dark | Missing |
| --- | --- | --- |
| 37 | 0 | button--default (light), button--default (dark), button--ghost (light), button--ghost (dark), button--outline (light), button--outline (dark), composer--inline (light), composer--inline (dark), composer--roomy (light), composer--roomy (dark), composer--stacked (light), composer--stacked (dark), composer-state--attached (light), composer-state--attached (dark), composer-state--chat-mode (light), composer-state--chat-mode (dark), composer-state--empty (light), composer-state--empty (dark), composer-state--listening (light), composer-state--listening (dark), composer-state--long-draft (light), composer-state--long-draft (dark), composer-state--no-limits (light), composer-state--no-limits (dark), composer-state--send-failed (light), composer-state--send-failed (dark), composer-state--sending (light), composer-state--sending (dark), composer-state--too-large (light), composer-state--too-large (dark), composer-state--typing (light), composer-state--typing (dark), composer-state--unsupported (light), composer-state--unsupported (dark), composer-state--upload-offline (light), composer-state--upload-offline (dark), composer-state--uploading (light), composer-state--uploading (dark), conversation--bubbles (light), conversation--bubbles (dark), conversation--document (light), conversation--document (dark), conversation--transcript (light), conversation--transcript (dark), conversation-row--compact (light), conversation-row--compact (dark), conversation-row--measured (light), conversation-row--measured (dark), conversation-row--two-line (light), conversation-row--two-line (dark), icon-button--control (light), icon-button--control (dark), icon-button--pill (light), icon-button--pill (dark), icon-button--row (light), icon-button--row (dark), icon-button--small (light), icon-button--small (dark), menu--compact (light), menu--compact (dark), menu--regular (light), menu--regular (dark), mode-toggle--pill (light), mode-toggle--pill (dark), mode-toggle--segmented (light), mode-toggle--segmented (dark), mode-toggle--underline (light), mode-toggle--underline (dark), palette--swatches (light), palette--swatches (dark), title-bar-tabs--filled (light), title-bar-tabs--filled (dark), title-bar-tabs--underline (light), title-bar-tabs--underline (dark) |

No result. The spec did not run or stopped early.

## 5. next build passes and next-validate-link finds no broken links

| Step                                        | Result      | Detail |
| ------------------------------------------- | ----------- | ------ |
| npm run build --workspace @composerkit/docs | exit 0      | 3 s    |
| next-validate-link on content/docs/*.mdx    | did not run |        |

## 6. Stress

Listed, not gated. 0 rows below still show a flag or a break.

### Every docs example at 320 and 1440 wide, in each design

In the base design, one image per example and width, light on the left and dark on the right, in `stress/render/`. In the other designs each example is inspected in light, and an image is kept only when it has a flag. A flag is sideways page scroll, a box wider than the window, text cut off with no ellipsis, text over other text, a control pushed out of view, or an empty field too narrow for its placeholder. Content inside a box that scrolls sideways, such as a code block or the tab strip, counts as reachable.

| Design | Width | Examples | With a flag |
| ------ | ----- | -------- | ----------- |
| base   | 320   | 0        | 0           |
| base   | 1440  | 0        | 0           |
| apple  | 320   | 0        | 0           |
| apple  | 1440  | 0        | 0           |
| glass  | 320   | 0        | 0           |
| glass  | 1440  | 0        | 0           |
| taste  | 320   | 0        | 0           |
| taste  | 1440  | 0        | 0           |
| emil   | 320   | 0        | 0           |
| emil   | 1440  | 0        | 0           |

### The demo app in every design at 320 and 1440 wide

The playground's home page, with the composer in work mode and in chat mode, inspected in light with the same flags as the examples. Images are light on the left and dark on the right, in `stress/app/`: the base design in both modes and the other designs in work mode.

| Design | Mode | Width | Flags | Errors | Image |
| ------ | ---- | ----- | ----- | ------ | ----- |

### Keyboard only, every docs page and the demo app

Tab from the top of the page to the end, then Shift+Tab back, with no mouse events. Each stop is checked for a visible change against its resting look, and for a focus ring cut off by a box that clips its overflow. Every menu trigger and tooltip in the examples is opened, closed with Escape, and checked for focus back on its trigger. A list that a text field drives, such as the composer's add menu, keeps focus in that field, as spec/functional.md says. The full focus order of each page is in `results/stress-keyboard.json`.

| Page | Stops | Walk ended | Trap | No visible focus | Focus ring cut off | Not reachable by Tab | Shift+Tab gives the same order | Escape did not return focus |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

### A 200 character paste into every composer, then Enter

Pasted through the clipboard. Images are in `stress/paste/`.

| Example | Label | Pasted | After Enter | Flags | Images |
| ------- | ----- | ------ | ----------- | ----- | ------ |

### 200 character labels in every part that shows one

Rendered by the playground's dev-only stress page (`/states/stress`), which passes the label through each part's own props. demo is the normal label, spaces is a 200 character title with spaces, word is a 200 character link with nowhere to break. Images are in `stress/labels/`.

| Part | Label | Width | Flags | Errors | Image |
| ---- | ----- | ----- | ----- | ------ | ----- |

### Empty states

Images are in `stress/empty/`.

| Part | Attack | Verdict | What happened | Image |
| ---- | ------ | ------- | ------------- | ----- |

## 7. Design directions

The Design picker in the docs sidebar footer, on the pages with the most examples, in light and dark. Each row picks the design through the real select, runs axe on the whole page, then reloads. First frame counts the animation frames before the load event that showed the page, and how many were already in the design, so a flash of the base look fails. Kept after navigation means a sidebar link click reached the next page with the design and without a document load. Screenshots are in `designs/`. Gated: axe, first frame, navigation and console errors.

No result. The spec did not run or stopped early.

## Every mismatch

### axe violations

None.

### Keyboard mismatches

| Spec line | Keys and context | Spec says | What happened | Where |
| --------- | ---------------- | --------- | ------------- | ----- |

### Size mismatches

| Spec line | Part | Spec says | Measured | Where |
| --------- | ---- | --------- | -------- | ----- |

### Rows that could not be checked

| Spec line | Row | Spec says | Why not |
| --------- | --- | --------- | ------- |
