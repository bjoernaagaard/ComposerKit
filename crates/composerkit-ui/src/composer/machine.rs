// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

//! The composer as a pure reducer, ported from `src/composer/machine.ts`.
//! Each field of the web state is a field here and each action a variant,
//! so both apps move through the same states.

use super::choices::{Effort, Model, Permission};

/// The largest file the composer accepts: 25 MB.
pub const MAX_UPLOAD_BYTES: u64 = 25 * 1024 * 1024;

/// Identifies one attachment within a composer. A
/// [`ComposerController`](super::ComposerController) mints a new one for
/// each file and never repeats one.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct AttachmentId(pub(super) u32);

impl AttachmentId {
    /// The first id.
    pub const FIRST: Self = Self(0);

    /// The id after this one, or `None` once ids run out.
    #[must_use]
    pub const fn next(self) -> Option<Self> {
        match self.0.checked_add(1) {
            Some(next) => Some(Self(next)),
            None => None,
        }
    }
}

/// Why an upload stopped.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum UploadFailure {
    /// The file is over [`MAX_UPLOAD_BYTES`]. Retrying can't help.
    TooLarge,
    /// The connection dropped. Retrying can help.
    Offline,
}

/// Where an attachment is in its upload.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum UploadStatus {
    Uploading,
    Ready,
    Failed(UploadFailure),
}

/// A file attached to the draft.
#[derive(Clone, Debug, PartialEq)]
pub struct Attachment {
    pub id: AttachmentId,
    pub name: String,
    pub size_bytes: u64,
    pub status: UploadStatus,
    /// How much has uploaded, from 0 to 1.
    pub progress: f32,
}

impl Attachment {
    /// A file that is about to upload, or that has already failed because
    /// it is over [`MAX_UPLOAD_BYTES`].
    #[must_use]
    pub fn picked(id: AttachmentId, name: impl Into<String>, size_bytes: u64) -> Self {
        let status = if size_bytes > MAX_UPLOAD_BYTES {
            UploadStatus::Failed(UploadFailure::TooLarge)
        } else {
            UploadStatus::Uploading
        };
        Self {
            id,
            name: name.into(),
            size_bytes,
            status,
            progress: 0.,
        }
    }

    /// The failure, if the upload stopped.
    #[must_use]
    pub const fn failure(&self) -> Option<UploadFailure> {
        match self.status {
            UploadStatus::Failed(failure) => Some(failure),
            UploadStatus::Uploading | UploadStatus::Ready => None,
        }
    }

    /// Whether retrying can help: only an upload the connection cut off.
    #[must_use]
    pub fn can_retry(&self) -> bool {
        self.failure() == Some(UploadFailure::Offline)
    }
}

/// Why a message wasn't sent.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum SendFailure {
    Offline,
}

/// Whether a message is on its way.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Hash)]
pub enum Phase {
    #[default]
    Idle,
    Sending,
    /// The last send failed. The draft and files are kept for a retry.
    Failed(SendFailure),
}

/// Everything the composer shows. Change it only through
/// [`ComposerState::apply`], so it stays consistent.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct ComposerState {
    pub draft: String,
    pub attachments: Vec<Attachment>,
    pub phase: Phase,
    pub model: Model,
    pub effort: Effort,
    pub permission: Permission,
    /// The project the chat runs in, if any.
    pub project_id: Option<String>,
    pub dictating: bool,
    /// The composer fills its container, for writing at length. Sending
    /// collapses it.
    pub expanded: bool,
}

/// Something that happened to the composer.
#[derive(Clone, Debug, PartialEq)]
pub enum ComposerAction {
    DraftChanged {
        draft: String,
    },
    FilesAdded {
        attachments: Vec<Attachment>,
    },
    UploadProgressed {
        id: AttachmentId,
        progress: f32,
    },
    UploadFinished {
        id: AttachmentId,
    },
    UploadFailed {
        id: AttachmentId,
        failure: UploadFailure,
    },
    UploadRetried {
        id: AttachmentId,
    },
    AttachmentRemoved {
        id: AttachmentId,
    },
    Submitted,
    SendSucceeded,
    SendFailed {
        failure: SendFailure,
    },
    Stopped,
    ModelChanged {
        model: Model,
    },
    EffortChanged {
        effort: Effort,
    },
    PermissionChanged {
        permission: Permission,
    },
    ProjectChanged {
        project_id: Option<String>,
    },
    DictationChanged {
        dictating: bool,
    },
    DictationHeard {
        text: String,
    },
    ExpandedChanged {
        expanded: bool,
    },
}

impl ComposerAction {
    /// While a message is in flight its draft and files are frozen, because
    /// a successful send clears them and would drop anything added meanwhile.
    const fn frozen_while_sending(&self) -> bool {
        matches!(
            self,
            Self::AttachmentRemoved { .. }
                | Self::DictationHeard { .. }
                | Self::DraftChanged { .. }
                | Self::FilesAdded { .. }
                | Self::UploadRetried { .. }
        )
    }
}

impl ComposerState {
    /// Whether any attachment is still uploading.
    #[must_use]
    pub fn is_uploading(&self) -> bool {
        self.attachments
            .iter()
            .any(|attachment| attachment.status == UploadStatus::Uploading)
    }

    /// Whether a send would go through: nothing is in flight or uploading,
    /// and there is text or a ready file to send.
    #[must_use]
    pub fn can_send(&self) -> bool {
        if self.phase == Phase::Sending || self.is_uploading() {
            return false;
        }
        let has_ready_file = self
            .attachments
            .iter()
            .any(|attachment| attachment.status == UploadStatus::Ready);
        !self.draft.trim().is_empty() || has_ready_file
    }

    /// Moves the composer to the state `action` leads to. Actions that
    /// don't apply, such as a submit with nothing to send, change nothing.
    pub fn apply(&mut self, action: ComposerAction) {
        if self.phase == Phase::Sending && action.frozen_while_sending() {
            return;
        }

        match action {
            ComposerAction::DraftChanged { draft } => self.draft = draft,
            ComposerAction::FilesAdded { attachments } => {
                // A second file with an id in use would act as the same file.
                for attachment in attachments {
                    if !self.attachments.iter().any(|old| old.id == attachment.id) {
                        self.attachments.push(attachment);
                    }
                }
            }
            ComposerAction::UploadProgressed { id, progress } => {
                self.update_attachment(id, |attachment| attachment.progress = progress);
            }
            ComposerAction::UploadFinished { id } => self.update_attachment(id, |attachment| {
                attachment.progress = 1.;
                attachment.status = UploadStatus::Ready;
            }),
            ComposerAction::UploadFailed { id, failure } => {
                self.update_attachment(id, |attachment| {
                    attachment.status = UploadStatus::Failed(failure);
                });
            }
            ComposerAction::UploadRetried { id } => self.update_attachment(id, |attachment| {
                if attachment.can_retry() {
                    attachment.progress = 0.;
                    attachment.status = UploadStatus::Uploading;
                }
            }),
            ComposerAction::AttachmentRemoved { id } => {
                self.attachments.retain(|attachment| attachment.id != id);
            }
            ComposerAction::Submitted => {
                if self.can_send() {
                    self.dictating = false;
                    self.expanded = false;
                    self.phase = Phase::Sending;
                }
            }
            ComposerAction::SendSucceeded => {
                self.attachments.clear();
                self.draft.clear();
                self.phase = Phase::Idle;
            }
            ComposerAction::SendFailed { failure } => self.phase = Phase::Failed(failure),
            ComposerAction::Stopped => self.phase = Phase::Idle,
            ComposerAction::ModelChanged { model } => self.model = model,
            ComposerAction::EffortChanged { effort } => self.effort = effort,
            ComposerAction::PermissionChanged { permission } => self.permission = permission,
            ComposerAction::ProjectChanged { project_id } => self.project_id = project_id,
            ComposerAction::DictationChanged { dictating } => self.dictating = dictating,
            ComposerAction::DictationHeard { text } => append_spoken(&mut self.draft, &text),
            ComposerAction::ExpandedChanged { expanded } => self.expanded = expanded,
        }
    }

    fn update_attachment(&mut self, id: AttachmentId, patch: impl FnOnce(&mut Attachment)) {
        if let Some(attachment) = self
            .attachments
            .iter_mut()
            .find(|attachment| attachment.id == id)
        {
            patch(attachment);
        }
    }
}

/// Adds dictated text to the draft, with a space unless the draft is empty
/// or already ends in whitespace.
fn append_spoken(draft: &mut String, text: &str) {
    if !(draft.is_empty() || draft.ends_with(' ') || draft.ends_with('\n')) {
        draft.push(' ');
    }
    draft.push_str(text);
}
