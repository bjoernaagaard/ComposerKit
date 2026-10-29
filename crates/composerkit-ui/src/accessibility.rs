// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

use gpui_kit::{InteractiveElement, Interactivity, StatefulInteractiveElement};

// Kit buttons expose their interactivity but not the stateful accessibility methods.
pub(crate) struct Accessible<T>(pub T);

impl<T: InteractiveElement> InteractiveElement for Accessible<T> {
    fn interactivity(&mut self) -> &mut Interactivity {
        self.0.interactivity()
    }
}

impl<T: InteractiveElement> StatefulInteractiveElement for Accessible<T> {}

pub(crate) fn live_region(
    id: impl Into<gpui_kit::ElementId>,
    text: String,
) -> impl gpui_kit::IntoElement {
    use gpui_kit::{
        Styled as _, TestSupportExt as _,
        accesskit::{Live, Role},
        div,
    };

    div()
        .id(id)
        .test_support()
        .role(Role::Status)
        .aria_value(text)
        .a11y_synthetic_children(|tree| {
            tree.parent_node().set_live(Live::Polite);
            tree.parent_node().set_live_atomic();
        })
        .absolute()
        .size_0()
}

pub(crate) fn current_page<T: InteractiveElement>(element: T, current: bool) -> T {
    use gpui_kit::accesskit::AriaCurrent;

    Accessible(element)
        .a11y_synthetic_children(move |tree| {
            if current {
                tree.parent_node().set_aria_current(AriaCurrent::Page);
            }
        })
        .0
}
