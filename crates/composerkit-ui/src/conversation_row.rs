// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

use crate::focus_ring::KeyboardRing as _;
use std::rc::Rc;

use gpui_kit::assets::IconName;
use gpui_kit::component::button::{Button, ButtonVariants as _};
use gpui_kit::component::menu::{DropdownMenu as _, PopupMenuItem};
use gpui_kit::component::{Selectable, Sizable as _};
use gpui_kit::{
    Anchor, App, ClickEvent, Div, ElementId, Entity, FocusHandle, InteractiveElement as _,
    IntoElement, ParentElement as _, RenderOnce, SharedString, StatefulInteractiveElement as _,
    Styled as _, Window, div, prelude::FluentBuilder as _, px,
};

use crate::accessibility::current_page;
use crate::marquee::{MarqueeLabel, wraps_when_active};
use crate::row_actions::{self, RowState};

/// How much room each chat in the sidebar takes.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Hash)]
pub enum RowDensity {
    /// 30px rows and body text.
    #[default]
    Regular,
    /// About a quarter more chats fit: 24px rows and caption text.
    Compact,
    /// Adds a second line with the chat's age and project.
    TwoLine,
}

impl RowDensity {
    /// Every density, in the order a picker shows them.
    pub const ALL: [Self; 3] = [Self::Regular, Self::Compact, Self::TwoLine];

    /// The name a picker shows.
    #[must_use]
    pub const fn label(self) -> &'static str {
        match self {
            Self::Regular => "Regular",
            Self::Compact => "Compact",
            Self::TwoLine => "Two-line",
        }
    }
}

type ClickHandler = Rc<dyn Fn(&ClickEvent, &mut Window, &mut App)>;

/// The row's focusable parts, in the order [`RowState::focus`] holds them.
const ROW: usize = 0;
const MENU: usize = 1;
const PIN: usize = 2;

/// One chat in the sidebar. The open chat gets the hover fill and full text
/// color. A tooltip shows titles the row cuts off.
///
/// With [`Self::on_toggle_pin`] or [`Self::on_archive`] the row grows a
/// "More actions" menu and a pin button. They show on hover and whenever
/// focus is on the row, and Tab reaches them from the row, so the keyboard
/// gets them too. While they show, the title gives up their width and
/// scrolls sideways to show what it cuts off.
#[derive(IntoElement)]
pub struct ConversationRow {
    id: ElementId,
    title: SharedString,
    detail: Option<SharedString>,
    density: RowDensity,
    selected: bool,
    pinned: bool,
    on_click: Option<ClickHandler>,
    on_toggle_pin: Option<ClickHandler>,
    on_archive: Option<ClickHandler>,
}

impl ConversationRow {
    #[must_use]
    pub fn new(id: impl Into<ElementId>, title: impl Into<SharedString>) -> Self {
        Self {
            id: id.into(),
            title: title.into(),
            detail: None,
            density: RowDensity::default(),
            selected: false,
            pinned: false,
            on_click: None,
            on_toggle_pin: None,
            on_archive: None,
        }
    }

    /// The second line in [`RowDensity::TwoLine`], such as "2h · shrok".
    /// Other densities leave it out.
    #[must_use]
    pub fn detail(mut self, detail: impl Into<SharedString>) -> Self {
        self.detail = Some(detail.into());
        self
    }

    #[must_use]
    pub fn density(mut self, density: RowDensity) -> Self {
        self.density = density;
        self
    }

    /// Whether the chat is pinned, which names the pin action Pin or Unpin.
    #[must_use]
    pub fn pinned(mut self, pinned: bool) -> Self {
        self.pinned = pinned;
        self
    }

    #[must_use]
    pub fn on_click(
        mut self,
        handler: impl Fn(&ClickEvent, &mut Window, &mut App) + 'static,
    ) -> Self {
        self.on_click = Some(Rc::new(handler));
        self
    }

    /// Adds the pin button and the menu's Pin or Unpin item.
    #[must_use]
    pub fn on_toggle_pin(
        mut self,
        handler: impl Fn(&ClickEvent, &mut Window, &mut App) + 'static,
    ) -> Self {
        self.on_toggle_pin = Some(Rc::new(handler));
        self
    }

    /// Adds the menu's Archive item.
    #[must_use]
    pub fn on_archive(
        mut self,
        handler: impl Fn(&ClickEvent, &mut Window, &mut App) + 'static,
    ) -> Self {
        self.on_archive = Some(Rc::new(handler));
        self
    }
}

impl Selectable for ConversationRow {
    fn selected(mut self, selected: bool) -> Self {
        self.selected = selected;
        self
    }

    fn is_selected(&self) -> bool {
        self.selected
    }
}

impl ConversationRow {
    /// The pin button, and the menu when there is anything to put in it.
    fn action_count(&self) -> usize {
        usize::from(self.on_toggle_pin.is_some())
            + usize::from(self.on_toggle_pin.is_some() || self.on_archive.is_some())
    }

    /// The menu and pin button, laid over the row's end. Hidden actions
    /// stay in the tab order, and focusing one shows them.
    fn actions(
        &self,
        state: &Entity<RowState<3>>,
        focus: &[FocusHandle; 3],
        revealed: bool,
        cx: &App,
    ) -> Option<Div> {
        if self.action_count() == 0 {
            return None;
        }
        let (pin_item, pin_label, pin_icon) = if self.pinned {
            (
                "Unpin chat",
                format!("Unpin {}", self.title),
                IconName::PinOff,
            )
        } else {
            ("Pin chat", format!("Pin {}", self.title), IconName::Pin)
        };
        let pin_label = SharedString::from(pin_label);

        let pin = self.on_toggle_pin.clone();
        let archive = self.on_archive.clone();
        let menu_state = state.clone();
        let menu = row_actions::action_button(
            (self.id.clone(), "actions"),
            IconName::Ellipsis,
            format!("More actions for {}", self.title).into(),
            "More actions",
            &focus[MENU],
            cx,
        )
        .dropdown_menu_with_anchor(Anchor::TopRight, move |menu, _, _| {
            let item = |label: &'static str, handler: &ClickHandler| {
                let handler = Rc::clone(handler);
                PopupMenuItem::new(label)
                    .on_click(move |event, window, cx| handler(event, window, cx))
            };
            let menu = match &pin {
                Some(handler) => menu.item(item(pin_item, handler)),
                None => menu,
            };
            match &archive {
                Some(handler) => menu.item(item("Archive chat", handler)),
                None => menu,
            }
        })
        .on_open_change(move |open, _, cx| {
            menu_state.update(cx, |state, cx| {
                state.menu_open = *open;
                cx.notify();
            });
        });

        let pin_button = self.on_toggle_pin.clone().map(|handler| {
            row_actions::action_button(
                (self.id.clone(), "pin"),
                pin_icon,
                pin_label.clone(),
                pin_label,
                &focus[PIN],
                cx,
            )
            .on_click(move |event, window, cx| handler(event, window, cx))
        });

        Some(
            div()
                .absolute()
                .top_0()
                .bottom_0()
                .right(row_actions::inset())
                .flex()
                .items_center()
                .gap(row_actions::gap())
                .opacity(if revealed { 1. } else { 0. })
                .child(menu)
                .children(pin_button),
        )
    }
}

impl RenderOnce for ConversationRow {
    fn render(self, window: &mut Window, cx: &mut App) -> impl IntoElement {
        let tokens = composerkit_theme::tokens();
        let colors = composerkit_theme::colors(cx);
        let (text, secondary, tertiary, hover) = (
            colors.foreground,
            colors.muted_foreground,
            colors.subtle_foreground,
            colors.accent,
        );
        let (height, radius, text_style) = match self.density {
            RowDensity::Regular => (tokens.size.row, tokens.radius.control, &tokens.text.body),
            RowDensity::Compact => (
                tokens.size.row_compact,
                tokens.radius.small,
                &tokens.text.caption,
            ),
            RowDensity::TwoLine => (
                tokens.size.row_two_line,
                tokens.radius.control,
                &tokens.text.body,
            ),
        };
        let detail = self
            .detail
            .clone()
            .filter(|_| self.density == RowDensity::TwoLine);

        let state =
            window.use_keyed_state((self.id.clone(), "row"), cx, |_, cx| RowState::<3>::new(cx));
        let revealed = state.read(cx).revealed(window);
        let focus = state.read(cx).focus.clone();

        let action_count = self.action_count();
        let room = match (action_count, revealed) {
            (0, _) => tokens.space.row_padding_x,
            (_, false) => row_actions::IDLE_ROOM,
            (count, true) => row_actions::shown_room(count),
        };
        let wraps = revealed && wraps_when_active(cx);

        let label = div()
            .flex()
            .flex_col()
            .min_w_0()
            .flex_1()
            .child(
                MarqueeLabel::new((self.id.clone(), "title"), self.title.clone(), text_style)
                    .active(revealed),
            )
            .when_some(detail, |label, detail| {
                let caption = &tokens.text.caption;
                label.child(
                    div()
                        .truncate()
                        .text_color(tertiary)
                        .text_size(px(caption.size))
                        .line_height(px(caption.line_height))
                        .child(detail),
                )
            });

        let actions = self.actions(&state, &focus, revealed, cx);

        let row = Button::new(self.id.clone())
            .keyboard_ring(cx)
            .ghost()
            .small()
            .track_focus(&focus[ROW])
            .selected(self.selected)
            .accessibility_label(self.title.clone())
            .tooltip(self.title.clone())
            .w_full()
            .h(px(height))
            .pl(px(tokens.space.row_padding_x))
            .pr(px(room))
            .rounded(px(radius))
            .justify_start()
            .text_color(if self.selected { text } else { secondary })
            // gpui-kit fills a selected ghost button with its pressed color,
            // which is darker than the hover tint the theme's contrast floor
            // measures text on.
            .when(self.selected, |button| button.bg(hover))
            // A wrapped title needs more than one row of height.
            .when(wraps, |button| {
                button
                    .h_auto()
                    .min_h(px(height))
                    .py(px(tokens.space.row_padding_y))
            })
            .child(label)
            .when_some(self.on_click, |button, handler| {
                button.on_click(move |event, window, cx| handler(event, window, cx))
            });

        let row = current_page(row, self.selected);
        let hover_state = state;
        div()
            .id((self.id, "row-hover"))
            .relative()
            .w_full()
            .on_hover(move |hovered, _, cx| {
                hover_state.update(cx, |state, cx| {
                    state.hovered = *hovered;
                    cx.notify();
                });
            })
            .child(row)
            .children(actions)
    }
}
