// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

use gpui_kit::component::bubble::{Bubble, BubbleContent, BubbleVariant};
use gpui_kit::component::message::MessageAlignment;
use gpui_kit::{
    App, ElementId, FontWeight, InteractiveElement as _, IntoElement, ParentElement as _, Pixels,
    RenderOnce, SharedString, StatefulInteractiveElement as _, Styled as _, Window,
    accesskit::Role, div, prelude::FluentBuilder as _, px, relative, transparent_black,
};

use super::parts::{
    ActionSize, CopyTarget, Density, RichText, StreamStatus, TurnActions, TurnHandlers, TurnStatus,
    attachments,
};
use super::turn::{Block, Role as Speaker, TurnAttachment};

/// How the conversation draws each turn. The layouts differ in how much of a
/// turn sits inside a container: bubbles enclose both speakers, document
/// encloses only your message, and transcript encloses nothing and names the
/// speaker on every row.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Hash)]
pub enum ConversationLayout {
    /// Your message is a bubble on the right, a reply is
    /// open prose across the reading column.
    #[default]
    Document,
    /// Both speakers in a bubble on their own side. Your message is filled,
    /// a reply is outlined, and the corner nearest the speaker is squared,
    /// so side, fill and shape all tell them apart.
    Bubbles,
    /// A log: one row per turn, the speaker's name in a gutter with the
    /// actions under it, rows split by a hairline.
    Transcript,
}

impl ConversationLayout {
    /// Every layout, in the order a picker shows them.
    pub const ALL: [Self; 3] = [Self::Document, Self::Bubbles, Self::Transcript];

    /// The name a picker shows.
    #[must_use]
    pub const fn label(self) -> &'static str {
        match self {
            Self::Document => "Document",
            Self::Bubbles => "Bubbles",
            Self::Transcript => "Transcript",
        }
    }

    /// The space above a turn by `role`, after the turn before it. In the
    /// document layout each turn's action row sits under it, so a reply
    /// starts just below your message's buttons, and your next message just
    /// below the reply's.
    pub(super) fn gap_before(self, role: Speaker) -> f32 {
        let space = &composerkit_theme::tokens().space;
        match (self, role) {
            (Self::Document, Speaker::Assistant) => space.prompt_to_reply,
            (Self::Document, Speaker::User) => space.reply_to_prompt,
            (Self::Bubbles, _) => 16.,
            (Self::Transcript, _) => 0.,
        }
    }
}

/// From this conversation width, a document bubble takes less of the row.
const DOCUMENT_WIDE: f32 = 560.;
/// Up to this conversation width, the transcript puts the name above the
/// text.
const TRANSCRIPT_NARROW: f32 = 520.;

/// The most of the reading column a bubble takes.
const BUBBLE_SHARE: f32 = 0.85;
/// A document bubble's share once the conversation is wide.
const DOCUMENT_WIDE_SHARE: f32 = 0.7;

/// One turn, drawn in a layout.
#[derive(IntoElement)]
pub(super) struct TurnView {
    pub(super) id: ElementId,
    pub(super) role: Speaker,
    /// What the turn shows, cut short while it streams or once stopped.
    pub(super) blocks: Vec<Block>,
    pub(super) attachments: Vec<TurnAttachment>,
    pub(super) status: TurnStatus,
    pub(super) copied: Option<CopyTarget>,
    /// The reply is marked helpful.
    pub(super) rated: bool,
    pub(super) layout: ConversationLayout,
    /// The conversation's width, which some layouts adapt to.
    pub(super) width: Pixels,
    pub(super) handlers: TurnHandlers,
}

impl TurnView {
    fn caret(&self) -> Option<f32> {
        match self.status {
            TurnStatus::Streaming { caret } => Some(caret),
            TurnStatus::Done | TurnStatus::Stopped => None,
        }
    }

    fn rich_text(&self, density: Density, caret: Option<f32>) -> RichText {
        RichText {
            id: (self.id.clone(), "text").into(),
            blocks: self.blocks.clone(),
            density,
            copied: match self.copied {
                Some(CopyTarget::Code(index)) => Some(index),
                Some(CopyTarget::Turn) | None => None,
            },
            caret,
            handlers: self.handlers.clone(),
        }
    }

    /// "Writing…" and Stop while the reply streams, or a note once it was
    /// stopped. Nothing for a finished turn.
    fn stream_status(&self) -> Option<StreamStatus> {
        (self.status == TurnStatus::Stopped).then_some(StreamStatus {
            status: self.status,
        })
    }

    /// The turn's buttons, except while the reply streams.
    fn actions(&self, size: ActionSize, hover_group: Option<SharedString>) -> Option<TurnActions> {
        (!matches!(self.status, TurnStatus::Streaming { .. })).then(|| TurnActions {
            id: (self.id.clone(), "actions").into(),
            role: self.role,
            blocks: self.blocks.clone(),
            copied: self.copied == Some(CopyTarget::Turn),
            rated: self.rated,
            size,
            hover_group,
            handlers: self.handlers.clone(),
        })
    }

    /// A bubble on the speaker's side, with the web app's padding and the
    /// corner nearest the speaker squared.
    fn bubble(&self, share: f32, cx: &App) -> Bubble {
        let tokens = composerkit_theme::tokens();
        let colors = composerkit_theme::colors(cx);
        let body = &tokens.text.body;
        let (alignment, variant) = match self.role {
            Speaker::User => (MessageAlignment::End, BubbleVariant::Muted),
            Speaker::Assistant => (MessageAlignment::Start, BubbleVariant::Outline),
        };
        let content = BubbleContent::new()
            .flex()
            .flex_col()
            .gap_2()
            .px_4()
            .py(px(tokens.space.bubble_padding_y))
            .rounded(px(tokens.radius.tray))
            .text_size(px(body.size))
            .line_height(px(body.line_height))
            .text_color(colors.foreground)
            .map(|content| match self.role {
                Speaker::User => content.bg(colors.muted).rounded_br(px(tokens.radius.small)),
                Speaker::Assistant => content
                    .bg(transparent_black())
                    .border(px(tokens.border.hairline))
                    .border_color(colors.input)
                    .rounded_bl(px(tokens.radius.small)),
            });
        Bubble::new()
            .alignment(alignment)
            .with_variant(variant)
            .max_w(relative(share))
            .content(content)
    }

    fn document(self, cx: &App) -> gpui_kit::Div {
        let tokens = composerkit_theme::tokens();
        let space = &tokens.space;
        let message = &tokens.text.message;
        let mine = self.role == Speaker::User;
        let share = if self.width >= px(DOCUMENT_WIDE) {
            DOCUMENT_WIDE_SHARE
        } else {
            BUBBLE_SHARE
        };
        let body = if mine {
            self.bubble(share, cx)
                .content(
                    BubbleContent::new()
                        .text_size(px(message.size))
                        .line_height(px(message.line_height))
                        .text_color(composerkit_theme::colors(cx).foreground)
                        .px(px(space.user_bubble_padding_x))
                        .py(px(space.user_bubble_padding_y))
                        .rounded(px(tokens.radius.user_bubble))
                        .bg(composerkit_theme::colors(cx).muted),
                )
                .mr(px(space.bubble_end_inset))
                .child(self.rich_text(Density::Regular, None))
                .into_any_element()
        } else {
            div()
                .flex()
                .flex_col()
                .gap_2()
                .text_size(px(message.size))
                .line_height(px(message.line_height))
                .child(self.rich_text(Density::Regular, self.caret()))
                .children(self.stream_status())
                .into_any_element()
        };
        // Your message's buttons keep their room but show only while the
        // pointer is on the turn or one of them has focus.
        let group = SharedString::from(format!("{}", self.id));
        let actions = if mine {
            self.actions(ActionSize::Small, Some(group.clone()))
                .map(|actions| div().mt(px(space.prompt_action_gap)).child(actions))
        } else {
            self.actions(ActionSize::Small, None).map(|actions| {
                div()
                    .mt(px(space.reply_action_gap))
                    .ml(px(-space.document_action_inset))
                    .child(actions)
            })
        };
        div()
            .group(group)
            .flex()
            .flex_col()
            .map(|turn| {
                if mine {
                    turn.items_end()
                } else {
                    turn.items_stretch()
                }
            })
            .children(
                attachments(&self.attachments)
                    .map(|row| row.mb_2().max_w(relative(BUBBLE_SHARE)).justify_end()),
            )
            .child(body)
            .children(actions)
    }

    fn bubbles(self, cx: &App) -> gpui_kit::Div {
        let mine = self.role == Speaker::User;
        div()
            .flex()
            .flex_col()
            .gap_1p5()
            .map(|turn| {
                if mine {
                    turn.items_end()
                } else {
                    turn.items_start()
                }
            })
            .children(
                attachments(&self.attachments)
                    .map(|row| row.max_w(relative(BUBBLE_SHARE)).justify_end()),
            )
            .child(
                self.bubble(BUBBLE_SHARE, cx)
                    .child(self.rich_text(Density::Regular, self.caret()))
                    .children(self.stream_status()),
            )
            .children(self.actions(ActionSize::Small, None))
    }

    fn transcript(self, cx: &App) -> gpui_kit::Div {
        let tokens = composerkit_theme::tokens();
        let label = &tokens.text.label;
        let narrow = self.width > Pixels::ZERO && self.width <= px(TRANSCRIPT_NARROW);
        let name = div()
            .font_weight(FontWeight::SEMIBOLD)
            .text_size(px(label.size))
            .line_height(px(label.line_height))
            .text_color(composerkit_theme::colors(cx).foreground)
            .child(self.role.name());
        let gutter = div()
            .flex()
            .min_w_0()
            .gap_1()
            .map(|gutter| {
                if narrow {
                    gutter.items_center().justify_between()
                } else {
                    gutter
                        .flex_col()
                        .items_start()
                        .flex_none()
                        .w(px(tokens.space.transcript_gutter))
                }
            })
            .child(name)
            .children(self.actions(ActionSize::Row, None).map(|actions| {
                // Beside the text, the actions keep to the gutter's width
                // and wrap there, clear of the text.
                div()
                    .ml(px(-tokens.space.transcript_action_inset))
                    .when(!narrow, gpui_kit::Styled::w_full)
                    .child(actions)
            }));
        let content = div()
            .flex()
            .flex_col()
            .flex_1()
            .min_w_0()
            .gap_2()
            .children(attachments(&self.attachments))
            .child(self.rich_text(Density::Compact, self.caret()))
            .children(self.stream_status());
        div()
            .flex()
            .py_3()
            .map(|row| {
                if narrow {
                    row.flex_col().gap_1()
                } else {
                    row.gap_x_4()
                }
            })
            .child(gutter)
            .child(content)
    }
}

impl RenderOnce for TurnView {
    fn render(self, _window: &mut Window, cx: &mut App) -> impl IntoElement {
        let id = self.id.clone();
        let said = self.role.said();
        let body = match self.layout {
            ConversationLayout::Document => self.document(cx),
            ConversationLayout::Bubbles => self.bubbles(cx),
            ConversationLayout::Transcript => self.transcript(cx),
        };
        body.id(id).role(Role::Article).aria_label(said)
    }
}
