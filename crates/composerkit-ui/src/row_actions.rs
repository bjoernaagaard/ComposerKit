// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

use crate::focus_ring::KeyboardRing as _;
use gpui_kit::assets::IconName;
use gpui_kit::component::button::{Button, ButtonVariants as _};
use gpui_kit::component::{Icon, Sizable as _};
use gpui_kit::{App, Context, ElementId, FocusHandle, SharedString, Styled as _, Window, px};

/// The room a row keeps for its actions when they are hidden.
pub(crate) const IDLE_ROOM: f32 = 6.;
/// The gap between two actions, and between the last one and the row's
/// end, as the web row draws them.
const GAP: f32 = 8.;
const INSET: f32 = 4.;
/// Each action is drawn this much larger than the 20px token on every side,
/// so it is the 24px target WCAG 2.5.8 asks for. The gap and inset shrink to
/// match, which keeps the actions where the web row draws them.
pub(crate) const HIT_SLOP: f32 = 2.;

/// What a sidebar row keeps between frames to decide whether its actions
/// show: on hover, while focus is on the row or one of its actions, and
/// while an action's menu is open.
pub(crate) struct RowState<const CONTROLS: usize> {
    pub(crate) hovered: bool,
    pub(crate) menu_open: bool,
    pub(crate) focus: [FocusHandle; CONTROLS],
}

impl<const CONTROLS: usize> RowState<CONTROLS> {
    /// A row with `CONTROLS` focusable parts.
    pub(crate) fn new(cx: &mut Context<Self>) -> Self {
        Self {
            hovered: false,
            menu_open: false,
            focus: std::array::from_fn(|_| cx.focus_handle()),
        }
    }

    pub(crate) fn revealed(&self, window: &Window) -> bool {
        self.hovered || self.menu_open || self.focus.iter().any(|focus| focus.is_focused(window))
    }
}

/// The width the title gives up while `count` actions show, so its end
/// stays visible: the web row's `ROW_ACTIONS_ROOM`.
pub(crate) fn shown_room(count: usize) -> f32 {
    let size = composerkit_theme::tokens().size.row_action;
    #[expect(clippy::cast_precision_loss, reason = "a row has a handful of actions")]
    let count = count as f32;
    count * size + (count - 1.).max(0.) * GAP + INSET
}

/// The spacing between actions, after the hit slop.
pub(crate) fn gap() -> gpui_kit::Pixels {
    px(GAP - 2. * HIT_SLOP)
}

/// The space between the last action and the row's end, after the hit slop.
pub(crate) fn inset() -> gpui_kit::Pixels {
    px(INSET - HIT_SLOP)
}

/// An icon button inside a row, named for the screen reader by `label` and
/// for the pointer by `tooltip`.
pub(crate) fn action_button(
    id: impl Into<ElementId>,
    icon: IconName,
    label: SharedString,
    tooltip: impl Into<SharedString>,
    focus: &FocusHandle,
    cx: &App,
) -> Button {
    let tokens = composerkit_theme::tokens();
    Button::new(id)
        .keyboard_ring(cx)
        .ghost()
        .with_size(px(tokens.size.row_action + 2. * HIT_SLOP))
        .rounded(px(tokens.radius.small))
        .icon(Icon::new(icon).with_size(px(tokens.size.icon_small)))
        .text_color(composerkit_theme::colors(cx).subtle_foreground)
        .accessibility_label(label)
        .tooltip(tooltip)
        .track_focus(focus)
}
