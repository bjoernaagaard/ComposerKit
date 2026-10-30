# Functional spec: composer, conversation, buttons, menus, tooltips, shell

This spec describes how the reference app looks and behaves. All of it comes from watching and driving the running app. Nothing here comes from its files or code. Labels and copy are described by function, not quoted.

## How the numbers were taken

| Method | What it means |
| --- | --- |
| AX frame | Position and size reported by the macOS accessibility tree (AXPosition, AXSize). Values are in points. |
| Pixel scan @2x | Row or column scan of a silent window capture on a 2x display, divided by 2. |
| Pixel scan @1x | The same on a 1x display. The session's display changed from 2x to 1x partway through, so later scans have 1 pt resolution. |
| Corner fit | Edge positions traced row by row near a corner, then fitted to a circle. Accurate to about 1 to 2 pt. |
| Frame timing | Screen recording at 60 fps with variable frame rate. Frame timestamps were read per frame, so timings are accurate to about one frame (17 ms). |
| Focus probe | The focused accessibility element read after each key press. |

The window was floated at 1440 x 900 pt for all measurements unless a row says otherwise. Theme was dark unless a row says light. The reference app's theme colors are user-customized on this machine, so this spec gives no colors.

## 1. Composer

### Structure

The composer is a rounded field with controls inside it. On one line, the controls sit in a single row:

```
[ add ][ text field .................... ][ model picker ][ dictate ][ voice | send | stop ]
```

When the text needs more than one line, the layout changes to two rows. The text spans the full width on top and the controls move to a bottom row:

```
[ text field, full width ............................................ ][ expand ]
[ add ]                                  [ model picker ][ dictate ][ send ]
```

The composer appears in two places:

- **Empty new chat.** It sits centered under a large heading. A list of suggestion rows sits below it.
- **Conversation.** It is docked at the bottom of the message column.

### Sizes

| Part | Empty chat | Docked in conversation | Method |
| --- | --- | --- | --- |
| Outer width | 641 | 737 (same as the message column) | AX frame |
| Height, one line | 44 | 48 | AX frame, pixel scan |
| Corner radius | 22 | 22 (fixed, so the 48 pt docked field is not a full pill) | Corner fit |
| Border | Hairline, about 0.5 to 1 pt, slightly lighter than the fill in dark mode | Same | Pixel scan @2x |
| Inset from field edge to first and last control | 8 left, 8 right | 8 left, 8 right | AX frame, pixel scan |
| Add button | 29 x 28 hit area, 28 pt round hover fill, plus glyph about 12 pt across with a 1.5 pt stroke | Same | AX frame, pixel scan @2x |
| Gap, add button to text | 4 | 4 | AX frame |
| Text line box | 20 tall, about 16 pt type | Text area box 36 tall (4 pt top inset, text top aligned) | AX frame |
| Model picker | 102 x 28 pill with a label and a down chevron | 102 to 103 x 28 | AX frame |
| Dictate button | 29 x 28 | 29 x 28 | AX frame |
| Trailing round button (voice, send or stop) | 29 x 28 hit area, 28 pt filled circle | Same | AX frame, pixel scan @2x |
| Gap between trailing controls | about 7 (picker ends, dictate starts, then 7 pt to the round button) | Same | AX frame |
| Distance from window bottom | n/a | 16 | AX frame |
| Gap, disclaimer line to composer | n/a | About 9. A one-line disclaimer of about 12 pt type sits above the composer, centered. It was not shown after a reply was stopped. | AX frame |

### Growth

The field grows one line at a time as lines are added with Shift+Enter. Values are the outer height of the field.

| Lines in the field | Outer height | Notes |
| --- | --- | --- |
| 1 | 44 (empty chat) or 48 (docked) | Single-row layout |
| 2 | 98 | Switches to the two-row layout. Text area 44 tall, top inset 14, bottom row 28, bottom inset 8, gap 4 between text and bottom row. |
| 3 | 114 |  |
| 4 | 134 | Each further line adds 20 |
| 11 | 274 |  |
| 12 or more | 279 (maximum at a 900 pt window) | The text scrolls inside the field. A thin scrollbar shows at the right edge. |

- In the empty chat, the top edge stays put and the field grows downward.
- When docked, the bottom edge stays put and the field grows upward.
- Soft wrapping also switches to the two-row layout. One long line with no line breaks switched to two rows (98) once it no longer fit beside the controls. It then grew to 114, 134 and 154 as it wrapped onto more lines.
- Deleting the text returns the field to the one-line layout and height.
- The maximum may depend on window height. Only the 900 pt window height was tested.

### Expand control

An expand toggle (33 x 32, AX frame) sits at the top right of the field in the two-row layout. Its top is 10 below the field's top edge, and its right edge is 10 inside the field's right edge. The text area narrows by 28 to make room for it (713 to 685 wide, docked).

When it appears (AX tree and screenshots, docked composer):

| Content | Expand control |
| --- | --- |
| One line | Absent |
| Two or more lines with a hard line break (Shift+Enter) | Present from the first break (field height 98) |
| One soft-wrapped paragraph, 2 to 4 visual lines (98 to 134) | Absent |
| One soft-wrapped paragraph, 5 visual lines (154) | Present |

So the control appears at 5 visual lines, or as soon as the text holds a hard line break.

What it does:

| Action | Result | Method |
| --- | --- | --- |
| Activate (click) | The field grows to fill the main pane above the window's bottom gap. Width is unchanged (737). Height was 726 at a 900 pt window: its top is 110 below the main pane's top, and its bottom stays 16 above the window bottom. The conversation is hidden behind it. The one-line disclaimer moves above the field. The add, picker, dictate and send controls stay in the bottom row. Focus stays in the text. | AX frame, screenshot |
| Expanded with short text | The field keeps its full expanded height. The text sits at the top. | AX frame |
| Expanded with long text | The field stays 726 tall and the text scrolls inside it. With 50 lines, the text area measured 796 tall inside the 726 field. | AX frame, screenshot |
| Control name and state | The toggle's accessible name changes from expand to collapse, and its value from 0 to 1. The icon changes from outward arrows to inward arrows. | AX, screenshot |

How it collapses:

| Trigger | Result |
| --- | --- |
| Activate the toggle again (click) | Returns to the normal growth size for the content: 279 for long text. Focus stays in the text. |
| Escape | No effect. The field stays expanded and the draft stays. |
| Send (mouse click on send) | The field returns at once to the one-line docked size (48) and the expand control goes away, because the field is now empty. |

Keyboard reach: in the two-row layout, Tab from the text field moved focus to the add button, not to the expand toggle. The toggle was only operated with the mouse in this session.

### States

| State | What changes |
| --- | --- |
| Empty | A muted placeholder prompt shows. The trailing round button starts voice chat. In a conversation, the trailing button is a send button in its disabled state, shown as a dimmed circle. |
| Focused | Only the caret appears. The border and fill do not change. A mouse click does not draw a focus ring on the field. |
| Has draft | The trailing round button becomes an enabled send button: a filled light circle with an up arrow. |
| Long draft | Two-row layout, then the expand toggle, then internal scrolling. See Growth and Expand control. |
| Expanded | The field fills the main pane height. See Expand control. |
| Has attachment | Not observed. Uploading files was out of scope. |
| Waiting for the reply to start | The trailing button becomes the stop control and the dictate button is disabled. A small ring glyph shows inside the 28 pt circle at first. In the conversation, a small pulsing dot marks where the reply will appear. The sidebar row for the chat shows a 20 x 20 busy indicator with a status role. |
| Streaming | The trailing button stays the stop control. Text appears progressively. See section 2. |
| Just stopped | For about 0.5 s the stop control stays in place but is disabled. Then it becomes the disabled send button. |
| Disabled (the whole composer) | Not observed. |

### Keyboard

| Key | Context | Result |
| --- | --- | --- |
| Enter | Draft present, no menu open | Sends. Focus stays in the text field. |
| Enter | Add menu open, draft present | Does not send. It runs the highlighted menu item instead. See section 4A. |
| Shift+Enter | Any | Inserts a new line |
| Escape | Draft present, nothing running | Nothing happens. The draft stays. |
| Escape | Field expanded | Nothing happens. The field stays expanded. |
| Escape | Reply generating | Stops the reply. Focus stays in the text field. |
| Escape | Add menu open | Closes the menu. The draft stays and focus stays in the field. |
| Up arrow | Draft present, no menu | No effect seen. It did not recall an earlier message. |
| Typing a printable character | Focus elsewhere in the main window | Focus moves to the composer and the character is inserted. See Type-to-focus scope. |
| Tab order, one-row layout | Starting from the add button | add button, text field, model picker, dictate, then the trailing button when it is enabled |
| Tab order, two-row layout | Starting from the text field | Tab goes to the add button |
| Shift+Escape | Focus outside the composer | Opens a confirmation dialog for a bulk mark-as-read action. Its first focus is a checkbox. It was cancelled each time and never confirmed. |

The menu bar lists no dedicated shortcut to focus the composer. Type-to-focus is the observed way.

### Type-to-focus scope

Each case was tested by focusing the element, typing one letter, then reading the focused element and the field's value (focus probe, AX).

| Where focus was | Letter goes to | Field receives it |
| --- | --- | --- |
| Document body or a landmark region (after clicking empty space, or after a mouse-click send) | Composer | Yes |
| An icon button outside the composer (a reply's more-actions menu button) | Composer | Yes. The menu does not open. |
| The composer's own add button | Composer | Yes. The menu does not open. |
| A sidebar chat row | Composer | Yes |
| A chat tab in the title bar | Composer | Yes |
| An open menu (reply more-actions) with a matching letter | Menu typeahead moves focus to the matching item | No |
| An open menu with a letter that matches nothing | Menu keeps focus. Nothing happens. | No |
| The model picker menu (container focused) | Menu keeps focus | No. The setting did not change. |
| A modal dialog (focus on its checkbox) | Dialog keeps focus. The checkbox does not toggle. | No. The composer is not reachable in the accessibility tree while the dialog is open. |
| Any text input, including the composer | That input | n/a |

Precedence rule, as observed:

```
on printable key:
  if focus is in a text input            -> the input handles it
  else if a menu is open                 -> the menu handles it (typeahead), even with no match
  else if a modal dialog is open         -> the dialog keeps it, nothing leaks out
  else (button, row, tab, body, region)  -> move focus to the composer and insert the character
```

Not observed: an open listbox or combobox other than the add menu, and a non-modal popover. For the add menu, focus is already in the composer, so typed text goes there and filters the menu.

### Focus after actions

| Action | Where focus ends |
| --- | --- |
| Send with Enter | Text field |
| Send by clicking the send button with the mouse | The document itself (the web area). Not the text field and not the button. It was checked about 0.15 s after the click and three more times over the next several seconds. Typing a letter afterward still reaches the field through type-to-focus. This was observed once, with the field expanded and a two-line draft. |
| Stop by clicking the stop control | Text field. Focus was in the field before the click and stayed there. |
| Stop with Escape | Text field |
| Close the add menu with Escape | Text field |
| Run an add-menu item, then cancel the system dialog it opened | Text field |
| Close the model picker or its submenu with Escape | The element that had focus before the picker opened. A mouse click on the picker does not focus it. This was the text field in one test and a reply's more-actions button in another. |

### Accessibility

| Element | Role and name |
| --- | --- |
| Composer container | form |
| Text field | text area (multi-line) whose accessible name equals the placeholder prompt |
| Add button | button named for adding files and more |
| Model picker | pop-up button (menu button) named for selecting the model |
| Dictate | button |
| Trailing control | button whose name changes with state: start voice chat, send, or stop |
| Expand | toggle button |

## 2. Conversation

### Layout

| Measure | Value | Method |
| --- | --- | --- |
| Message column width | 737 maximum, centered in the main pane. With a 1095 to 1556 wide pane it stays 737. | AX frame at window widths 1200, 1440, 1700 and 1900 |
| Narrow pane | The column fills the pane less a gutter of about 16 on each side (pane 656 gives 623, pane 506 gives 473) | AX frame at window widths 1000 and 850 |
| Space above the first turn | 32 from the top of the content area | AX frame |
| Reply text | Starts at the left edge of the column, about 16 pt type, line pitch about 22.7 | AX frame |
| Paragraph spacing in replies | About 16 between paragraphs | AX frame (line positions) |

### Prompt (user) turn

| Measure | Value | Method |
| --- | --- | --- |
| Alignment | Bubble aligned to the right of the column, ending about 5 pt short of the column edge | Pixel scan |
| Bubble height, one line | 43 | Pixel scan @2x and @1x |
| Bubble padding | About 10 to 12 horizontal, about 13 vertical around a 17 pt glyph box | Pixel scan, AX frame |
| Bubble radius | About 18 | Corner fit @2x |
| Bubble fill | Subtle neutral fill a step lighter than the page. No border. | Pixel scan |
| Action row | Right-aligned under the bubble, 4 below it. Copy (27 x 26), share (31 x 30) and edit (27 x 26) buttons. | AX frame |
| Action row visibility | Hidden until the pointer is over the turn. The buttons keep their space while hidden. | Screenshots |

### Reply (assistant) turn

| Measure | Value | Method |
| --- | --- | --- |
| Gap, prompt action row to reply text | About 11 | AX frame |
| Gap, prompt bubble bottom to reply text | About 49, including the hidden action row | Pixel scan, AX frame |
| Background | None. Text sits on the page. | Screenshot |
| Action row | Left-aligned, about 6 below the last line. Copy, rate, read aloud (toggle), share, regenerate (menu button) and more (menu button). Buttons are 27 x 26 or 27 x 27 on a 28 pt pitch. The share button is 31 x 30 and the more button is 25 x 25. | AX frame |
| Action row visibility | Always visible on completed replies, including older ones | Screenshots |
| Gap, reply action row to the next prompt bubble | About 12 | AX frame |

### Streaming

1. On send, the conversation scrolls so the new prompt bubble sits near the top of the view. Part of the previous turn stays visible above it.
2. A small pulsing dot shows where the reply will start.
3. The reply text then appears progressively, a few words at a time. On screen, text kept appearing for about 7 s after the accessibility tree already reported completion at about 3 s. The visible reveal is paced separately from the data.
4. The view does not follow the text. When the reply grows past the bottom of the view, the text runs under the composer and a jump-to-latest button appears.
5. On completion, the action row appears under the reply and an off-screen status announces completion.

### Scroll and jump-to-latest

| Item | Value | Method |
| --- | --- | --- |
| Stick to bottom while streaming | No. The view keeps the new prompt near the top. | Screen recording |
| Jump-to-latest control | Round 32 pt button with a 1 pt outline and a down-arrow glyph about 12 x 14. It has no fill of its own and is centered on the column. | Pixel scan @1x, AX frame (33 x 32) |
| Position | Bottom edge about 24 above the composer's top edge | AX frame, pixel scan |
| Accessible role | button named for scrolling to the bottom | AX |
| Scroll on click | Near instant. The content reached the bottom within about 70 ms (one to four frames). No long eased scroll was seen. | Frame timing |
| Focus after click | Stays on the jump button | Focus probe |

### What assistive technology gets

| Element | Role | Notes |
| --- | --- | --- |
| Conversation | region landmark with a label naming the conversation |  |
| Each prompt turn | Starts with a visually hidden level-4 heading that says the user said the following | 2 x 1 pt frame |
| Each reply turn | Starts with a visually hidden level-4 heading that says the assistant said the following |  |
| Before the composer | A visually hidden level-4 heading that marks the latest response, for quick navigation |  |
| Live status | Several status (live region) nodes, kept off screen at the window edges. After each reply one of them holds a short completion message. | AX |
| Sidebar row while generating | A 20 x 20 status node named for working, shown as a busy indicator | AX |
| Reply text | Exposed as plain static text, word by word | AX |

## 3. Buttons and icon buttons

### Sizes

| Button type | Hit area | Visual | Icon | Method |
| --- | --- | --- | --- | --- |
| Message action button | 27 x 26 (some 27 x 27, share 31 x 30) | Hover fill fills the hit area, about 26 x 26, radius about 8 to 9 | About 16 | AX frame, pixel scan, corner fit |
| Composer icon button (add, dictate) | 29 x 28 | Round 28 pt hover fill | About 16 to 18 (plus glyph about 12) | AX frame, pixel scan |
| Composer send, voice and stop | 29 x 28 | Always a filled 28 pt circle. Enabled send is a light circle with a dark arrow. Disabled send is a dimmed circle. | Arrow about 14 | Pixel scan @2x |
| Title-bar and header icon buttons | 28 x 28 | Rounded square fill when active or hovered | About 16 | AX frame |
| Sidebar header buttons (activity, search) | 28 x 28 |  | About 16 | AX frame |
| Icon rail buttons | 36 x 36 | Selected item has a rounded fill, radius about 8 | About 16 | AX frame, corner fit |
| Sidebar row trailing buttons (more, pin) | 20 x 20 or 20 x 21 | Shown only on row hover | About 14 to 16 | AX frame |
| Jump-to-latest | 32 x 32 | Round outline | About 12 x 14 | Pixel scan |

### States

| State | Look | Timing |
| --- | --- | --- |
| Rest | Icon in a muted tone, no fill |  |
| Hover | Subtle neutral fill in the button's shape: a rounded square on message actions, a circle on composer buttons. The icon does not change. | Appears and disappears within one frame. No fade. |
| Pressed | Same as hover. No extra darkening and no scale. |  |
| Menu open (trigger) | The trigger keeps a fill while its menu is open. The model picker pill gains a pill fill and its label changes to describe the open menu. |  |
| Focus visible (keyboard) | A 2 pt solid ring in the theme's accent color, drawn just outside the control with no gap. On a 27 to 29 pt icon button the ring spans about 31 to 32 pt. It follows a round shape on both message actions and composer buttons, even where the hover fill is a rounded square. A tooltip also opens on keyboard focus. |  |
| Focus after a mouse click | No ring |  |
| Disabled | Dimmed icon or fill. It gets no hover feedback. The send and stop control and the history back and forward buttons were seen disabled. |  |

Focus ring measured on the regenerate action: ring pixels at 631 to 633 and 659 to 661 pt (x) for a button at 632 to 659, and 720 to 722 and 748 to 750 pt (y) for a button at 722 to 749. Pixel scan @1x.

## 4. Menus

Three kinds of popup were observed. They differ in structure and keyboard model.

### A. Add menu (composer)

| Measure | Value | Method |
| --- | --- | --- |
| Placement | Directly above the composer, same width as the composer (737 docked), 4 gap | AX frame |
| Panel | 1 pt border, padding 5 on each side, radius about 18 (4 less than the composer) | AX frame, corner fit |
| Height | Up to 320. It scrolls when there are more items. | AX frame |
| Item | Full width less padding (727), 28.6 pitch (29 and 30 alternating). Each row has a 16 pt colored icon, a label, and a muted description on the same line. | AX frame |
| Highlight | Pill fill, 29 tall, fully rounded | Pixel scan |
| Open and close | Fully drawn on the first frame after the click. No fade or scale. | Frame timing |

Keyboard. Focus stays in the composer text field the whole time the menu is open. This works like a combobox list.

| Key | Result |
| --- | --- |
| Enter or Space on the focused add button | Opens the menu. Focus moves to the text field. |
| Down, Up | Moves the highlight. It wraps from last to first. The list scrolls to keep the highlight visible. |
| Home, End | No effect on the highlight |
| Typing | Text goes into the composer and filters the list live. Typing a few letters left one item, and the panel shrank to fit it. |
| Space with an item highlighted | Types a space into the field. The menu stays open, the highlight stays on the same item, and nothing runs. |
| Enter with an item highlighted | Runs the highlighted item. The menu closes on the same step. Enter never sends while the menu is open, even with a draft in the field. |
| Escape | Closes the menu. The typed text stays in the composer. |

Enter was tested only on the item that opens the system file picker, because that action can be cancelled. It was tested three ways:

| Field content when Enter was pressed | Result |
| --- | --- |
| A draft typed before the menu opened | The file picker opened as a sheet and took focus. The draft was not sent and was still in the field afterward. |
| Only a space typed while the menu was open | The file picker opened. The typed space was removed from the field. |
| Filter text typed while the menu was open (one item left) | The file picker opened. The filter text was removed from the field. |

Each time, cancelling the picker with Escape returned focus to the text field, with the menu closed and nothing sent.

So running an item removes the text typed while the menu was open, and keeps any draft typed before it opened.

Not activated: every other item. They create images, turn on tools or modes, or connect services, and could not be cleanly undone in a real account. For those items only the highlight, Space, filtering and Escape behavior above was observed.

Roles. Items are exposed as plain buttons, not as menu items. There is no menu role on the panel. The last entry is a search entry for plugins.

### B. Model picker

| Measure | Value | Method |
| --- | --- | --- |
| Placement | Above the trigger, right-aligned near it, about 4 gap | AX frame |
| Panel | 256 x 86 outside, 254 x 84 inside the 1 pt border. Padding 4. Radius about 14. | AX frame, corner fit |
| Rows | A header row (36 tall) holding a centered item with a right chevron that opens a submenu, and a slider row (32 tall) with 5 steps | AX frame |
| Submenu | Replaces the panel in place (drill-in) rather than opening beside it. Items 29 to 30 tall in a 254 x 65 panel. The current choice has a check mark at the right. | AX frame, screenshot |

Keyboard and roles:

| Key | Result |
| --- | --- |
| Open by click | Focus moves to the menu container (role menu) |
| Down from the container | Focuses the first menu item |
| Down, Up | Move between items. Up from the first item wraps to the last. |
| Home, End | First and last item |
| Right on the submenu item | No effect |
| Enter on the submenu item | Opens the submenu with focus on the checked item |
| Left, Right on the slider row | Changes the setting (not pressed during testing). A hidden status node announces the current step and its position out of five, and a hidden hint explains the arrow keys. |
| Escape (in the submenu or the menu) | Closes everything. Focus returns to whatever had focus before the picker opened, because a mouse click on the trigger does not focus it. In testing this was the text field once and a reply action button once. |

Submenu items are menu items with a checked value of 1 or 0, which is the radio menu item pattern.

### C. Row more menu (reply more-actions)

| Measure | Value | Method |
| --- | --- | --- |
| Placement | Above the trigger, left edge 2 right of the trigger's left edge, 4 gap | AX frame |
| Panel | 193 wide, padding 4, no visible border in dark mode, soft shadow, radius about 12 to 14 | AX frame, screenshot |
| Items | 185 x 29 or 30. The first item is a muted info line (a timestamp). The second has a 16 pt icon, about an 8 pt gap, the label, and a right chevron for a submenu. | AX frame, screenshot |
| Separators | None seen in this menu | Screenshot |
| Submenu | Opens to the right. Its left edge is 5 right of the parent panel. Its first item lines up with the parent item (panel top is 3 above the parent item). 180 wide, items 172 x 29 or 30. | AX frame |
| Open and close | Fully drawn on the first frame after the click, and gone on the first frame after Escape. No fade or scale. | Frame timing (pixel sampling per frame) |

Keyboard and roles:

| Key | Result |
| --- | --- |
| Enter on the trigger | Opens the menu with focus on the first item |
| Click on the trigger | Opens the menu with focus on the menu container. Down then focuses the first item. |
| Down, Up | Move between items. No wrap: Down on the last item and Up on the first item stay put. |
| Home, End | First and last item |
| Typeahead | Typing a letter focuses the next item whose label starts with it |
| Right on a submenu item | Opens the submenu and focuses its first item. The parent item reports expanded. |
| Left in a submenu | Closes the submenu. Focus returns to the parent item. |
| Escape | Closes the menu. Focus returns to the trigger. |
| Enter or Space on an item | Not tested, because it would run the action |

Roles: the trigger is a pop-up button (menu button). The panel is a menu. Items are menu items. A submenu is a nested menu, and its parent item carries an expanded state.

### Sidebar row more menu

The trigger (20 x 21) is a pop-up button. It shows only on row hover. The menu was not opened, so its contents and keyboard were not measured.

## 5. Tooltips

| Measure | Value | Method |
| --- | --- | --- |
| Open delay | About 200 ms: 183, 200 and 233 ms in three trials, from pointer entry to the first frame with the tooltip | Frame timing |
| Moving to a neighbor button | No warm-up shortcut. The old tooltip closes at once and the new one waits the full delay again (about 230 ms). | Frame timing |
| Close delay | Gone within one frame (17 ms or less) of the pointer leaving | Frame timing |
| Animation | None. Full opacity on the first frame, gone on the first frame. | Pixel sampling per frame |
| Placement | Centered on the trigger. Below the trigger for reply actions. Above the trigger for prompt actions. It flips, or chooses a side, based on context. | Screenshots |
| Offset | 2 pt between the trigger edge and the tooltip edge | Pixel scan @1x |
| Height | 30, including a 1 pt border | Pixel scan @1x and @2x |
| Horizontal padding | About 12 to 14 from the border to the label ink | Pixel scan @1x |
| Radius | About 10 to 12 | Corner fit |
| Type | About 13 pt, single line | Pixel scan |
| Surface | Raised neutral fill, 1 pt subtle border, large soft shadow | Screenshot |
| Max width | Not measured. Every tooltip seen was a short single line. |  |
| Keyboard focus | Yes. A tooltip opens when a button gets keyboard focus. | Screenshot |

## 6. App shell

### Regions

```
+------+-----------------+-------------------------------------------+
| rail | sidebar         | title bar / tab strip (44)                |
| 52   | 288             +-------------------------------------------+
|      |                 | main pane                                 |
|      |                 |   message column (max 737, centered)      |
|      |                 |   docked composer (bottom gap 16)         |
+------+-----------------+-------------------------------------------+
```

| Part | Measure | Method |
| --- | --- | --- |
| Title bar | 44 tall across the full window, with a 1 pt divider at the bottom. Window controls at the left, then back and forward (28 x 28, 6 apart), then a sidebar toggle (28 x 28). | AX frame, pixel scan |
| Tab strip | In the title bar, right of a 1 pt vertical divider in line with the sidebar edge. A tab is 231 x 32, radius about 6, with a 1 pt border, a 16 pt icon and a label. A new-tab button (28 x 28) follows 8 to the right. | AX frame, corner fit |
| Title bar right side | Overflow and share actions when a chat is open, and two 28 x 28 view toggles, 6 apart | AX frame |
| Icon rail | 52 wide with a 1 pt right divider. Buttons are 36 x 36 with an 8 inset and a 44 pitch. A short separator splits the groups. An account button (36 x 36) sits at the bottom. | AX frame, pixel scan |
| Sidebar | 288 wide (rail plus sidebar is 340). A splitter with a 16 pt hit area sits on its right edge. | AX frame |
| Sidebar header | Mode switcher menu button (about 109 x 32), plus activity toggle and search (28 x 28, 6 apart) on the right | AX frame |
| New chat row | 272 x 30 | AX frame |
| Section header | 25 tall. A collapsible button with an expanded state. Muted label. A gap of about 16 to 20 between sections. | AX frame |
| Chat row | 30 tall on a 31 pitch, 261 to 272 wide, 8 text inset. Hover or active fill with radius about 8. On hover, two 20 pt trailing buttons (more, pin) appear 8 apart. Long titles are clipped at the right edge. | AX frame, corner fit, screenshot |
| Main pane header (empty chat only) | A two-segment mode switch (two 113 x 36 toggle buttons) centered at the top, and a 28 x 28 temporary-chat button at the right | AX frame |
| Empty chat | Heading 34 tall, about 28 pt type, centered. Composer 24 below it. Suggestion rows 40 tall, the full composer width, 24 below the composer. Each row has a 29 x 28 dismiss button on hover. | AX frame |

Shell roles: a skip-to-content link first, then a banner (title bar), a complementary landmark (the sidebar), two navigation landmarks (rail and sidebar list), and a main landmark with a nested main for the chat. Chat tabs are a tab group: each tab is a tab with a selected state and the content is a tab panel. Sidebar lists are content lists.

### What the app shell implements

The app shell in `components/app-shell/` implements these measured items:

- The skip-to-content link as the first Tab stop, which moves focus to the main region
- The complementary landmark for the sidebar, beside the banner, the rail's navigation landmark and the main landmark
- The splitter on the sidebar's edge, with its 16 pt hit area and a 1 pt line, which also resizes the sidebar from the keyboard
- The 1 pt divider between the open sidebar and the main region, and the short separator between rail groups
- The 1 pt divider at the bottom of the title bar
- The 1 pt divider on the rail's inline-end edge
- The vertical divider in the title bar in line with the sidebar edge, drawn while the sidebar is open beside the main region

These measured items are not implemented yet:

- The title bar's right-side actions (overflow, share and the two view toggles). `AppShellTitleBarEnd` holds whatever actions the app passes.
- The temporary-chat button in the empty chat's header
- The dismiss button on each suggestion row

### Light and dark

The reference app has its own theme setting and ignores the system appearance. Switching the app between dark and light changed no layout. All frames stayed the same. Two structural details differ:

| Detail | Dark | Light |
| --- | --- | --- |
| Composer edge | 1 pt border lighter than the fill, no visible shadow | 1 pt border darker than the fill, plus a faint shadow about 2 pt below |
| Elevated panels (menus, tooltips) | Separated mainly by a slightly lighter fill, a 1 pt border on some panels, and a shadow | Not measured in light mode |

The theme was set back to dark afterward.

## Not measured, and why

| Item | Reason |
| --- | --- |
| Composer with an attachment | Uploading files was not allowed |
| Whole composer disabled | Did not occur |
| Composer maximum height at other window heights | Only the 900 pt height was tested |
| Tooltip maximum width and wrapping | Only short single-line tooltips were seen |
| Separators in menus | None appeared in the menus that were opened |
| Enter or Space on menu items other than the file-picker item in the add menu | It would have run actions in a real account |
| Model picker slider keys | It would have changed a setting |
| Sidebar row more menu contents | Its menu acts on existing conversations |
| Exact visual of the stop glyph during streaming | Only the waiting state was captured; the reply started fast |
| Screen reader speech | Announcements are inferred from accessibility roles and live-region text, not heard |
