// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

use crate::focus_ring::KeyboardRing as _;
use gpui_kit::assets::IconName;
use gpui_kit::component::button::{Button, ButtonVariants as _};
use gpui_kit::component::{Icon, Sizable as _};
use gpui_kit::{
    App, Entity, IntoElement, ParentElement as _, Styled as _, div, prelude::FluentBuilder as _, px,
};

use crate::composer::{Composer, ComposerAction, ComposerController, ComposerLayout, ComposerMode};
use crate::{Mode, ModeToggle};

const SUGGESTIONS: [(&str, IconName); 3] = [
    ("Help me write something", IconName::Pencil),
    ("Look something up", IconName::Search),
    ("Describe a picture", IconName::Image),
];

/// The home screen with suggestions that fill the supplied composer.
pub fn home_view(
    controller: &Entity<ComposerController>,
    narrow: bool,
    cx: &App,
) -> impl IntoElement {
    let tokens = composerkit_theme::tokens();
    let show_suggestions = controller.read(cx).state().draft.is_empty();
    let text_color = composerkit_theme::colors(cx).subtle_foreground;
    let buttons = SUGGESTIONS
        .into_iter()
        .enumerate()
        .map(|(index, (label, icon))| {
            let controller = controller.clone();
            Button::new(("suggestion", index))
                .keyboard_ring(cx)
                .ghost()
                .h(px(tokens.size.suggestion_row))
                .px(px(if narrow {
                    tokens.space.suggestion_narrow_inset
                } else {
                    tokens.space.suggestion_native_inset
                }))
                .accessibility_label(label)
                .child(
                    div()
                        .flex()
                        .items_center()
                        .gap(px(tokens.space.suggestion_icon_gap))
                        .text_size(px(tokens.text.body.size))
                        .text_color(text_color)
                        .child(Icon::new(icon).with_size(px(tokens.size.suggestion_icon)))
                        .child(label),
                )
                .on_click(move |_, _, cx| {
                    controller.update(cx, |controller, cx| {
                        controller.dispatch(
                            ComposerAction::DraftChanged {
                                draft: label.to_owned(),
                            },
                            cx,
                        );
                    });
                })
        })
        .collect::<Vec<_>>();
    let suggestions = div()
        .relative()
        .top(px(if narrow {
            tokens.space.suggestion_native_narrow_offset
        } else {
            tokens.space.suggestion_native_offset
        }))
        .flex()
        .flex_col()
        .flex_shrink_0()
        .items_start()
        .h(px(SUGGESTIONS
            .iter()
            .map(|_| tokens.size.suggestion_row)
            .sum::<f32>()))
        .when(show_suggestions, |view| view.children(buttons));
    let composer = Composer::for_controller("home-composer", controller, cx)
        .layout(ComposerLayout::Inline)
        .narrow(narrow)
        .mode(ComposerMode::Chat);
    let input = div()
        .w_full()
        .max_w(px(tokens.size.composer_width))
        .flex()
        .flex_col();
    let input = if narrow {
        input.child(suggestions).child(composer)
    } else {
        input
            .child(
                div()
                    .relative()
                    .h(px(tokens.size.composer_inline_min_height))
                    .top(px(tokens.space.suggestion_native_offset))
                    .child(composer),
            )
            .child(div().mt(px(tokens.space.suggestion_gap)).child(suggestions))
    };
    div()
        .size_full()
        .flex()
        .flex_col()
        .items_center()
        .px_3()
        .pt(px(6.))
        .when(narrow, |view| view.pb(px(tokens.space.home_bottom)))
        .child(ModeToggle::new("home-mode", Mode::Chat))
        .child(
            div()
                .w_full()
                .flex_1()
                .flex()
                .when(narrow, gpui_kit::Styled::items_center)
                .when(!narrow, |hero| hero.items_end().pb(px(22.)))
                .justify_center()
                .child(div().text_size(px(28.)).child("Start with a question")),
        )
        .child(input)
        .when(!narrow, |view| view.child(div().flex_1()))
}
