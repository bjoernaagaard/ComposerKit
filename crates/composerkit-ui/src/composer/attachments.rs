// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

use crate::focus_ring::KeyboardRing as _;
use gpui_kit::assets::IconName;
use gpui_kit::component::attachment::{
    Attachment as Card, AttachmentActions, AttachmentContent, AttachmentDescription,
    AttachmentMedia, AttachmentStatus, AttachmentTitle,
};
use gpui_kit::component::button::{Button, ButtonVariants as _};
use gpui_kit::component::{Icon, Sizable as _};
use gpui_kit::{App, IntoElement, ParentElement as _, Styled, div, prelude::FluentBuilder as _};

use super::machine::{Attachment, ComposerAction, MAX_UPLOAD_BYTES, UploadFailure, UploadStatus};
use super::view::{ComposerRequest, Handlers};

const KILOBYTE: u64 = 1024;
const MEGABYTE: u64 = KILOBYTE * KILOBYTE;

#[expect(
    clippy::cast_precision_loss,
    reason = "file sizes are shown to one decimal place"
)]
pub(crate) fn format_size(bytes: u64) -> String {
    if bytes >= MEGABYTE {
        format!("{:.1} MB", bytes as f64 / MEGABYTE as f64)
    } else {
        format!("{} KB", ((bytes + KILOBYTE / 2) / KILOBYTE).max(1))
    }
}

/// The line under the file name. While uploading, gpui-kit adds the
/// percentage after it.
pub(super) fn status_text(attachment: &Attachment) -> String {
    match attachment.status {
        UploadStatus::Uploading => "Uploading".to_owned(),
        UploadStatus::Ready => format_size(attachment.size_bytes),
        UploadStatus::Failed(UploadFailure::TooLarge) => format!(
            "Larger than {} MB. Remove it and pick a smaller file.",
            MAX_UPLOAD_BYTES / MEGABYTE
        ),
        UploadStatus::Failed(UploadFailure::Offline) => {
            "The upload stopped because the connection dropped. Retry once you’re online."
                .to_owned()
        }
    }
}

pub(super) fn upload_announcement(attachment: &Attachment) -> String {
    match attachment.status {
        UploadStatus::Uploading => format!("Uploading {}.", attachment.name),
        UploadStatus::Ready => format!("{} uploaded.", attachment.name),
        UploadStatus::Failed(_) => format!("{}: {}", attachment.name, status_text(attachment)),
    }
}

const fn card_status(status: UploadStatus) -> AttachmentStatus {
    match status {
        UploadStatus::Uploading => AttachmentStatus::Uploading,
        UploadStatus::Ready => AttachmentStatus::Complete,
        UploadStatus::Failed(_) => AttachmentStatus::Failed,
    }
}

/// One file. A failed file shows a stop sign instead of the file icon, so
/// failure never rides on the red text alone. The card truncates long names
/// and messages, so its tooltip carries both in full.
fn attachment_card(attachment: &Attachment, handlers: &Handlers, cx: &App) -> Card {
    let name = attachment.name.clone();
    let status = status_text(attachment);
    let id = attachment.id;

    let retry = attachment.can_retry().then(|| {
        let handlers = handlers.clone();
        let label = format!("Upload {name} again");
        Button::new("retry")
            .keyboard_ring(cx)
            .ghost()
            .xsmall()
            .icon(Icon::new(IconName::RefreshCw))
            .tooltip(label.clone())
            .accessibility_label(label)
            .on_click(move |_, window, cx| {
                handlers.request(&ComposerRequest::RetryUpload(id), window, cx);
            })
    });
    let remove = {
        let handlers = handlers.clone();
        let label = format!("Remove {name}");
        Button::new("remove")
            .keyboard_ring(cx)
            .ghost()
            .xsmall()
            .icon(Icon::new(IconName::X))
            .tooltip(label.clone())
            .accessibility_label(label)
            .on_click(move |_, window, cx| {
                handlers.act(&ComposerAction::AttachmentRemoved { id }, window, cx);
            })
    };

    Card::new()
        .id(("attachment", id.0))
        .status(card_status(attachment.status))
        .progress(attachment.progress * 100.)
        .tooltip(format!("{name}\n{status}"))
        .media(AttachmentMedia::new().child(Icon::new(IconName::File)))
        .content(
            AttachmentContent::new()
                .title(AttachmentTitle::new(name))
                .description(AttachmentDescription::new(status)),
        )
        .actions(AttachmentActions::new().children(retry).child(remove))
        // A failure says what to do next, so its card grows to fit the
        // message instead of cutting it at gpui-kit's fixed chip width.
        .when(attachment.failure().is_some(), Styled::w_auto)
}

/// The files attached to the draft, or nothing when there are none.
pub(super) fn attachment_row(
    attachments: &[Attachment],
    handlers: &Handlers,
    cx: &App,
) -> Option<impl IntoElement> {
    (!attachments.is_empty()).then(|| {
        div().flex().flex_wrap().gap_2().px_2().pt_2().children(
            attachments
                .iter()
                .map(|attachment| attachment_card(attachment, handlers, cx).small()),
        )
    })
}
