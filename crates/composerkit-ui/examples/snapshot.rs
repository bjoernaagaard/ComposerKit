// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

//! Capture the app shell with GPUI's offscreen renderer.
use std::{path::PathBuf, sync::Arc};

use composerkit_ui::composer::{ComposerAction, ComposerController, ComposerState};
use composerkit_ui::conversation::{ConversationView, sample_turns};
use composerkit_ui::{
    ChatTab, ConversationRow, Destination, IconRail, Project, ProjectList, SidebarSection,
    SidebarVisibility, TabStrip, TitleBar, home_view,
};
use gpui_kit::InputEvent as _;
use gpui_kit::assets::IconName;
use gpui_kit::component::ActiveTheme as _;
use gpui_kit::component::button::{Button, ButtonVariants as _};
use gpui_kit::component::{Icon, Selectable as _, Sizable as _};
use gpui_kit::test::TestWindowExt as _;
use gpui_kit::{
    AppContext as _, Context, Entity, HeadlessAppContext, InteractiveElement as _, IntoElement,
    ParentElement as _, Render, StatefulInteractiveElement as _, Styled as _, Window, div,
    prelude::FluentBuilder as _, px, size,
};

const DRAFT: &str = "Read the sync client and list every place it gives up after one failed request.\nMark the ones that also lose data.\nKeep it short.";
/// One long line, which wraps to several in the docked composer.
const LONG_DRAFT: &str = "Go through the sync client one function at a time and list every place where a single failed request ends the whole sync, then say for each one whether the data it was carrying is kept for the next try or dropped, and what the user sees when that happens, because the support team keeps hearing about notes that vanish after a train ride and nobody has been able to say where they go.";
/// The screens that show a conversation rather than the home view.
const CONVERSATION_SCREENS: [&str; 4] = [
    "conversation",
    "composer-streaming",
    "composer-long",
    "composer-expanded",
];
const CHATS: [(&str, &str); 13] = [
    ("c1", "Pack list for a weekend of hiking"),
    ("c2", "Add retries to the sync client"),
    ("c3", "Outline the talk on local-first apps"),
    ("c4", "Why does my sourdough collapse in the oven?"),
    ("c5", "Split the settings page into tabs"),
    ("c6", "Fix the date picker in Firefox"),
    ("c7", "Summarize the notes from Tuesday's planning call"),
    ("c8", "Turn the onboarding steps into a checklist"),
    ("c9", "Name ideas for a plant-watering app"),
    ("c10", "Compare three ways to store user preferences"),
    ("c11", "Plan meals for a week on a budget"),
    ("c12", "Make the sidebar keyboard friendly"),
    ("c13", "Shorten the release notes for 0.3"),
];

struct Snapshot {
    composer: Entity<ComposerController>,
    conversation: Entity<ConversationView>,
    screen: &'static str,
    narrow: bool,
}

impl Snapshot {
    fn new(screen: &'static str, narrow: bool, cx: &mut Context<Self>) -> Self {
        let composer = cx.new(|_| ComposerController::new(ComposerState::default()));
        cx.observe(&composer, |_, _, cx| cx.notify()).detach();
        composer.update(cx, |controller, cx| {
            if screen == "composer-draft" {
                controller.dispatch(
                    ComposerAction::DraftChanged {
                        draft: DRAFT.to_owned(),
                    },
                    cx,
                );
            }
        });
        Self {
            composer,
            conversation: cx.new(|cx| {
                let mut turns = sample_turns();
                if screen == "composer-streaming" {
                    turns.truncate(2);
                }
                let mut view = ConversationView::new(turns, cx);
                if screen == "composer-streaming" {
                    view.retry_last_reply(cx);
                }
                if ["composer-long", "composer-expanded"].contains(&screen) {
                    view.composer().update(cx, |composer, cx| {
                        composer.dispatch(
                            ComposerAction::DraftChanged {
                                draft: LONG_DRAFT.to_owned(),
                            },
                            cx,
                        );
                        composer.dispatch(
                            ComposerAction::ExpandedChanged {
                                expanded: screen == "composer-expanded",
                            },
                            cx,
                        );
                    });
                }
                view
            }),
            screen,
            narrow,
        }
    }

    fn sidebar(&self, cx: &mut Context<Self>) -> impl IntoElement + use<> {
        let pinned = ConversationRow::new(CHATS[0].0, CHATS[0].1).pinned(true);
        let rows: Vec<_> = CHATS
            .iter()
            .skip(1)
            .map(|&(id, label)| {
                ConversationRow::new(id, label)
                    .selected(id == "c2" && CONVERSATION_SCREENS.contains(&self.screen))
            })
            .collect();
        div()
            .id("sidebar")
            .flex()
            .flex_col()
            .gap_2()
            .w(px(composerkit_theme::tokens().size.sidebar))
            .h_full()
            .p(px(composerkit_theme::tokens().space.sidebar_padding))
            .overflow_y_scroll()
            .bg(cx.theme().sidebar)
            .child(SidebarSection::new("pinned", "Pinned").child(pinned))
            .child(
                SidebarSection::new("projects-section", "Projects")
                    .action(
                        Button::new("add-project")
                            .ghost()
                            .xsmall()
                            .icon(Icon::new(IconName::FolderPlus))
                            .tooltip("Add new project")
                            .accessibility_label("Add new project"),
                    )
                    .child(ProjectList::new(
                        "projects",
                        vec![
                            Project::new("shrok", "shrok"),
                            Project::new("garden-planner", "garden-planner"),
                        ],
                    )),
            )
            .child(
                SidebarSection::new("recents", "Recent")
                    .action(
                        Button::new("new-chat")
                            .ghost()
                            .xsmall()
                            .icon(Icon::new(IconName::Plus))
                            .tooltip("New chat")
                            .accessibility_label("New chat"),
                    )
                    .children(rows),
            )
    }
}
impl Render for Snapshot {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let title = if CONVERSATION_SCREENS.contains(&self.screen) {
            CHATS[1].1
        } else {
            "New chat"
        };
        let tabs = TabStrip::new("tabs", vec![ChatTab::new("home", title)]).active("home");
        let title = TitleBar::new(tabs).sidebar_toggle(SidebarVisibility::Shown, |_, _, _| {});
        let sidebar = self.sidebar(cx);
        let home = home_view(&self.composer, self.narrow, cx);
        div()
            .size_full()
            .flex()
            .flex_col()
            .bg(cx.theme().title_bar)
            .text_color(cx.theme().foreground)
            .child(title)
            .child(
                div()
                    .flex()
                    .flex_1()
                    .min_h_0()
                    .child(IconRail::new("rail").active(Destination::default()))
                    .when(!self.narrow, |body| body.child(sidebar))
                    .child(
                        div()
                            .flex_1()
                            .min_w_0()
                            .h_full()
                            .bg(cx.theme().background)
                            .when(CONVERSATION_SCREENS.contains(&self.screen), |body| {
                                body.child(self.conversation.clone())
                            })
                            .when(!CONVERSATION_SCREENS.contains(&self.screen), |body| {
                                body.child(home)
                            }),
                    ),
            )
    }
}

fn main() {
    let out = PathBuf::from(
        std::env::args_os()
            .nth(1)
            .expect("pass an output directory"),
    );
    std::fs::create_dir_all(&out).expect("create output directory");
    let mut cx = HeadlessAppContext::with_platform(
        gpui_kit::platform::current_platform(true).text_system(),
        Arc::new(composerkit_ui::Assets),
        || {
            Ok(
                gpui_kit::platform::current_headless_renderer()?.map(|renderer| {
                    Box::new(ScaleOne(renderer)) as Box<dyn gpui_kit::PlatformHeadlessRenderer>
                }),
            )
        },
    );
    cx.update(|cx| {
        gpui_kit::init(cx);
        composerkit_theme::init(cx);
    });
    for (width, height, label) in [(1440., 900., "1440"), (480., 844., "390")] {
        for scheme in ["dark", "light"] {
            cx.update(|cx| {
                composerkit_theme::set_scheme(
                    if scheme == "dark" {
                        composerkit_theme::Scheme::Dark
                    } else {
                        composerkit_theme::Scheme::Light
                    },
                    cx,
                );
            });
            for screen in [
                "home",
                "composer-focused",
                "composer-draft",
                "composer-menu",
                "composer-streaming",
                "composer-long",
                "composer-expanded",
                "conversation",
            ] {
                let handle = cx
                    .open_window(size(px(width), px(height)), move |_, cx| {
                        cx.new(|cx| Snapshot::new(screen, width < 500., cx))
                    })
                    .expect("open offscreen window");
                cx.update_window(handle.into(), |_, window, cx| {
                    window.set_scale_factor(1.);
                    // The composer sizes itself from the frame before, so it
                    // settles on the third.
                    for _ in 0..3 {
                        window.render_frame(cx);
                    }
                    if screen == "conversation" {
                        for _ in 0..12 {
                            window.dispatch_event(
                                gpui_kit::ScrollEvent {
                                    position: gpui_kit::point(px(width - 100.), px(200.)),
                                    delta: gpui_kit::ScrollDelta::Pixels(gpui_kit::point(
                                        px(0.),
                                        px(100_000.),
                                    )),
                                    ..Default::default()
                                }
                                .to_platform_input(),
                                cx,
                            );
                            window.render_frame(cx);
                        }
                    }
                    if ["composer-focused", "composer-menu", "composer-draft"].contains(&screen) {
                        window.click("input-state", cx);
                    }
                })
                .expect("render frame");
                cx.capture_screenshot(handle.into())
                    .expect("capture screenshot")
                    .save(out.join(format!("{screen}-{label}-{scheme}.png")))
                    .expect("save screenshot");
                cx.update_window(handle.into(), |_, window, _| window.remove_window())
                    .expect("close window");
            }
        }
    }
}

// TestPlatform allocates at 2x even when Window's scene is set to 1x.
struct ScaleOne(Box<dyn gpui_kit::PlatformHeadlessRenderer>);
impl gpui_kit::PlatformHeadlessRenderer for ScaleOne {
    fn render_scene_to_image(
        &mut self,
        scene: &gpui_kit::Scene,
        size: gpui_kit::Size<gpui_kit::DevicePixels>,
    ) -> gpui_kit::Result<image::RgbaImage> {
        self.0.render_scene_to_image(
            scene,
            gpui_kit::size(
                gpui_kit::DevicePixels(size.width.0 / 2),
                gpui_kit::DevicePixels(size.height.0 / 2),
            ),
        )
    }
    fn render_scene(
        &mut self,
        scene: &gpui_kit::Scene,
        size: gpui_kit::Size<gpui_kit::DevicePixels>,
    ) -> gpui_kit::Result<()> {
        self.0.render_scene(
            scene,
            gpui_kit::size(
                gpui_kit::DevicePixels(size.width.0 / 2),
                gpui_kit::DevicePixels(size.height.0 / 2),
            ),
        )
    }
    fn sprite_atlas(&self) -> Arc<dyn gpui_kit::PlatformAtlas> {
        self.0.sprite_atlas()
    }
}
