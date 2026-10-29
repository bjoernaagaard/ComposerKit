// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

// The chat the demo opens, "Add retries to the sync client" in sample.ts.
// The Rust port shows the same turns, in conversation/sample.rs.

import { toBlocks } from "@/components/conversation/types";
import type {
  BlockContent,
  Turn,
  TurnAttachment,
} from "@/components/conversation/types";

export const SAMPLE_CONVERSATION_ID = "c2";

const paragraph = (text: string): BlockContent => ({ kind: "paragraph", text });

const code = (language: string, source: string): BlockContent => ({
  code: source,
  kind: "code",
  language,
});

const user = (
  id: string,
  text: string,
  attachments: TurnAttachment[] = []
): Turn => ({
  attachments,
  blocks: toBlocks([paragraph(text)]),
  id,
  role: "user",
});

const assistant = (id: string, content: BlockContent[]): Turn => ({
  attachments: [],
  blocks: toBlocks(content),
  id,
  role: "assistant",
});

const RETRY_LOOP = `pub async fn send_with_retry(&self, request: Request) -> Result<Response, SyncError> {
    let mut attempt = 0;
    loop {
        let copy = request.try_clone().ok_or(SyncError::NotRetryable)?;
        match self.send(copy).await {
            Ok(response) if !is_retryable(response.status()) => return Ok(response),
            Ok(response) if attempt + 1 >= MAX_ATTEMPTS => return Ok(response),
            Err(error) if !error.is_retryable() || attempt + 1 >= MAX_ATTEMPTS => return Err(error),
            _ => {}
        }
        tokio::time::sleep(backoff(attempt)).await;
        attempt += 1;
    }
}`;

const BACKOFF = `fn backoff(attempt: u32) -> Duration {
    let ceiling = BASE_DELAY.saturating_mul(1 << attempt.min(5)).min(MAX_DELAY);
    ceiling.mul_f64(rand::random::<f64>())
}`;

const RETRY_AFTER = `fn retry_after(response: &Response) -> Option<Duration> {
    let value = response.headers().get(RETRY_AFTER)?.to_str().ok()?;
    if let Ok(seconds) = value.parse::<u64>() {
        return Some(Duration::from_secs(seconds));
    }
    let date = httpdate::parse_http_date(value).ok()?;
    date.duration_since(SystemTime::now()).ok()
}`;

const COMMIT = `Retry failed sync requests with backoff

The sync client gave up on the first timeout or 503. It now tries up
to five times and waits a random time below a doubling ceiling, so
clients spread out after an outage. A Retry-After header from the
server wins over our own wait.

Requests with a streaming body are not retried.`;

export const SAMPLE_TURNS: Turn[] = [
  user(
    "t1",
    "Our sync client gives up on the first network error. Can you add retries without hammering the server?",
    [{ name: "sync_client.rs", size: "12 KB" }]
  ),
  assistant("t2", [
    paragraph(
      "Here is the plan: retry only errors that can clear up on their own, wait longer after each try, and add some randomness so clients don’t all retry at once."
    ),
    {
      items: [
        "Retry timeouts, dropped connections and `503` responses. Leave other `4xx` errors alone, except `429`, because sending the same request again gets the same answer.",
        "Wait up to `base * 2^attempt`, capped at 30 seconds, and pick a random point below that.",
        "Stop after five tries and return the last error, so the caller decides what to show.",
      ],
      kind: "list",
      ordered: true,
    },
    paragraph("The loop looks like this:"),
    code("rust", RETRY_LOOP),
    paragraph(
      "`try_clone` returns `None` for a streaming body, so an upload fails at once instead of sending half a file twice."
    ),
  ]),
  user("t3", "Why the random part? Plain doubling seems simpler."),
  assistant("t4", [
    paragraph(
      "With plain doubling, every client that failed at the same moment also retries at the same moment. After an outage, thousands of requests land in the same second, over and over. A random wait spreads them out."
    ),
    paragraph("This version picks any wait between zero and the ceiling:"),
    code("rust", BACKOFF),
  ]),
  user("t5", "Should it respect the Retry-After header?"),
  assistant("t6", [
    paragraph(
      "Yes. When the server sends `Retry-After`, it knows more than our guess, so wait at least that long. The header comes in two forms, a number of seconds or an HTTP date, and this reads both:"
    ),
    code("rust", RETRY_AFTER),
  ]),
  user("t7", "Write a commit message for this."),
  assistant("t8", [
    paragraph("Here is one:"),
    code("text", COMMIT),
    paragraph(
      "I can also log each retry, so they show up when someone sends you their logs."
    ),
  ]),
];

// The demo has no model behind it, so every message gets this answer.
export const PLACEHOLDER_REPLY: BlockContent[] = [
  paragraph(
    "This demo has no model behind it, so this answer is a stand-in. Your message stays in the conversation above."
  ),
];
