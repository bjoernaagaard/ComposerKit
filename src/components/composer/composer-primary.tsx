// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

import {
  ArrowUpIcon,
  AudioLinesIcon,
  CircleIcon,
  SquareIcon,
} from "lucide-react";
import type { MouseEvent } from "react";

import { canSend, isUploading } from "@/components/composer/machine";
import type { ComposerState } from "@/components/composer/machine";
import { Button } from "@/components/ui/button";
import { Tip } from "@/components/ui/tip";

// Where a reply the composer can stop is in its life.
export type ComposerReplyStatus = "waiting" | "streaming";

const LABEL = {
  send: "Send",
  stop: "Stop reply",
  stopSending: "Stop sending",
  uploading: "Uploads still running",
  voice: "Start voice chat",
} as const;

// A ring while the reply has not started, a square once it streams.
const StopButton = ({
  label,
  waiting,
  onStop,
}: {
  label: string;
  waiting: boolean;
  onStop: (() => void) | undefined;
}) => (
  <Tip label={label} side="top">
    <Button
      aria-label={label}
      data-slot="composer-primary"
      disabled={!onStop}
      focusableWhenDisabled
      onClick={onStop}
      size="icon-composer"
      variant="solid"
    >
      {waiting ? (
        <CircleIcon aria-hidden="true" className="size-3.5" />
      ) : (
        <SquareIcon aria-hidden="true" className="size-3.5 fill-current" />
      )}
    </Button>
  </Tip>
);

// Voice chat is left to the app, so the button says it isn't available.
const VoiceButton = () => (
  <Tip label="Voice chat isn’t available here" side="top">
    <Button
      aria-disabled="true"
      aria-label={LABEL.voice}
      data-slot="composer-primary"
      size="icon-composer"
      variant="solid"
    >
      <AudioLinesIcon aria-hidden="true" className="size-4" />
    </Button>
  </Tip>
);

const SendButton = ({
  state,
  onSend,
}: {
  state: ComposerState;
  onSend: (event: MouseEvent<HTMLButtonElement>) => void;
}) => {
  const ready = canSend(state);
  const uploading = !ready && isUploading(state);

  // While uploads run, Send stays in the tab order so its tooltip can say
  // why it is off. With nothing to send it leaves the tab order.
  return (
    <Tip label={uploading ? LABEL.uploading : LABEL.send} side="top">
      <Button
        aria-label={LABEL.send}
        data-slot="composer-primary"
        disabled={!ready}
        focusableWhenDisabled={uploading}
        onClick={onSend}
        size="icon-composer"
        variant="solid"
      >
        <ArrowUpIcon aria-hidden="true" className="size-3.5" />
      </Button>
    </Tip>
  );
};

const hasContent = (state: ComposerState): boolean =>
  state.draft.trim().length > 0 ||
  state.attachments.some((item) => item.status !== "failed");

// The round button at the end of the composer. It stops a reply that is
// running, and for a moment after one was stopped it stays, disabled. With
// nothing to send it starts voice chat in an empty chat, and is a disabled
// send button in a conversation. Otherwise it sends.
export const PrimaryAction = ({
  state,
  conversation,
  replyStatus,
  settling,
  onStopReply,
  onStopSending,
  onSend,
}: {
  state: ComposerState;
  conversation: boolean;
  replyStatus: ComposerReplyStatus | undefined;
  settling: boolean;
  onStopReply: (() => void) | undefined;
  onStopSending: () => void;
  onSend: (event: MouseEvent<HTMLButtonElement>) => void;
}) => {
  if (onStopReply || settling) {
    return (
      <StopButton
        label={LABEL.stop}
        onStop={onStopReply}
        waiting={replyStatus === "waiting"}
      />
    );
  }

  if (state.phase === "sending") {
    return (
      <StopButton
        label={LABEL.stopSending}
        onStop={onStopSending}
        waiting={false}
      />
    );
  }

  if (!(hasContent(state) || conversation)) {
    return <VoiceButton />;
  }

  return <SendButton onSend={onSend} state={state} />;
};
