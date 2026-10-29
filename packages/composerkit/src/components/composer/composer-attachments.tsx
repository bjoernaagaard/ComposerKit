// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

import { FileIcon, RotateCwIcon, TriangleAlertIcon, XIcon } from "lucide-react";

import { canRetry, MAX_UPLOAD_BYTES } from "@/components/composer/machine";
import type { Attachment, ComposerAction } from "@/components/composer/machine";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils";

const KILOBYTE = 1024;
const MEGABYTE = KILOBYTE * KILOBYTE;
const PERCENT = 100;

export const formatSize = (bytes: number): string => {
  if (bytes >= MEGABYTE) {
    return `${(bytes / MEGABYTE).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(bytes / KILOBYTE))} KB`;
};

const statusText = (attachment: Attachment): string => {
  if (attachment.status === "uploading") {
    return `${Math.round(attachment.progress * PERCENT)}% uploaded`;
  }

  if (attachment.failure === "tooLarge") {
    return `Larger than ${MAX_UPLOAD_BYTES / MEGABYTE} MB. Remove it and pick a smaller file.`;
  }

  if (attachment.failure === "offline") {
    return "The upload stopped because the connection dropped. Retry once you’re online.";
  }

  return formatSize(attachment.sizeBytes);
};

// Failed uploads are announced, because the chip text changes silently.
export const failureNotice = (attachments: Attachment[]): string =>
  attachments
    .flatMap((item) =>
      item.status === "failed" ? [`${item.name}: ${statusText(item)}`] : []
    )
    .join(" ");

const AttachmentChip = ({
  attachment,
  dispatch,
  onRetry,
}: {
  attachment: Attachment;
  dispatch: (action: ComposerAction) => void;
  onRetry: (id: string) => void;
}) => {
  const failed = attachment.status === "failed";
  const StatusIcon = failed ? TriangleAlertIcon : FileIcon;

  return (
    <li
      className={cn(
        "flex max-w-full min-w-0 items-center gap-2 rounded-(--radius-control) py-1.5 pr-1 pl-2",
        failed ? "bg-accent" : "bg-muted"
      )}
    >
      <StatusIcon
        aria-hidden="true"
        className={cn(
          "size-4 shrink-0",
          failed ? "text-destructive" : "text-subtle-foreground"
        )}
      />
      <span className="flex min-w-0 flex-col">
        <span className="text-(length:--text-label-size) leading-(--text-label-leading) wrap-anywhere">
          {attachment.name}
        </span>
        <span
          className={cn(
            "text-(length:--text-caption-size) leading-(--text-caption-leading) tabular-nums",
            failed ? "text-destructive" : "text-subtle-foreground"
          )}
        >
          {statusText(attachment)}
        </span>
      </span>
      {attachment.status === "uploading" ? (
        <progress
          aria-label={`Uploading ${attachment.name}`}
          className="sr-only"
          max={1}
          value={attachment.progress}
        />
      ) : null}
      {canRetry(attachment) ? (
        <IconButton
          icon={RotateCwIcon}
          kind="small"
          label={`Upload ${attachment.name} again`}
          onClick={() => onRetry(attachment.id)}
        />
      ) : null}
      <IconButton
        icon={XIcon}
        kind="small"
        label={`Remove ${attachment.name}`}
        onClick={() =>
          dispatch({ id: attachment.id, type: "attachmentRemoved" })
        }
      />
    </li>
  );
};

export const ComposerAttachments = ({
  attachments,
  dispatch,
  onRetry,
}: {
  attachments: Attachment[];
  dispatch: (action: ComposerAction) => void;
  onRetry: (id: string) => void;
}) => {
  if (attachments.length === 0) {
    return null;
  }

  return (
    <ul
      aria-label="Attached files"
      className="flex flex-wrap gap-2 px-2 pt-2"
      data-slot="composer-attachments"
    >
      {attachments.map((attachment) => (
        <AttachmentChip
          attachment={attachment}
          dispatch={dispatch}
          key={attachment.id}
          onRetry={onRetry}
        />
      ))}
    </ul>
  );
};
