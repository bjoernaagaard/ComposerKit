// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

use gpui_kit::component::Sizable as _;
use gpui_kit::component::input::{InputEvent, Textarea, TextareaState};
use gpui_kit::{
    AnyElement, App, AppContext as _, ClipboardEntry, ClipboardItem, Context, Div, ElementId,
    Entity, FocusHandle, Focusable as _, Font, IntoElement, ParentElement as _, Pixels,
    SharedString, Styled as _, Subscription, TextRun, Window, canvas, px,
};

use super::controller::PickedFile;
use super::machine::ComposerAction;
use super::view::{ComposerLayout, ComposerRequest, Handlers};

/// What the text box keeps between frames.
struct FieldState {
    input: Entity<TextareaState>,
    /// The latest callbacks, so the subscription below always reaches the
    /// owner's current handlers.
    handlers: Handlers,
    /// The rows the box starts at and grows to, as last set.
    rows: (usize, usize),
    placeholder: SharedString,
    /// The font the text box draws in, as of the last frame.
    font: Option<Font>,
    /// How wide the box and its controls are, as of the last frame. They
    /// are measured in both arrangements, so the room for one row stays
    /// right while the text sits on its own row.
    widths: Widths,
    /// How tall the expanded box is, as of the last frame that drew it.
    expanded_height: Option<Pixels>,
    _events: Subscription,
}

impl FieldState {
    fn new(
        rows: (usize, usize),
        placeholder: SharedString,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) -> Self {
        let input = cx.new(|cx| {
            let mut input = TextareaState::new(window, cx)
                .auto_grow(rows.0, rows.1)
                .placeholder(placeholder.clone());
            input.set_submit_on_enter(true, cx);
            input
        });
        let events = cx.subscribe_in(&input, window, Self::on_input_event);
        Self {
            input,
            handlers: Handlers::default(),
            rows,
            placeholder,
            font: None,
            widths: Widths::default(),
            expanded_height: None,
            _events: events,
        }
    }

    fn on_input_event(
        &mut self,
        input: &Entity<TextareaState>,
        event: &InputEvent,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) {
        match event {
            InputEvent::Change => {
                let draft = input.read(cx).value().to_string();
                self.handlers
                    .act(&ComposerAction::DraftChanged { draft }, window, cx);
                // The lines the text wraps to are known once it is laid out,
                // so the composer looks again on the next frame.
                window.on_next_frame(|window, _| window.refresh());
            }
            InputEvent::PressEnter { shift: false, .. } => {
                self.handlers.request(&ComposerRequest::Submit, window, cx);
            }
            InputEvent::PressEnter { shift: true, .. } | InputEvent::Focus | InputEvent::Blur => {}
        }
    }
}

/// A part of the composer whose width decides the room for one row.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) enum Part {
    /// The whole box.
    Surface,
    /// The controls before the text on one row.
    Leading,
    /// The controls after the text on one row.
    Trailing,
}

/// The parts' widths, as last drawn.
#[derive(Clone, Copy, Debug, Default)]
struct Widths {
    surface: Option<Pixels>,
    leading: Option<Pixels>,
    trailing: Option<Pixels>,
}

impl Widths {
    fn slot(&mut self, part: Part) -> &mut Option<Pixels> {
        match part {
            Part::Surface => &mut self.surface,
            Part::Leading => &mut self.leading,
            Part::Trailing => &mut self.trailing,
        }
    }

    /// How wide the text may run on one row: the box less its controls and
    /// `chrome`, the padding and gaps around them.
    fn room(self, chrome: Pixels) -> Option<Pixels> {
        Some(self.surface? - self.leading? - self.trailing? - chrome)
    }
}

/// How the text sits in the box, as of the last frame.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) struct FieldMeasure {
    /// Lines of text, counting wrapped lines.
    pub(super) lines: usize,
    /// The text no longer fits on one row beside the controls.
    pub(super) overflows: bool,
}

/// The text box, ready to place, with what the composer needs to know
/// about it.
pub(super) struct BuiltField {
    pub(super) textarea: Textarea,
    pub(super) focus: FocusHandle,
    pub(super) measure: FieldMeasure,
    /// The text and its caret.
    pub(super) input: Entity<TextareaState>,
    state: Entity<FieldState>,
}

impl BuiltField {
    /// Reports `part`'s width to the next frame. Place it as a child of
    /// that part, which must be positioned, so it covers the part exactly.
    pub(super) fn probe(&self, part: Part) -> impl IntoElement + use<> {
        let state = self.state.clone();
        canvas(
            move |bounds, _, cx| {
                let width = bounds.size.width;
                state.update(cx, |state, cx| {
                    if state.widths.slot(part).replace(width) != Some(width) {
                        cx.notify();
                    }
                });
            },
            |_, (), _, _| {},
        )
        .absolute()
        .size_full()
    }

    /// The text box in a wrapper that reports the font the text draws in,
    /// which the next frame measures the text with, and its height when
    /// expanded, which sets how many rows it shows.
    pub(super) fn into_element(self, wrapper: Div, expanded: bool) -> AnyElement {
        let state = self.state;
        wrapper
            .relative()
            .child(self.textarea)
            .child(
                canvas(
                    move |bounds, window, cx| {
                        let font = window.text_style().font();
                        state.update(cx, |state, cx| {
                            let mut changed = state.font.as_ref() != Some(&font);
                            state.font = Some(font);
                            if expanded {
                                changed |= state.expanded_height.replace(bounds.size.height)
                                    != Some(bounds.size.height);
                            }
                            if changed {
                                cx.notify();
                            }
                        });
                    },
                    |_, (), _, _| {},
                )
                .absolute()
                .size_full(),
            )
            .into_any_element()
    }
}

/// The message box. It mirrors the draft it is given, so text the owner
/// changes, such as dictation or a sent message clearing, shows up here.
pub(super) struct MessageField {
    pub(super) id: ElementId,
    pub(super) draft: String,
    pub(super) layout: ComposerLayout,
    pub(super) placeholder: SharedString,
    /// While sending, the draft is frozen, so the box is read-only.
    pub(super) sending: bool,
    /// The layout could put the text on one row beside the controls.
    pub(super) one_row_possible: bool,
    /// The padding and gaps around the controls on one row, which take
    /// room from the text along with the controls themselves.
    pub(super) one_row_chrome: Pixels,
    pub(super) expanded: bool,
    pub(super) handlers: Handlers,
}

impl MessageField {
    /// The text box, its focus handle, and how its text sits.
    pub(super) fn build(self, window: &mut Window, cx: &mut App) -> BuiltField {
        let tokens = composerkit_theme::tokens();
        let text = &tokens.text.composer;
        let max_rows = two_row_max_rows();
        let state = window.use_keyed_state(self.id, cx, |window, cx| {
            FieldState::new(
                self.layout.rows(max_rows),
                self.placeholder.clone(),
                window,
                cx,
            )
        });

        let (input, expanded_height, room, font) = state.update(cx, |state, _| {
            state.handlers = self.handlers;
            (
                state.input.clone(),
                state.expanded_height,
                state.widths.room(self.one_row_chrome),
                state.font.clone(),
            )
        });
        let rows = match expanded_height {
            Some(height) if self.expanded => {
                let fit = rows_in(height, text.line_height).max(1);
                (fit, fit)
            }
            _ => self.layout.rows(max_rows),
        };
        let (rows_changed, placeholder_changed) = state.update(cx, |state, _| {
            let changed = (state.rows != rows, state.placeholder != self.placeholder);
            state.rows = rows;
            state.placeholder.clone_from(&self.placeholder);
            changed
        });

        input.update(cx, |input, cx| {
            if rows_changed {
                input.set_auto_grow(rows.0, rows.1, cx);
            }
            if placeholder_changed {
                input.set_placeholder(self.placeholder.clone(), window, cx);
            }
            if input.value() != self.draft {
                let end = self.draft.len();
                input.set_value(self.draft.clone(), window, cx);
                input.set_selected_range(end..end, cx);
            }
        });

        // Rows after soft wrapping, as of the last layout.
        let lines = input.read(cx).display_map().wrap_row_count().max(1);
        let overflows = self.one_row_possible
            && room.is_some_and(|room| one_line_width(&self.draft, font, window) > room);

        let focus = input.read(cx).focus_handle(cx);
        let paste_state = state.clone();
        // The extra-small size has no padding of its own, so the box's
        // height is the text's, as on the web.
        let textarea = Textarea::new(&input)
            .on_paste(move |item, window, cx| {
                let handlers = paste_state.read(cx).handlers.clone();
                paste_attachments(item, &handlers, window, cx)
            })
            .xsmall()
            .appearance(false)
            .readonly(self.sending)
            .aria_label(self.placeholder)
            .text_size(px(text.size))
            .line_height(px(text.line_height));
        BuiltField {
            textarea,
            focus,
            measure: FieldMeasure { lines, overflows },
            input,
            state,
        }
    }
}

/// Copied files attach instead of pasting their names, and so does a copied
/// image with no text beside it, such as a screenshot. Returns whether it
/// took the paste. Text pastes as before.
fn paste_attachments(
    item: &ClipboardItem,
    handlers: &Handlers,
    window: &mut Window,
    cx: &mut App,
) -> bool {
    let entries = item.entries();
    let has_text = entries
        .iter()
        .any(|entry| matches!(entry, ClipboardEntry::String(_)));
    let mut paths = Vec::new();
    let mut images = Vec::new();
    for entry in entries {
        match entry {
            ClipboardEntry::ExternalPaths(external) => paths.extend_from_slice(external.paths()),
            ClipboardEntry::Image(image) if !has_text => images.push(PickedFile {
                name: format!("Pasted image.{}", image.format.extension()),
                size_bytes: u64::try_from(image.bytes.len()).unwrap_or(u64::MAX),
            }),
            ClipboardEntry::Image(_) | ClipboardEntry::String(_) => {}
        }
    }
    if paths.is_empty() && images.is_empty() {
        return false;
    }
    if !paths.is_empty() {
        handlers.request(&ComposerRequest::AttachPaths(paths.into()), window, cx);
    }
    if !images.is_empty() {
        handlers.request(&ComposerRequest::AttachFiles(images.into()), window, cx);
    }
    true
}

/// How many rows the text shows once it sits on its own row, before it
/// scrolls: what fits under the composer's height cap with the controls
/// below it.
fn two_row_max_rows() -> usize {
    let tokens = composerkit_theme::tokens();
    let space = &tokens.space;
    let room = tokens.size.composer_max_height
        - space.composer_two_row_top
        - space.composer_row_gap
        - tokens.size.composer_control
        - space.composer_footer_padding;
    rows_in(px(room), tokens.text.composer.line_height)
}

/// Whole lines of `line_height` that fit in `height`.
#[expect(
    clippy::cast_possible_truncation,
    clippy::cast_sign_loss,
    reason = "a box height over a line height is a small positive count"
)]
fn rows_in(height: Pixels, line_height: f32) -> usize {
    (f32::from(height) / line_height).floor().max(0.) as usize
}

/// How wide `draft` is on one line in `font` at the composer's text size.
/// Before the box has drawn once, the font around the composer stands in.
fn one_line_width(draft: &str, font: Option<Font>, window: &Window) -> Pixels {
    if draft.is_empty() {
        return Pixels::ZERO;
    }
    let size = px(composerkit_theme::tokens().text.composer.size);
    let style = window.text_style();
    let run = TextRun {
        len: draft.len(),
        font: font.unwrap_or_else(|| style.font()),
        color: style.color,
        background_color: None,
        underline: None,
        strikethrough: None,
    };
    window
        .text_system()
        .shape_line(SharedString::from(draft.to_owned()), size, &[run], None)
        .width
}
