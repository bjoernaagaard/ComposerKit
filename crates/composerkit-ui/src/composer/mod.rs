// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

//! The message composer, the native twin of `packages/composerkit/src/components/composer`.
//!
//! [`ComposerState`] and [`ComposerAction`] are a pure reducer with the web
//! machine's states. [`Composer`] renders a state in one of three layouts
//! and reports edits and requests. [`ComposerController`] owns a state and
//! answers those requests with simulated uploads and sends.

mod add_menu;
pub(crate) mod attachments;
mod choices;
mod controller;
mod field;
mod machine;
mod menus;
mod model_picker;
mod tray;
mod view;

pub use choices::{Effort, Model, Permission};
pub use controller::{ComposerController, Connectivity, PickedFile, SentMessage};
pub use machine::{
    Attachment, AttachmentId, ComposerAction, ComposerState, MAX_UPLOAD_BYTES, Phase, SendFailure,
    UploadFailure, UploadStatus,
};
pub use view::{
    Composer, ComposerLayout, ComposerMode, ComposerProject, ComposerRequest, DictationSupport,
};
