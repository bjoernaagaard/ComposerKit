// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

use super::turn::{Block, ListStyle, Turn, TurnAttachment};

const RETRY_LOOP: &str = r"pub async fn send_with_retry(&self, request: Request) -> Result<Response, SyncError> {
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
}";

const BACKOFF: &str = r"fn backoff(attempt: u32) -> Duration {
    let ceiling = BASE_DELAY.saturating_mul(1 << attempt.min(5)).min(MAX_DELAY);
    ceiling.mul_f64(rand::random::<f64>())
}";

const RETRY_AFTER: &str = r"fn retry_after(response: &Response) -> Option<Duration> {
    let value = response.headers().get(RETRY_AFTER)?.to_str().ok()?;
    if let Ok(seconds) = value.parse::<u64>() {
        return Some(Duration::from_secs(seconds));
    }
    let date = httpdate::parse_http_date(value).ok()?;
    date.duration_since(SystemTime::now()).ok()
}";

const COMMIT: &str = "Retry failed sync requests with backoff

The sync client gave up on the first timeout or 503. It now tries up
to five times and waits a random time below a doubling ceiling, so
clients spread out after an outage. A Retry-After header from the
server wins over our own wait.

Requests with a streaming body are not retried.";

fn user(text: &str) -> Turn {
    Turn::user(text, [])
}

/// The chat the web demo opens, from `src/content/conversation.ts`: "Add
/// retries to the sync client", eight turns with a list, code blocks and an
/// attachment.
#[must_use]
pub fn sample_turns() -> Vec<Turn> {
    vec![
        Turn::user(
            "Our sync client gives up on the first network error. Can you add retries without hammering the server?",
            [TurnAttachment::new("sync_client.rs", "12 KB")],
        ),
        Turn::assistant([
            Block::paragraph(
                "Here is the plan: retry only errors that can clear up on their own, wait longer after each try, and add some randomness so clients don’t all retry at once.",
            ),
            Block::list(
                ListStyle::Numbered,
                [
                    "Retry timeouts, dropped connections and `503` responses. Leave other `4xx` errors alone, except `429`, because sending the same request again gets the same answer.",
                    "Wait up to `base * 2^attempt`, capped at 30 seconds, and pick a random point below that.",
                    "Stop after five tries and return the last error, so the caller decides what to show.",
                ],
            ),
            Block::paragraph("The loop looks like this:"),
            Block::code("rust", RETRY_LOOP),
            Block::paragraph(
                "`try_clone` returns `None` for a streaming body, so an upload fails at once instead of sending half a file twice.",
            ),
        ]),
        user("Why the random part? Plain doubling seems simpler."),
        Turn::assistant([
            Block::paragraph(
                "With plain doubling, every client that failed at the same moment also retries at the same moment. After an outage, thousands of requests land in the same second, over and over. A random wait spreads them out.",
            ),
            Block::paragraph("This version picks any wait between zero and the ceiling:"),
            Block::code("rust", BACKOFF),
        ]),
        user("Should it respect the Retry-After header?"),
        Turn::assistant([
            Block::paragraph(
                "Yes. When the server sends `Retry-After`, it knows more than our guess, so wait at least that long. The header comes in two forms, a number of seconds or an HTTP date, and this reads both:",
            ),
            Block::code("rust", RETRY_AFTER),
        ]),
        user("Write a commit message for this."),
        Turn::assistant([
            Block::paragraph("Here is one:"),
            Block::code("text", COMMIT),
            Block::paragraph(
                "I can also log each retry, so they show up when someone sends you their logs.",
            ),
        ]),
    ]
}

/// No model is attached, so a sent message gets this reply.
pub(super) fn placeholder_reply() -> Turn {
    Turn::assistant([Block::paragraph(
        "This demo has no model behind it, so this answer is a stand-in. Your message stays in the conversation above.",
    )])
}
