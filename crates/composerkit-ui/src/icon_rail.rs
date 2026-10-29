// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

use crate::focus_ring::KeyboardRing as _;
use std::rc::Rc;

use gpui_kit::assets::IconName;
use gpui_kit::base::Placement;
use gpui_kit::component::button::{Button, ButtonVariants as _};
use gpui_kit::component::{Icon, Selectable as _, Sizable as _};
use gpui_kit::{
    App, ElementId, InteractiveElement as _, IntoElement, ParentElement as _, RenderOnce,
    StatefulInteractiveElement as _, Styled as _, Window, accesskit::Role, div,
    prelude::FluentBuilder as _, px,
};

use crate::accessibility::current_page;

/// A place the icon rail opens.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Hash)]
pub enum Destination {
    #[default]
    Home,
    Inbox,
    Schedule,
    Extensions,
    Projects,
    Files,
    Notes,
}

impl Destination {
    /// Every destination, in rail order.
    pub const ALL: [Self; 7] = [
        Self::Home,
        Self::Inbox,
        Self::Schedule,
        Self::Extensions,
        Self::Projects,
        Self::Files,
        Self::Notes,
    ];

    /// The name the tooltip shows and a screen reader reads.
    #[must_use]
    pub const fn label(self) -> &'static str {
        match self {
            Self::Home => "Home",
            Self::Inbox => "Inbox",
            Self::Schedule => "Schedule",
            Self::Extensions => "Extensions",
            Self::Projects => "Projects",
            Self::Files => "Files",
            Self::Notes => "Notes",
        }
    }

    const fn icon(self) -> IconName {
        match self {
            Self::Home => IconName::House,
            Self::Inbox => IconName::Inbox,
            Self::Schedule => IconName::CalendarClock,
            Self::Extensions => IconName::Blocks,
            Self::Projects => IconName::Folder,
            Self::Files => IconName::Files,
            Self::Notes => IconName::NotebookPen,
        }
    }

    /// The rail draws a rule above the first destination of each group.
    const fn starts_group(self) -> bool {
        matches!(self, Self::Projects)
    }
}

type SelectHandler = Rc<dyn Fn(&Destination, &mut Window, &mut App)>;

/// The column of destinations at the window's left edge. The open
/// destination gets a fill as well as full text color, so color is never the
/// only cue. Destinations scroll when the window is too short for them.
#[derive(IntoElement)]
pub struct IconRail {
    id: ElementId,
    active: Destination,
    on_select: Option<SelectHandler>,
}

impl IconRail {
    #[must_use]
    pub fn new(id: impl Into<ElementId>) -> Self {
        Self {
            id: id.into(),
            active: Destination::default(),
            on_select: None,
        }
    }

    /// The destination on screen.
    #[must_use]
    pub fn active(mut self, destination: Destination) -> Self {
        self.active = destination;
        self
    }

    /// Called with the destination the user picks.
    #[must_use]
    pub fn on_select(
        mut self,
        handler: impl Fn(&Destination, &mut Window, &mut App) + 'static,
    ) -> Self {
        self.on_select = Some(Rc::new(handler));
        self
    }
}

impl RenderOnce for IconRail {
    fn render(self, _window: &mut Window, cx: &mut App) -> impl IntoElement {
        let tokens = composerkit_theme::tokens();
        let colors = composerkit_theme::colors(cx);
        let (text, tertiary, hover, rule) = (
            colors.foreground,
            colors.subtle_foreground,
            colors.accent,
            colors.input,
        );

        let rail_id = self.id.clone();
        let buttons = Destination::ALL.into_iter().map(|destination| {
            let active = destination == self.active;
            let on_select = self.on_select.clone();
            let button = Button::new((self.id.clone(), destination.label()))
                .keyboard_ring(cx)
                .ghost()
                .with_size(px(tokens.size.rail_button))
                .rounded(px(tokens.radius.control))
                .icon(Icon::new(destination.icon()).with_size(px(tokens.size.rail_icon)))
                .accessibility_label(destination.label())
                .tooltip(destination.label())
                .tooltip_placement(Placement::Right)
                .selected(active)
                .text_color(if active { text } else { tertiary })
                // gpui-kit fills a selected ghost button with its pressed
                // color; the web rail uses the hover tint.
                .when(active, |button| button.bg(hover))
                .when_some(on_select, |button, on_select| {
                    button.on_click(move |_, window, cx| on_select(&destination, window, cx))
                });

            let button = current_page(button, active);
            div()
                .flex()
                .flex_col()
                .items_center()
                .gap(px(tokens.space.rail_gap))
                .when(destination.starts_group(), |item| {
                    item.child(div().w_5().h(px(tokens.border.rail_rule)).bg(rule))
                })
                .child(button)
        });

        div()
            .id(self.id.clone())
            .role(Role::Navigation)
            .aria_label("Main")
            .flex()
            .flex_col()
            .items_center()
            .flex_none()
            .w(px(tokens.size.rail))
            .h_full()
            .px(px(tokens.space.rail_padding))
            .pt(px(tokens.space.rail_padding))
            .pb_1()
            .child(
                div()
                    .id((rail_id, "destinations"))
                    .flex()
                    .flex_col()
                    .items_center()
                    .flex_1()
                    .min_h_0()
                    .w_full()
                    .gap(px(tokens.space.rail_gap))
                    .overflow_y_scroll()
                    .children(buttons),
            )
    }
}
