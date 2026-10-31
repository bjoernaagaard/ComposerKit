// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

//! Native counterpart of the web catalog: the app shell in every option, in
//! the light and the dark scheme. Run with `cargo run --example catalog`.

use std::iter;

use composerkit_ui::composer::{
    Attachment, AttachmentId, Composer, ComposerAction, ComposerController, ComposerLayout,
    ComposerMode, ComposerProject, ComposerState, Connectivity, DictationSupport, Permission,
    Phase, PickedFile, SendFailure, SentMessage, UploadFailure, UploadStatus,
};
use composerkit_ui::conversation::{ConversationLayout, ConversationView, sample_turns};
use composerkit_ui::{
    AppearanceMenu, ChatTab, ConversationRow, RowDensity, SidebarSection, SidebarVisibility,
    TabAppearance, TabStrip, TitleBar,
};
use composerkit_ui::{
    Destination, IconRail, Mode, ModeToggle, ModeToggleAppearance, Project, ProjectList, home_view,
};
use gpui_kit::component::button::{Button, ButtonVariants as _};
use gpui_kit::component::tab::{Tab, TabBar};
use gpui_kit::component::{
    ActiveTheme as _, Selectable as _, Sizable as _, TitleBar as KitTitleBar,
};
use gpui_kit::{
    AnyElement, AnyWindowHandle, App, Empty, Entity, StyleRefinement, Subscription, WeakEntity,
};
use gpui_kit::{
    AppContext as _, Context, FontWeight, InteractiveElement as _, IntoElement, KeyBinding,
    ParentElement as _, Render, SharedString, StatefulInteractiveElement as _, Styled, Window,
    actions, div, prelude::FluentBuilder as _, px,
};

// GPUI leaves Tab unbound, so each app wires focus traversal itself.
actions!(catalog, [FocusNext, FocusPrevious]);

/// Titles from the web catalog's sample data, so both catalogs read alike.
const CHATS: [(&str, &str, &str); 14] = [
    ("c1", "Pack list for a weekend of hiking", "4m"),
    ("c2", "Add retries to the sync client", "23m · shrok"),
    ("c3", "Outline the talk on local-first apps", "1h"),
    ("c4", "Why does my sourdough collapse in the oven?", "3h"),
    (
        "c5",
        "Split the settings page into tabs",
        "6h · garden-planner",
    ),
    (
        "c6",
        "Explain the difference between a process and a thread",
        "10h",
    ),
    ("c7", "Turn the onboarding steps into a checklist", "14h"),
    (
        "c8",
        "Name ideas for a plant-watering app",
        "19h · garden-planner",
    ),
    ("c9", "Fix the date picker in Firefox", "1d"),
    (
        "c10",
        "Summarize the notes from Tuesday’s planning call",
        "1d",
    ),
    (
        "c11",
        "Draft a polite reminder about the unpaid invoice",
        "2d",
    ),
    ("c12", "Compare three ways to store user preferences", "2d"),
    ("c13", "Make the sidebar keyboard friendly", "3d"),
    ("c14", "Debug the websocket that drops after an hour", "3d"),
];

pub(crate) struct Catalog {
    tabs: Vec<ChatTab>,
    active_tab: SharedString,
    active_chat: SharedString,
    density: RowDensity,
    tab_appearance: TabAppearance,
    sidebar: SidebarVisibility,
    pub(crate) composers: Entity<ComposerSection>,
    home: Entity<HomeSection>,
    parts: CatalogParts,
    pub(crate) conversation: Entity<ConversationView>,
    destination: Destination,
    pub(crate) mode: Mode,
    mode_appearance: ModeToggleAppearance,
    projects: Vec<Project>,
    adding_project: bool,
    pinned: Vec<&'static str>,
    archived: Vec<&'static str>,
    /// Holds focus until Tab moves it, so key bindings reach the catalog
    /// before anything has been clicked.
    focus: gpui_kit::FocusHandle,
}

impl Catalog {
    fn new(window: &mut Window, cx: &mut Context<Self>) -> Self {
        cx.observe_window_appearance(window, |_, _, cx| {
            composerkit_theme::sync_system_appearance(cx);
        })
        .detach();
        let focus = cx.focus_handle();
        focus.focus(window, cx);
        let composers = cx.new(ComposerSection::new);
        let live = composers.read(cx).live.clone();
        let home = cx.new(|cx| HomeSection::new(live, cx));
        let catalog = cx.entity();
        let parts = CatalogParts {
            title_bar: cx.new(|cx| CatalogPart::new(&catalog, Self::title_bar, cx)),
            rail: cx.new(|cx| CatalogPart::new(&catalog, Self::rail, cx)),
            sidebar: cx.new(|cx| CatalogPart::new(&catalog, Self::sidebar, cx)),
        };

        Self {
            tabs: CHATS[..3]
                .iter()
                .map(|(id, title, _)| ChatTab::new(*id, *title))
                .collect(),
            active_tab: "c1".into(),
            active_chat: "c1".into(),
            density: RowDensity::default(),
            tab_appearance: TabAppearance::default(),
            sidebar: SidebarVisibility::Shown,
            composers,
            home,
            parts,
            conversation: cx.new(|cx| ConversationView::new(sample_turns(), cx)),
            destination: Destination::default(),
            mode: Mode::default(),
            mode_appearance: ModeToggleAppearance::default(),
            projects: vec![
                Project::new("shrok", "shrok"),
                Project::new("garden-planner", "garden-planner"),
                Project::new(
                    "household",
                    "Household paperwork, bills and the yearly tax return",
                ),
            ],
            adding_project: false,
            pinned: vec!["c1"],
            archived: Vec::new(),
            focus,
        }
    }

    fn toggle_pin(&mut self, id: &'static str, cx: &mut Context<Self>) {
        if let Some(index) = self.pinned.iter().position(|pinned| *pinned == id) {
            self.pinned.remove(index);
        } else {
            self.pinned.push(id);
        }
        cx.notify();
    }

    fn archive(&mut self, id: &'static str, window: &mut Window, cx: &mut Context<Self>) {
        self.pinned.retain(|pinned| *pinned != id);
        self.archived.push(id);
        self.reclaim_focus(window, cx);
        cx.notify();
    }

    /// Takes focus back before the focused control is removed. A focus that
    /// points at a removed element sends key bindings nowhere, so Tab would
    /// stop working.
    fn reclaim_focus(&self, window: &mut Window, cx: &mut Context<Self>) {
        self.focus.focus(window, cx);
    }

    fn open_chat(&mut self, id: &str, cx: &mut Context<Self>) {
        if !self.tabs.iter().any(|tab| tab.id == id)
            && let Some((_, title, _)) = CHATS.iter().find(|(chat, ..)| *chat == id)
        {
            self.tabs.push(ChatTab::new(id.to_owned(), *title));
        }
        self.active_chat = SharedString::from(id.to_owned());
        self.active_tab = self.active_chat.clone();
        cx.notify();
    }

    fn rail(&mut self, _: &mut Window, cx: &mut Context<Self>) -> AnyElement {
        IconRail::new("rail")
            .active(self.destination)
            .on_select(cx.listener(|this, destination: &Destination, _, cx| {
                this.destination = *destination;
                cx.notify();
            }))
            .into_any_element()
    }

    fn title_bar(&mut self, _: &mut Window, cx: &mut Context<Self>) -> AnyElement {
        let tabs = TabStrip::new("tabs", self.tabs.clone())
            .active(self.active_tab.clone())
            .appearance(self.tab_appearance)
            .on_select(cx.listener(|this, id: &SharedString, _, cx| this.open_chat(id, cx)))
            .on_move({
                let view = cx.entity().downgrade();
                move |id, to, _, cx| {
                    view.update(cx, |this, cx| {
                        if let Some(from) = this.tabs.iter().position(|tab| &tab.id == id) {
                            let tab = this.tabs.remove(from);
                            this.tabs.insert(to.min(this.tabs.len()), tab);
                            cx.notify();
                        }
                    })
                    .ok();
                }
            });

        TitleBar::new(tabs)
            .sidebar_toggle(
                self.sidebar,
                cx.listener(|this, _, _, cx| {
                    this.sidebar = match this.sidebar {
                        SidebarVisibility::Shown => SidebarVisibility::Hidden,
                        SidebarVisibility::Hidden => SidebarVisibility::Shown,
                    };
                    cx.notify();
                }),
            )
            .on_new_tab(cx.listener(|this, _, _, cx| {
                let next = CHATS
                    .iter()
                    .find(|(id, ..)| !this.tabs.iter().any(|tab| tab.id == *id));
                if let Some((id, ..)) = next {
                    this.open_chat(id, cx);
                }
            }))
            .trailing(AppearanceMenu::new("appearance").conversation_layout(
                self.conversation.read(cx).layout(),
                cx.listener(|this, layout: &ConversationLayout, _, cx| {
                    this.conversation
                        .update(cx, |conversation, cx| conversation.set_layout(*layout, cx));
                    cx.notify();
                }),
            ))
            .into_any_element()
    }

    fn sidebar(&mut self, _: &mut Window, cx: &mut Context<Self>) -> AnyElement {
        let tokens = composerkit_theme::tokens();
        let row = |&(id, title, detail): &(&'static str, &'static str, &'static str),
                   cx: &mut Context<Self>| {
            ConversationRow::new(id, title)
                .detail(detail)
                .density(self.density)
                .selected(self.active_chat == id)
                .pinned(self.pinned.contains(&id))
                .on_click(cx.listener(move |this, _, _, cx| this.open_chat(id, cx)))
                .on_toggle_pin(cx.listener(move |this, _, _, cx| this.toggle_pin(id, cx)))
                .on_archive(cx.listener(move |this, _, window, cx| this.archive(id, window, cx)))
        };
        let shown = CHATS.iter().filter(|(id, ..)| !self.archived.contains(id));
        let pinned: Vec<_> = shown
            .clone()
            .filter(|(id, ..)| self.pinned.contains(id))
            .map(|chat| row(chat, cx))
            .collect();
        let recents: Vec<_> = shown
            .filter(|(id, ..)| !self.pinned.contains(id))
            .map(|chat| row(chat, cx))
            .collect();
        let projects = ProjectList::new("projects", self.projects.clone())
            .adding(self.adding_project)
            .on_add(cx.listener(|this, name: &SharedString, window, cx| {
                let id = SharedString::from(format!("p{}", this.projects.len() + 1));
                this.projects.push(Project::new(id, name.clone()));
                this.adding_project = false;
                this.reclaim_focus(window, cx);
                cx.notify();
            }))
            .on_cancel_add(cx.listener(|this, _, window, cx| {
                this.adding_project = false;
                this.reclaim_focus(window, cx);
                cx.notify();
            }))
            .on_start_chat(cx.listener(|this, _: &SharedString, _, cx| {
                this.mode = Mode::Work;
                cx.notify();
            }));

        div()
            .id("sidebar")
            .flex()
            .flex_col()
            .gap_2()
            .w(px(tokens.size.sidebar))
            .h_full()
            .p(px(tokens.space.sidebar_padding))
            .overflow_y_scroll()
            .bg(cx.theme().sidebar)
            .child(SidebarSection::new("pinned", "Pinned").children(pinned))
            .child(
                SidebarSection::new("projects-section", "Projects")
                    .action(
                        Button::new("add-project")
                            .ghost()
                            .xsmall()
                            .icon(gpui_kit::component::Icon::new(
                                gpui_kit::assets::IconName::FolderPlus,
                            ))
                            .tooltip("Add new project")
                            .accessibility_label("Add new project")
                            .on_click(cx.listener(|this, _, _, cx| {
                                this.adding_project = true;
                                cx.notify();
                            })),
                    )
                    .child(projects),
            )
            .child(
                SidebarSection::new("recents", "Recent")
                    .action(
                        Button::new("new-chat")
                            .ghost()
                            .xsmall()
                            .icon(gpui_kit::component::Icon::new(
                                gpui_kit::assets::IconName::Plus,
                            ))
                            .tooltip("New chat")
                            .accessibility_label("New chat"),
                    )
                    .children(recents),
            )
            .into_any_element()
    }

    fn options(&self, cx: &mut Context<Self>) -> impl IntoElement {
        let colors = *composerkit_theme::colors(cx);
        let heading =
            |text: &'static str| div().pt_4().font_weight(FontWeight::SEMIBOLD).child(text);
        let density = RowDensity::ALL
            .iter()
            .position(|density| *density == self.density);
        let appearance = TabAppearance::ALL
            .iter()
            .position(|appearance| *appearance == self.tab_appearance);

        div()
            .flex()
            .flex_col()
            .gap_2()
            .flex_1()
            .p_4()
            .child(heading("Conversation row density"))
            .child(
                TabBar::new("density")
                    .segmented()
                    .when_some(density, TabBar::selected_index)
                    .on_click(cx.listener(|this, index: &usize, _, cx| {
                        this.density = RowDensity::ALL[*index];
                        cx.notify();
                    }))
                    .children(RowDensity::ALL.map(|density| Tab::new().label(density.label()))),
            )
            .child(heading("Title bar tabs"))
            .child(
                TabBar::new("tab-appearance")
                    .segmented()
                    .when_some(appearance, TabBar::selected_index)
                    .on_click(cx.listener(|this, index: &usize, _, cx| {
                        this.tab_appearance = TabAppearance::ALL[*index];
                        cx.notify();
                    }))
                    .children(
                        TabAppearance::ALL.map(|appearance| Tab::new().label(appearance.label())),
                    ),
            )
            .child(heading("Mode toggle"))
            .child(
                TabBar::new("mode-appearance")
                    .segmented()
                    .when_some(
                        ModeToggleAppearance::ALL
                            .iter()
                            .position(|appearance| *appearance == self.mode_appearance),
                        TabBar::selected_index,
                    )
                    .on_click(cx.listener(|this, index: &usize, _, cx| {
                        this.mode_appearance = ModeToggleAppearance::ALL[*index];
                        cx.notify();
                    }))
                    .children(
                        ModeToggleAppearance::ALL
                            .map(|appearance| Tab::new().label(appearance.label())),
                    ),
            )
            .child(
                ModeToggle::new("mode", self.mode)
                    .appearance(self.mode_appearance)
                    .on_change(cx.listener(|this, mode: &Mode, _, cx| {
                        this.mode = *mode;
                        cx.notify();
                    })),
            )
            .child(heading("Text"))
            .child(div().text_color(colors.foreground).child("Body text"))
            .child(
                div()
                    .text_color(colors.muted_foreground)
                    .child("Muted text"),
            )
            .child(
                div()
                    .text_color(colors.subtle_foreground)
                    .child("Subtle text"),
            )
            .child(heading("Button"))
            .child(
                div()
                    .flex()
                    .gap_2()
                    .child(Button::new("primary").primary().label("Primary"))
                    .child(Button::new("secondary").label("Secondary"))
                    .child(Button::new("ghost").ghost().label("Ghost")),
            )
    }
}

impl Catalog {
    /// The sample chat in the layout the Appearance menu picks.
    fn conversation_section(&self, cx: &mut Context<Self>) -> impl IntoElement {
        let tokens = composerkit_theme::tokens();
        let colors = composerkit_theme::colors(cx);
        let layout = self.conversation.read(cx).layout();
        div()
            .flex()
            .flex_col()
            .gap_2()
            .p_4()
            .child(
                div()
                    .pt_4()
                    .font_weight(FontWeight::SEMIBOLD)
                    .child("Conversation"),
            )
            .child(div().text_color(colors.muted_foreground).child(format!(
                "{} layout. Change it under Conversation layout in the Appearance menu.",
                layout.label()
            )))
            .child(
                div()
                    .h(px(CONVERSATION_HEIGHT))
                    .overflow_hidden()
                    .rounded(px(tokens.radius.tray))
                    .border(px(tokens.border.hairline))
                    .border_color(colors.border)
                    .child(
                        self.conversation
                            .clone()
                            .cached(StyleRefinement::default().size_full()),
                    ),
            )
    }
}

/// The parts of the catalog with a size of their own, which typing in a
/// composer leaves as they are.
struct CatalogParts {
    title_bar: Entity<CatalogPart>,
    rail: Entity<CatalogPart>,
    sidebar: Entity<CatalogPart>,
}

/// A part of the catalog that one of its methods draws. It is drawn again
/// only when the catalog changes, so typing in a composer leaves it alone.
struct CatalogPart {
    catalog: WeakEntity<Catalog>,
    render: fn(&mut Catalog, &mut Window, &mut Context<Catalog>) -> AnyElement,
    _changes: Subscription,
}

impl CatalogPart {
    fn new(
        catalog: &Entity<Catalog>,
        render: fn(&mut Catalog, &mut Window, &mut Context<Catalog>) -> AnyElement,
        cx: &mut Context<Self>,
    ) -> Self {
        Self {
            catalog: catalog.downgrade(),
            render,
            _changes: cx.observe(catalog, |_, _, cx| cx.notify()),
        }
    }
}

impl Render for CatalogPart {
    fn render(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let render = self.render;
        self.catalog
            .update(cx, |catalog, cx| render(catalog, window, cx))
            .unwrap_or_else(|_| Empty.into_any_element())
    }
}

/// The home screen, drawn again when the live composer it shares changes.
struct HomeSection {
    live: Entity<ComposerController>,
    _changes: Subscription,
}

impl HomeSection {
    fn new(live: Entity<ComposerController>, cx: &mut Context<Self>) -> Self {
        Self {
            _changes: cx.observe(&live, |_, _, cx| cx.notify()),
            live,
        }
    }
}

impl Render for HomeSection {
    fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        home_view(&self.live, false, cx)
    }
}

/// Tall enough to scroll the sample chat and grow the composer.
const CONVERSATION_HEIGHT: f32 = 720.;

impl Render for Catalog {
    fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let size = &composerkit_theme::tokens().size;
        div()
            .track_focus(&self.focus)
            .on_action(|_: &FocusNext, window, cx| window.focus_next(cx))
            .on_action(|_: &FocusPrevious, window, cx| window.focus_prev(cx))
            .flex()
            .flex_col()
            .size_full()
            .bg(cx.theme().title_bar)
            .text_color(cx.theme().foreground)
            .child(
                self.parts
                    .title_bar
                    .clone()
                    .cached(StyleRefinement::default().w_full().h(px(size.titlebar))),
            )
            .child(
                div()
                    .flex()
                    .flex_1()
                    .min_h_0()
                    .child(
                        self.parts
                            .rail
                            .clone()
                            .cached(StyleRefinement::default().w(px(size.rail)).h_full()),
                    )
                    .when(self.sidebar == SidebarVisibility::Shown, |body| {
                        body.child(
                            self.parts
                                .sidebar
                                .clone()
                                .cached(StyleRefinement::default().w(px(size.sidebar)).h_full()),
                        )
                    })
                    .child(
                        div()
                            .id("main")
                            .flex_1()
                            .h_full()
                            .overflow_y_scroll()
                            .bg(cx.theme().background)
                            .child(
                                self.home.clone().cached(
                                    StyleRefinement::default()
                                        .w_full()
                                        .h(px(CONVERSATION_HEIGHT)),
                                ),
                            )
                            .child(self.options(cx))
                            .child(self.composers.clone())
                            .child(self.conversation_section(cx)),
                    ),
            )
    }
}

fn main() {
    run(|_, _, _| {});
}

/// Opens the catalog window, then hands it to `opened`.
pub(crate) fn run(opened: impl FnOnce(AnyWindowHandle, Entity<Catalog>, &mut App) + 'static) {
    gpui_kit::application()
        .with_assets(composerkit_ui::Assets)
        .run(|cx| {
            gpui_kit::init(cx);
            composerkit_theme::init(cx);
            cx.bind_keys([
                KeyBinding::new("tab", FocusNext, None),
                KeyBinding::new("shift-tab", FocusPrevious, None),
            ]);
            let (window, catalog) =
                gpui_kit::open_window(KitTitleBar::window_options(), cx, |window, cx| {
                    cx.new(|cx| Catalog::new(window, cx))
                })
                .expect("failed to open the catalog window");
            opened(window, catalog, cx);
        });
}

/// The composer in every layout: one driven by a simulated controller, and
/// one showing each named state from the web demo's fixtures.
pub(crate) struct ComposerSection {
    layout: ComposerLayout,
    pub(crate) live: Entity<ComposerController>,
    last_sent: Option<SharedString>,
    fixtures: Vec<ComposerFixture>,
    active_fixture: usize,
    /// The picked fixture as edited on the stage. Picking a fixture resets
    /// it, so the fixtures themselves never change.
    stage: ComposerState,
    _subscriptions: [Subscription; 2],
}

/// A named state from `src/states/composer/fixtures.ts`.
struct ComposerFixture {
    group: &'static str,
    label: &'static str,
    mode: ComposerMode,
    dictation: DictationSupport,
    state: ComposerState,
}

const MB: u64 = 1024 * 1024;

const TYPED: &str =
    "Read the sync client and list every place it gives up after one failed request";

const LONG_DRAFT: &str = "Here is how I want to split the settings page:

1. Move account, notifications and privacy into their own tabs.
2. Keep the save button in one place, below the tabs.
3. Remember the last open tab when someone comes back.
4. Make each tab reachable with the arrow keys.
5. Keep Enter to save and Escape to cancel.

Before you start, check whether the tab list scrolls when the window is narrow, and what happens to a tab title that is too long. If it doesn’t scroll, we need a menu for the tabs that don’t fit.

Also confirm the page still works at 320px wide and with text zoomed to 200%.";

fn sample_projects() -> [ComposerProject; 2] {
    [
        ComposerProject::new("shrok", "shrok"),
        ComposerProject::new("garden-planner", "garden-planner"),
    ]
}

/// Attachments with the given name, size, status and progress, numbered
/// from the first id.
fn files<const N: usize>(list: [(&str, u64, UploadStatus, f32); N]) -> Vec<Attachment> {
    iter::successors(Some(AttachmentId::FIRST), |id| id.next())
        .zip(list)
        .map(|(id, (name, size_bytes, status, progress))| Attachment {
            id,
            name: name.to_owned(),
            size_bytes,
            status,
            progress,
        })
        .collect()
}

#[expect(
    clippy::too_many_lines,
    reason = "one entry per state in fixtures.ts, in the same order, so the two can be compared"
)]
fn composer_fixtures() -> Vec<ComposerFixture> {
    let fixture = |group, label, state| ComposerFixture {
        group,
        label,
        mode: ComposerMode::Work,
        dictation: DictationSupport::Supported,
        state,
    };
    let draft = |text: &str| ComposerState {
        draft: text.to_owned(),
        ..ComposerState::default()
    };
    vec![
        fixture("Draft", "Empty", ComposerState::default()),
        fixture("Draft", "Typing", draft(TYPED)),
        fixture("Draft", "Long draft", draft(LONG_DRAFT)),
        fixture(
            "Attachments",
            "Uploading",
            ComposerState {
                attachments: files([
                    (
                        "electricity-bill-october.pdf",
                        11 * MB / 10,
                        UploadStatus::Uploading,
                        0.42,
                    ),
                    (
                        "settings page at 320px wide.png",
                        24 * MB / 10,
                        UploadStatus::Uploading,
                        0.08,
                    ),
                ]),
                ..draft("How much did we pay in total?")
            },
        ),
        fixture(
            "Attachments",
            "Attached",
            ComposerState {
                attachments: files([
                    (
                        "electricity-bill-october.pdf",
                        11 * MB / 10,
                        UploadStatus::Ready,
                        1.,
                    ),
                    (
                        "household budget by month and category (final version).xlsx",
                        380 * 1024,
                        UploadStatus::Ready,
                        1.,
                    ),
                ]),
                ..ComposerState::default()
            },
        ),
        fixture(
            "Attachments",
            "Too large",
            ComposerState {
                attachments: files([(
                    "screen-recording-of-the-glitch.mov",
                    182 * MB,
                    UploadStatus::Failed(UploadFailure::TooLarge),
                    1.,
                )]),
                ..draft("What makes the list jump in this recording?")
            },
        ),
        fixture(
            "Attachments",
            "Upload interrupted",
            ComposerState {
                attachments: files([(
                    "contacts-export.csv",
                    62 * MB / 10,
                    UploadStatus::Failed(UploadFailure::Offline),
                    0.6,
                )]),
                ..ComposerState::default()
            },
        ),
        fixture(
            "Sending",
            "Sending",
            ComposerState {
                phase: Phase::Sending,
                ..draft(TYPED)
            },
        ),
        fixture(
            "Sending",
            "Not sent",
            ComposerState {
                phase: Phase::Failed(SendFailure::Offline),
                ..draft(TYPED)
            },
        ),
        fixture(
            "Dictation",
            "Listening",
            ComposerState {
                dictating: true,
                ..ComposerState::default()
            },
        ),
        ComposerFixture {
            dictation: DictationSupport::Unsupported,
            ..fixture("Dictation", "Not supported", ComposerState::default())
        },
        fixture(
            "Access",
            "No limits",
            ComposerState {
                permission: Permission::Open,
                project_id: Some("shrok".to_owned()),
                ..ComposerState::default()
            },
        ),
        ComposerFixture {
            mode: ComposerMode::Chat,
            ..fixture(
                "Access",
                "Chat mode",
                draft("Pack list for a weekend of hiking"),
            )
        },
    ]
}

impl ComposerSection {
    fn new(cx: &mut Context<Self>) -> Self {
        let live = cx.new(|_| ComposerController::new(ComposerState::default()));
        let subscriptions = [
            cx.observe(&live, |_, _, cx| cx.notify()),
            cx.subscribe(&live, |this, _, message: &SentMessage, cx| {
                let files = message.attachments.len();
                let draft = message.draft.trim();
                this.last_sent = Some(format!("Last sent: “{draft}” with {files} file(s)").into());
                cx.notify();
            }),
        ];
        let fixtures = composer_fixtures();
        Self {
            layout: ComposerLayout::default(),
            live,
            last_sent: None,
            stage: fixtures[0].state.clone(),
            fixtures,
            active_fixture: 0,
            _subscriptions: subscriptions,
        }
    }

    /// Two files that upload and one that is too large, for trying the
    /// upload states without a file picker.
    fn attach_samples(&mut self, cx: &mut Context<Self>) {
        let samples = [
            ("electricity-bill.pdf", 12 * MB / 10),
            ("settings page.png", 24 * MB / 10),
            ("screen-recording.mov", 182 * MB),
        ];
        self.live.update(cx, |live, cx| {
            live.add_files(
                samples.map(|(name, size_bytes)| PickedFile {
                    name: name.to_owned(),
                    size_bytes,
                }),
                cx,
            );
        });
    }
}

impl Render for ComposerSection {
    fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        let heading =
            |text: &'static str| div().pt_4().font_weight(FontWeight::SEMIBOLD).child(text);
        let layout = ComposerLayout::ALL
            .iter()
            .position(|layout| *layout == self.layout);
        let offline = usize::from(self.live.read(cx).connectivity() == Connectivity::Offline);

        let live = Composer::for_controller("live-composer", &self.live, cx)
            .layout(self.layout)
            .projects(sample_projects());

        let index = self.active_fixture;
        let fixture = &self.fixtures[index];
        // Requests are ignored, so pending states hold still, as on the web
        // workbench.
        let stage = Composer::new(("composer-state", index), self.stage.clone())
            .layout(self.layout)
            .mode(fixture.mode)
            .dictation(fixture.dictation)
            .projects(sample_projects())
            .on_action(cx.listener(move |this, action: &ComposerAction, _, cx| {
                this.stage.apply(action.clone());
                cx.notify();
            }));
        let pickers: Vec<_> = self
            .fixtures
            .iter()
            .enumerate()
            .map(|(index, fixture)| {
                Button::new(("pick-state", index))
                    .small()
                    .ghost()
                    .selected(index == self.active_fixture)
                    .label(format!("{} · {}", fixture.group, fixture.label))
                    .on_click(cx.listener(move |this, _, _, cx| {
                        this.active_fixture = index;
                        this.stage = this.fixtures[index].state.clone();
                        cx.notify();
                    }))
            })
            .collect();

        div()
            .flex()
            .flex_col()
            .gap_2()
            .p_4()
            .child(heading("Composer layout"))
            .child(
                TabBar::new("composer-layout")
                    .segmented()
                    .when_some(layout, TabBar::selected_index)
                    .on_click(cx.listener(|this, index: &usize, _, cx| {
                        this.layout = ComposerLayout::ALL[*index];
                        cx.notify();
                    }))
                    .children(ComposerLayout::ALL.map(|layout| Tab::new().label(layout.label()))),
            )
            .child(heading("Composer with simulated uploads and sends"))
            .child(
                div()
                    .flex()
                    .items_center()
                    .gap_2()
                    .child(
                        TabBar::new("composer-network")
                            .segmented()
                            .selected_index(offline)
                            .on_click(cx.listener(|this, index: &usize, _, cx| {
                                let connectivity = if *index == 0 {
                                    Connectivity::Online
                                } else {
                                    Connectivity::Offline
                                };
                                this.live
                                    .update(cx, |live, cx| live.set_connectivity(connectivity, cx));
                            }))
                            .child(Tab::new().label("Online"))
                            .child(Tab::new().label("Offline")),
                    )
                    .child(
                        Button::new("attach-samples")
                            .label("Attach sample files")
                            .on_click(cx.listener(|this, _, _, cx| this.attach_samples(cx))),
                    ),
            )
            .child(live)
            .children(self.last_sent.clone())
            .child(heading("Composer states"))
            .child(div().flex().flex_wrap().gap_1().children(pickers))
            .child(stage)
    }
}
