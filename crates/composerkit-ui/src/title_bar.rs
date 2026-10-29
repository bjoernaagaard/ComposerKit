// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

use crate::focus_ring::KeyboardRing as _;
use gpui_kit::assets::IconName;
use gpui_kit::component::button::{Button, ButtonVariants as _};
use gpui_kit::component::{Disableable as _, Icon, Sizable as _, TitleBar as KitTitleBar};
use gpui_kit::{
    AnyElement, App, ClickEvent, IntoElement, ParentElement as _, RenderOnce, Styled as _, Window,
    div, prelude::FluentBuilder as _, px,
};

use crate::TabStrip;

/// Whether the sidebar is on screen, which sets the toggle's label.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Hash)]
pub enum SidebarVisibility {
    #[default]
    Shown,
    Hidden,
}

type ClickHandler = Box<dyn Fn(&ClickEvent, &mut Window, &mut App)>;

/// The window's title bar: back and forward, the sidebar toggle, the tab
/// strip, a new tab button and an optional trailing control. Open the window
/// with `gpui_kit::component::TitleBar::window_options()` so this bar owns
/// dragging and the traffic lights sit inside it.
#[derive(IntoElement)]
pub struct TitleBar {
    tabs: TabStrip,
    on_back: Option<ClickHandler>,
    on_forward: Option<ClickHandler>,
    sidebar: Option<(SidebarVisibility, ClickHandler)>,
    on_new_tab: Option<ClickHandler>,
    trailing: Option<AnyElement>,
}

impl TitleBar {
    #[must_use]
    pub fn new(tabs: TabStrip) -> Self {
        Self {
            tabs,
            on_back: None,
            on_forward: None,
            sidebar: None,
            on_new_tab: None,
            trailing: None,
        }
    }

    /// Without a handler the Back button is disabled.
    #[must_use]
    pub fn on_back(
        mut self,
        handler: impl Fn(&ClickEvent, &mut Window, &mut App) + 'static,
    ) -> Self {
        self.on_back = Some(Box::new(handler));
        self
    }

    /// Without a handler the Forward button is disabled.
    #[must_use]
    pub fn on_forward(
        mut self,
        handler: impl Fn(&ClickEvent, &mut Window, &mut App) + 'static,
    ) -> Self {
        self.on_forward = Some(Box::new(handler));
        self
    }

    /// Shows the sidebar toggle, labelled for the sidebar's current state.
    #[must_use]
    pub fn sidebar_toggle(
        mut self,
        visibility: SidebarVisibility,
        handler: impl Fn(&ClickEvent, &mut Window, &mut App) + 'static,
    ) -> Self {
        self.sidebar = Some((visibility, Box::new(handler)));
        self
    }

    /// Shows the New tab button after the tabs.
    #[must_use]
    pub fn on_new_tab(
        mut self,
        handler: impl Fn(&ClickEvent, &mut Window, &mut App) + 'static,
    ) -> Self {
        self.on_new_tab = Some(Box::new(handler));
        self
    }

    /// A control at the end of the bar, such as the appearance menu.
    #[must_use]
    pub fn trailing(mut self, element: impl IntoElement) -> Self {
        self.trailing = Some(element.into_any_element());
        self
    }
}

fn nav_button(
    id: &'static str,
    icon: IconName,
    label: &'static str,
    handler: Option<ClickHandler>,
    cx: &App,
) -> Button {
    Button::new(id)
        .keyboard_ring(cx)
        .ghost()
        .small()
        .icon(Icon::new(icon))
        .tooltip(label)
        .accessibility_label(label)
        .disabled(handler.is_none())
        .when_some(handler, Button::on_click)
}

impl RenderOnce for TitleBar {
    fn render(self, _window: &mut Window, cx: &mut App) -> impl IntoElement {
        let tokens = composerkit_theme::tokens();

        let sidebar_toggle = self.sidebar.map(|(visibility, handler)| {
            let label = match visibility {
                SidebarVisibility::Shown => "Hide sidebar",
                SidebarVisibility::Hidden => "Show sidebar",
            };
            nav_button(
                "sidebar-toggle",
                IconName::PanelLeft,
                label,
                Some(handler),
                cx,
            )
        });

        KitTitleBar::new()
            .h(px(tokens.size.titlebar))
            .child(
                div()
                    .flex()
                    .items_center()
                    .gap_1()
                    .child(nav_button(
                        "back",
                        IconName::ArrowLeft,
                        "Back",
                        self.on_back,
                        cx,
                    ))
                    .child(nav_button(
                        "forward",
                        IconName::ArrowRight,
                        "Forward",
                        self.on_forward,
                        cx,
                    ))
                    .children(sidebar_toggle),
            )
            // gpui-kit's bar never shrinks below its content, so this region
            // starts at zero width and grows into the free space. The tab
            // strip then scrolls instead of pushing the trailing slot away.
            .child(
                div()
                    .flex()
                    .flex_1()
                    .w_0()
                    .items_center()
                    .gap_2()
                    .px_2()
                    .child(div().flex_1().min_w_0().child(self.tabs))
                    .when_some(self.on_new_tab, |row, handler| {
                        row.child(nav_button(
                            "new-tab",
                            IconName::Plus,
                            "New tab",
                            Some(handler),
                            cx,
                        ))
                    }),
            )
            .children(self.trailing.map(|element| div().px_2().child(element)))
    }
}
