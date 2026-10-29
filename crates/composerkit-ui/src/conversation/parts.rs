// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

use crate::focus_ring::KeyboardRing as _;
use std::rc::Rc;

use gpui_kit::assets::IconName;
use gpui_kit::component::attachment::{
    Attachment as Card, AttachmentContent, AttachmentDescription, AttachmentMedia,
    AttachmentStatus, AttachmentTitle,
};
use gpui_kit::component::button::{Button, ButtonVariants as _};
use gpui_kit::component::menu::{DropdownMenu as _, PopupMenuItem};
use gpui_kit::component::{ActiveTheme as _, Disableable as _, Icon, Sizable as _};
use gpui_kit::{
    AnyElement, App, Div, ElementId, FocusHandle, Font, Hsla, InteractiveElement as _, IntoElement,
    KeyDownEvent, ParentElement as _, RenderOnce, ScrollHandle, SharedString,
    StatefulInteractiveElement as _, Styled as _, StyledText, TextRun, Window, accesskit::Role,
    div, point, prelude::FluentBuilder as _, px,
};

use super::reveal::FocusReveal;
use super::turn::{
    Block, ListStyle, Role as Speaker, TurnAttachment, bare_text, plain_text, segments,
};

/// A solid block after the newest text while a reply streams.
const CARET: char = '\u{258D}';
/// How far one arrow key moves a code block sideways.
const CODE_SCROLL_STEP: f32 = 40.;
/// The width of a list's markers, the web list's `pl-5`.
const LIST_INDENT: f32 = 20.;

/// Where a reply is in its life.
#[derive(Clone, Copy, Debug, PartialEq)]
pub(super) enum TurnStatus {
    Done,
    /// Arriving. The caret after the text shows at this opacity.
    Streaming {
        caret: f32,
    },
    /// Stopped before the end, by Stop or a newer reply.
    Stopped,
}

/// How much room text gets between blocks.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) enum Density {
    Regular,
    /// The transcript layout.
    Compact,
}

/// What a Copy button copies.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub(super) enum CopyTarget {
    Turn,
    /// The code block at this index in the turn's blocks.
    Code(usize),
}

/// How large the Copy and Retry buttons under a turn are.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) enum ActionSize {
    /// The web app's `action` kind: 27 by 26 on a 30px row.
    Small,
    /// The 20px row action, drawn at 24px so it meets WCAG 2.5.8.
    Row,
}

type Callback = Rc<dyn Fn(&mut Window, &mut App)>;
type CopyCallback = Rc<dyn Fn(CopyTarget, String, &mut Window, &mut App)>;
type TextCallback = Rc<dyn Fn(String, &mut Window, &mut App)>;

/// What one turn's controls do, bound to that turn by the view.
#[derive(Clone)]
pub(super) struct TurnHandlers {
    pub(super) copy: CopyCallback,
    pub(super) retry: Callback,
    /// Hands the text on to share. With no share sheet, it is copied.
    pub(super) share: TextCallback,
    /// Puts your message back in the composer to change and send again.
    pub(super) edit: TextCallback,
    /// Marks the reply as helpful, or takes the mark back.
    pub(super) rate: Callback,
    pub(super) reveal: FocusReveal,
}

/// A focus handle kept with the element `id`, so a control's focus survives
/// frames without the view owning one per control.
fn keyed_focus(id: ElementId, window: &mut Window, cx: &mut App) -> FocusHandle {
    window
        .use_keyed_state(id, cx, |_, cx| cx.focus_handle())
        .read(cx)
        .clone()
}

/// A ring just inside a focused region, which draws no ring of its own.
pub(super) fn focus_ring(cx: &App) -> Div {
    div()
        .absolute()
        .inset_0()
        .border_2()
        .border_color(composerkit_theme::colors(cx).ring)
}

/// Text with its inline code set in the mono font on a tint, and the caret
/// after it while it streams.
fn inline_text(text: &str, caret: Option<f32>, window: &Window, cx: &App) -> StyledText {
    let colors = composerkit_theme::colors(cx);
    let color = colors.foreground;
    let font = window.text_style().font();
    let mono = Font {
        family: cx.theme().mono_font_family.clone(),
        ..font.clone()
    };
    let run = |len: usize, font: &Font, background: Option<Hsla>, color: Hsla| TextRun {
        len,
        font: font.clone(),
        color,
        background_color: background,
        underline: None,
        strikethrough: None,
    };

    let mut shown = String::with_capacity(text.len() + CARET.len_utf8());
    let mut runs = Vec::new();
    for segment in segments(text).filter(|segment| !segment.text.is_empty()) {
        shown.push_str(segment.text);
        runs.push(if segment.code {
            run(segment.text.len(), &mono, Some(colors.accent), color)
        } else {
            run(segment.text.len(), &font, None, color)
        });
    }
    if let Some(opacity) = caret {
        shown.push(CARET);
        runs.push(run(CARET.len_utf8(), &font, None, color.opacity(opacity)));
    }
    StyledText::new(shown).with_runs(runs)
}

/// Code as written, in the mono font, with the caret after it while it
/// streams. Backticks stay literal, so the code looks the same once the
/// stream ends.
fn streaming_code(code: &str, caret_opacity: f32, window: &Window, cx: &App) -> StyledText {
    let color = composerkit_theme::colors(cx).foreground;
    let mono = Font {
        family: cx.theme().mono_font_family.clone(),
        ..window.text_style().font()
    };
    let run = |len: usize, color: Hsla| TextRun {
        len,
        font: mono.clone(),
        color,
        background_color: None,
        underline: None,
        strikethrough: None,
    };
    let runs = vec![
        run(code.len(), color),
        run(CARET.len_utf8(), color.opacity(caret_opacity)),
    ];
    StyledText::new(format!("{code}{CARET}")).with_runs(runs)
}

/// A code block: its language and a Copy code button over the code, whose
/// long lines scroll sideways. The code takes focus, so the arrow keys
/// scroll it too.
#[derive(IntoElement)]
pub(super) struct CodeBlock {
    pub(super) id: ElementId,
    pub(super) language: SharedString,
    pub(super) code: SharedString,
    pub(super) density: Density,
    pub(super) copied: bool,
    pub(super) caret: Option<f32>,
    pub(super) on_copy: Callback,
    pub(super) reveal: FocusReveal,
}

impl CodeBlock {
    /// The language and the Copy code button, which reads "Copied" for a
    /// moment after a copy.
    fn header(&self, window: &mut Window, cx: &mut App) -> Div {
        let tokens = composerkit_theme::tokens();
        let colors = *composerkit_theme::colors(cx);
        let caption = &tokens.text.caption;
        let copy_focus = keyed_focus((self.id.clone(), "copy-focus").into(), window, cx);
        let (icon, label) = if self.copied {
            (IconName::Check, "Copied")
        } else {
            (IconName::Copy, "Copy code")
        };
        let on_copy = Rc::clone(&self.on_copy);
        let copy = Button::new((self.id.clone(), "copy"))
            .keyboard_ring(cx)
            .ghost()
            .small()
            .h(px(tokens.size.button_small))
            .rounded_full()
            .icon(Icon::new(icon))
            .label(label)
            .text_color(colors.muted_foreground)
            .track_focus(&copy_focus)
            .on_click(move |_, window, cx| on_copy(window, cx));

        div()
            .flex()
            .items_center()
            .gap_2()
            .pl_3()
            .map(|header| {
                if self.density == Density::Compact {
                    header.py_0p5().pr_1()
                } else {
                    header.py_1().pr_1p5()
                }
            })
            .border_b(px(tokens.border.hairline))
            .border_color(colors.border)
            .child(
                div()
                    .min_w_0()
                    .flex_1()
                    .text_color(colors.muted_foreground)
                    .text_size(px(caption.size))
                    .line_height(px(caption.line_height))
                    .child(self.language.clone()),
            )
            .child(self.reveal.wrap(&copy_focus, copy))
    }
}

impl RenderOnce for CodeBlock {
    fn render(self, window: &mut Window, cx: &mut App) -> impl IntoElement {
        let tokens = composerkit_theme::tokens();
        let colors = *composerkit_theme::colors(cx);
        let caption = &tokens.text.caption;
        let compact = self.density == Density::Compact;
        let scroll = window
            .use_keyed_state((self.id.clone(), "scroll"), cx, |_, _| ScrollHandle::new())
            .read(cx)
            .clone();
        let code_focus = window
            .use_keyed_state((self.id.clone(), "code-focus"), cx, |_, cx| {
                cx.focus_handle().tab_stop(true)
            })
            .read(cx)
            .clone();
        let header = self.header(window, cx);

        let text: AnyElement = match self.caret {
            Some(opacity) => streaming_code(&self.code, opacity, window, cx).into_any_element(),
            None => self.code.clone().into_any_element(),
        };
        let step = px(CODE_SCROLL_STEP);
        let scrolled = scroll.clone();
        let code = div()
            .id((self.id.clone(), "code"))
            .track_focus(&code_focus)
            .role(Role::Code)
            .aria_label(format!("{} code", self.language))
            .track_scroll(&scroll)
            .overflow_x_scroll()
            .flex()
            .font_family(cx.theme().mono_font_family.clone())
            .text_color(colors.foreground)
            .text_size(px(caption.size))
            .line_height(px(caption.line_height))
            .map(|code| {
                if compact {
                    code.px_3().py_2()
                } else {
                    code.p_3()
                }
            })
            .on_key_down(move |event: &KeyDownEvent, _, cx| {
                let distance = match event.keystroke.key.as_str() {
                    "left" => -step,
                    "right" => step,
                    _ => return,
                };
                let offset = scrolled.offset();
                let max = scrolled.max_offset().x;
                let x = (offset.x - distance).clamp(-max, px(0.));
                scrolled.set_offset(point(x, offset.y));
                cx.stop_propagation();
                cx.refresh_windows();
            })
            .child(div().flex_none().whitespace_nowrap().child(text));

        let focused = code_focus.is_focused(window);
        let radius = tokens.radius.control;
        div()
            .flex()
            .flex_col()
            .min_w_0()
            .overflow_hidden()
            .rounded(px(radius))
            .border(px(tokens.border.hairline))
            .border_color(colors.border)
            .bg(colors.muted)
            .child(header)
            .child(
                self.reveal.wrap(
                    &code_focus,
                    div()
                        .relative()
                        .child(code)
                        .when(focused, |region| region.child(focus_ring(cx))),
                ),
            )
    }
}

/// A turn's blocks: paragraphs, lists and code, with the caret after the
/// newest text while it streams.
#[derive(IntoElement)]
pub(super) struct RichText {
    pub(super) id: ElementId,
    pub(super) blocks: Vec<Block>,
    pub(super) density: Density,
    /// The code block whose Copy code button says "Copied".
    pub(super) copied: Option<usize>,
    pub(super) caret: Option<f32>,
    pub(super) handlers: TurnHandlers,
}

impl RenderOnce for RichText {
    fn render(self, window: &mut Window, cx: &mut App) -> impl IntoElement {
        let last = self.blocks.len().checked_sub(1);
        let caret_at = |index: usize| self.caret.filter(|_| Some(index) == last);
        let mut children: Vec<AnyElement> = Vec::with_capacity(self.blocks.len() + 1);
        for (index, block) in self.blocks.iter().enumerate() {
            let caret = caret_at(index);
            let child = match block {
                Block::Paragraph(text) => div()
                    .child(inline_text(text, caret, window, cx))
                    .into_any_element(),
                Block::List { style, items } => list(*style, items, caret, window, cx),
                Block::Code { language, code } => {
                    let copy = Rc::clone(&self.handlers.copy);
                    let code_text = code.clone();
                    CodeBlock {
                        id: (self.id.clone(), format!("code-{index}")).into(),
                        language: language.clone().into(),
                        code: code.clone().into(),
                        density: self.density,
                        copied: self.copied == Some(index),
                        caret,
                        on_copy: Rc::new(move |window, cx| {
                            copy(CopyTarget::Code(index), code_text.clone(), window, cx);
                        }),
                        reveal: self.handlers.reveal.clone(),
                    }
                    .into_any_element()
                }
            };
            children.push(child);
        }
        // A reply that has shown nothing yet still shows the caret.
        if let (Some(caret), None) = (self.caret, last) {
            children.push(
                div()
                    .size(px(8.))
                    .my_1p5()
                    .rounded_full()
                    .bg(composerkit_theme::colors(cx).foreground.opacity(caret))
                    .into_any_element(),
            );
        }

        div()
            .flex()
            .flex_col()
            .min_w_0()
            .gap(px(match self.density {
                Density::Regular => composerkit_theme::tokens().space.paragraph_gap,
                Density::Compact => 8.,
            }))
            .children(children)
    }
}

fn list(
    style: ListStyle,
    items: &[String],
    caret: Option<f32>,
    window: &Window,
    cx: &App,
) -> AnyElement {
    let last = items.len().saturating_sub(1);
    div()
        .flex()
        .flex_col()
        .gap_1()
        .children(items.iter().enumerate().map(|(index, item)| {
            let marker = match style {
                ListStyle::Numbered => format!("{}.", index + 1),
                ListStyle::Bulleted => "•".to_owned(),
            };
            div()
                .flex()
                .child(
                    div()
                        .flex_none()
                        .w(px(LIST_INDENT))
                        .text_color(composerkit_theme::colors(cx).muted_foreground)
                        .child(marker),
                )
                .child(div().flex_1().min_w_0().child(inline_text(
                    item,
                    caret.filter(|_| index == last),
                    window,
                    cx,
                )))
        }))
        .into_any_element()
}

/// The files a message carried, as the composer's attachment cards. A card
/// cuts off a long name, so its tooltip carries the name in full.
pub(super) fn attachments(attachments: &[TurnAttachment]) -> Option<Div> {
    (!attachments.is_empty()).then(|| {
        div()
            .flex()
            .flex_wrap()
            .gap_2()
            .children(attachments.iter().enumerate().map(|(index, attachment)| {
                Card::new()
                    .id(("turn-attachment", index))
                    .status(AttachmentStatus::Complete)
                    .tooltip(format!("{}\n{}", attachment.name, attachment.size))
                    .media(AttachmentMedia::new().child(Icon::new(IconName::File)))
                    .content(
                        AttachmentContent::new()
                            .title(AttachmentTitle::new(attachment.name.clone()))
                            .description(AttachmentDescription::new(attachment.size.clone())),
                    )
                    .small()
            }))
    })
}

/// Shown under a reply while it streams, or once it was stopped. Words, not
/// a colored dot, say which.
#[derive(IntoElement)]
pub(super) struct StreamStatus {
    pub(super) status: TurnStatus,
}

impl RenderOnce for StreamStatus {
    fn render(self, _window: &mut Window, cx: &mut App) -> impl IntoElement {
        let tokens = composerkit_theme::tokens();
        let colors = *composerkit_theme::colors(cx);
        let caption = &tokens.text.caption;
        let line = |text: &'static str, color| {
            div()
                .text_color(color)
                .text_size(px(caption.size))
                .line_height(px(caption.line_height))
                .child(text)
        };
        match self.status {
            // A finished reply shows nothing; layouts leave this part out.
            TurnStatus::Done | TurnStatus::Streaming { .. } => div(),
            TurnStatus::Stopped => line(
                "Stopped partway. The text so far is kept.",
                colors.subtle_foreground,
            ),
        }
    }
}

/// Under your message: Copy, Share and Edit. Under a reply: Copy,
/// Helpful, Read aloud, Share, a Write again menu and a More menu with Copy
/// as. Layouts leave them out while a reply streams, since there is nothing
/// whole to act on yet.
#[derive(IntoElement)]
pub(super) struct TurnActions {
    pub(super) id: ElementId,
    pub(super) role: Speaker,
    pub(super) blocks: Vec<Block>,
    pub(super) copied: bool,
    /// The reply is marked helpful.
    pub(super) rated: bool,
    pub(super) size: ActionSize,
    /// The row keeps its room but shows only while the pointer is on the
    /// turn named by this group, or while one of its buttons has focus.
    pub(super) hover_group: Option<SharedString>,
    pub(super) handlers: TurnHandlers,
}

impl TurnActions {
    fn button(
        &self,
        key: &'static str,
        icon: IconName,
        label: SharedString,
        focus: &FocusHandle,
        cx: &App,
    ) -> Button {
        let tokens = composerkit_theme::tokens();
        let (width, height, icon_size, radius) = match self.size {
            ActionSize::Small => (
                tokens.size.action_button_width,
                tokens.size.action_button_height,
                tokens.size.icon,
                tokens.radius.action,
            ),
            ActionSize::Row => {
                let size = tokens.size.row_action + 2. * crate::row_actions::HIT_SLOP;
                (size, size, tokens.size.icon_small, tokens.radius.small)
            }
        };
        // Button draws an `icon` at three quarters of its size, so the icon
        // goes in as a child to keep the web app's 16px and 14px.
        Button::new((self.id.clone(), key))
            .keyboard_ring(cx)
            .ghost()
            .with_size(px(height))
            .w(px(width))
            .h(px(height))
            .rounded(px(radius))
            .child(Icon::new(icon).with_size(px(icon_size)))
            .text_color(composerkit_theme::colors(cx).subtle_foreground)
            .accessibility_label(label.clone())
            .tooltip(label)
            .track_focus(focus)
    }
}

impl RenderOnce for TurnActions {
    fn render(self, window: &mut Window, cx: &mut App) -> impl IntoElement {
        let focus = |key: &'static str, window: &mut Window, cx: &mut App| {
            keyed_focus((self.id.clone(), key).into(), window, cx)
        };
        let copy_focus = focus("copy-focus", window, cx);
        let share_focus = focus("share-focus", window, cx);
        let edit_focus = focus("edit-focus", window, cx);
        let rate_focus = focus("rate-focus", window, cx);
        let read_focus = focus("read-focus", window, cx);
        let again_focus = focus("again-focus", window, cx);
        let more_focus = focus("more-focus", window, cx);
        let focused = [
            &copy_focus,
            &share_focus,
            &edit_focus,
            &rate_focus,
            &read_focus,
            &again_focus,
            &more_focus,
        ]
        .into_iter()
        .any(|focus| focus.is_focused(window));

        let text = plain_text(&self.blocks);
        let bare = bare_text(&self.blocks);
        let (icon, label) = if self.copied {
            (IconName::Check, "Copied")
        } else {
            (IconName::Copy, "Copy")
        };
        let handlers = self.handlers.clone();
        let copied_text = text.clone();
        let copy = self
            .button("copy", icon, label.into(), &copy_focus, cx)
            .on_click(move |_, window, cx| {
                (handlers.copy)(CopyTarget::Turn, copied_text.clone(), window, cx);
            });
        let handlers = self.handlers.clone();
        let shared_text = bare.clone();
        let share = self
            .button("share", IconName::Share, "Share".into(), &share_focus, cx)
            .on_click(move |_, window, cx| (handlers.share)(shared_text.clone(), window, cx));

        let reveal = self.handlers.reveal.clone();
        let mut buttons: Vec<AnyElement> = vec![reveal.wrap(&copy_focus, copy).into_any_element()];
        match self.role {
            Speaker::User => {
                let handlers = self.handlers.clone();
                let edit = self
                    .button("edit", IconName::Pencil, "Edit".into(), &edit_focus, cx)
                    .on_click(move |_, window, cx| (handlers.edit)(bare.clone(), window, cx));
                buttons.push(reveal.wrap(&share_focus, share).into_any_element());
                buttons.push(reveal.wrap(&edit_focus, edit).into_any_element());
            }
            Speaker::Assistant => {
                let handlers = self.handlers.clone();
                let rate = self
                    .button(
                        "rate",
                        IconName::ThumbsUp,
                        "Helpful".into(),
                        &rate_focus,
                        cx,
                    )
                    .toggled(self.rated)
                    .on_click(move |_, window, cx| (handlers.rate)(window, cx));
                // Speech is out of scope natively, so the button says so.
                let read = self
                    .button(
                        "read",
                        IconName::Volume2,
                        "Reading aloud isn’t available here".into(),
                        &read_focus,
                        cx,
                    )
                    .disabled(true);
                let again = self.write_again(&again_focus, cx);
                let more = self.more(&more_focus, text, bare, cx);
                buttons.push(reveal.wrap(&rate_focus, rate).into_any_element());
                buttons.push(reveal.wrap(&read_focus, read).into_any_element());
                buttons.push(reveal.wrap(&share_focus, share).into_any_element());
                buttons.push(reveal.wrap(&again_focus, again).into_any_element());
                buttons.push(reveal.wrap(&more_focus, more).into_any_element());
            }
        }

        let tokens = composerkit_theme::tokens();
        div()
            .flex()
            .items_center()
            .map(|row| match self.size {
                ActionSize::Small => row
                    .h(px(tokens.size.turn_action_row))
                    .gap(px(tokens.space.turn_action_gap)),
                // The transcript's gutter is narrower than the whole row,
                // so the buttons wrap onto a second line inside it.
                ActionSize::Row => row.flex_wrap().gap_1(),
            })
            .when_some(self.hover_group.filter(|_| !focused), |row, group| {
                row.opacity(0.)
                    .group_hover(group, |style| style.opacity(1.))
            })
            .children(buttons)
    }
}

impl TurnActions {
    /// Writes the reply again, the same length, shorter or longer. The demo
    /// has no model, so all three stream the same reply again.
    fn write_again(&self, focus: &FocusHandle, cx: &App) -> impl IntoElement {
        let retry = Rc::clone(&self.handlers.retry);
        self.button("again", IconName::RotateCw, "Write again".into(), focus, cx)
            .dropdown_menu(move |menu, _, _| {
                ["Same length", "Shorter", "Longer"]
                    .into_iter()
                    .fold(menu, |menu, label| {
                        let retry = Rc::clone(&retry);
                        menu.item(
                            PopupMenuItem::new(label)
                                .on_click(move |_, window, cx| retry(window, cx)),
                        )
                    })
            })
    }

    /// More: Copy as plain text or Markdown.
    fn more(
        &self,
        focus: &FocusHandle,
        markdown: String,
        bare: String,
        cx: &App,
    ) -> impl IntoElement {
        let copy = Rc::clone(&self.handlers.copy);
        let width = px(composerkit_theme::tokens().size.more_menu_width);
        self.button("more", IconName::Ellipsis, "More".into(), focus, cx)
            .dropdown_menu(move |menu, window, cx| {
                let copy = Rc::clone(&copy);
                let (markdown, bare) = (markdown.clone(), bare.clone());
                menu.min_w(width)
                    .submenu("Copy as", window, cx, move |menu, _, _| {
                        let (plain_copy, markdown_copy) = (Rc::clone(&copy), Rc::clone(&copy));
                        let (markdown, bare) = (markdown.clone(), bare.clone());
                        menu.item(PopupMenuItem::new("Plain text").on_click(
                            move |_, window, cx| {
                                plain_copy(CopyTarget::Turn, bare.clone(), window, cx);
                            },
                        ))
                        .item(
                            PopupMenuItem::new("Markdown").on_click(move |_, window, cx| {
                                markdown_copy(CopyTarget::Turn, markdown.clone(), window, cx);
                            }),
                        )
                    })
            })
    }
}
