// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

//! Drag and drop as a person does it: files dragged in from the desktop,
//! pasted files, and tabs moved with the keyboard and the mouse.

use std::path::{Path, PathBuf};

use composerkit_ui::composer::{
    Composer, ComposerAction, ComposerController, ComposerRequest, ComposerState, Connectivity,
    UploadFailure, UploadStatus,
};
use composerkit_ui::{ChatTab, TabStrip, TitleBar};
use gpui_kit::test::{ElementSnapshot, TestWindowExt as _};
use gpui_kit::{
    AnyWindowHandle, AppContext as _, Bounds, ClipboardEntry, ClipboardItem, Context, ElementId,
    Entity, ExternalPaths, FileDropEvent, InputEvent as _, IntoElement, ParentElement as _, Pixels,
    Point, Render, Styled as _, TestAppContext, Window, WindowBounds, WindowOptions, div, point,
    px, size,
};
use gpui_kit::{MouseButton, MouseDownEvent, MouseMoveEvent, MouseUpEvent, SharedString};

struct Host {
    controller: Entity<ComposerController>,
}

impl Render for Host {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        div().size_full().p(px(16.)).child(Composer::for_controller(
            "composer",
            &self.controller,
            cx,
        ))
    }
}

/// A folder of test files, removed when the test ends.
struct Files(PathBuf);

impl Files {
    fn new(name: &str) -> Self {
        let path =
            std::env::temp_dir().join(format!("composerkit-dnd-{name}-{}", std::process::id()));
        std::fs::create_dir_all(&path).expect("create test folder");
        Self(path)
    }

    fn file(&self, name: &str, size_bytes: u64) -> PathBuf {
        let path = self.0.join(name);
        std::fs::File::create(&path)
            .and_then(|file| file.set_len(size_bytes))
            .expect("create file");
        path
    }
}

impl Drop for Files {
    fn drop(&mut self) {
        std::fs::remove_dir_all(&self.0).ok();
    }
}

struct App {
    window: AnyWindowHandle,
    controller: Entity<ComposerController>,
    files: Files,
}

impl App {
    fn open(name: &str, cx: &mut TestAppContext) -> Self {
        cx.update(|cx| {
            gpui_kit::init(cx);
            composerkit_theme::init(cx);
        });
        let controller =
            cx.update(|cx| cx.new(|_| ComposerController::new(ComposerState::default())));
        let host = controller.clone();
        let window = cx.update(|cx| {
            let bounds = Bounds {
                origin: Point::default(),
                size: size(px(900.), px(600.)),
            };
            gpui_kit::open_window(
                WindowOptions {
                    window_bounds: Some(WindowBounds::Windowed(bounds)),
                    ..Default::default()
                },
                cx,
                move |_, cx| {
                    cx.new(|cx| {
                        // The host draws the controller's state, as an app does.
                        cx.observe(&host, |_, _, cx| cx.notify()).detach();
                        Host { controller: host }
                    })
                },
            )
            .expect("open test window")
            .0
        });
        let app = Self {
            window,
            controller,
            files: Files::new(name),
        };
        // The composer sizes itself from the frame before.
        for _ in 0..3 {
            app.frame(cx);
        }
        app
    }

    fn frame(&self, cx: &mut TestAppContext) {
        cx.update_window(self.window, |_, window, cx| window.render_frame(cx))
            .expect("render frame");
    }

    fn send(&self, event: FileDropEvent, cx: &mut TestAppContext) {
        cx.update_window(self.window, |_, window, cx| {
            window.dispatch_event(event.to_platform_input(), cx);
            window.render_frame(cx);
        })
        .expect("dispatch file drop");
    }

    /// The drop overlay's bounds, while it shows.
    fn overlay(&self, cx: &mut TestAppContext) -> Option<Bounds<Pixels>> {
        let id: ElementId = (ElementId::from("composer"), "drop-overlay").into();
        cx.update_window(self.window, |_, window, _| {
            window
                .try_find(id)
                .filter(ElementSnapshot::visible)
                .map(|overlay| overlay.bounds())
        })
        .expect("read window")
    }

    /// Drags `paths` in at the window's far corner, then drops them on the
    /// composer.
    fn drop_files(&self, paths: &[&Path], cx: &mut TestAppContext) {
        let paths = ExternalPaths(paths.iter().map(|path| path.to_path_buf()).collect());
        self.send(
            FileDropEvent::Entered {
                position: far_corner(),
                paths,
            },
            cx,
        );
        let target = self.overlay(cx).expect("the composer lit up").center();
        self.send(FileDropEvent::Pending { position: target }, cx);
        self.send(FileDropEvent::Submit { position: target }, cx);
        self.settle(cx);
    }

    /// Runs the size reads that attaching starts, then draws the result.
    fn settle(&self, cx: &mut TestAppContext) {
        cx.run_until_parked();
        self.frame(cx);
    }

    fn paste(&self, item: ClipboardItem, cx: &mut TestAppContext) {
        cx.write_to_clipboard(item);
        cx.update_window(self.window, |_, window, cx| window.press("cmd-v", cx))
            .expect("paste");
        self.settle(cx);
    }

    fn attachments(&self, cx: &mut TestAppContext) -> Vec<(String, UploadStatus)> {
        cx.update(|cx| {
            self.controller
                .read(cx)
                .state()
                .attachments
                .iter()
                .map(|attachment| (attachment.name.clone(), attachment.status))
                .collect()
        })
    }
}

fn far_corner() -> Point<Pixels> {
    point(px(890.), px(590.))
}

#[gpui_kit::test]
fn files_dragged_into_the_window_light_up_the_composer_and_attach_when_dropped_on_it(
    cx: &mut TestAppContext,
) {
    let app = App::open("drop", cx);
    let notes = app.files.file("notes.txt", 5);
    let plan = app.files.file("plan.md", 12);

    assert!(app.overlay(cx).is_none(), "no overlay before a drag");
    app.drop_files(&[&notes, &plan], cx);

    assert_eq!(
        app.attachments(cx),
        [
            ("notes.txt".into(), UploadStatus::Uploading),
            ("plan.md".into(), UploadStatus::Uploading),
        ]
    );
    assert!(
        app.overlay(cx).is_none(),
        "the overlay goes once the files drop"
    );
}

#[gpui_kit::test]
fn files_that_leave_the_window_put_the_composer_back_and_attach_nothing(cx: &mut TestAppContext) {
    let app = App::open("leave", cx);
    let notes = app.files.file("notes.txt", 5);

    app.send(
        FileDropEvent::Entered {
            position: far_corner(),
            paths: ExternalPaths([notes].into_iter().collect()),
        },
        cx,
    );
    assert!(app.overlay(cx).is_some(), "the composer lights up at once");

    app.send(FileDropEvent::Exited, cx);
    assert!(app.overlay(cx).is_none(), "the overlay goes with the files");
    assert_eq!(app.attachments(cx), []);
}

#[gpui_kit::test]
fn a_dropped_file_over_25_mb_attaches_as_too_large(cx: &mut TestAppContext) {
    let app = App::open("large", cx);
    let video = app.files.file("video.mov", 26 * 1024 * 1024);

    app.drop_files(&[&video], cx);

    assert_eq!(
        app.attachments(cx),
        [(
            "video.mov".into(),
            UploadStatus::Failed(UploadFailure::TooLarge)
        )]
    );
}

#[gpui_kit::test]
fn a_dropped_folder_attaches_nothing(cx: &mut TestAppContext) {
    let app = App::open("folder", cx);
    let folder = app.files.0.join("photos");
    std::fs::create_dir_all(&folder).expect("create folder");

    app.drop_files(&[&folder], cx);

    assert_eq!(app.attachments(cx), []);
}

#[gpui_kit::test]
fn files_dropped_while_a_message_sends_attach_nothing(cx: &mut TestAppContext) {
    let app = App::open("sending", cx);
    let notes = app.files.file("notes.txt", 5);
    cx.update(|cx| {
        app.controller.update(cx, |controller, cx| {
            // Offline, the send waits on a timer that never fires here, so it
            // is still sending when the files drop.
            controller.set_connectivity(Connectivity::Offline, cx);
            let draft = "Ship it".to_string();
            controller.dispatch(ComposerAction::DraftChanged { draft }, cx);
            controller.request(ComposerRequest::Submit, cx);
        });
    });
    app.frame(cx);

    app.drop_files(&[&notes], cx);

    assert_eq!(app.attachments(cx), []);
}

#[gpui_kit::test]
fn a_pasted_file_attaches_and_pasted_text_attaches_nothing(cx: &mut TestAppContext) {
    let app = App::open("paste", cx);
    let notes = app.files.file("notes.txt", 5);
    cx.update_window(app.window, |_, window, cx| window.click("input-state", cx))
        .expect("focus the field");

    app.paste(
        ClipboardItem {
            entries: vec![ClipboardEntry::ExternalPaths(ExternalPaths(
                [notes].into_iter().collect(),
            ))],
        },
        cx,
    );
    assert_eq!(
        app.attachments(cx),
        [("notes.txt".into(), UploadStatus::Uploading)]
    );

    // Text goes to the field as before. The headless window takes no text
    // input, so this checks only that a text paste attaches nothing.
    app.paste(ClipboardItem::new_string("hello".into()), cx);
    assert_eq!(app.attachments(cx).len(), 1);
}

/// A title bar with three tabs that move in the host's own list, as the
/// catalog's do.
struct TabsHost {
    tabs: Vec<ChatTab>,
    active: SharedString,
}

impl Render for TabsHost {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let select = cx.entity().downgrade();
        let moves = select.clone();
        let strip = TabStrip::new("tabs", self.tabs.clone())
            .active(self.active.clone())
            .on_select(move |id, _, cx| {
                select
                    .update(cx, |this, cx| {
                        this.active = id.clone();
                        cx.notify();
                    })
                    .ok();
            })
            .on_move(move |id, to, _, cx| {
                moves
                    .update(cx, |this, cx| {
                        if let Some(from) = this.tabs.iter().position(|tab| &tab.id == id) {
                            let tab = this.tabs.remove(from);
                            this.tabs.insert(to, tab);
                            cx.notify();
                        }
                    })
                    .ok();
            });
        div().size_full().child(TitleBar::new(strip))
    }
}

struct TabsApp {
    window: AnyWindowHandle,
    host: Entity<TabsHost>,
}

impl TabsApp {
    fn open(cx: &mut TestAppContext) -> Self {
        cx.update(|cx| {
            gpui_kit::init(cx);
            composerkit_theme::init(cx);
        });
        let (window, host) = cx.update(|cx| {
            let bounds = Bounds {
                origin: Point::default(),
                size: size(px(900.), px(600.)),
            };
            let (window, host) = gpui_kit::open_window(
                WindowOptions {
                    window_bounds: Some(WindowBounds::Windowed(bounds)),
                    ..Default::default()
                },
                cx,
                |_, cx| {
                    cx.new(|_| TabsHost {
                        tabs: vec![
                            ChatTab::new("a", "Alpha"),
                            ChatTab::new("b", "Beta"),
                            ChatTab::new("c", "Gamma"),
                        ],
                        active: "a".into(),
                    })
                },
            )
            .expect("open test window");
            (window, host)
        });
        let app = Self { window, host };
        app.frame(cx);
        app.frame(cx);
        app
    }

    fn frame(&self, cx: &mut TestAppContext) {
        cx.update_window(self.window, |_, window, cx| window.render_frame(cx))
            .expect("render frame");
    }

    fn order(&self, cx: &mut TestAppContext) -> Vec<String> {
        cx.update(|cx| {
            self.host
                .read(cx)
                .tabs
                .iter()
                .map(|tab| tab.id.to_string())
                .collect()
        })
    }

    fn active(&self, cx: &mut TestAppContext) -> String {
        cx.update(|cx| self.host.read(cx).active.to_string())
    }

    /// The middle of tab `index`. Every tab is the token's tab width wide.
    fn tab_center(&self, index: usize, cx: &mut TestAppContext) -> Point<Pixels> {
        let id: ElementId = (ElementId::from("tabs"), "keys").into();
        let strip = cx
            .update_window(self.window, |_, window, _| {
                window.try_find(id).map(|strip| strip.bounds())
            })
            .expect("read window")
            .expect("the tab strip is drawn");
        let width = composerkit_theme::tokens().size.tab_width;
        #[allow(clippy::cast_precision_loss)]
        let x = strip.left() + px(1. + width * (index as f32 + 0.5));
        point(x, strip.center().y)
    }

    fn send(&self, event: impl gpui_kit::InputEvent, cx: &mut TestAppContext) {
        cx.update_window(self.window, |_, window, cx| {
            window.dispatch_event(event.to_platform_input(), cx);
            window.render_frame(cx);
        })
        .expect("dispatch mouse event");
    }

    /// Presses at `from`, moves to `to`, and releases there.
    fn drag(&self, from: Point<Pixels>, to: Point<Pixels>, cx: &mut TestAppContext) {
        self.send(
            MouseDownEvent {
                button: MouseButton::Left,
                position: from,
                click_count: 1,
                ..Default::default()
            },
            cx,
        );
        for step in 1..=4u8 {
            let along = f32::from(step) / 4.;
            self.send(
                MouseMoveEvent {
                    position: from + (to - from) * along,
                    pressed_button: Some(MouseButton::Left),
                    ..Default::default()
                },
                cx,
            );
        }
        self.send(
            MouseUpEvent {
                button: MouseButton::Left,
                position: to,
                click_count: 1,
                ..Default::default()
            },
            cx,
        );
    }

    /// Clicks tab `index`, which opens it and focuses the strip.
    fn click(&self, index: usize, cx: &mut TestAppContext) {
        let center = self.tab_center(index, cx);
        self.drag(center, center, cx);
    }

    fn press(&self, keys: &str, cx: &mut TestAppContext) {
        cx.update_window(self.window, |_, window, cx| {
            window.press(keys, cx);
            window.render_frame(cx);
        })
        .expect("press keys");
    }
}

#[gpui_kit::test]
fn ctrl_shift_arrows_move_the_open_tab_and_stop_at_the_ends(cx: &mut TestAppContext) {
    let app = TabsApp::open(cx);
    app.click(0, cx);

    app.press("ctrl-shift-right", cx);
    assert_eq!(app.order(cx), ["b", "a", "c"]);
    assert_eq!(app.active(cx), "a", "the moved tab stays open");

    app.press("ctrl-shift-left", cx);
    app.press("ctrl-shift-left", cx);
    assert_eq!(app.order(cx), ["a", "b", "c"], "the first tab doesn't wrap");
}

#[gpui_kit::test]
fn dragging_a_tab_past_the_next_one_moves_it_there(cx: &mut TestAppContext) {
    let app = TabsApp::open(cx);
    let from = app.tab_center(0, cx);
    let past_second = app.tab_center(1, cx) + point(px(10.), px(0.));

    app.drag(from, past_second, cx);

    assert_eq!(app.order(cx), ["b", "a", "c"]);
}

#[gpui_kit::test]
fn a_one_pixel_move_is_a_click_that_opens_the_tab(cx: &mut TestAppContext) {
    let app = TabsApp::open(cx);
    let second = app.tab_center(1, cx);

    app.drag(second, second + point(px(1.), px(0.)), cx);

    assert_eq!(app.order(cx), ["a", "b", "c"]);
    assert_eq!(app.active(cx), "b");
}

#[gpui_kit::test]
fn a_tab_released_far_below_the_strip_moves_nothing(cx: &mut TestAppContext) {
    let app = TabsApp::open(cx);
    let from = app.tab_center(0, cx);

    app.drag(from, point(app.tab_center(2, cx).x, px(500.)), cx);

    assert_eq!(app.order(cx), ["a", "b", "c"]);
}
