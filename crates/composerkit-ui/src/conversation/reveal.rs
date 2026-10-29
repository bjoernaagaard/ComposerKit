// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

use std::cell::RefCell;
use std::rc::Rc;

use gpui_kit::{
    App, Bounds, Div, EntityId, FocusHandle, IntoElement, ListState, ParentElement as _, Pixels,
    Styled as _, Window, div, px,
};

/// How far inside the list's edges a revealed control stops, so its focus
/// ring shows in full.
const MARGIN: f32 = 8.;

/// Scrolls the message list so a control that takes keyboard focus is in
/// view, as a browser does for a focused element. GPUI moves focus with Tab
/// but never scrolls to it.
///
/// Each control reports its bounds while focused. The first report after
/// focus moves scrolls once, so scrolling away from a focused control by
/// wheel is never undone.
#[derive(Clone)]
pub(super) struct FocusReveal(Rc<Inner>);

struct Inner {
    list: ListState,
    /// The view that draws the list, redrawn after a scroll.
    view: EntityId,
    /// The control revealed last.
    revealed: RefCell<Option<FocusHandle>>,
}

impl FocusReveal {
    pub(super) fn new(list: ListState, view: EntityId) -> Self {
        Self(Rc::new(Inner {
            list,
            view,
            revealed: RefCell::new(None),
        }))
    }

    /// Wraps `control`, which tracks `focus`, so taking focus scrolls it into
    /// view.
    pub(super) fn wrap(&self, focus: &FocusHandle, control: impl IntoElement) -> Div {
        let reveal = self.clone();
        let focus = focus.clone();
        div()
            .flex_none()
            .on_children_prepainted(move |bounds, window, cx| {
                let Some(bounds) = bounds.first().copied() else {
                    return;
                };
                if !focus.is_focused(window) || reveal.is_revealed(&focus) {
                    return;
                }
                reveal.0.revealed.replace(Some(focus.clone()));
                // The list is mid-layout here, so it moves once layout ends.
                let reveal = reveal.clone();
                cx.defer(move |cx| reveal.scroll_to(bounds, cx));
            })
            .child(control)
    }

    /// Forgets the revealed control once it loses focus, so focusing it
    /// again reveals it again. Call it each time the list renders.
    pub(super) fn forget_blurred(&self, window: &Window) {
        let blurred = self
            .0
            .revealed
            .borrow()
            .as_ref()
            .is_some_and(|focus| !focus.is_focused(window));
        if blurred {
            self.0.revealed.replace(None);
        }
    }

    fn is_revealed(&self, focus: &FocusHandle) -> bool {
        self.0.revealed.borrow().as_ref() == Some(focus)
    }

    fn scroll_to(&self, bounds: Bounds<Pixels>, cx: &mut App) {
        let viewport = self.0.list.viewport_bounds();
        let top = viewport.top() + px(MARGIN);
        let bottom = viewport.bottom() - px(MARGIN);
        let distance = if bounds.top() < top {
            bounds.top() - top
        } else if bounds.bottom() > bottom {
            // A control taller than the list keeps its top in view.
            (bounds.bottom() - bottom).min(bounds.top() - top)
        } else {
            return;
        };
        self.0.list.scroll_by(distance);
        cx.notify(self.0.view);
    }
}
