// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

//! Types into the catalog's live composer from inside the process and fails
//! when the draws it caused take more than the budget at p95. Run with
//! `cargo run --release --example frame_budget --features profiler`.

#[path = "catalog.rs"]
#[expect(dead_code, reason = "the catalog's own `main` is not called here")]
mod catalog;

use std::cell::Cell;
use std::process::ExitCode;
use std::rc::Rc;
use std::time::Duration;

use catalog::Catalog;
use composerkit_ui::Mode;
use composerkit_ui::composer::{ComposerAction, ComposerController, ComposerRequest};
use gpui_kit::{AnyWindowHandle, AsyncApp, Entity, Keystroke, Window};

/// The most a draw caused by one keystroke may take at p95.
const BUDGET: Duration = Duration::from_millis(4);
const TYPED: &str = "list every place the sync client gives up too soon";
const KEY_INTERVAL: Duration = Duration::from_millis(50);
const STARTUP: Duration = Duration::from_secs(3);
const IDLE: Duration = Duration::from_secs(2);
/// Long enough for the frames a change schedules after itself.
const AFTERMATH: Duration = Duration::from_millis(300);
/// Focus stops to try before giving up on finding the live composer.
const MAX_FOCUS_STOPS: usize = 300;

fn main() -> ExitCode {
    catalog::run(|window, catalog, cx| {
        cx.spawn(async move |cx| {
            let code = match drive(window, &catalog, cx).await {
                Ok(true) => 0,
                Ok(false) => 1,
                Err(error) => {
                    eprintln!("frame_budget: {error:#}");
                    2
                }
            };
            std::process::exit(code);
        })
        .detach();
    });
    ExitCode::FAILURE
}

/// Draw durations recorded so far, to subtract from a later snapshot.
type Draws = gpui_kit::FrameDurationSnapshot;

struct Driver {
    window: AnyWindowHandle,
    /// The window is hidden, so the platform asks for no frames and the
    /// driver draws after each change itself.
    forced_draws: bool,
}

impl Driver {
    fn with_window<R>(
        &self,
        cx: &mut AsyncApp,
        update: impl FnOnce(&mut Window, &mut gpui_kit::App) -> R,
    ) -> Result<R, String> {
        self.window
            .update(cx, |_, window, cx| update(window, cx))
            .map_err(|error| error.to_string())
    }

    fn snapshot(&self, cx: &mut AsyncApp) -> Result<Draws, String> {
        self.with_window(cx, |window, _| window.frame_duration_snapshot())
    }

    fn draw_if_forced(&self, cx: &mut AsyncApp) -> Result<(), String> {
        if self.forced_draws {
            self.with_window(cx, |window, cx| window.draw(cx).clear(cx))?;
        }
        Ok(())
    }

    fn key(&self, cx: &mut AsyncApp, key: &str, key_char: Option<&str>) -> Result<(), String> {
        let keystroke = Keystroke {
            key: key.to_owned(),
            key_char: key_char.map(str::to_owned),
            ..Keystroke::default()
        };
        self.with_window(cx, |window, cx| window.dispatch_keystroke(keystroke, cx))?;
        self.draw_if_forced(cx)
    }

    fn character(&self, cx: &mut AsyncApp, character: char) -> Result<(), String> {
        let text = character.to_string();
        let key = if character == ' ' { "space" } else { &text };
        self.key(cx, key, Some(&text))
    }
}

async fn pause(cx: &AsyncApp, duration: Duration) {
    cx.background_executor().timer(duration).await;
}

fn draft(live: &Entity<ComposerController>, cx: &AsyncApp) -> String {
    live.read_with(cx, |live, _| live.state().draft.clone())
}

/// Moves focus one stop at a time and types a probe character, until the
/// second text box that reaches the live controller has focus. The first is
/// the home composer and the second is the one in the Composer section.
async fn focus_live_composer(
    driver: &Driver,
    live: &Entity<ComposerController>,
    cx: &mut AsyncApp,
) -> Result<(), String> {
    let mut found = 0;
    for _ in 0..MAX_FOCUS_STOPS {
        driver.with_window(cx, Window::focus_next)?;
        driver.draw_if_forced(cx)?;
        driver.character(cx, 'z')?;
        pause(cx, Duration::from_millis(10)).await;
        if draft(live, cx) == "z" {
            driver.key(cx, "backspace", None)?;
            pause(cx, Duration::from_millis(10)).await;
            found += 1;
            if found == 2 {
                return Ok(());
            }
        }
    }
    Err("no focus stop reached the live composer's text box".to_owned())
}

/// Prints the draw count, p50, p95 and max of the draws between two
/// snapshots, and returns the p95.
fn report(phase: &str, before: &Draws, after: &Draws) -> Result<Duration, String> {
    let mut draws = after.draw_duration_histogram.clone();
    draws
        .subtract(&before.draw_duration_histogram)
        .map_err(|error| format!("{error:?}"))?;
    if draws.is_empty() {
        println!("{phase}: 0 draws");
        return Ok(Duration::ZERO);
    }
    let ms = |nanos| {
        format!(
            "{:.2} ms",
            Duration::from_nanos(nanos).as_secs_f64() * 1000.
        )
    };
    let p95 = draws.value_at_quantile(0.95);
    println!(
        "{phase}: {} draws, p50 {}, p95 {}, max {}",
        draws.len(),
        ms(draws.value_at_quantile(0.5)),
        ms(p95),
        ms(draws.max()),
    );
    Ok(Duration::from_nanos(p95))
}

async fn drive(
    window: AnyWindowHandle,
    catalog: &Entity<Catalog>,
    cx: &mut AsyncApp,
) -> Result<bool, String> {
    pause(cx, STARTUP).await;
    let hidden = window
        .update(cx, |_, window, _| !window.visibility().is_visible())
        .map_err(|error| error.to_string())?;
    let driver = Driver {
        window,
        forced_draws: hidden,
    };
    if hidden {
        println!(
            "The window is hidden (display off or locked), so no frame is presented. \
             The driver calls window.draw after each change, and every number is CPU time \
             of Window::draw."
        );
    }

    let (live, conversation) = catalog.read_with(cx, |catalog, cx| {
        (
            catalog.composers.read(cx).live.clone(),
            catalog.conversation.clone(),
        )
    });
    focus_live_composer(&driver, &live, cx).await?;
    pause(cx, AFTERMATH).await;

    let before = driver.snapshot(cx)?;
    pause(cx, IDLE).await;
    report("idle, before typing", &before, &driver.snapshot(cx)?)?;

    let before = driver.snapshot(cx)?;
    for character in TYPED.chars() {
        driver.character(cx, character)?;
        pause(cx, KEY_INTERVAL).await;
    }
    pause(cx, AFTERMATH).await;
    let after = driver.snapshot(cx)?;
    let typed = draft(&live, cx);
    if typed != TYPED {
        return Err(format!(
            "the live composer holds {typed:?}, not the {} characters typed",
            TYPED.len()
        ));
    }
    let p95 = report(
        &format!("typing {} characters", TYPED.chars().count()),
        &before,
        &after,
    )?;

    let before = driver.snapshot(cx)?;
    for _ in 0..10 {
        catalog.update(cx, |catalog, cx| {
            catalog.mode = match catalog.mode {
                Mode::Chat => Mode::Work,
                Mode::Work => Mode::Chat,
            };
            cx.notify();
        });
        driver.draw_if_forced(cx)?;
        pause(cx, Duration::from_millis(150)).await;
    }
    pause(cx, AFTERMATH).await;
    report("mode toggle x10", &before, &driver.snapshot(cx)?)?;

    let changed = Rc::new(Cell::new(false));
    let _observer = cx.update(|cx| {
        let changed = changed.clone();
        cx.observe(&conversation, move |_, _| changed.set(true))
    });
    let reply = conversation.read_with(cx, |conversation, _| conversation.composer().clone());
    let before = driver.snapshot(cx)?;
    reply.update(cx, |reply, cx| {
        reply.dispatch(
            ComposerAction::DraftChanged {
                draft: "Stream a reply".to_owned(),
            },
            cx,
        );
        reply.request(ComposerRequest::Submit, cx);
    });
    for _ in 0..600 {
        pause(cx, Duration::from_millis(5)).await;
        if changed.replace(false) {
            driver.draw_if_forced(cx)?;
        }
    }
    report("send and stream a reply", &before, &driver.snapshot(cx)?)?;

    let within = p95 <= BUDGET;
    println!(
        "typing p95 {} the {} ms budget",
        if within { "is within" } else { "is over" },
        BUDGET.as_millis()
    );
    Ok(within)
}
