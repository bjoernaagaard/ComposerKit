// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

use std::collections::HashMap;
use std::time::Duration;

use gpui_kit::{
    App, AsyncApp, Context, ElementId, Entity, EventEmitter, PathPromptOptions, Task, WeakEntity,
};

use super::attachments::upload_announcement;
use super::machine::{
    Attachment, AttachmentId, ComposerAction, ComposerState, Phase, SendFailure, UploadFailure,
    UploadStatus,
};
use super::view::{Composer, ComposerRequest};

/// How often a simulated upload advances, and by how much.
const UPLOAD_STEP: Duration = Duration::from_millis(120);
const UPLOAD_STEP_FRACTION: f32 = 0.12;
/// How long a simulated send takes, online and offline. Online it goes
/// through at once, so the field clears as soon as you send, as the web
/// demo's does.
const SEND_DELAY: Duration = Duration::ZERO;
const OFFLINE_DELAY: Duration = Duration::from_millis(400);

/// Whether the simulated network is reachable.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Hash)]
pub enum Connectivity {
    #[default]
    Online,
    /// Uploads stop at their next step and sends fail.
    Offline,
}

/// A file the user picked, before it becomes an [`Attachment`].
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub struct PickedFile {
    pub name: String,
    pub size_bytes: u64,
}

/// Emitted when a message goes through, with what it carried.
#[derive(Clone, Debug, PartialEq)]
pub struct SentMessage {
    pub draft: String,
    pub attachments: Vec<Attachment>,
}

/// Owns a [`ComposerState`] and does the work the composer asks for, the way
/// the web `useComposerController` does. Uploads and sends are
/// simulated on timers; the file picker is real. Dictation only toggles the
/// listening state, because speech recognition is out of scope.
#[derive(Debug)]
pub struct ComposerController {
    state: ComposerState,
    upload_notice: String,
    connectivity: Connectivity,
    uploads: HashMap<AttachmentId, Task<()>>,
    send: Option<Task<()>>,
    /// The id for the next file, or `None` once ids have run out.
    next_id: Option<AttachmentId>,
}

impl EventEmitter<SentMessage> for ComposerController {}

impl ComposerController {
    /// A controller that starts from `state`. No upload runs for a file that
    /// is uploading there, so it starts as cut off by the connection, which
    /// shows its Retry control.
    #[must_use]
    pub fn new(mut state: ComposerState) -> Self {
        for attachment in &mut state.attachments {
            if attachment.status == UploadStatus::Uploading {
                attachment.status = UploadStatus::Failed(UploadFailure::Offline);
            }
        }
        let next_id = after_highest_id(&state.attachments);
        Self {
            state,
            upload_notice: String::new(),
            connectivity: Connectivity::default(),
            uploads: HashMap::new(),
            send: None,
            next_id,
        }
    }

    #[must_use]
    pub fn state(&self) -> &ComposerState {
        &self.state
    }

    #[must_use]
    pub fn connectivity(&self) -> Connectivity {
        self.connectivity
    }

    pub fn set_connectivity(&mut self, connectivity: Connectivity, cx: &mut Context<Self>) {
        self.connectivity = connectivity;
        cx.notify();
    }

    /// Applies `action`, and stops the uploads of files it removed.
    pub fn dispatch(&mut self, action: ComposerAction, cx: &mut Context<Self>) {
        let previous = self.state.attachments.clone();
        self.state.apply(action);
        // A host can add files with ids of its own, so the next id moves past
        // them. It never moves back, so a removed file's id is not reused.
        self.next_id = self.next_id.and_then(|next| {
            after_highest_id(&self.state.attachments).map(|after| next.max(after))
        });
        let changed: Vec<_> = self
            .state
            .attachments
            .iter()
            .filter(|attachment| {
                previous
                    .iter()
                    .find(|old| old.id == attachment.id)
                    .is_none_or(|old| old.status != attachment.status)
            })
            .map(upload_announcement)
            .collect();
        if self.state.attachments.is_empty() {
            self.upload_notice.clear();
        } else if !changed.is_empty() {
            self.upload_notice = changed.join(" ");
        }
        let attachments = &self.state.attachments;
        self.uploads
            .retain(|id, _| attachments.iter().any(|attachment| attachment.id == *id));
        cx.notify();
    }

    /// Does what the composer asked for.
    pub fn request(&mut self, request: ComposerRequest, cx: &mut Context<Self>) {
        match request {
            ComposerRequest::Submit => self.submit(cx),
            ComposerRequest::Stop => self.stop(cx),
            ComposerRequest::RetryUpload(id) => {
                let before = self.status(id);
                self.dispatch(ComposerAction::UploadRetried { id }, cx);
                // The composer only retries uploads the connection cut off.
                if before != Some(UploadStatus::Uploading)
                    && self.status(id) == Some(UploadStatus::Uploading)
                {
                    self.upload(id, cx);
                }
            }
            ComposerRequest::PickFiles => Self::pick_files(cx),
            ComposerRequest::ToggleDictation => {
                let dictating = !self.state.dictating;
                self.dispatch(ComposerAction::DictationChanged { dictating }, cx);
            }
        }
    }

    /// Attaches `files` and starts uploading each one that isn't too large.
    /// While a message is sending, its files are frozen, so this does
    /// nothing. Ids never repeat, so once they run out no more files attach.
    pub fn add_files(
        &mut self,
        files: impl IntoIterator<Item = PickedFile>,
        cx: &mut Context<Self>,
    ) {
        if self.state.phase == Phase::Sending {
            return;
        }
        let mut attachments = Vec::new();
        for file in files {
            let Some(id) = self.next_id else {
                break;
            };
            self.next_id = id.next();
            attachments.push(Attachment::picked(id, file.name, file.size_bytes));
        }
        let uploading: Vec<AttachmentId> = attachments
            .iter()
            .filter(|attachment| attachment.failure().is_none())
            .map(|attachment| attachment.id)
            .collect();
        self.dispatch(ComposerAction::FilesAdded { attachments }, cx);
        for id in uploading {
            self.upload(id, cx);
        }
    }

    fn status(&self, id: AttachmentId) -> Option<UploadStatus> {
        self.state
            .attachments
            .iter()
            .find(|attachment| attachment.id == id)
            .map(|attachment| attachment.status)
    }

    fn pick_files(cx: &mut Context<Self>) {
        let paths = cx.prompt_for_paths(PathPromptOptions {
            files: true,
            directories: false,
            multiple: true,
            prompt: None,
        });
        cx.spawn(async move |this: WeakEntity<Self>, cx: &mut AsyncApp| {
            let Ok(Ok(Some(paths))) = paths.await else {
                return;
            };
            // Reading sizes can block on a slow disk, so it runs off the UI thread.
            let files: Vec<PickedFile> = cx
                .background_executor()
                .spawn(async move {
                    paths
                        .iter()
                        .filter_map(|path| {
                            Some(PickedFile {
                                name: path.file_name()?.to_string_lossy().into_owned(),
                                size_bytes: std::fs::metadata(path).ok()?.len(),
                            })
                        })
                        .collect()
                })
                .await;
            // The composer may be gone by the time the picker closes.
            this.update(cx, |this, cx| this.add_files(files, cx)).ok();
        })
        .detach();
    }

    fn upload(&mut self, id: AttachmentId, cx: &mut Context<Self>) {
        let task = cx.spawn(async move |this: WeakEntity<Self>, cx: &mut AsyncApp| {
            let mut progress: f32 = 0.;
            loop {
                cx.background_executor().timer(UPLOAD_STEP).await;
                let keep_going = this.update(cx, |this, cx| {
                    if this.connectivity == Connectivity::Offline {
                        let failure = UploadFailure::Offline;
                        this.dispatch(ComposerAction::UploadFailed { id, failure }, cx);
                        return false;
                    }
                    progress = (progress + UPLOAD_STEP_FRACTION).min(1.);
                    if progress >= 1. {
                        this.dispatch(ComposerAction::UploadFinished { id }, cx);
                        return false;
                    }
                    this.dispatch(ComposerAction::UploadProgressed { id, progress }, cx);
                    true
                });
                if !matches!(keep_going, Ok(true)) {
                    break;
                }
            }
        });
        self.uploads.insert(id, task);
    }

    fn submit(&mut self, cx: &mut Context<Self>) {
        if !self.state.can_send() {
            return;
        }
        let message = SentMessage {
            draft: self.state.draft.clone(),
            attachments: self.state.attachments.clone(),
        };
        self.dispatch(ComposerAction::Submitted, cx);

        let connectivity = self.connectivity;
        let delay = match connectivity {
            Connectivity::Online => SEND_DELAY,
            Connectivity::Offline => OFFLINE_DELAY,
        };
        self.send = Some(
            cx.spawn(async move |this: WeakEntity<Self>, cx: &mut AsyncApp| {
                cx.background_executor().timer(delay).await;
                this.update(cx, |this, cx| {
                    this.send = None;
                    match connectivity {
                        Connectivity::Online => {
                            cx.emit(message);
                            this.dispatch(ComposerAction::SendSucceeded, cx);
                        }
                        Connectivity::Offline => {
                            let failure = SendFailure::Offline;
                            this.dispatch(ComposerAction::SendFailed { failure }, cx);
                        }
                    }
                })
                .ok();
            }),
        );
    }

    fn stop(&mut self, cx: &mut Context<Self>) {
        // Dropping the task cancels the send.
        self.send = None;
        self.dispatch(ComposerAction::Stopped, cx);
    }
}

/// The id after the highest one in `attachments`, or `None` if the highest
/// is the last id.
fn after_highest_id(attachments: &[Attachment]) -> Option<AttachmentId> {
    attachments
        .iter()
        .map(|attachment| attachment.id)
        .max()
        .map_or(Some(AttachmentId::FIRST), AttachmentId::next)
}

impl Composer {
    /// A composer that shows `controller`'s state and hands it every action
    /// and request. Set the layout, mode and projects on the result.
    #[must_use]
    pub fn for_controller(
        id: impl Into<ElementId>,
        controller: &Entity<ComposerController>,
        cx: &App,
    ) -> Self {
        let state = controller.read(cx).state.clone();
        let on_action = controller.downgrade();
        let on_request = controller.downgrade();
        Self::new(id, state)
            .upload_notice(controller.read(cx).upload_notice.clone())
            .on_action(move |action, _, cx| {
                on_action
                    .update(cx, |controller, cx| controller.dispatch(action.clone(), cx))
                    .ok();
            })
            .on_request(move |request, _, cx| {
                on_request
                    .update(cx, |controller, cx| controller.request(*request, cx))
                    .ok();
            })
    }
}
