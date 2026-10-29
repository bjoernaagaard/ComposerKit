// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

use crate::focus_ring::KeyboardRing as _;
use std::rc::Rc;
use std::time::Duration;

use gpui_kit::base::motion::{Transition, transition};
use gpui_kit::component::Selectable as _;
use gpui_kit::component::button::{Button, ButtonVariants as _};
use gpui_kit::{
    AbsoluteLength, App, ElementId, FontWeight, InteractiveElement as _, IntoElement,
    ParentElement as _, Pixels, RenderOnce, StatefulInteractiveElement as _, Styled, Window,
    accesskit::Role, div, prelude::FluentBuilder as _, px,
};

/// What the composer sends to: a chat, or a task that works on its own.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Hash)]
pub enum Mode {
    #[default]
    Chat,
    Work,
}

impl Mode {
    /// Both modes, in the order the toggle shows them.
    pub const ALL: [Self; 2] = [Self::Chat, Self::Work];

    /// The name the toggle shows.
    #[must_use]
    pub const fn label(self) -> &'static str {
        match self {
            Self::Chat => "Chat",
            Self::Work => "Work",
        }
    }
}

/// How the mode toggle marks the chosen mode.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Hash)]
pub enum ModeToggleAppearance {
    /// A round track with a sliding thumb.
    #[default]
    Pill,
    /// A squarer track with an inset thumb, as in macOS.
    Segmented,
    /// No track; a bar slides under the chosen label.
    Underline,
}

impl ModeToggleAppearance {
    /// Every appearance, in the order a picker shows them.
    pub const ALL: [Self; 3] = [Self::Pill, Self::Segmented, Self::Underline];

    /// The name a picker shows.
    #[must_use]
    pub const fn label(self) -> &'static str {
        match self {
            Self::Pill => "Pill",
            Self::Segmented => "Segmented",
            Self::Underline => "Underline",
        }
    }
}

type ChangeHandler = Rc<dyn Fn(&Mode, &mut Window, &mut App)>;

/// The Chat / Work switch above the composer. A thumb or bar slides to the
/// chosen mode and its label turns semibold, because the thumb alone barely
/// stands out from the track. The thumb jumps instead of sliding when the
/// system asks for reduced motion.
#[derive(IntoElement)]
pub struct ModeToggle {
    id: ElementId,
    mode: Mode,
    appearance: ModeToggleAppearance,
    on_change: Option<ChangeHandler>,
}

impl ModeToggle {
    #[must_use]
    pub fn new(id: impl Into<ElementId>, mode: Mode) -> Self {
        Self {
            id: id.into(),
            mode,
            appearance: ModeToggleAppearance::default(),
            on_change: None,
        }
    }

    #[must_use]
    pub fn appearance(mut self, appearance: ModeToggleAppearance) -> Self {
        self.appearance = appearance;
        self
    }

    /// Called with the mode the user picks.
    #[must_use]
    pub fn on_change(mut self, handler: impl Fn(&Mode, &mut Window, &mut App) + 'static) -> Self {
        self.on_change = Some(Rc::new(handler));
        self
    }
}

/// Sets every border of `element` to `width`, which the `border_*` helpers
/// cannot do below one pixel.
fn border_width<E: Styled>(mut element: E, width: Pixels) -> E {
    let width = Some(AbsoluteLength::Pixels(width));
    let edges = &mut element.style().border_widths;
    edges.top = width;
    edges.right = width;
    edges.bottom = width;
    edges.left = width;
    element
}

impl RenderOnce for ModeToggle {
    fn render(self, window: &mut Window, cx: &mut App) -> impl IntoElement {
        let tokens = composerkit_theme::tokens();
        let colors = *composerkit_theme::colors(cx);
        let hairline = px(tokens.border.hairline);
        let width = tokens.size.mode_toggle_width;
        let ease_out = tokens.motion.ease_out.easing();

        let progress = transition(
            (self.id.clone(), "thumb"),
            if self.mode == Mode::Work {
                1.0_f32
            } else {
                0.0
            },
            Transition::new(Duration::from_millis(tokens.motion.duration_ms)).easing(ease_out),
            window,
            cx,
        );

        // How far the thumb sits in from the track, and how wide it is.
        let (inset, thumb_width) = match self.appearance {
            ModeToggleAppearance::Pill | ModeToggleAppearance::Underline => (0., width / 2.),
            ModeToggleAppearance::Segmented => {
                let inset = tokens.space.mode_toggle_inset;
                (inset, (width - 2. * tokens.border.hairline) / 2. - inset)
            }
        };
        let left = px(inset + progress * thumb_width);

        let track = div()
            .relative()
            .flex()
            .w(px(width))
            .h(px(tokens.size.mode_toggle_height));
        let track = match self.appearance {
            ModeToggleAppearance::Pill => track.rounded_full().bg(colors.secondary),
            ModeToggleAppearance::Segmented => border_width(track, hairline)
                .border_color(colors.border)
                .rounded(px(tokens.radius.control))
                .p(px(inset))
                .bg(colors.secondary),
            ModeToggleAppearance::Underline => {
                let mut track = track.border_color(colors.input);
                track.style().border_widths.bottom = Some(AbsoluteLength::Pixels(hairline));
                track
            }
        };

        let thumb = div().absolute().left(left).w(px(thumb_width));
        let thumb = match self.appearance {
            ModeToggleAppearance::Pill => border_width(thumb.top_0().bottom_0(), hairline)
                .border_color(colors.border)
                .rounded_full()
                .bg(colors.card),
            ModeToggleAppearance::Segmented => thumb
                .top(px(inset))
                .bottom(px(inset))
                .rounded(px(tokens.radius.small))
                .bg(colors.card),
            ModeToggleAppearance::Underline => thumb
                .bottom(px(-tokens.border.toggle_underline_offset))
                .h(px(tokens.border.toggle_underline_width))
                .bg(colors.foreground),
        };
        let option_radius = match self.appearance {
            ModeToggleAppearance::Pill => px(tokens.size.mode_toggle_height / 2.),
            ModeToggleAppearance::Segmented | ModeToggleAppearance::Underline => {
                px(tokens.radius.small)
            }
        };

        let label = &tokens.text.label;
        let options = Mode::ALL.into_iter().map(|mode| {
            let selected = mode == self.mode;
            let on_change = self.on_change.clone();
            Button::new((self.id.clone(), mode.label()))
                .keyboard_ring(cx)
                .text()
                .label(mode.label())
                .flex_1()
                .h_full()
                .rounded(option_radius)
                .text_size(px(label.size))
                .line_height(px(label.line_height))
                .selected(selected)
                .toggled(selected)
                .font_weight(if selected {
                    FontWeight::SEMIBOLD
                } else {
                    FontWeight::NORMAL
                })
                .text_color(if selected {
                    colors.foreground
                } else {
                    colors.muted_foreground
                })
                .when_some(on_change, |button, on_change| {
                    button.on_click(move |_, window, cx| on_change(&mode, window, cx))
                })
        });

        div()
            .id(self.id.clone())
            .role(Role::Group)
            .aria_label("Composer mode")
            .min_w_0()
            .child(track.child(thumb).children(options))
    }
}
