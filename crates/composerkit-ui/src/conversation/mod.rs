// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

//! The open chat, the native twin of `src/components/conversation`.
//!
//! [`ConversationView`] shows a list of [`Turn`]s in a
//! [`ConversationLayout`], with the composer under it. [`sample_turns`] is
//! the same sample chat the web demo shows.

mod layout;
mod parts;
mod reveal;
mod sample;
mod turn;
mod view;

pub use layout::ConversationLayout;
pub use sample::sample_turns;
pub use turn::{Block, ListStyle, Role, Turn, TurnAttachment};
pub use view::ConversationView;
