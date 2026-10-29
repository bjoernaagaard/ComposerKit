// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

use std::rc::Rc;

use gpui_kit::assets::IconName;
use gpui_kit::component::tab::{Tab, TabBar, TabVariant};
use gpui_kit::component::tooltip::Tooltip;
use gpui_kit::component::{Icon, Sizable as _};
use gpui_kit::{
    App, ElementId, FocusHandle, FontWeight, InteractiveElement as _, IntoElement, KeyDownEvent,
    ParentElement as _, RenderOnce, ScrollHandle, SharedString, StatefulInteractiveElement as _,
    Styled as _, Window, div, prelude::FluentBuilder as _, px,
};

/// How the tab strip marks the open tab.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Hash)]
pub enum TabAppearance {
    /// The open tab is a raised box. Other tabs show hover
    /// through text color, since a hover fill would look open.
    #[default]
    Filled,
    /// No box; a bar sits under the open tab.
    Underline,
}

impl TabAppearance {
    /// Every appearance, in the order a picker shows them.
    pub const ALL: [Self; 2] = [Self::Filled, Self::Underline];

    /// The name a picker shows.
    #[must_use]
    pub const fn label(self) -> &'static str {
        match self {
            Self::Filled => "Filled",
            Self::Underline => "Underline",
        }
    }

    const fn variant(self) -> TabVariant {
        match self {
            Self::Filled => TabVariant::Tab,
            Self::Underline => TabVariant::Underline,
        }
    }
}

/// One open chat in the tab strip.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ChatTab {
    pub id: SharedString,
    pub title: SharedString,
}

impl ChatTab {
    #[must_use]
    pub fn new(id: impl Into<SharedString>, title: impl Into<SharedString>) -> Self {
        Self {
            id: id.into(),
            title: title.into(),
        }
    }
}

// Shared by the click and key handlers.
type SelectHandler = Rc<dyn Fn(&SharedString, &mut Window, &mut App)>;

/// What a strip keeps between frames.
struct StripState {
    focus: FocusHandle,
    scroll: ScrollHandle,
    /// The tab last scrolled into view, so the strip scrolls only when the
    /// open tab changes and leaves the user's own scrolling alone.
    revealed: Option<usize>,
}

/// The row of open chats in the title bar. The open tab's title is also
/// semibold, so color is never the only cue, and a tooltip shows titles the
/// tab cuts off. The strip is one keyboard stop: the arrow keys, Home and
/// End pick a tab, as the WAI-ARIA tabs pattern expects. The open tab is
/// scrolled into view whenever it changes, however it was picked.
#[derive(IntoElement)]
pub struct TabStrip {
    id: ElementId,
    tabs: Vec<ChatTab>,
    active: Option<SharedString>,
    appearance: TabAppearance,
    on_select: Option<SelectHandler>,
}

impl TabStrip {
    #[must_use]
    pub fn new(id: impl Into<ElementId>, tabs: impl IntoIterator<Item = ChatTab>) -> Self {
        Self {
            id: id.into(),
            tabs: tabs.into_iter().collect(),
            active: None,
            appearance: TabAppearance::default(),
            on_select: None,
        }
    }

    /// The id of the open tab.
    #[must_use]
    pub fn active(mut self, id: impl Into<SharedString>) -> Self {
        self.active = Some(id.into());
        self
    }

    #[must_use]
    pub fn appearance(mut self, appearance: TabAppearance) -> Self {
        self.appearance = appearance;
        self
    }

    /// Called with the id of the tab the user picks.
    #[must_use]
    pub fn on_select(
        mut self,
        handler: impl Fn(&SharedString, &mut Window, &mut App) + 'static,
    ) -> Self {
        self.on_select = Some(Rc::new(handler));
        self
    }
}

impl RenderOnce for TabStrip {
    fn render(self, window: &mut Window, cx: &mut App) -> impl IntoElement {
        let tokens = composerkit_theme::tokens();
        let size = &tokens.size;
        let focus_ring = composerkit_theme::colors(cx).ring;
        let variant = self.appearance.variant();
        let selected = self
            .tabs
            .iter()
            .position(|tab| Some(&tab.id) == self.active.as_ref());

        let tabs: Vec<Tab> = self
            .tabs
            .iter()
            .enumerate()
            .map(|(index, tab)| {
                let title = tab.title.clone();
                let label = div()
                    .id(("tab-title", index))
                    .min_w_0()
                    .flex_1()
                    .truncate()
                    .child(tab.title.clone())
                    .tooltip(move |window, cx| Tooltip::new(title.clone()).build(window, cx));

                Tab::new()
                    .aria_label(tab.title.clone())
                    .w(px(size.tab_width))
                    .when(Some(index) == selected, |tab| {
                        tab.font_weight(FontWeight::SEMIBOLD)
                    })
                    .prefix(Icon::new(IconName::MessageCircle).small())
                    .child(label)
            })
            .collect();

        let state = window.use_keyed_state((self.id.clone(), "strip"), cx, |_, cx| StripState {
            focus: cx.focus_handle().tab_stop(true),
            scroll: ScrollHandle::new(),
            revealed: None,
        });
        let StripState {
            focus,
            scroll,
            revealed,
        } = state.read(cx);
        let (focus, scroll) = (focus.clone(), scroll.clone());
        if *revealed != selected {
            if let Some(index) = selected {
                scroll.scroll_to_item(index);
            }
            state.update(cx, |state, _| state.revealed = selected);
        }

        let ids: Rc<[SharedString]> = self.tabs.into_iter().map(|tab| tab.id).collect();
        let on_click = self.on_select.clone().map(|on_select| {
            let ids = Rc::clone(&ids);
            move |index: &usize, window: &mut Window, cx: &mut App| {
                if let Some(id) = ids.get(*index) {
                    on_select(id, window, cx);
                }
            }
        });
        let on_key_down = self.on_select.map(|on_select| {
            move |event: &KeyDownEvent, window: &mut Window, cx: &mut App| {
                let last = ids.len().saturating_sub(1);
                let target = match (event.keystroke.key.as_str(), selected) {
                    ("left", Some(index)) => Some(if index == 0 { last } else { index - 1 }),
                    ("right", Some(index)) => Some(if index == last { 0 } else { index + 1 }),
                    ("home", _) => Some(0),
                    ("end", _) => Some(last),
                    _ => None,
                };
                if let Some(id) = target.and_then(|index| ids.get(index)) {
                    cx.stop_propagation();
                    on_select(id, window, cx);
                }
            }
        });

        div()
            .id((self.id.clone(), "keys"))
            .track_focus(&focus)
            .when_some(on_key_down, |strip, handler| strip.on_key_down(handler))
            // Without a width cap the bar grows past the title bar instead of
            // scrolling.
            .flex()
            .min_w_0()
            .max_w_full()
            .rounded(px(tokens.radius.tab))
            .border_1()
            .border_color(gpui_kit::transparent_black())
            .focus_visible(|style| style.border_color(focus_ring))
            .child(
                TabBar::new(self.id)
                    .with_variant(variant)
                    .small()
                    .min_w_0()
                    .max_width(px(size.tab_width))
                    .track_scroll(&scroll)
                    .when_some(selected, TabBar::selected_index)
                    .children(tabs)
                    .when_some(on_click, TabBar::on_click),
            )
    }
}
