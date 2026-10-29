// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

use crate::focus_ring::KeyboardRing as _;
use std::rc::Rc;

use composerkit_theme::Scheme;
use gpui_kit::assets::IconName;
use gpui_kit::component::Icon;
use gpui_kit::component::button::{Button, ButtonVariants as _};
use gpui_kit::component::menu::{DropdownMenu as _, PopupMenu, PopupMenuItem};
use gpui_kit::{App, ElementId, IntoElement, RenderOnce, Window, px};

use crate::conversation::ConversationLayout;

/// The menu scrolls past this height, so every choice stays reachable on a short screen.
const MENU_MAX_HEIGHT: f32 = 480.;

type LayoutHandler = Rc<dyn Fn(&ConversationLayout, &mut Window, &mut App)>;

/// The app's conversation layout and what to do when it changes.
#[derive(Clone)]
struct LayoutChoice {
    current: ConversationLayout,
    on_change: LayoutHandler,
}

/// A button that opens the color scheme picker, and the conversation layout
/// picker when [`Self::conversation_layout`] is set. The chosen scheme and
/// layout carry a check mark.
#[derive(IntoElement)]
pub struct AppearanceMenu {
    id: ElementId,
    layout: Option<LayoutChoice>,
}

impl AppearanceMenu {
    #[must_use]
    pub fn new(id: impl Into<ElementId>) -> Self {
        Self {
            id: id.into(),
            layout: None,
        }
    }

    /// Adds the "Conversation layout" group below the color scheme, as on
    /// the web, with `current` checked. The app keeps the
    /// layout, so `on_change` stores the choice and draws the menu again.
    #[must_use]
    pub fn conversation_layout(
        mut self,
        current: ConversationLayout,
        on_change: impl Fn(&ConversationLayout, &mut Window, &mut App) + 'static,
    ) -> Self {
        self.layout = Some(LayoutChoice {
            current,
            on_change: Rc::new(on_change),
        });
        self
    }
}

fn layout_group(menu: PopupMenu, choice: &LayoutChoice) -> PopupMenu {
    ConversationLayout::ALL.into_iter().fold(
        menu.separator().label("Conversation layout"),
        |menu, layout| {
            let on_change = Rc::clone(&choice.on_change);
            menu.item(
                PopupMenuItem::new(layout.label())
                    .checked(layout == choice.current)
                    .on_click(move |_, window, cx| on_change(&layout, window, cx)),
            )
        },
    )
}

impl RenderOnce for AppearanceMenu {
    fn render(self, _window: &mut Window, cx: &mut App) -> impl IntoElement {
        let layout = self.layout;
        Button::new(self.id)
            .keyboard_ring(cx)
            .ghost()
            .icon(Icon::new(IconName::Palette))
            .tooltip("Appearance")
            .accessibility_label("Appearance")
            .dropdown_menu(move |menu, _window, cx| {
                let scheme = composerkit_theme::scheme(cx);
                let menu = Scheme::ALL.into_iter().fold(
                    menu.max_h(px(MENU_MAX_HEIGHT))
                        .scrollable(true)
                        .label("Color scheme"),
                    |menu, choice| {
                        menu.item(
                            PopupMenuItem::new(choice.label())
                                .checked(choice == scheme)
                                .on_click(move |_, _, cx| {
                                    composerkit_theme::set_scheme(choice, cx);
                                }),
                        )
                    },
                );
                match &layout {
                    Some(choice) => layout_group(menu, choice),
                    None => menu,
                }
            })
    }
}
