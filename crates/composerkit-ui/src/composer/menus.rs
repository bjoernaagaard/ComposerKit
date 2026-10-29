// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

use crate::focus_ring::KeyboardRing as _;
use gpui_kit::assets::IconName;
use gpui_kit::component::button::{Button, ButtonVariants as _};
use gpui_kit::component::menu::{DropdownMenu as _, PopupMenuItem};
use gpui_kit::component::{Icon, Sizable as _};
use gpui_kit::{
    App, ElementId, InteractiveElement as _, IntoElement, ParentElement as _,
    StatefulInteractiveElement as _, Styled as _, div, prelude::FluentBuilder as _, px,
};

use super::choices::Permission;
use super::machine::ComposerAction;
use super::view::Handlers;

/// A text button in the composer's footer or tray that opens a menu.
pub(super) fn footer_button(id: impl Into<ElementId>, cx: &App) -> Button {
    let tokens = composerkit_theme::tokens();
    let caption = &tokens.text.caption;
    Button::new(id)
        .keyboard_ring(cx)
        .ghost()
        .h(px(tokens.size.composer_control))
        .px_2()
        .gap_1()
        .min_w_0()
        .rounded_full()
        .text_size(px(caption.size))
        .line_height(px(caption.line_height))
        .text_color(composerkit_theme::colors(cx).subtle_foreground)
}

/// A menu item with a second, dimmer line under its name. gpui-kit's
/// element items carry no accessible name, so the content names itself.
pub(super) fn described_item(
    label: &'static str,
    description: Option<&'static str>,
) -> PopupMenuItem {
    PopupMenuItem::element(move |_, cx| {
        let tokens = composerkit_theme::tokens();
        let caption = &tokens.text.caption;
        let tertiary = composerkit_theme::colors(cx).subtle_foreground;
        div()
            .id(label)
            .aria_label(label)
            .when_some(description, |item, description| {
                item.aria_description(description)
            })
            .flex()
            .flex_col()
            .py_1()
            .child(label)
            .when_some(description, |item, description| {
                item.child(
                    div()
                        .text_color(tertiary)
                        .text_size(px(caption.size))
                        .line_height(px(caption.line_height))
                        .child(description),
                )
            })
    })
}

/// The permission picker in Work mode. A mode that never asks swaps the
/// shield for a warning sign and turns the label to the warning color. In the inline
/// layout only the icon shows, so a tooltip names the mode.
pub(super) fn permission_menu(
    permission: Permission,
    compact: bool,
    handlers: &Handlers,
    cx: &App,
) -> impl IntoElement {
    let colors = composerkit_theme::colors(cx);
    let caution = permission.caution();
    let icon = if caution {
        IconName::TriangleAlert
    } else {
        IconName::Shield
    };
    let handlers = handlers.clone();

    footer_button("permissions", cx)
        .px_1p5()
        .when(caution, |button| button.text_color(colors.warning))
        .accessibility_label(format!("Permissions, now {}. Change", permission.label()))
        .when(compact, |button| {
            button.tooltip(format!("Permissions: {}", permission.label()))
        })
        .child(Icon::new(icon).small())
        .when(!compact, |button| {
            button.child(div().truncate().child(permission.label()))
        })
        .dropdown_menu(move |menu, _, _| {
            Permission::ALL.into_iter().fold(menu, |menu, choice| {
                let handlers = handlers.clone();
                menu.item(
                    described_item(choice.label(), Some(choice.description()))
                        .checked(choice == permission)
                        .on_click(move |_, window, cx| {
                            handlers.act(
                                &ComposerAction::PermissionChanged { permission: choice },
                                window,
                                cx,
                            );
                        }),
                )
            })
        })
}
