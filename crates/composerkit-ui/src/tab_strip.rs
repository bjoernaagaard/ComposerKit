// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

use std::rc::Rc;
use std::time::{Duration, Instant};

use gpui_kit::assets::IconName;
use gpui_kit::component::tab::{Tab, TabBar, TabVariant};
use gpui_kit::component::tooltip::Tooltip;
use gpui_kit::component::{Icon, Sizable as _};
use gpui_kit::{
    App, AppContext as _, Context, DragMoveEvent, ElementId, FocusHandle, FontWeight,
    InteractiveElement as _, IntoElement, KeyDownEvent, MouseButton, ParentElement as _, Pixels,
    Render, RenderOnce, ScrollHandle, SharedString, StatefulInteractiveElement as _, Styled as _,
    TestSupportExt as _, Window, div, prelude::FluentBuilder as _, px,
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
// Called with the moved tab's id and its place after the move.
type MoveHandler = Rc<dyn Fn(&SharedString, usize, &mut Window, &mut App)>;

/// What a strip keeps between frames.
struct StripState {
    focus: FocusHandle,
    scroll: ScrollHandle,
    /// The tab last scrolled into view, so the strip scrolls only when the
    /// open tab changes and leaves the user's own scrolling alone.
    revealed: Option<usize>,
    /// The tab a pointer is dragging, and the place it would drop into.
    drag: Option<DragSlot>,
    /// Each tab's left and right edge when the drag started, in the strip's
    /// scrolled content. Tabs slide during a drag, so their live bounds
    /// can't place the pointer.
    rest: Vec<(Pixels, Pixels)>,
    /// The other tabs' slide toward the offsets the drag asks for.
    slide: Slide,
}

#[derive(Clone, Copy, PartialEq, Eq)]
struct DragSlot {
    from: usize,
    slot: usize,
}

/// Eases each tab's horizontal offset from where it was drawn to where the
/// drag wants it.
#[derive(Default)]
struct Slide {
    started: Option<Instant>,
    from: Vec<f32>,
    to: Vec<f32>,
}

impl Slide {
    /// The offsets to draw now, and whether they are still moving.
    fn sample(&self, reduce_motion: bool) -> (Vec<f32>, bool) {
        let motion = &composerkit_theme::tokens().motion;
        let duration = Duration::from_millis(motion.duration_ms);
        let progress = match self.started {
            Some(started) if !reduce_motion && !duration.is_zero() => {
                (started.elapsed().as_secs_f32() / duration.as_secs_f32()).min(1.)
            }
            _ => 1.,
        };
        let eased = motion.ease_out.easing().sample(progress);
        let offsets = self
            .to
            .iter()
            .enumerate()
            .map(|(index, to)| {
                let from = self.from.get(index).copied().unwrap_or(0.);
                from + (to - from) * eased
            })
            .collect();
        (offsets, progress < 1.)
    }

    fn retarget(&mut self, to: Vec<f32>, reduce_motion: bool) {
        if to == self.to {
            return;
        }
        let (now, _) = self.sample(reduce_motion);
        self.from = now;
        self.to = to;
        self.started = Some(Instant::now());
    }
}

/// What a tab drag carries: which strip it came from, so another strip
/// ignores it, and the tab.
#[derive(Clone)]
struct DragTab {
    strip: ElementId,
    id: SharedString,
    title: SharedString,
    from: usize,
}

/// The tab under the pointer while it is dragged: lifted with the menu's
/// shadow.
struct DragTabPreview {
    title: SharedString,
}

impl Render for DragTabPreview {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let tokens = composerkit_theme::tokens();
        let colors = *composerkit_theme::colors(cx);
        div()
            .flex()
            .items_center()
            .gap_2()
            .w(px(tokens.size.tab_width))
            .h(px(tokens.size.tab_height))
            .px_2()
            .rounded(px(tokens.radius.tab))
            .bg(colors.card)
            .border_1()
            .border_color(colors.border)
            .shadow_lg()
            .text_color(colors.foreground)
            .font_weight(FontWeight::SEMIBOLD)
            .child(Icon::new(IconName::MessageCircle).small())
            .child(
                div()
                    .min_w_0()
                    .flex_1()
                    .truncate()
                    .child(self.title.clone()),
            )
    }
}

/// Where a tab dragged from `from` lands for a pointer at `x`, in the
/// strip's scrolled content: past every other tab whose middle it passed.
fn slot_for(rest: &[(Pixels, Pixels)], from: usize, x: Pixels) -> usize {
    rest.iter()
        .enumerate()
        .filter(|(index, (left, right))| *index != from && (*left + *right) / 2. < x)
        .count()
}

/// How far each tab sits from its resting place while the dragged tab
/// would land in `slot`: the tabs between step over by one place.
fn offsets_for(rest: &[(Pixels, Pixels)], drag: Option<DragSlot>) -> Vec<f32> {
    let mut offsets = vec![0.; rest.len()];
    let Some(DragSlot { from, slot }) = drag else {
        return offsets;
    };
    let left = |index: usize| rest.get(index).map_or(0., |(left, _)| f32::from(*left));
    for (index, offset) in offsets.iter_mut().enumerate() {
        *offset = if index == from {
            left(slot) - left(from)
        } else if from < index && index <= slot {
            left(index - 1) - left(index)
        } else if slot <= index && index < from {
            left(index + 1) - left(index)
        } else {
            0.
        };
    }
    offsets
}

/// The row of open chats in the title bar. The open tab's title is also
/// semibold, so color is never the only cue, and a tooltip shows titles the
/// tab cuts off. The strip is one keyboard stop: the arrow keys, Home and
/// End pick a tab, as the WAI-ARIA tabs pattern expects. The open tab is
/// scrolled into view whenever it changes, however it was picked. With
/// [`TabStrip::on_move`], Ctrl+Shift+Left and Right move the open tab, and a
/// tab dragged with the mouse moves while the others slide aside.
#[derive(IntoElement)]
pub struct TabStrip {
    id: ElementId,
    tabs: Vec<ChatTab>,
    active: Option<SharedString>,
    appearance: TabAppearance,
    on_select: Option<SelectHandler>,
    on_move: Option<MoveHandler>,
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
            on_move: None,
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

    /// Lets tabs move: dragging one, or Ctrl+Shift+Left and Right on the
    /// strip. `index` is the tab's place after the move. The app moves the
    /// tab in its own list. Without it tabs can't move.
    #[must_use]
    pub fn on_move(
        mut self,
        handler: impl Fn(&SharedString, usize, &mut Window, &mut App) + 'static,
    ) -> Self {
        self.on_move = Some(Rc::new(handler));
        self
    }
}

/// How close to an end of the strip the pointer must be, while dragging a
/// tab, for the strip to scroll toward that end.
const DRAG_SCROLL_EDGE: f32 = 24.;
/// How far the strip scrolls for each pointer move near an end.
const DRAG_SCROLL_STEP: f32 = 8.;

impl RenderOnce for TabStrip {
    #[allow(clippy::too_many_lines)]
    fn render(self, window: &mut Window, cx: &mut App) -> impl IntoElement {
        let tokens = composerkit_theme::tokens();
        let size = &tokens.size;
        let focus_ring = composerkit_theme::colors(cx).ring;
        let variant = self.appearance.variant();
        let count = self.tabs.len();
        let reduce_motion = cx.reduce_motion();
        let selected = self
            .tabs
            .iter()
            .position(|tab| Some(&tab.id) == self.active.as_ref());

        let state = window.use_keyed_state((self.id.clone(), "strip"), cx, |_, cx| StripState {
            focus: cx.focus_handle().tab_stop(true),
            scroll: ScrollHandle::new(),
            revealed: None,
            drag: None,
            rest: Vec::new(),
            slide: Slide::default(),
        });
        // gpui ends a drag released off the strip before this frame, so a
        // slot left set is stale, and the tabs slide back.
        if state.read(cx).drag.is_some() && !cx.has_active_drag() {
            state.update(cx, |state, _| state.drag = None);
        }
        let (focus, scroll) = {
            let state = state.read(cx);
            (state.focus.clone(), state.scroll.clone())
        };
        if state.read(cx).revealed != selected {
            if let Some(index) = selected {
                scroll.scroll_to_item(index);
            }
            state.update(cx, |state, _| state.revealed = selected);
        }
        let (offsets, sliding) = state.update(cx, |state, _| {
            let target = offsets_for(&state.rest, state.drag);
            state.slide.retarget(target, reduce_motion);
            state.slide.sample(reduce_motion)
        });
        if sliding {
            window.request_animation_frame();
        }
        let dragging = state.read(cx).drag.map(|drag| drag.from);

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
                let offset = offsets.get(index).copied().unwrap_or(0.);

                Tab::new()
                    .aria_label(tab.title.clone())
                    .w(px(size.tab_width))
                    .when(Some(index) == selected, |tab| {
                        tab.font_weight(FontWeight::SEMIBOLD)
                    })
                    .when(offset != 0., |tab| tab.relative().left(px(offset)))
                    // The pointer carries a lifted copy, so the tab itself
                    // leaves an empty place where it would land.
                    .when(dragging == Some(index), |tab| tab.opacity(0.))
                    .when(self.on_move.is_some(), |movable| {
                        let drag = DragTab {
                            strip: self.id.clone(),
                            id: tab.id.clone(),
                            title: tab.title.clone(),
                            from: index,
                        };
                        let state = state.clone();
                        let scroll = scroll.clone();
                        let focus = focus.clone();
                        movable
                            .aria_description(format!("position {} of {count}", index + 1))
                            // gpui-kit's tab stops a press in the bubble
                            // phase, which also keeps the title bar from
                            // moving the window, so the strip hears the
                            // press while it is captured.
                            .capture_any_mouse_down(move |event, window, cx| {
                                if event.button != MouseButton::Left {
                                    return;
                                }
                                window.focus(&focus, cx);
                                let scrolled = scroll.offset().x;
                                let rest = (0..count)
                                    .filter_map(|item| scroll.bounds_for_item(item))
                                    .map(|bounds| {
                                        (bounds.left() - scrolled, bounds.right() - scrolled)
                                    })
                                    .collect();
                                state.update(cx, |state, _| state.rest = rest);
                            })
                            .on_drag(drag, |drag, _, _, cx| {
                                cx.new(|_| DragTabPreview {
                                    title: drag.title.clone(),
                                })
                            })
                    })
                    .prefix(Icon::new(IconName::MessageCircle).small())
                    .child(label)
            })
            .collect();

        let ids: Rc<[SharedString]> = self.tabs.into_iter().map(|tab| tab.id).collect();
        let on_click = self.on_select.clone().map(|on_select| {
            let ids = Rc::clone(&ids);
            move |index: &usize, window: &mut Window, cx: &mut App| {
                if let Some(id) = ids.get(*index) {
                    on_select(id, window, cx);
                }
            }
        });
        let on_key_down = (self.on_select.is_some() || self.on_move.is_some()).then(|| {
            let on_select = self.on_select.clone();
            let on_move = self.on_move.clone();
            move |event: &KeyDownEvent, window: &mut Window, cx: &mut App| {
                let key = event.keystroke.key.as_str();
                let modifiers = event.keystroke.modifiers;
                if modifiers.control && modifiers.shift && matches!(key, "left" | "right") {
                    let Some(on_move) = &on_move else {
                        return;
                    };
                    cx.stop_propagation();
                    // The ends don't wrap: a tab at an end stays there.
                    let to = selected.and_then(|index| match key {
                        "left" => index.checked_sub(1),
                        _ => (index + 1 < ids.len()).then_some(index + 1),
                    });
                    if let (Some(to), Some(id)) = (to, selected.and_then(|index| ids.get(index))) {
                        on_move(id, to, window, cx);
                    }
                    return;
                }
                let Some(on_select) = &on_select else {
                    return;
                };
                let last = ids.len().saturating_sub(1);
                let target = match (key, selected) {
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

        let strip_id = self.id.clone();
        div()
            .id((self.id.clone(), "keys"))
            .test_support()
            .track_focus(&focus)
            .when_some(on_key_down, |strip, handler| strip.on_key_down(handler))
            .when_some(self.on_move, |strip, on_move| {
                let moving = state.clone();
                let dropping = state;
                let scroll = scroll.clone();
                let strip_for_move = strip_id.clone();
                strip
                    .aria_keyshortcuts("Control+Shift+ArrowLeft Control+Shift+ArrowRight")
                    .on_drag_move::<DragTab>(move |event: &DragMoveEvent<DragTab>, window, cx| {
                        let (strip, from) = {
                            let drag = event.drag(cx);
                            (drag.strip.clone(), drag.from)
                        };
                        if strip != strip_for_move {
                            return;
                        }
                        let position = event.event.position;
                        let bounds = event.bounds;
                        let edge = px(DRAG_SCROLL_EDGE);
                        let scrolled = scroll.offset();
                        if position.x < bounds.left() + edge {
                            scroll.set_offset(gpui_kit::point(
                                (scrolled.x + px(DRAG_SCROLL_STEP)).min(px(0.)),
                                scrolled.y,
                            ));
                        } else if position.x > bounds.right() - edge {
                            scroll.set_offset(gpui_kit::point(
                                scrolled.x - px(DRAG_SCROLL_STEP),
                                scrolled.y,
                            ));
                        }
                        // Far above or below the strip, a release
                        // moves nothing, so the tabs show that.
                        let reach = bounds.size.height;
                        let near = position.y >= bounds.top() - reach
                            && position.y <= bounds.bottom() + reach;
                        let content_x = position.x - scroll.offset().x;
                        let changed = moving.update(cx, |state, _| {
                            let slot = if near {
                                slot_for(&state.rest, from, content_x)
                            } else {
                                from
                            };
                            let next = Some(DragSlot { from, slot });
                            let changed = state.drag != next;
                            state.drag = next;
                            changed
                        });
                        if changed {
                            window.refresh();
                        }
                    })
                    .on_drop::<DragTab>(move |drag, window, cx| {
                        if drag.strip != strip_id {
                            return;
                        }
                        let slot = dropping.update(cx, |state, _| {
                            let slot = state.drag.map_or(drag.from, |drag| drag.slot);
                            // The app redraws the tabs in their new order,
                            // so nothing is left to slide.
                            state.drag = None;
                            state.slide = Slide::default();
                            slot
                        });
                        if slot != drag.from {
                            on_move(&drag.id, slot, window, cx);
                        }
                        window.refresh();
                    })
            })
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
