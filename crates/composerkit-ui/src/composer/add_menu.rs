// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

use std::ops::Range;

use gpui_kit::assets::IconName;
use gpui_kit::component::Icon;
use gpui_kit::{
    AnyElement, App, Context, ElementId, Entity, FocusHandle, InteractiveElement as _, IntoElement,
    KeystrokeEvent, ParentElement as _, StatefulInteractiveElement as _, Styled as _, Subscription,
    Window, accesskit::Role, div, prelude::FluentBuilder as _, px,
};

use super::machine::ComposerAction;
use super::view::{ComposerRequest, Handlers};

/// Something the add button offers.
struct AddItem {
    id: &'static str,
    label: &'static str,
    description: &'static str,
    icon: IconName,
}

/// Both open the file picker, which has no filter for file types.
const ITEMS: [AddItem; 2] = [
    AddItem {
        id: "files",
        label: "Files",
        description: "Documents, code or any other file",
        icon: IconName::File,
    },
    AddItem {
        id: "images",
        label: "Images",
        description: "Photos and screenshots",
        icon: IconName::Image,
    },
];

/// Shown, and announced, when the typed text matches no item.
const NO_MATCH: &str = "Nothing matches what you typed.";

/// The menu is open. The text typed since it opened sits between `start`,
/// where the caret was, and the `after` bytes that followed the caret.
#[derive(Clone, Copy)]
struct Open {
    start: usize,
    after: usize,
    highlighted: Option<&'static str>,
}

/// The list the add button opens above the composer, the native twin of
/// the web `ComposerAddMenu`. Focus stays in the text box the whole time:
/// Up and Down move the highlight and wrap, typing filters the list,
/// Enter runs the highlighted item and never sends, and Escape closes the
/// list and keeps the draft. Running an item drops the text typed since
/// the list opened.
pub(super) struct AddMenu {
    open: Option<Open>,
    /// The latest draft, handlers and text box, for the keys below.
    draft: String,
    handlers: Handlers,
    field: Option<FocusHandle>,
    /// Takes the menu's keys before the text box's own bindings see them.
    _keys: Subscription,
}

impl AddMenu {
    pub(super) fn new(cx: &mut Context<Self>) -> Self {
        let menu = cx.weak_entity();
        let keys = cx.intercept_keystrokes(move |event, window, cx| {
            menu.update(cx, |menu, cx| menu.on_key(event, window, cx))
                .ok();
        });
        Self {
            open: None,
            draft: String::new(),
            handlers: Handlers::default(),
            field: None,
            _keys: keys,
        }
    }

    /// Keeps what the keys act on current. The menu closes when the text
    /// box loses focus or its draft freezes for sending.
    pub(super) fn sync(
        &mut self,
        draft: &str,
        handlers: &Handlers,
        field: &FocusHandle,
        keep_open: bool,
    ) {
        draft.clone_into(&mut self.draft);
        self.handlers = handlers.clone();
        self.field = Some(field.clone());
        if !keep_open {
            self.open = None;
        }
    }

    pub(super) fn is_open(&self) -> bool {
        self.open.is_some()
    }

    /// Opens the menu with the caret at `selection`, or closes it.
    pub(super) fn toggle(&mut self, selection: Range<usize>, cx: &mut Context<Self>) {
        self.open = if self.open.is_some() {
            None
        } else {
            Some(Open {
                start: selection.start,
                after: self.draft.len().saturating_sub(selection.end),
                highlighted: None,
            })
        };
        cx.notify();
    }

    fn close(&mut self, cx: &mut Context<Self>) {
        if self.open.take().is_some() {
            cx.notify();
        }
    }

    /// Where the text typed since the menu opened sits in the draft.
    /// Deleting past either end moves that end with it, to the start of the
    /// character it lands in.
    fn typed(&self, open: Open) -> Range<usize> {
        let end = self
            .draft
            .floor_char_boundary(self.draft.len().saturating_sub(open.after));
        self.draft.floor_char_boundary(open.start.min(end))..end
    }

    /// The items whose label or description holds the typed text. Spaces
    /// around it are ignored, so typing a space keeps the list.
    fn shown(&self) -> Vec<&'static AddItem> {
        let Some(open) = self.open else {
            return Vec::new();
        };
        let query = self
            .draft
            .get(self.typed(open))
            .unwrap_or_default()
            .trim()
            .to_lowercase();
        ITEMS
            .iter()
            .filter(|item| {
                format!("{} {}", item.label, item.description)
                    .to_lowercase()
                    .contains(&query)
            })
            .collect()
    }

    /// The highlighted item, or the first one shown.
    fn highlighted(&self, shown: &[&'static AddItem]) -> Option<&'static str> {
        let wanted = self.open.and_then(|open| open.highlighted);
        shown
            .iter()
            .find(|item| Some(item.id) == wanted)
            .or(shown.first())
            .map(|item| item.id)
    }

    /// What a screen reader hears as the list filters and the highlight
    /// moves.
    fn announcement(&self) -> String {
        if self.open.is_none() {
            return String::new();
        }
        let shown = self.shown();
        let highlighted = self.highlighted(&shown);
        match shown.iter().position(|item| Some(item.id) == highlighted) {
            Some(at) => format!("{}, {} of {}", shown[at].label, at + 1, shown.len()),
            None => NO_MATCH.to_owned(),
        }
    }

    fn highlight(&mut self, id: &'static str, cx: &mut Context<Self>) {
        if let Some(open) = &mut self.open
            && open.highlighted != Some(id)
        {
            open.highlighted = Some(id);
            cx.notify();
        }
    }

    fn step(&mut self, step: isize, cx: &mut Context<Self>) {
        let shown = self.shown();
        let highlighted = self.highlighted(&shown);
        let Some(at) = shown.iter().position(|item| Some(item.id) == highlighted) else {
            return;
        };
        let next = (at.cast_signed() + step).rem_euclid(shown.len().cast_signed());
        self.highlight(shown[next.cast_unsigned()].id, cx);
    }

    /// Drops the typed text, closes the menu and opens the file picker.
    fn run(&mut self, window: &mut Window, cx: &mut Context<Self>) {
        let Some(open) = self.open.take() else {
            return;
        };
        let typed = self.typed(open);
        let draft = format!("{}{}", &self.draft[..typed.start], &self.draft[typed.end..]);
        if draft != self.draft {
            self.handlers
                .act(&ComposerAction::DraftChanged { draft }, window, cx);
        }
        self.handlers
            .request(ComposerRequest::PickFiles, window, cx);
        cx.notify();
    }

    fn on_key(&mut self, event: &KeystrokeEvent, window: &mut Window, cx: &mut Context<Self>) {
        let field_focused = self
            .field
            .as_ref()
            .is_some_and(|field| field.is_focused(window));
        if self.open.is_none() || !field_focused {
            return;
        }
        let keystroke = &event.keystroke;
        if keystroke.modifiers.modified()
            && !(keystroke.key == "enter" && keystroke.modifiers.shift)
        {
            return;
        }
        match keystroke.key.as_str() {
            "up" => self.step(-1, cx),
            "down" => self.step(1, cx),
            "escape" => self.close(cx),
            "enter" if !keystroke.modifiers.shift => {
                if self.highlighted(&self.shown()).is_some() {
                    self.run(window, cx);
                }
            }
            _ => return,
        }
        cx.stop_propagation();
    }

    /// The list, when open, and the live region that reads its changes.
    /// The list is placed against the nearest positioned ancestor, the
    /// composer's box.
    pub(super) fn list_with_announcement(
        menu: &Entity<Self>,
        composer: ElementId,
        cx: &App,
    ) -> impl IntoElement {
        div()
            .child(crate::accessibility::live_region(
                (composer.clone(), "add-menu-announcement"),
                menu.read(cx).announcement(),
            ))
            .children(Self::panel(menu, (composer, "add-menu-list").into(), cx))
    }

    /// The list, directly above the composer and as wide as it.
    fn panel(menu: &Entity<Self>, id: ElementId, cx: &App) -> Option<AnyElement> {
        let this = menu.read(cx);
        this.open?;
        let tokens = composerkit_theme::tokens();
        let colors = composerkit_theme::colors(cx);
        let label = &tokens.text.label;
        let shown = this.shown();
        let highlighted = this.highlighted(&shown);
        let menu = menu.downgrade();
        let panel = div()
            .id(id)
            .absolute()
            .left_0()
            .right_0()
            .bottom_full()
            .mb(px(tokens.space.menu_offset))
            .max_h(px(tokens.size.add_menu_max_height))
            .overflow_y_scroll()
            .p(px(tokens.space.add_menu_padding))
            .rounded(px(tokens.radius.add_menu))
            .border(px(tokens.border.panel))
            .border_color(colors.border)
            .bg(colors.popover)
            .text_color(colors.popover_foreground)
            .shadow_lg()
            .text_size(px(label.size))
            .line_height(px(label.line_height));
        if shown.is_empty() {
            return Some(
                panel
                    .child(
                        div()
                            .flex()
                            .items_center()
                            .h(px(tokens.size.add_menu_item))
                            .px(px(tokens.space.menu_item_padding_x))
                            .text_color(colors.subtle_foreground)
                            .child(NO_MATCH),
                    )
                    .into_any_element(),
            );
        }
        let rows = shown.into_iter().map(|item| {
            let active = Some(item.id) == highlighted;
            let hover = menu.clone();
            let click = menu.clone();
            div()
                .id(item.id)
                .role(Role::ListBoxOption)
                .aria_label(item.label)
                .aria_selected(active)
                .flex()
                .items_center()
                .gap_2()
                .h(px(tokens.size.add_menu_item))
                .px(px(tokens.space.menu_item_padding_x))
                .rounded_full()
                .cursor_pointer()
                .when(active, |row| {
                    row.bg(colors.accent).text_color(colors.accent_foreground)
                })
                .on_mouse_move(move |_, _, cx| {
                    hover
                        .update(cx, |menu, cx| menu.highlight(item.id, cx))
                        .ok();
                })
                .on_click(move |_, window, cx| {
                    click
                        .update(cx, |menu, cx| {
                            menu.highlight(item.id, cx);
                            menu.run(window, cx);
                        })
                        .ok();
                })
                .child(
                    Icon::new(item.icon)
                        .size(px(tokens.size.icon_small))
                        .text_color(colors.link),
                )
                .child(div().flex_none().child(item.label))
                .child(
                    div()
                        .min_w_0()
                        .truncate()
                        .text_color(colors.subtle_foreground)
                        .child(item.description),
                )
        });
        Some(
            panel
                .role(Role::ListBox)
                .aria_label("Add to your message")
                .children(rows)
                .into_any_element(),
        )
    }
}
