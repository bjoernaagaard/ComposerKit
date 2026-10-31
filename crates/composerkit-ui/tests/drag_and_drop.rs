// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

//! Drag and drop as a person does it: files dragged in from the desktop,
//! pasted files, and tabs moved with the keyboard and the mouse.

use std::path::{Path, PathBuf};

use composerkit_ui::composer::{
    Composer, ComposerAction, ComposerController, ComposerRequest, ComposerState, Connectivity,
    UploadFailure, UploadStatus,
};
use gpui_kit::test::{ElementSnapshot, TestWindowExt as _};
use gpui_kit::{
    AnyWindowHandle, AppContext as _, Bounds, ClipboardEntry, ClipboardItem, Context, ElementId,
    Entity, ExternalPaths, FileDropEvent, InputEvent as _, IntoElement, ParentElement as _, Pixels,
    Point, Render, Styled as _, TestAppContext, Window, WindowBounds, WindowOptions, div, point,
    px, size,
};

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
