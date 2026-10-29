// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

use std::time::Duration;

use gpui_kit::base::motion::{Easing, Transition, transition};
use gpui_kit::{
    App, ElementId, IntoElement, ParentElement as _, Pixels, RenderOnce, SharedString, Styled as _,
    TextRun, Window, div, px,
};

/// The label's width in the last frame. The title's own width is shaped
/// each frame, so only the room it gets is carried over.
struct Viewport(Pixels);

/// A one-line title that, while `active`, scrolls sideways to show what it
/// cuts off, then holds there. Idle titles end in an ellipsis. When the
/// system asks for reduced motion the title never moves: an active title
/// wraps onto more lines instead, so the whole title is still readable from
/// the keyboard, where no tooltip shows.
#[derive(IntoElement)]
pub(crate) struct MarqueeLabel {
    id: ElementId,
    text: SharedString,
    active: bool,
    size: f32,
    line_height: f32,
}

impl MarqueeLabel {
    pub(crate) fn new(
        id: impl Into<ElementId>,
        text: SharedString,
        style: &composerkit_theme::TextStyle,
    ) -> Self {
        Self {
            id: id.into(),
            text,
            active: false,
            size: style.size,
            line_height: style.line_height,
        }
    }

    pub(crate) fn active(mut self, active: bool) -> Self {
        self.active = active;
        self
    }
}

/// Whether an active label wraps rather than scrolls, so a row can let its
/// height grow.
pub(crate) fn wraps_when_active(cx: &App) -> bool {
    cx.reduce_motion()
}

impl RenderOnce for MarqueeLabel {
    fn render(self, window: &mut Window, cx: &mut App) -> impl IntoElement {
        let viewport = window.use_keyed_state((self.id.clone(), "marquee-viewport"), cx, |_, _| {
            Viewport(Pixels::ZERO)
        });
        let room = viewport.read(cx).0;

        let font_size = px(self.size);
        let style = window.text_style();
        let run = TextRun {
            len: self.text.len(),
            font: style.font(),
            color: style.color,
            background_color: None,
            underline: None,
            strikethrough: None,
        };
        let natural = window
            .text_system()
            .shape_line(self.text.clone(), font_size, &[run], None)
            .width;
        // Nothing is measured before the first frame, so nothing overflows.
        let overflow = if room > Pixels::ZERO {
            (natural - room).max(Pixels::ZERO).as_f32()
        } else {
            0.
        };

        let reduce_motion = wraps_when_active(cx);
        let scrolls = self.active && overflow > 0. && !reduce_motion;
        // Scroll out slowly after a pause, as the web title does; snap back
        // at once when the row goes idle.
        let policy = if scrolls {
            let motion = &composerkit_theme::tokens().motion;
            Transition::new(Duration::from_secs_f32(
                overflow * motion.marquee_ms_per_pixel / 1000.,
            ))
            .delay(Duration::from_millis(motion.marquee_delay_ms))
            .easing(Easing::Linear)
        } else {
            Transition::new(Duration::ZERO)
        };
        let progress = transition(
            (self.id.clone(), "marquee"),
            if scrolls { 1.0_f32 } else { 0.0 },
            policy,
            window,
            cx,
        );

        let text = div().text_size(font_size).line_height(px(self.line_height));
        let text = if scrolls {
            text.flex_none()
                .whitespace_nowrap()
                .relative()
                .left(px(-progress * overflow))
                .child(self.text)
        } else if self.active && reduce_motion {
            text.flex_1().min_w_0().whitespace_normal().child(self.text)
        } else {
            text.flex_1().min_w_0().truncate().child(self.text)
        };

        div()
            .flex()
            .flex_1()
            .min_w_0()
            .on_children_prepainted(move |bounds, _, cx| {
                let Some(width) = bounds.first().map(|bounds| bounds.size.width) else {
                    return;
                };
                viewport.update(cx, |viewport, cx| {
                    if viewport.0 != width {
                        viewport.0 = width;
                        cx.notify();
                    }
                });
            })
            .child(
                div()
                    .flex()
                    .flex_1()
                    .min_w_0()
                    .overflow_hidden()
                    .child(text),
            )
    }
}
