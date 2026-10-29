// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

use crate::focus_ring::KeyboardRing as _;
use gpui_kit::assets::IconName;
use gpui_kit::component::button::{Button, ButtonVariants as _};
use gpui_kit::component::{Icon, Sizable as _};
use gpui_kit::{
    AnyElement, App, ElementId, FontWeight, IntoElement, ParentElement, RenderOnce, SharedString,
    StatefulInteractiveElement as _, Styled as _, Window, div, prelude::FluentBuilder as _, px,
};

use crate::accessibility::Accessible;

/// A collapsible group of sidebar rows, such as Pinned or Recent. The
/// chevron points down when open and right when closed, so the state never
/// rides on color or motion alone.
#[derive(IntoElement)]
pub struct SidebarSection {
    id: ElementId,
    title: SharedString,
    actions: Vec<AnyElement>,
    children: Vec<AnyElement>,
}

impl SidebarSection {
    #[must_use]
    pub fn new(id: impl Into<ElementId>, title: impl Into<SharedString>) -> Self {
        Self {
            id: id.into(),
            title: title.into(),
            actions: Vec::new(),
            children: Vec::new(),
        }
    }

    /// A control at the end of the heading, such as "New chat".
    #[must_use]
    pub fn action(mut self, action: impl IntoElement) -> Self {
        self.actions.push(action.into_any_element());
        self
    }
}

impl ParentElement for SidebarSection {
    fn extend(&mut self, elements: impl IntoIterator<Item = AnyElement>) {
        self.children.extend(elements);
    }
}

impl RenderOnce for SidebarSection {
    fn render(self, window: &mut Window, cx: &mut App) -> impl IntoElement {
        let tokens = composerkit_theme::tokens();
        let tertiary = composerkit_theme::colors(cx).subtle_foreground;
        let open = window.use_keyed_state(self.id.clone(), cx, |_, _| true);
        let is_open = *open.read(cx);
        let heading = &tokens.text.heading;
        let chevron = if is_open {
            IconName::ChevronDown
        } else {
            IconName::ChevronRight
        };

        let toggle = Button::new(self.id)
            .keyboard_ring(cx)
            .ghost()
            .small()
            .flex_1()
            .min_w_0()
            .justify_start()
            .h_full()
            .rounded(px(tokens.radius.tab))
            .text_color(tertiary)
            .text_size(px(heading.size))
            .font_weight(FontWeight::MEDIUM)
            .accessibility_label(self.title.clone())
            .child(
                div()
                    .flex()
                    .flex_1()
                    .items_center()
                    .gap_1()
                    .child(self.title)
                    .child(Icon::new(chevron).small()),
            )
            .on_click(move |_, _, cx| {
                open.update(cx, |open, cx| {
                    *open = !*open;
                    cx.notify();
                });
            });

        let toggle = Accessible(toggle).aria_expanded(is_open).0;
        div()
            .flex()
            .flex_col()
            .child(
                div()
                    .flex()
                    .items_center()
                    .h(px(tokens.size.section_heading))
                    .px_1()
                    .child(toggle)
                    .children(self.actions),
            )
            .when(is_open, |section| {
                section.child(
                    div()
                        .flex()
                        .flex_col()
                        .gap(px(tokens.size.row_gap))
                        .mt_1()
                        .children(self.children),
                )
            })
    }
}
