// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

use crate::focus_ring::KeyboardRing as _;
use std::collections::{BTreeMap, BTreeSet};
use std::f32::consts::TAU;
use std::fmt;
use std::rc::Rc;
use std::time::{Duration, Instant};

use gpui_kit::assets::IconName;
use gpui_kit::component::button::{Button, ButtonVariants as _};
use gpui_kit::component::scroll::ScrollableElement as _;
use gpui_kit::component::{Icon, Sizable as _};
use gpui_kit::{
    AnyElement, AppContext as _, ClickEvent, ClipboardItem, Context, Div, Entity, FocusHandle,
    FollowMode, InteractiveElement as _, IntoElement, KeyDownEvent, ListAlignment, ListOffset,
    ListState, ParentElement as _, Pixels, Render, Stateful, StatefulInteractiveElement as _,
    Styled as _, Subscription, Task, Window, accesskit::Role, div, list, point,
    prelude::FluentBuilder as _, px,
};

use super::layout::{ConversationLayout, TurnView};
use super::parts::{CopyTarget, TurnHandlers, TurnStatus, focus_ring};
use super::reveal::FocusReveal;
use super::sample::placeholder_reply;
use super::turn::{Block, Role as Speaker, Turn, TurnAttachment, reveal, total_length};
use crate::composer::attachments::format_size;
use crate::composer::{
    Composer, ComposerAction, ComposerController, ComposerLayout, ComposerMode, ComposerState,
    Phase, SentMessage, UploadStatus,
};

/// About 100 characters a second, slow enough to watch a reply arrive.
const STREAM_STEP: usize = 6;
const STREAM_TICK: Duration = Duration::from_millis(60);
/// How long a Copy button says "Copied".
const COPIED_FOR: Duration = Duration::from_secs(2);
/// Within this many pixels of the end counts as reading the newest turn.
const PIN_SLACK: f32 = 48.;
/// How far past the visible turns the list lays turns out ahead of a scroll.
const LIST_OVERDRAW: f32 = 400.;
/// The runway ignores changes smaller than this, so it settles.
const RUNWAY_SLACK: f32 = 0.5;

/// How far an arrow key scrolls the list.
const KEY_SCROLL_STEP: f32 = 40.;
/// The web caret's `animate-pulse`: full, half, full again.
const CARET_PERIOD: Duration = Duration::from_secs(2);
/// About a browser's smooth scroll.
/// The list keeps at least this much height when the composer grows.
const MESSAGES_MIN_HEIGHT: f32 = 160.;

/// Names a turn for as long as the view shows it.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
struct TurnId(u64);

struct Entry {
    id: TurnId,
    turn: Turn,
    /// Lets the list keep drawing a turn that holds keyboard focus after it
    /// scrolls out of view, so the focus is never left pointing at nothing.
    focus: FocusHandle,
}

/// The reply that is arriving, and how much of it shows.
struct Stream {
    turn: TurnId,
    shown: usize,
    started: Instant,
}

/// The Copy button that says "Copied".
#[derive(Clone, Copy, PartialEq, Eq)]
struct Copied {
    turn: TurnId,
    target: CopyTarget,
}

/// A smooth scroll to the end, started by Jump to the newest message.
struct Jump {
    from: Pixels,
    started: Instant,
}

/// The open chat: a scrolling list of turns with the composer under it,
/// the native twin of the web `ConversationView`.
///
/// The list keeps the newest turn in view while you are at the end, as
/// replies stream in and when the composer grows, and offers a Go to the
/// newest message button once you scroll up. A reply streams with a Stop
/// button; Retry streams a reply again, and starting a reply stops the one
/// streaming, which keeps what it showed. Copy puts a turn or a code block
/// on the clipboard.
///
/// The keyboard reaches everything: Tab moves through the turns' controls
/// and scrolls each into view, and with focus in the list the arrow, Page
/// Up, Page Down, Home and End keys scroll it. When the system asks for
/// reduced motion, the caret holds still and Jump moves at once.
///
/// The view owns a [`ComposerController`] with simulated sends. A sent
/// message gets a placeholder reply, because no model is attached.
#[expect(
    clippy::struct_excessive_bools,
    reason = "scroll, motion and focus each keep their own flag, set at different times"
)]
pub struct ConversationView {
    entries: Vec<Entry>,
    next_id: u64,
    layout: ConversationLayout,
    stream: Option<Stream>,
    /// Replies stopped before the end, with the characters they showed.
    stopped: BTreeMap<TurnId, usize>,
    /// Replies marked helpful.
    rated: BTreeSet<TurnId>,
    copied: Option<Copied>,
    announcement: &'static str,
    list: ListState,
    reveal: FocusReveal,
    /// The message list, which takes focus so the keyboard can scroll it.
    focus: FocusHandle,
    /// Whether you are reading the newest turn, so growth keeps it in view.
    pinned: bool,
    /// A message you just sent sits at the top, and the reply grows below
    /// it without the list following, until you scroll or jump.
    anchored: bool,
    /// Edit put a message back in the composer, which takes focus on the
    /// next frame.
    focus_composer: bool,
    jump: Option<Jump>,
    /// The system asks for reduced motion, as of the last frame.
    reduce_motion: bool,
    /// The list's size in the last frame, read while turns are laid out.
    viewport: gpui_kit::Size<Pixels>,
    /// The message you sent last, which the runway lets reach the top.
    runway_for: Option<TurnId>,
    /// Empty space after the last turn, so the message you sent last can
    /// scroll to the top however short the reply below it is.
    runway: Pixels,
    composer: Entity<ComposerController>,
    stream_task: Option<Task<()>>,
    copied_task: Option<Task<()>>,
    _subscriptions: [Subscription; 2],
}

impl fmt::Debug for ConversationView {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("ConversationView")
            .field("turns", &self.entries.len())
            .field("layout", &self.layout)
            .field(
                "streaming",
                &self
                    .stream
                    .as_ref()
                    .map(|stream| (stream.turn, stream.shown)),
            )
            .field("stopped", &self.stopped)
            .field("pinned", &self.pinned)
            .finish_non_exhaustive()
    }
}

impl ConversationView {
    /// A view of existing `turns` in the default layout, scrolled to the end.
    pub fn new(turns: impl IntoIterator<Item = Turn>, cx: &mut Context<Self>) -> Self {
        // The one item is the runway, which stays last.
        let list = ListState::new(1, ListAlignment::Top, px(LIST_OVERDRAW));
        list.set_follow_mode(FollowMode::Tail);
        let view = cx.weak_entity();
        // The list is mid-scroll when this runs, so the view reads it after.
        list.set_scroll_handler(move |_, _, cx| {
            let view = view.clone();
            cx.defer(move |cx| {
                view.update(cx, Self::on_scrolled).ok();
            });
        });

        let composer = cx.new(|_| ComposerController::new(ComposerState::default()));
        let subscriptions = [
            cx.observe(&composer, |_, _, cx| cx.notify()),
            cx.subscribe(&composer, |this, _, message: &SentMessage, cx| {
                this.on_sent(message, cx);
            }),
        ];

        let mut this = Self {
            entries: Vec::new(),
            next_id: 0,
            layout: ConversationLayout::default(),
            stream: None,
            stopped: BTreeMap::new(),
            rated: BTreeSet::new(),
            copied: None,
            announcement: "",
            reveal: FocusReveal::new(list.clone(), cx.entity_id()),
            list,
            focus: cx.focus_handle().tab_stop(true),
            pinned: true,
            anchored: false,
            focus_composer: false,
            jump: None,
            reduce_motion: cx.reduce_motion(),
            viewport: gpui_kit::Size::default(),
            runway_for: None,
            runway: Pixels::ZERO,
            composer,
            stream_task: None,
            copied_task: None,
            _subscriptions: subscriptions,
        };
        this.push(turns, cx);
        this
    }

    /// Retry the last turn when it is a reply.
    pub fn retry_last_reply(&mut self, cx: &mut Context<Self>) {
        if let Some(entry) = self.entries.last()
            && entry.turn.role == Speaker::Assistant
        {
            self.retry(entry.id, cx);
        }
    }

    /// The layout the turns are drawn in.
    #[must_use]
    pub fn layout(&self) -> ConversationLayout {
        self.layout
    }

    /// Draws the turns in `layout`. The conversation, its scroll position
    /// and a streaming reply carry over.
    pub fn set_layout(&mut self, layout: ConversationLayout, cx: &mut Context<Self>) {
        if self.layout == layout {
            return;
        }
        self.layout = layout;
        self.list.remeasure();
        self.keep_end_in_view();
        cx.notify();
    }

    /// Whether the list shows the newest turn, give or take a few pixels.
    #[must_use]
    pub fn is_at_end(&self) -> bool {
        self.pinned
    }

    /// How far the list is scrolled above its end.
    #[must_use]
    pub fn distance_from_end(&self) -> Pixels {
        let max = self.list.max_offset_for_scrollbar().y;
        if max <= Pixels::ZERO {
            return Pixels::ZERO;
        }
        let top = -self.list.scroll_px_offset_for_scrollbar().y;
        (max + px(2. * composerkit_theme::tokens().space.conversation_list_padding) - top)
            .max(Pixels::ZERO)
    }

    /// The composer the view draws under the list.
    #[must_use]
    pub fn composer(&self) -> &Entity<ComposerController> {
        &self.composer
    }

    fn push(
        &mut self,
        turns: impl IntoIterator<Item = Turn>,
        cx: &mut Context<Self>,
    ) -> Vec<TurnId> {
        let start = self.entries.len();
        for turn in turns {
            let id = TurnId(self.next_id);
            self.next_id += 1;
            self.entries.push(Entry {
                id,
                turn,
                focus: cx.focus_handle(),
            });
        }
        let added = &self.entries[start..];
        self.list.splice_focusable(
            start..start,
            added.iter().map(|entry| Some(entry.focus.clone())),
        );
        added.iter().map(|entry| entry.id).collect()
    }

    fn index_of(&self, id: TurnId) -> Option<usize> {
        self.entries.iter().position(|entry| entry.id == id)
    }

    /// Lays the turn out again, after what it shows changed.
    fn remeasure(&self, id: TurnId) {
        if let Some(index) = self.index_of(id) {
            self.list.remeasure_items(index..index + 1);
        }
    }

    /// While you read the newest turn, growth keeps the end in view.
    fn keep_end_in_view(&self) {
        if self.pinned && !self.anchored && !self.list.is_following_tail() {
            self.list.set_follow_mode(FollowMode::Tail);
        }
    }

    /// Sizes the runway from the last frame's layout: enough that the top
    /// of the message you sent last can reach the top of the list. While
    /// that message is anchored, the list scrolls it back up as the runway
    /// changes.
    fn update_runway(&mut self) {
        let Some(prompt) = self.runway_for.and_then(|id| self.index_of(id)) else {
            return;
        };
        let last = self.entries.len() - 1;
        let (Some(top), Some(end)) = (
            self.list.bounds_for_item(prompt),
            self.list.bounds_for_item(last),
        ) else {
            return;
        };
        let padding = px(2. * composerkit_theme::tokens().space.conversation_list_padding);
        let runway =
            (self.viewport.height - padding - (end.bottom() - top.top())).max(Pixels::ZERO);
        if (runway - self.runway).abs() < px(RUNWAY_SLACK) {
            return;
        }
        self.runway = runway;
        let spacer = self.entries.len();
        self.list.remeasure_items(spacer..spacer + 1);
        if self.anchored {
            self.list.scroll_to(ListOffset {
                item_ix: prompt,
                offset_in_item: Pixels::ZERO,
            });
        }
    }

    fn on_scrolled(&mut self, cx: &mut Context<Self>) {
        // Scrolling by hand takes over from a jump in flight.
        self.jump = None;
        self.anchored = false;
        self.update_pinned();
        cx.notify();
    }

    fn update_pinned(&mut self) {
        self.pinned = self.list.is_following_tail() || self.distance_from_end() < px(PIN_SLACK);
    }

    fn start_stream(&mut self, turn: TurnId, cx: &mut Context<Self>) {
        self.announcement = "The assistant is writing a reply.";
        self.stream = Some(Stream {
            turn,
            shown: 0,
            started: Instant::now(),
        });
        self.remeasure(turn);
        self.stream_task = Some(cx.spawn(async move |this, cx| {
            loop {
                cx.background_executor().timer(STREAM_TICK).await;
                let streaming = this.update(cx, Self::advance_stream);
                if !matches!(streaming, Ok(true)) {
                    break;
                }
            }
        }));
    }

    /// Shows a few more characters of the streaming reply. Returns whether
    /// it is still streaming.
    fn advance_stream(&mut self, cx: &mut Context<Self>) -> bool {
        let Some(stream) = &mut self.stream else {
            return false;
        };
        let Some(entry) = self.entries.iter().find(|entry| entry.id == stream.turn) else {
            self.stream = None;
            return false;
        };
        let total = total_length(&entry.turn.blocks);
        let turn = stream.turn;
        let streaming = stream.shown < total;
        if streaming {
            stream.shown = (stream.shown + STREAM_STEP).min(total);
        } else {
            self.stream = None;
            self.announcement = "The assistant has replied.";
        }
        self.remeasure(turn);
        self.keep_end_in_view();
        cx.notify();
        streaming
    }

    /// Ends the streaming reply unless it is `next`, keeping what it showed.
    fn interrupt_stream(&mut self, next: TurnId) {
        if let Some(stream) = self.stream.take_if(|stream| stream.turn != next) {
            self.stopped.insert(stream.turn, stream.shown);
            self.stream_task = None;
            self.remeasure(stream.turn);
        }
    }

    fn stop(&mut self, cx: &mut Context<Self>) {
        if let Some(stream) = self.stream.take() {
            self.stopped.insert(stream.turn, stream.shown);
            self.stream_task = None;
            self.remeasure(stream.turn);
            self.announcement = "Reply stopped. What it wrote so far stays.";
            cx.notify();
        }
    }

    fn retry(&mut self, turn: TurnId, cx: &mut Context<Self>) {
        self.interrupt_stream(turn);
        self.stopped.remove(&turn);
        self.start_stream(turn, cx);
        cx.notify();
    }

    fn copy(&mut self, turn: TurnId, target: CopyTarget, text: String, cx: &mut Context<Self>) {
        cx.write_to_clipboard(ClipboardItem::new_string(text));
        self.copied = Some(Copied { turn, target });
        self.announcement = "Copied.";
        self.copied_task = Some(cx.spawn(async move |this, cx| {
            cx.background_executor().timer(COPIED_FOR).await;
            this.update(cx, |this, cx| {
                this.copied = None;
                if this.announcement == "Copied." {
                    this.announcement = "";
                }
                cx.notify();
            })
            .ok();
        }));
        cx.notify();
    }

    fn on_sent(&mut self, message: &SentMessage, cx: &mut Context<Self>) {
        let attachments = message
            .attachments
            .iter()
            .filter(|attachment| attachment.status == UploadStatus::Ready)
            .map(|attachment| {
                TurnAttachment::new(attachment.name.clone(), format_size(attachment.size_bytes))
            });
        let sent = Turn::user(message.draft.trim(), attachments);
        let ids = self.push([sent, placeholder_reply()], cx);
        let (Some(&prompt), Some(&reply)) = (ids.first(), ids.last()) else {
            return;
        };
        self.interrupt_stream(reply);
        self.jump = None;
        // Your message moves to the top of the list, as far as the list can
        // scroll, and the reply grows below it.
        if let Some(index) = self.index_of(prompt) {
            self.anchored = true;
            self.runway_for = Some(prompt);
            self.list.set_follow_mode(FollowMode::Normal);
            self.list.scroll_to(ListOffset {
                item_ix: index,
                offset_in_item: Pixels::ZERO,
            });
        }
        self.start_stream(reply, cx);
        self.announcement = "Sent. The assistant is writing a reply.";
        cx.notify();
    }

    /// Scrolls to the newest turn: at once with the tokens' zero duration or
    /// when the system asks for reduced motion, smoothly otherwise.
    fn jump_to_end(&mut self, cx: &mut Context<Self>) {
        self.pinned = true;
        self.anchored = false;
        if cx.reduce_motion() || composerkit_theme::tokens().motion.jump_duration_ms == 0 {
            self.jump = None;
            self.list.set_follow_mode(FollowMode::Tail);
        } else {
            self.jump = Some(Jump {
                from: -self.list.scroll_px_offset_for_scrollbar().y,
                started: Instant::now(),
            });
        }
        cx.notify();
    }

    /// Moves a jump in flight one frame closer to the end, which may move
    /// while a reply streams.
    fn advance_jump(&mut self, window: &mut Window) {
        let Some(jump) = &self.jump else {
            return;
        };
        let duration = Duration::from_millis(composerkit_theme::tokens().motion.jump_duration_ms);
        let progress = jump.started.elapsed().as_secs_f32() / duration.as_secs_f32();
        if progress >= 1. {
            self.jump = None;
            self.list.set_follow_mode(FollowMode::Tail);
            return;
        }
        let eased = composerkit_theme::tokens()
            .motion
            .ease_out
            .easing()
            .sample(progress);
        let end = self.list.max_offset_for_scrollbar().y
            + px(2. * composerkit_theme::tokens().space.conversation_list_padding);
        let y = jump.from + (end - jump.from) * eased;
        self.list.set_offset_from_scrollbar(point(Pixels::ZERO, -y));
        window.request_animation_frame();
    }

    fn on_key_down(&mut self, event: &KeyDownEvent, window: &Window, cx: &mut Context<Self>) {
        let modifiers = event.keystroke.modifiers;
        if modifiers.control || modifiers.alt || modifiers.platform {
            return;
        }
        if self.type_into_composer(event, window, cx) {
            cx.stop_propagation();
            return;
        }
        if modifiers.shift {
            return;
        }
        let step = px(KEY_SCROLL_STEP);
        let page = (self.viewport.height - step).max(step);
        match event.keystroke.key.as_str() {
            "up" => self.list.scroll_by(-step),
            "down" => self.list.scroll_by(step),
            "pageup" => self.list.scroll_by(-page),
            "pagedown" => self.list.scroll_by(page),
            "home" => self.list.scroll_to(ListOffset {
                item_ix: 0,
                offset_in_item: Pixels::ZERO,
            }),
            "end" => self.list.set_follow_mode(FollowMode::Tail),
            _ => return,
        }
        self.jump = None;
        self.update_pinned();
        cx.stop_propagation();
        cx.notify();
    }

    /// A letter typed with the list or a turn focused lands in the
    /// composer, which takes focus. Buttons keep their keys, and so do
    /// their menus.
    fn type_into_composer(
        &mut self,
        event: &KeyDownEvent,
        window: &Window,
        cx: &mut Context<Self>,
    ) -> bool {
        let Some(text) = event.keystroke.key_char.as_deref() else {
            return false;
        };
        let printable = !text.is_empty() && !text.chars().any(char::is_control);
        let list_focused = self.focus.is_focused(window)
            || self
                .entries
                .iter()
                .any(|entry| entry.focus.is_focused(window));
        let state = self.composer.read(cx).state();
        let sending = state.phase == Phase::Sending;
        if !(printable && list_focused) || sending {
            return false;
        }
        let draft = format!("{}{text}", state.draft);
        self.composer.update(cx, |composer, cx| {
            composer.dispatch(ComposerAction::DraftChanged { draft }, cx);
        });
        self.focus_composer = true;
        cx.notify();
        true
    }

    /// What a turn shows and where it is in its life.
    fn shown(&self, entry: &Entry) -> (Vec<Block>, TurnStatus) {
        let blocks = &entry.turn.blocks;
        if let Some(stream) = self
            .stream
            .as_ref()
            .filter(|stream| stream.turn == entry.id)
        {
            return (
                reveal(blocks, stream.shown),
                TurnStatus::Streaming {
                    caret: self.caret_opacity(stream.started),
                },
            );
        }
        match self.stopped.get(&entry.id) {
            Some(&shown) => (reveal(blocks, shown), TurnStatus::Stopped),
            None => (blocks.clone(), TurnStatus::Done),
        }
    }

    /// The caret pulses between full and half while a reply streams. The
    /// stream redraws the view on every step, which drives the pulse.
    fn caret_opacity(&self, started: Instant) -> f32 {
        if self.reduce_motion {
            return 1.;
        }
        let phase = started.elapsed().as_secs_f32() / CARET_PERIOD.as_secs_f32();
        0.75 + 0.25 * (phase * TAU).cos()
    }

    /// With no share sheet natively, Share copies the text and says so.
    fn share(&mut self, text: String, cx: &mut Context<Self>) {
        cx.write_to_clipboard(ClipboardItem::new_string(text));
        self.announcement = "Copied, ready to paste wherever you share it.";
        cx.notify();
    }

    /// Puts your message back in the composer, with focus there. A draft
    /// already in progress is kept, and the message goes after it.
    fn edit(&mut self, text: String, cx: &mut Context<Self>) {
        self.composer.update(cx, |composer, cx| {
            let draft = composer.state().draft.trim_end();
            let draft = if draft.is_empty() {
                text
            } else {
                format!("{draft}\n\n{text}")
            };
            composer.dispatch(ComposerAction::DraftChanged { draft }, cx);
        });
        self.focus_composer = true;
        cx.notify();
    }

    fn rate(&mut self, turn: TurnId, cx: &mut Context<Self>) {
        if !self.rated.remove(&turn) {
            self.rated.insert(turn);
            self.announcement = "Marked as helpful.";
        }
        cx.notify();
    }

    fn handlers(&self, turn: TurnId, cx: &Context<Self>) -> TurnHandlers {
        let copy_view = cx.weak_entity();
        let retry_view = cx.weak_entity();
        let share_view = cx.weak_entity();
        let edit_view = cx.weak_entity();
        let rate_view = cx.weak_entity();
        TurnHandlers {
            share: Rc::new(move |text, _, cx| {
                share_view.update(cx, |this, cx| this.share(text, cx)).ok();
            }),
            edit: Rc::new(move |text, _, cx| {
                edit_view.update(cx, |this, cx| this.edit(text, cx)).ok();
            }),
            rate: Rc::new(move |_, cx| {
                rate_view.update(cx, |this, cx| this.rate(turn, cx)).ok();
            }),
            copy: Rc::new(move |target, text, _, cx| {
                copy_view
                    .update(cx, |this, cx| this.copy(turn, target, text, cx))
                    .ok();
            }),
            retry: Rc::new(move |_, cx| {
                retry_view.update(cx, |this, cx| this.retry(turn, cx)).ok();
            }),
            reveal: self.reveal.clone(),
        }
    }

    /// One turn in the list, in the reading column. The list is mid-layout
    /// while this runs, so it reads nothing from the list itself.
    fn render_row(&mut self, index: usize, cx: &mut Context<Self>) -> AnyElement {
        let Some(entry) = self.entries.get(index) else {
            return div().h(self.runway).into_any_element();
        };
        let tokens = composerkit_theme::tokens();
        let colors = composerkit_theme::colors(cx);
        let (blocks, status) = self.shown(entry);
        let copied = self
            .copied
            .filter(|copied| copied.turn == entry.id)
            .map(|copied| copied.target);
        let transcript = self.layout == ConversationLayout::Transcript;
        let turn = TurnView {
            id: ("turn", entry.id.0).into(),
            role: entry.turn.role,
            blocks,
            attachments: entry.turn.attachments.clone(),
            status,
            copied,
            rated: self.rated.contains(&entry.id),
            layout: self.layout,
            width: self.viewport.width,
            handlers: self.handlers(entry.id, cx),
        };
        div()
            .id(("turn-row", entry.id.0))
            .track_focus(&entry.focus)
            .w_full()
            .px(px(tokens.space.conversation_gutter))
            .when(index > 0, |row| {
                row.pt(px(self.layout.gap_before(entry.turn.role)))
            })
            .child(
                div()
                    .mx_auto()
                    .w_full()
                    .max_w(px(tokens.size.message_column))
                    .when(transcript, |column| {
                        column
                            .border_b(px(tokens.border.hairline))
                            .border_color(colors.border)
                            .when(index == 0, |column| {
                                column
                                    .border_t(px(tokens.border.hairline))
                                    .border_color(colors.border)
                            })
                    })
                    .child(turn),
            )
            .into_any_element()
    }

    /// The turns, as a log that scrolls and takes focus.
    fn messages(&mut self, window: &Window, cx: &mut Context<Self>) -> Stateful<Div> {
        let list = list(
            self.list.clone(),
            cx.processor(|this, index: usize, _, cx| this.render_row(index, cx)),
        )
        .size_full()
        .pt(px(composerkit_theme::tokens()
            .space
            .conversation_list_padding))
        .pb(px(composerkit_theme::tokens()
            .space
            .conversation_list_padding));

        div()
            .id("messages")
            .track_focus(&self.focus)
            .role(Role::Log)
            .aria_label("Conversation")
            .relative()
            .size_full()
            .min_h_0()
            .on_key_down(cx.listener(|this, event: &KeyDownEvent, window, cx| {
                this.on_key_down(event, window, cx);
            }))
            .child(list)
            .vertical_scrollbar(&self.list)
            // A click on Send leaves focus here too, without a ring.
            .when(
                self.focus.is_focused(window) && window.last_input_was_keyboard(),
                |messages| messages.child(focus_ring(cx)),
            )
    }

    fn jump_button(cx: &mut Context<Self>) -> impl IntoElement {
        let tokens = composerkit_theme::tokens();
        let colors = composerkit_theme::colors(cx);
        let label = "Scroll to the newest message";
        div()
            .absolute()
            .left_0()
            .right_0()
            .bottom(px(tokens.space.jump_offset))
            .flex()
            .justify_center()
            .child(
                Button::new("jump-to-latest")
                    .keyboard_ring(cx)
                    .ghost()
                    .icon(Icon::new(IconName::ArrowDown))
                    .with_size(px(tokens.size.jump_button))
                    .size(px(tokens.size.jump_button))
                    .rounded_full()
                    .border(px(tokens.border.panel))
                    .border_color(colors.input)
                    .bg(colors.background)
                    .text_color(colors.muted_foreground)
                    .accessibility_label(label)
                    .tooltip(label)
                    .on_click(cx.listener(|this, event: &ClickEvent, window, cx| {
                        this.jump_to_end(cx);
                        // The button goes away, so the keyboard lands on the
                        // list rather than nowhere.
                        if event.is_keyboard() {
                            this.focus.focus(window, cx);
                        }
                    })),
            )
    }
}

impl Render for ConversationView {
    fn render(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        self.reveal.forget_blurred(window);
        self.reduce_motion = cx.reduce_motion();
        self.advance_jump(window);
        let rendered_height = self.viewport.height;
        self.viewport = self.list.viewport_bounds().size;
        self.update_runway();
        if self.jump.is_none() {
            self.update_pinned();
        }

        let view = cx.weak_entity();
        let expanded = self.composer.read(cx).state().expanded;
        let composer = Composer::for_controller("conversation-composer", &self.composer, cx)
            .conversation()
            .expandable()
            .focus_field(std::mem::take(&mut self.focus_composer))
            .focus_after_send(self.focus.clone())
            .layout(ComposerLayout::Inline)
            .mode(ComposerMode::Chat)
            .when(self.stream.is_some(), |composer| {
                let view = cx.weak_entity();
                composer.on_stop_reply(move |_, cx| {
                    view.update(cx, Self::stop).ok();
                })
            });

        let space = &composerkit_theme::tokens().space;
        div()
            .relative()
            .flex()
            .flex_col()
            .size_full()
            .min_h_0()
            .child(crate::accessibility::live_region(
                "conversation-announcement",
                self.announcement.to_owned(),
            ))
            .child(
                div()
                    .relative()
                    .flex()
                    .flex_col()
                    .flex_1()
                    .min_h(px(MESSAGES_MIN_HEIGHT))
                    .on_children_prepainted(move |bounds, _, cx| {
                        // The composer grew, or the window shrank. Following the end
                        // already holds it; a list just short of the end catches up.
                        let shrank = bounds
                            .first()
                            .is_some_and(|list| list.size.height < rendered_height);
                        if shrank {
                            let view = view.clone();
                            cx.defer(move |cx| {
                                view.update(cx, |this, cx| {
                                    this.keep_end_in_view();
                                    cx.notify();
                                })
                                .ok();
                            });
                        }
                    })
                    // Expanded, the composer covers the conversation, so
                    // the turns leave the tab order and the accessibility
                    // tree until it shrinks again.
                    .when(!expanded, |area| {
                        area.child(self.messages(window, cx))
                            .when(!self.pinned, |area| area.child(Self::jump_button(cx)))
                    }),
            )
            .child(
                div()
                    .flex()
                    .flex_none()
                    .justify_center()
                    .px(px(space.conversation_gutter))
                    .pb(px(space.composer_bottom))
                    // Expanded, the composer covers the conversation and
                    // fills it from a little below the top.
                    .when(expanded, |dock| {
                        dock.absolute()
                            .inset_0()
                            .pt(px(space.composer_expanded_top))
                            .bg(composerkit_theme::colors(cx).background)
                    })
                    .child(composer),
            )
    }
}
