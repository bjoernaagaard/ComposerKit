// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

use gpui_kit::component::FocusableExt as _;
use gpui_kit::component::button::Button;
use gpui_kit::{App, InteractiveElement as _, Styled as _, px};

/// The web's keyboard focus ring: a solid line in the ring color, as wide as
/// the focus width token, right at the button's edge, shown only when focus
/// came from the keyboard. gpui-kit's own ring is wider, half transparent and
/// set apart from the edge, so ComposerKit's buttons turn it off and draw
/// this one.
pub(crate) trait KeyboardRing {
    #[must_use]
    fn keyboard_ring(self, cx: &App) -> Self;
}

impl KeyboardRing for Button {
    fn keyboard_ring(self, cx: &App) -> Self {
        let width = px(composerkit_theme::tokens().border.focus_width);
        let color = composerkit_theme::colors(cx).ring;
        self.focus_ring(false)
            .focus_visible(move |style| style.border(width).border_color(color))
    }
}
