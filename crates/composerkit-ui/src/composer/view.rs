// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

use std::path::PathBuf;
use std::rc::Rc;

use std::time::Duration;

use gpui_kit::assets::IconName;
use gpui_kit::component::button::{Button, ButtonVariants as _};
use gpui_kit::component::{Disableable as _, Icon, Sizable as _, Size};
use gpui_kit::{
    AnyElement, App, ElementId, Entity, ExternalPaths, FocusHandle, InteractiveElement as _,
    IntoElement, KeyDownEvent, ParentElement as _, RenderOnce, SharedString,
    StatefulInteractiveElement as _, Styled as _, TestSupportExt as _, Window, div,
    prelude::FluentBuilder as _, px,
};

use super::add_menu::AddMenu;
use super::attachments::attachment_row;
use super::controller::PickedFile;
use super::field::{BuiltField, FieldMeasure, MessageField, Part};
use super::machine::{AttachmentId, ComposerAction, ComposerState, Phase};
use super::menus::permission_menu;
use super::model_picker::ModelPicker;
use super::tray::Tray;
use crate::accessibility::Accessible;
use crate::focus_ring::KeyboardRing as _;

/// How the composer arranges its text box and controls.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Hash)]
pub enum ComposerLayout {
    /// Text above, controls below, the tray tucked under.
    #[default]
    Stacked,
    /// Everything on one row that grows as you type.
    Inline,
    /// Taller, with the tray inside the box as its last row.
    Roomy,
}

impl ComposerLayout {
    /// Every layout, in the order a picker shows them.
    pub const ALL: [Self; 3] = [Self::Stacked, Self::Inline, Self::Roomy];

    /// The name a picker shows.
    #[must_use]
    pub const fn label(self) -> &'static str {
        match self {
            Self::Stacked => "Stacked",
            Self::Inline => "Inline",
            Self::Roomy => "Roomy",
        }
    }

    /// The rows the text box starts at, and grows to before it scrolls.
    pub(super) const fn rows(self, max_rows: usize) -> (usize, usize) {
        match self {
            Self::Inline => (1, max_rows),
            Self::Stacked => (2, max_rows),
            Self::Roomy => (4, max_rows),
        }
    }
}

/// Whether the chat is a plain conversation or an agent working in a project.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Hash)]
pub enum ComposerMode {
    Chat,
    /// Adds the permission menu and the tray with the project picker.
    #[default]
    Work,
}

impl ComposerMode {
    const fn placeholder(self) -> &'static str {
        match self {
            Self::Chat => "Send a message",
            Self::Work => "Describe a task",
        }
    }
}

/// Whether this platform can turn speech into text.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Hash)]
pub enum DictationSupport {
    #[default]
    Supported,
    /// The microphone button stays visible but disabled, and says why.
    Unsupported,
}

/// A project the tray's project menu offers.
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub struct ComposerProject {
    pub id: SharedString,
    pub name: SharedString,
}

impl ComposerProject {
    #[must_use]
    pub fn new(id: impl Into<SharedString>, name: impl Into<SharedString>) -> Self {
        Self {
            id: id.into(),
            name: name.into(),
        }
    }
}

/// Something the composer asks its owner to do, because it needs more than
/// the reducer: a network, a timer, a file picker or a microphone.
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub enum ComposerRequest {
    /// Send the draft and ready files.
    Submit,
    /// Stop the message in flight.
    Stop,
    /// Upload this attachment again.
    RetryUpload(AttachmentId),
    /// Let the user pick files to attach.
    PickFiles,
    /// Attach files dropped on the composer or pasted into it, by path.
    AttachPaths(Rc<[PathBuf]>),
    /// Attach files that exist only in memory, such as a pasted screenshot.
    AttachFiles(Rc<[PickedFile]>),
    /// Start or stop dictation.
    ToggleDictation,
}

type ActionHandler = Rc<dyn Fn(&ComposerAction, &mut Window, &mut App)>;
type RequestHandler = Rc<dyn Fn(&ComposerRequest, &mut Window, &mut App)>;
type StopReplyHandler = Rc<dyn Fn(&mut Window, &mut App)>;

/// The expand control shows from this many lines of wrapped text, or as
/// soon as the text holds a line break.
const EXPAND_FROM_LINES: usize = 5;

/// The owner's callbacks, shared by every control in the composer.
#[derive(Clone, Default)]
pub(super) struct Handlers {
    on_action: Option<ActionHandler>,
    on_request: Option<RequestHandler>,
}

impl Handlers {
    pub(super) fn act(&self, action: &ComposerAction, window: &mut Window, cx: &mut App) {
        if let Some(on_action) = &self.on_action {
            on_action(action, window, cx);
        }
    }

    pub(super) fn request(&self, request: &ComposerRequest, window: &mut Window, cx: &mut App) {
        if let Some(on_request) = &self.on_request {
            on_request(request, window, cx);
        }
    }
}

/// The message composer: a text box, attachments, the model, effort and
/// permission menus, dictation, send and stop, and in Work mode a tray with
/// the project picker.
///
/// It shows a [`ComposerState`] and changes nothing itself. Edits arrive as
/// [`ComposerAction`]s for the owner to apply, and work that needs more than
/// the reducer arrives as a [`ComposerRequest`]. `ComposerController` does
/// both with simulated uploads and sends.
///
/// Enter sends and Shift+Enter starts a new line. While a reply runs,
/// Escape stops it; otherwise Escape leaves the draft alone. In the inline
/// layout the text sits on one row with the controls until it holds a line
/// break or runs past the row; then it moves to its own row above them.
#[derive(IntoElement)]
#[expect(
    clippy::struct_excessive_bools,
    reason = "each flag is a separate builder option that callers set on their own"
)]
pub struct Composer {
    id: ElementId,
    state: ComposerState,
    upload_notice: String,
    layout: ComposerLayout,
    conversation: bool,
    narrow: bool,
    expandable: bool,
    focus_field: bool,
    /// Where focus goes after Send is clicked, instead of nowhere.
    focus_after_send: Option<FocusHandle>,
    mode: ComposerMode,
    projects: Vec<ComposerProject>,
    dictation: DictationSupport,
    handlers: Handlers,
    stop_reply: Option<StopReplyHandler>,
}

impl Composer {
    #[must_use]
    pub fn new(id: impl Into<ElementId>, state: ComposerState) -> Self {
        Self {
            id: id.into(),
            state,
            upload_notice: String::new(),
            layout: ComposerLayout::default(),
            conversation: false,
            narrow: false,
            expandable: false,
            focus_field: false,
            focus_after_send: None,
            mode: ComposerMode::default(),
            projects: Vec::new(),
            dictation: DictationSupport::default(),
            handlers: Handlers::default(),
            stop_reply: None,
        }
    }

    pub(super) fn upload_notice(mut self, notice: String) -> Self {
        self.upload_notice = notice;
        self
    }

    #[must_use]
    pub fn layout(mut self, layout: ComposerLayout) -> Self {
        self.layout = layout;
        self
    }

    #[must_use]
    pub fn conversation(mut self) -> Self {
        self.conversation = true;
        self
    }

    /// Places the field above the controls when the available width is narrow.
    #[must_use]
    pub fn narrow(mut self, narrow: bool) -> Self {
        self.narrow = narrow;
        self
    }
    /// Adds a control that lets the box fill its container once the text
    /// holds a line break or runs to five lines. It reports the change as
    /// [`ComposerAction::ExpandedChanged`]; the container reads
    /// [`ComposerState::expanded`] and decides how tall that is.
    #[must_use]
    pub fn expandable(mut self) -> Self {
        self.expandable = true;
        self
    }

    /// Moves keyboard focus to the text box after this frame.
    #[must_use]
    pub(crate) fn focus_field(mut self, focus: bool) -> Self {
        self.focus_field = focus;
        self
    }

    /// Gives `focus` the keyboard after Send is clicked, so the owner can
    /// catch what you type next.
    #[must_use]
    pub(crate) fn focus_after_send(mut self, focus: FocusHandle) -> Self {
        self.focus_after_send = Some(focus);
        self
    }

    /// Replaces the primary action with a button that stops a streaming
    /// reply. Escape in the text box stops it too, and focus stays in the
    /// text box.
    #[must_use]
    pub fn on_stop_reply(mut self, handler: impl Fn(&mut Window, &mut App) + 'static) -> Self {
        self.stop_reply = Some(Rc::new(handler));
        self
    }

    #[must_use]
    pub fn mode(mut self, mode: ComposerMode) -> Self {
        self.mode = mode;
        self
    }

    /// The projects the tray's project menu offers in Work mode.
    #[must_use]
    pub fn projects(mut self, projects: impl IntoIterator<Item = ComposerProject>) -> Self {
        self.projects = projects.into_iter().collect();
        self
    }

    #[must_use]
    pub fn dictation(mut self, dictation: DictationSupport) -> Self {
        self.dictation = dictation;
        self
    }

    /// Called with each edit, for the owner to apply with
    /// [`ComposerState::apply`]. Without it the composer is read-only.
    #[must_use]
    pub fn on_action(
        mut self,
        handler: impl Fn(&ComposerAction, &mut Window, &mut App) + 'static,
    ) -> Self {
        self.handlers.on_action = Some(Rc::new(handler));
        self
    }

    /// Called when the user sends, stops, retries an upload, adds files or
    /// toggles dictation.
    #[must_use]
    pub fn on_request(
        mut self,
        handler: impl Fn(&ComposerRequest, &mut Window, &mut App) + 'static,
    ) -> Self {
        self.handlers.on_request = Some(Rc::new(handler));
        self
    }
}

/// The round icon button the footer uses, such as Add files or Dictate.
pub(super) fn pill_button(
    id: impl Into<ElementId>,
    icon: IconName,
    label: impl Into<SharedString>,
    cx: &App,
) -> Button {
    let size = &composerkit_theme::tokens().size;
    let label = label.into();
    Button::new(id)
        .keyboard_ring(cx)
        .ghost()
        .icon(Icon::new(icon))
        .with_size(Size::Size(px(size.composer_control)))
        .w(px(size.composer_control_width))
        .rounded_full()
        .text_color(composerkit_theme::colors(cx).subtle_foreground)
        .tooltip(label.clone())
        .accessibility_label(label)
}

/// The round button at the end of the composer, filled.
fn primary_button(id: &'static str, icon: IconName, label: &'static str, cx: &App) -> Button {
    let size = &composerkit_theme::tokens().size;
    Button::new(id)
        .keyboard_ring(cx)
        .primary()
        .icon(Icon::new(icon))
        .with_size(Size::Size(px(size.composer_control)))
        .w(px(size.composer_control_width))
        .h(px(size.composer_control))
        .rounded_full()
        .tooltip(label)
        .accessibility_label(label)
}

/// Stops the reply, keeps the stop button a moment, disabled, and leaves
/// focus in the text box.
fn stop_reply_now(
    stop: &StopReplyHandler,
    settle: &Entity<bool>,
    focus: &FocusHandle,
    window: &mut Window,
    cx: &mut App,
) {
    stop(window, cx);
    let wait = Duration::from_millis(composerkit_theme::tokens().motion.stop_settle_ms);
    settle.update(cx, |settling, cx| {
        *settling = true;
        cx.notify();
        cx.spawn(async move |settle, cx| {
            cx.background_executor().timer(wait).await;
            settle
                .update(cx, |settling, cx| {
                    *settling = false;
                    cx.notify();
                })
                .ok();
        })
        .detach();
    });
    focus.focus(window, cx);
}

/// Where the composer's parts go this frame.
struct Arrangement {
    /// The text sits on its own row above the controls.
    two_rows: bool,
    expanded: bool,
    show_expand: bool,
}

impl Composer {
    fn primary_action(&self, focus: &FocusHandle, settle: &Entity<bool>, cx: &App) -> Button {
        let state = &self.state;
        let stop_button = || {
            let size = &composerkit_theme::tokens().size;
            Button::new("stop-reply")
                .keyboard_ring(cx)
                .primary()
                .with_size(Size::Size(px(size.composer_control)))
                .w(px(size.composer_control_width))
                .h(px(size.composer_control))
                .rounded_full()
                .tooltip("Stop reply")
                .accessibility_label("Stop reply")
                .child(
                    div()
                        .size(px(7.))
                        .rounded(px(1.5))
                        .bg(composerkit_theme::colors(cx).primary_foreground),
                )
        };

        if let Some(stop) = self.stop_reply.clone() {
            let (focus, settle) = (focus.clone(), settle.clone());
            return stop_button().on_click(move |_, window, cx| {
                stop_reply_now(&stop, &settle, &focus, window, cx);
            });
        }

        // A reply that was just stopped keeps its button for a moment, so a
        // second press doesn't land on Send.
        if *settle.read(cx) {
            return stop_button().disabled(true);
        }

        if state.phase == Phase::Sending {
            let handlers = self.handlers.clone();
            return primary_button("stop", IconName::Square, "Stop sending", cx).on_click(
                move |_, window, cx| {
                    handlers.request(&ComposerRequest::Stop, window, cx);
                },
            );
        }

        let has_content = !state.draft.trim().is_empty()
            || state
                .attachments
                .iter()
                .any(|attachment| attachment.failure().is_none());
        if !(has_content || self.conversation) {
            return primary_button("voice", IconName::AudioLines, "Start voice chat", cx)
                .tooltip("Voice chat isn’t available here")
                .disabled(true);
        }

        let ready = state.can_send();
        let tooltip = if ready || !state.is_uploading() {
            "Send"
        } else {
            "Uploads still running"
        };
        let handlers = self.handlers.clone();
        let focus = focus.clone();
        let after_click = self.focus_after_send.clone();
        primary_button("send", IconName::ArrowUp, "Send", cx)
            .tooltip(tooltip)
            .disabled(!ready)
            .on_click(move |event, window, cx| {
                handlers.request(&ComposerRequest::Submit, window, cx);
                // The button turns disabled, so the keyboard goes back to the
                // text box. A click hands focus to the owner, or leaves it on
                // the window, from where typing reaches nothing by accident.
                if event.is_keyboard() {
                    focus.focus(window, cx);
                } else if let Some(after_click) = &after_click {
                    after_click.focus(window, cx);
                } else {
                    window.blur(cx);
                }
            })
    }

    fn dictation_button(&self, cx: &App) -> Button {
        let dictating = self.state.dictating;
        let label = match (self.dictation, dictating) {
            (DictationSupport::Unsupported, _) => "This browser can’t take dictation",
            (DictationSupport::Supported, true) => "Stop dictating",
            (DictationSupport::Supported, false) => "Dictate",
        };
        let handlers = self.handlers.clone();
        let colors = composerkit_theme::colors(cx);
        pill_button("dictate", IconName::Mic, label, cx)
            .mr(px(composerkit_theme::tokens().space.composer_trailing_gap))
            .toggled(dictating)
            .disabled(self.dictation == DictationSupport::Unsupported || self.stop_reply.is_some())
            // The icon changes too, so the state never rides on color alone.
            .when(dictating, |button| {
                button
                    .icon(Icon::new(IconName::MicVocal))
                    .bg(colors.accent)
                    .text_color(colors.link)
            })
            .on_click(move |_, window, cx| {
                handlers.request(&ComposerRequest::ToggleDictation, window, cx);
            })
    }

    /// Lets the box fill its container, and back. It sits in the top right
    /// corner and comes last in the tab order.
    fn expand_toggle(&self, focus: &FocusHandle, cx: &App) -> impl IntoElement {
        let tokens = composerkit_theme::tokens();
        let expanded = self.state.expanded;
        let handlers = self.handlers.clone();
        let focus = focus.clone();
        let icon = if expanded {
            IconName::Minimize2
        } else {
            IconName::Maximize2
        };
        div()
            .absolute()
            .top(px(tokens.space.composer_expand_inset))
            .right(px(tokens.space.composer_expand_inset))
            .child(
                Button::new("expand")
                    .keyboard_ring(cx)
                    .ghost()
                    .icon(Icon::new(icon))
                    .w(px(tokens.size.composer_expand_width))
                    .h(px(tokens.size.composer_expand_height))
                    .rounded_full()
                    .toggled(expanded)
                    .tooltip(if expanded {
                        "Exit full height"
                    } else {
                        "Full height"
                    })
                    .accessibility_label("Full height")
                    .on_click(move |_, window, cx| {
                        handlers.act(
                            &ComposerAction::ExpandedChanged {
                                expanded: !expanded,
                            },
                            window,
                            cx,
                        );
                        focus.focus(window, cx);
                    }),
            )
    }

    fn send_failure(&self, cx: &App) -> impl IntoElement {
        let tokens = composerkit_theme::tokens();
        let caption = &tokens.text.caption;
        let danger = composerkit_theme::colors(cx).destructive;
        let handlers = self.handlers.clone();
        div()
            .flex()
            .items_center()
            .gap_2()
            .mx_3()
            .mt_2()
            .text_color(danger)
            .text_size(px(caption.size))
            .line_height(px(caption.line_height))
            .child(Icon::new(IconName::TriangleAlert).small())
            .child(
                div()
                    .min_w_0()
                    .flex_1()
                    .child("There’s no connection, so nothing was sent. Your draft is still here."),
            )
            .child(
                Button::new("retry-send")
                    .keyboard_ring(cx)
                    .small()
                    .icon(Icon::new(IconName::RefreshCw))
                    .label("Try again")
                    .on_click(move |_, window, cx| {
                        handlers.request(&ComposerRequest::Submit, window, cx);
                    }),
            )
    }

    /// The add menu's state, kept current with the draft and the text box.
    /// It closes when the box loses focus or the draft freezes for sending.
    fn add_menu(&self, focus: &FocusHandle, window: &mut Window, cx: &mut App) -> Entity<AddMenu> {
        let menu =
            window.use_keyed_state((self.id.clone(), "add-menu"), cx, |_, cx| AddMenu::new(cx));
        let keep_open = focus.is_focused(window) && self.state.phase != Phase::Sending;
        menu.update(cx, |menu, _| {
            menu.sync(&self.state.draft, &self.handlers, focus, keep_open);
        });
        menu
    }

    /// The text box with the controls around it: one row with the text
    /// between them, or the text on top and the controls below it.
    fn controls(
        &self,
        field: BuiltField,
        arrangement: &Arrangement,
        settle: &Entity<bool>,
        add_menu: &Entity<AddMenu>,
        cx: &App,
    ) -> AnyElement {
        let tokens = composerkit_theme::tokens();
        let space = &tokens.space;
        let footer_padding = px(space.composer_footer_padding);
        let state = &self.state;
        let compact = self.layout == ComposerLayout::Inline;
        let focus = field.focus.clone();
        let menu = add_menu.clone();
        let input = field.input.clone();
        let field_focus = focus.clone();
        let menu_open = add_menu.read(cx).is_open();
        let add_button = pill_button("add-files", IconName::Plus, "Add files and more", cx)
            .disabled(state.phase == Phase::Sending)
            .on_click(move |_, window, cx| {
                let selection = input.read(cx).selected_range();
                menu.update(cx, |menu, cx| menu.toggle(selection, cx));
                field_focus.focus(window, cx);
            });
        let add_button = Accessible(add_button).aria_expanded(menu_open).0;
        // A press keeps focus in the text box, which the menu's keys need.
        let add_files = div()
            .capture_any_mouse_down(|_, window, _| window.prevent_default())
            .child(add_button);
        let leading = div()
            .relative()
            .flex()
            .items_center()
            .gap(px(space.composer_add_gap))
            .child(field.probe(Part::Leading))
            .child(add_files)
            .when(self.mode == ComposerMode::Work, |row| {
                row.child(permission_menu(
                    state.permission,
                    compact,
                    &self.handlers,
                    cx,
                ))
            });
        let trailing = div()
            .relative()
            .flex()
            .items_center()
            .ml_auto()
            .child(field.probe(Part::Trailing))
            .child(ModelPicker {
                model: state.model,
                effort: state.effort,
                compact,
                handlers: self.handlers.clone(),
            })
            .child(self.dictation_button(cx))
            .child(self.primary_action(&focus, settle, cx));

        if !arrangement.two_rows {
            let min_height = if self.conversation {
                tokens.size.conversation_composer_min_height
            } else {
                tokens.size.composer_inline_min_height
            };
            return div()
                .flex()
                .items_center()
                .gap(px(space.composer_add_gap))
                .px(footer_padding)
                .py(px((min_height - tokens.size.composer_control) / 2.))
                .child(leading)
                .child(field.into_element(div().flex_1().min_w_0(), false))
                .child(trailing)
                .into_any_element();
        }

        let expanded = arrangement.expanded;
        let wrapper = div()
            .mx(px(space.composer_padding_x))
            .map(|wrapper| match self.layout {
                ComposerLayout::Roomy => wrapper
                    .mt_4()
                    .min_h(px(tokens.size.composer_roomy_text_min_height)),
                ComposerLayout::Inline | ComposerLayout::Stacked => wrapper
                    .mt(px(space.composer_two_row_top))
                    .min_h(px(tokens.size.composer_two_row_text_min_height)),
            })
            .when(arrangement.show_expand, |wrapper| {
                wrapper.mr(px(space.composer_padding_x + space.composer_expand_reserve))
            })
            .when(expanded, |wrapper| wrapper.flex_1().min_h_0());
        div()
            .flex()
            .flex_col()
            .flex_1()
            .child(field.into_element(wrapper, expanded))
            .child(
                div()
                    .flex()
                    .items_center()
                    .mt(px(space.composer_row_gap))
                    .px(footer_padding)
                    .pb(footer_padding)
                    .child(leading)
                    .child(trailing),
            )
            .into_any_element()
    }
}

impl Composer {
    /// Work mode's tray: inside the box in the roomy layout, then tucked
    /// under it otherwise.
    fn trays(&self, cx: &App) -> (Option<AnyElement>, Option<AnyElement>) {
        let tray = (self.mode == ComposerMode::Work).then(|| {
            Tray {
                project_id: self.state.project_id.clone(),
                projects: self.projects.clone(),
                sending: self.state.phase == Phase::Sending,
                embedded: self.layout == ComposerLayout::Roomy,
                handlers: self.handlers.clone(),
            }
            .render(cx)
        });
        match (tray, self.layout) {
            (Some(tray), ComposerLayout::Roomy) => (Some(tray), None),
            (tray, _) => (None, tray),
        }
    }

    /// The box's least height and its corner radius.
    fn surface_size(&self) -> (f32, f32) {
        let tokens = composerkit_theme::tokens();
        let min_height = match self.layout {
            ComposerLayout::Inline if self.conversation => {
                tokens.size.conversation_composer_min_height
            }
            ComposerLayout::Inline => tokens.size.composer_inline_min_height,
            ComposerLayout::Stacked => tokens.size.composer_min_height,
            ComposerLayout::Roomy => 0.,
        };
        let radius = if self.conversation {
            tokens.radius.conversation_composer
        } else {
            tokens.radius.composer
        };
        (min_height, radius)
    }
}

impl Composer {
    /// The text box, and where it and the controls go this frame.
    fn arrange(&self, window: &mut Window, cx: &mut App) -> (BuiltField, Arrangement) {
        let tokens = composerkit_theme::tokens();
        let state = &self.state;
        let layout = self.layout;
        let sending = state.phase == Phase::Sending;
        let hard_break = state.draft.contains('\n');
        let expanded = self.expandable && state.expanded;
        // Full height always uses two rows, so the control that leaves it
        // stays on screen even after the text is cleared.
        let one_row_possible =
            layout == ComposerLayout::Inline && !self.narrow && !hard_break && !expanded;

        let placeholder = if state.dictating {
            "Listening…"
        } else {
            self.mode.placeholder()
        };
        let field = MessageField {
            id: (self.id.clone(), "field").into(),
            draft: state.draft.clone(),
            layout,
            placeholder: placeholder.into(),
            sending,
            one_row_possible,
            one_row_chrome: px(
                2. * (tokens.space.composer_footer_padding + tokens.space.composer_add_gap)
            ),
            expanded,
            handlers: self.handlers.clone(),
        }
        .build(window, cx);
        let FieldMeasure { lines, overflows } = field.measure;
        let two_rows = !one_row_possible || overflows;
        let long_text = hard_break || lines >= EXPAND_FROM_LINES;
        let arrangement = Arrangement {
            two_rows,
            expanded,
            show_expand: self.expandable && (expanded || (two_rows && long_text)),
        };
        (field, arrangement)
    }
}

/// Covers the box while files are dragged over the window, with the same
/// words as the web. The card underneath keeps the draft from showing
/// through. Over the box the dashed edge turns solid and takes the ring's
/// color and a tint of the primary color.
fn drop_overlay(id: impl Into<ElementId>, radius: f32, cx: &App) -> impl IntoElement {
    let tokens = composerkit_theme::tokens();
    let colors = *composerkit_theme::colors(cx);
    div()
        .id(id)
        .test_support()
        .absolute()
        .inset_0()
        .rounded(px(radius))
        .bg(colors.card)
        .child(
            div()
                .size_full()
                .flex()
                .items_center()
                .justify_center()
                .rounded(px(radius))
                .border(px(tokens.border.focus_width))
                .border_dashed()
                .border_color(colors.border)
                .text_color(colors.subtle_foreground)
                .drag_over::<ExternalPaths>(move |style, _, _, _| {
                    style
                        .border_color(colors.ring)
                        .bg(colors.primary.opacity(0.08))
                        .text_color(colors.foreground)
                })
                .child("Drop files to attach"),
        )
}

impl RenderOnce for Composer {
    fn render(self, window: &mut Window, cx: &mut App) -> impl IntoElement {
        let tokens = composerkit_theme::tokens();
        let colors = *composerkit_theme::colors(cx);
        let state = &self.state;
        let (field, arrangement) = self.arrange(window, cx);
        let expanded = arrangement.expanded;
        let surface_probe = field.probe(Part::Surface);
        let focus = field.focus.clone();
        if self.focus_field {
            let focus = focus.clone();
            window.defer(cx, move |window, cx| focus.focus(window, cx));
        }

        let settle = window.use_keyed_state((self.id.clone(), "settle"), cx, |_, _| false);
        let drop_ready = window.use_keyed_state((self.id.clone(), "drop-ready"), cx, |_, _| false);
        // gpui ends a file drag, by a drop or by the files leaving the
        // window, before this frame, so a flag left set is stale.
        if *drop_ready.read(cx) && !cx.has_active_drag() {
            drop_ready.update(cx, |ready, _| *ready = false);
        }
        let ready = *drop_ready.read(cx);
        let add_menu = self.add_menu(&focus, window, cx);
        let add_list = AddMenu::list_with_announcement(&add_menu, self.id.clone(), cx);
        let controls = self.controls(field, &arrangement, &settle, &add_menu, cx);

        let (embedded_tray, tucked_tray) = self.trays(cx);
        let (min_height, radius) = self.surface_size();
        let stop = self.stop_reply.clone();
        let escape_focus = focus.clone();
        let escape_settle = settle.clone();
        // Only the caret shows where the focus is, as on the web.
        let surface = div()
            .id((self.id.clone(), "surface"))
            .relative()
            .flex()
            .flex_col()
            .w_full()
            .min_h(px(min_height))
            .when(expanded, gpui_kit::Styled::flex_1)
            .bg(colors.card)
            .rounded(px(radius))
            .child(surface_probe)
            // Every composer hears a file drag anywhere in the window, so
            // each lights up before the files reach it.
            .on_drag_move::<ExternalPaths>({
                let drop_ready = drop_ready.clone();
                move |_, window, cx| {
                    if !*drop_ready.read(cx) {
                        drop_ready.update(cx, |ready, _| *ready = true);
                        window.refresh();
                    }
                }
            })
            .on_drop({
                let handlers = self.handlers.clone();
                move |paths: &ExternalPaths, window, cx| {
                    drop_ready.update(cx, |ready, _| *ready = false);
                    let paths = paths.paths().into();
                    handlers.request(&ComposerRequest::AttachPaths(paths), window, cx);
                }
            })
            .capture_key_down(move |event: &KeyDownEvent, window, cx| {
                if event.keystroke.key == "escape"
                    && let Some(stop) = &stop
                {
                    cx.stop_propagation();
                    stop_reply_now(stop, &escape_settle, &escape_focus, window, cx);
                }
            })
            .child(crate::accessibility::live_region(
                (self.id.clone(), "upload-announcement"),
                self.upload_notice.clone(),
            ))
            .child(add_list)
            .children(attachment_row(&state.attachments, &self.handlers, cx))
            .when(matches!(state.phase, Phase::Failed(_)), |surface| {
                surface.child(self.send_failure(cx))
            })
            .child(controls)
            .children(embedded_tray)
            .when(arrangement.show_expand, |surface| {
                surface.child(self.expand_toggle(&focus, cx))
            })
            // The edge is drawn over the box, like the web's inset ring, so it
            // takes no room from the sizes above.
            .child(
                div()
                    .absolute()
                    .inset_0()
                    .rounded(px(radius))
                    .border(px(tokens.border.panel))
                    .border_color(colors.border),
            )
            .when(ready, |surface| {
                surface.child(drop_overlay((self.id.clone(), "drop-overlay"), radius, cx))
            });

        // Column-reverse so the surface paints after the tray and covers the
        // part of it that tucks underneath.
        div()
            .id(self.id)
            .flex()
            .flex_col_reverse()
            .w_full()
            .when(expanded, gpui_kit::Styled::h_full)
            .max_w(px(if self.conversation {
                tokens.size.message_column
            } else {
                tokens.size.composer_width
            }))
            .children(tucked_tray)
            .child(surface)
    }
}
