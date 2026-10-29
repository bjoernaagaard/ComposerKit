// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

use gpui_kit::SharedString;

/// Who wrote a turn.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum Role {
    User,
    Assistant,
}

impl Role {
    /// The speaker's name, as the transcript layout shows it.
    #[must_use]
    pub const fn name(self) -> &'static str {
        match self {
            Self::User => "You",
            Self::Assistant => "Assistant",
        }
    }

    /// What a screen reader hears before the turn.
    pub(super) const fn said(self) -> &'static str {
        match self {
            Self::User => "Message from you",
            Self::Assistant => "Message from the assistant",
        }
    }
}

/// How a list marks its items.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum ListStyle {
    Numbered,
    Bulleted,
}

/// One piece of a turn. Text between backticks in a paragraph or list item
/// is inline code.
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub enum Block {
    Paragraph(String),
    List {
        style: ListStyle,
        items: Vec<String>,
    },
    Code {
        language: String,
        code: String,
    },
}

impl Block {
    /// A paragraph of `text`.
    #[must_use]
    pub fn paragraph(text: impl Into<String>) -> Self {
        Self::Paragraph(text.into())
    }

    /// A code block in `language`, such as `rust`.
    #[must_use]
    pub fn code(language: impl Into<String>, code: impl Into<String>) -> Self {
        Self::Code {
            language: language.into(),
            code: code.into(),
        }
    }

    /// A list with `items` in order.
    #[must_use]
    pub fn list(style: ListStyle, items: impl IntoIterator<Item = impl Into<String>>) -> Self {
        Self::List {
            style,
            items: items.into_iter().map(Into::into).collect(),
        }
    }

    /// The characters a reply streams for this block.
    fn len(&self) -> usize {
        match self {
            Self::Paragraph(text) => text.chars().count(),
            Self::Code { code, .. } => code.chars().count(),
            Self::List { items, .. } => items.iter().map(|item| item.chars().count()).sum(),
        }
    }

    /// The block cut to its first `budget` characters.
    fn cut(&self, budget: usize) -> Self {
        match self {
            Self::Paragraph(text) => Self::Paragraph(first_chars(text, budget)),
            Self::Code { language, code } => Self::Code {
                language: language.clone(),
                code: first_chars(code, budget),
            },
            Self::List { style, items } => {
                let mut left = budget;
                let mut kept = Vec::new();
                for item in items {
                    if left == 0 {
                        break;
                    }
                    kept.push(first_chars(item, left));
                    left = left.saturating_sub(item.chars().count());
                }
                Self::List {
                    style: *style,
                    items: kept,
                }
            }
        }
    }

    /// The block as Markdown, as Copy puts it on the clipboard: inline code
    /// keeps its backticks and code its fence.
    fn plain_text(&self) -> String {
        match self {
            Self::Paragraph(text) => text.clone(),
            Self::Code { language, code } => format!("```{language}\n{code}\n```"),
            Self::List { style, items } => items
                .iter()
                .enumerate()
                .map(|(index, item)| match style {
                    ListStyle::Numbered => format!("{}. {item}", index + 1),
                    ListStyle::Bulleted => format!("- {item}"),
                })
                .collect::<Vec<_>>()
                .join("\n"),
        }
    }
}

impl Block {
    /// The block with no Markdown at all: no fences, markers or backticks.
    fn bare_text(&self) -> String {
        match self {
            Self::Paragraph(text) => text.replace('`', ""),
            Self::Code { code, .. } => code.clone(),
            Self::List { items, .. } => items
                .iter()
                .map(|item| item.replace('`', ""))
                .collect::<Vec<_>>()
                .join("\n"),
        }
    }
}

fn first_chars(text: &str, count: usize) -> String {
    text.chars().take(count).collect()
}

/// A file sent with a message.
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub struct TurnAttachment {
    pub name: SharedString,
    /// The size as people read it, such as "18 KB".
    pub size: SharedString,
}

impl TurnAttachment {
    #[must_use]
    pub fn new(name: impl Into<SharedString>, size: impl Into<SharedString>) -> Self {
        Self {
            name: name.into(),
            size: size.into(),
        }
    }
}

/// One message in a conversation.
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub struct Turn {
    pub role: Role,
    pub blocks: Vec<Block>,
    pub attachments: Vec<TurnAttachment>,
}

impl Turn {
    /// A message from the user: one paragraph, with the files it carried.
    #[must_use]
    pub fn user(
        text: impl Into<String>,
        attachments: impl IntoIterator<Item = TurnAttachment>,
    ) -> Self {
        let text = text.into();
        Self {
            role: Role::User,
            blocks: if text.trim().is_empty() {
                Vec::new()
            } else {
                vec![Block::Paragraph(text)]
            },
            attachments: attachments.into_iter().collect(),
        }
    }

    /// A reply made of `blocks`.
    #[must_use]
    pub fn assistant(blocks: impl IntoIterator<Item = Block>) -> Self {
        Self {
            role: Role::Assistant,
            blocks: blocks.into_iter().collect(),
            attachments: Vec::new(),
        }
    }
}

/// The characters a reply streams in all.
pub(super) fn total_length(blocks: &[Block]) -> usize {
    blocks.iter().map(Block::len).sum()
}

/// The first `shown` characters of a reply, for streaming and stopped turns.
pub(super) fn reveal(blocks: &[Block], shown: usize) -> Vec<Block> {
    let mut left = shown;
    let mut visible = Vec::new();
    for block in blocks {
        if left == 0 {
            break;
        }
        visible.push(block.cut(left));
        left = left.saturating_sub(block.len());
    }
    visible
}

/// The whole turn with no Markdown, for Copy as plain text and for editing.
pub(super) fn bare_text(blocks: &[Block]) -> String {
    blocks
        .iter()
        .map(Block::bare_text)
        .collect::<Vec<_>>()
        .join("\n\n")
}

/// The whole turn as Markdown, as Copy puts it on the clipboard.
pub(super) fn plain_text(blocks: &[Block]) -> String {
    blocks
        .iter()
        .map(Block::plain_text)
        .collect::<Vec<_>>()
        .join("\n\n")
}

/// A run of text that is inline code or not, split on backticks.
pub(super) struct Segment<'text> {
    pub(super) text: &'text str,
    pub(super) code: bool,
}

/// Splits on backticks. Odd segments are inline code.
pub(super) fn segments(text: &str) -> impl Iterator<Item = Segment<'_>> {
    text.split('`').enumerate().map(|(index, text)| Segment {
        text,
        code: index % 2 == 1,
    })
}
