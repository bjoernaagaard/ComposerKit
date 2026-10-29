// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

use crate::focus_ring::KeyboardRing as _;
use std::rc::Rc;

use gpui_kit::assets::IconName;
use gpui_kit::component::button::{Button, ButtonVariants as _};
use gpui_kit::component::input::{Input, InputState};
use gpui_kit::component::tooltip::Tooltip;
use gpui_kit::component::{Icon, Sizable as _};
use gpui_kit::{
    App, AppContext as _, DismissEvent, Div, ElementId, Entity, Focusable as _,
    InteractiveElement as _, IntoElement, KeyDownEvent, ParentElement as _, RenderOnce,
    SharedString, StatefulInteractiveElement as _, Styled as _, Window, accesskit::Role, div,
    prelude::FluentBuilder as _, px,
};

use crate::marquee::MarqueeLabel;
use crate::row_actions::{self, RowState};

/// A project in the sidebar.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Project {
    pub id: SharedString,
    pub name: SharedString,
}

impl Project {
    #[must_use]
    pub fn new(id: impl Into<SharedString>, name: impl Into<SharedString>) -> Self {
        Self {
            id: id.into(),
            name: name.into(),
        }
    }
}

type ProjectHandler = Rc<dyn Fn(&SharedString, &mut Window, &mut App)>;
type DismissHandler = Rc<dyn Fn(&DismissEvent, &mut Window, &mut App)>;

/// The Projects section's rows. Each row has a "New chat in …"
/// button that shows on hover and when it has focus; Tab reaches it while it
/// is hidden. While [`Self::adding`] is set, a form for a new project's
/// name follows the rows: Enter adds, Escape cancels, and a blank or
/// existing name gets an error under the field instead.
#[derive(IntoElement)]
pub struct ProjectList {
    id: ElementId,
    projects: Vec<Project>,
    adding: bool,
    on_add: Option<ProjectHandler>,
    on_cancel_add: Option<DismissHandler>,
    on_start_chat: Option<ProjectHandler>,
}

impl ProjectList {
    #[must_use]
    pub fn new(id: impl Into<ElementId>, projects: impl IntoIterator<Item = Project>) -> Self {
        Self {
            id: id.into(),
            projects: projects.into_iter().collect(),
            adding: false,
            on_add: None,
            on_cancel_add: None,
            on_start_chat: None,
        }
    }

    /// Shows the new project form after the rows.
    #[must_use]
    pub fn adding(mut self, adding: bool) -> Self {
        self.adding = adding;
        self
    }

    /// Called with the new project's name, trimmed, once it is neither blank
    /// nor taken.
    #[must_use]
    pub fn on_add(
        mut self,
        handler: impl Fn(&SharedString, &mut Window, &mut App) + 'static,
    ) -> Self {
        self.on_add = Some(Rc::new(handler));
        self
    }

    /// Called when the form is cancelled with Escape or its Cancel button.
    #[must_use]
    pub fn on_cancel_add(
        mut self,
        handler: impl Fn(&DismissEvent, &mut Window, &mut App) + 'static,
    ) -> Self {
        self.on_cancel_add = Some(Rc::new(handler));
        self
    }

    /// Called with the id of the project to start a chat in.
    #[must_use]
    pub fn on_start_chat(
        mut self,
        handler: impl Fn(&SharedString, &mut Window, &mut App) + 'static,
    ) -> Self {
        self.on_start_chat = Some(Rc::new(handler));
        self
    }
}

/// The trimmed name, or why it cannot be added.
fn check_name(name: &str, projects: &[Project]) -> Result<SharedString, SharedString> {
    let name = name.trim();
    if name.is_empty() {
        return Err("Type a name for the project, or choose Cancel.".into());
    }
    if projects
        .iter()
        .any(|project| project.name.to_lowercase() == name.to_lowercase())
    {
        return Err(
            format!("There is already a project called “{name}”. Try another name.").into(),
        );
    }
    Ok(SharedString::from(name.to_owned()))
}

fn project_row(
    list: &ElementId,
    project: Project,
    on_start_chat: Option<ProjectHandler>,
    window: &mut Window,
    cx: &mut App,
) -> impl IntoElement + use<> {
    let tokens = composerkit_theme::tokens();
    let colors = *composerkit_theme::colors(cx);
    let id = ElementId::NamedChild(list.clone().into(), project.id.clone());
    let state = window.use_keyed_state((id.clone(), "row"), cx, |_, cx| RowState::<1>::new(cx));
    let revealed = state.read(cx).revealed(window);
    let [focus] = state.read(cx).focus.clone();
    let body = &tokens.text.body;
    let name = project.name.clone();

    let start_chat = on_start_chat.map(|handler| {
        let label: SharedString = format!("New chat in {}", project.name).into();
        let project_id = project.id.clone();
        row_actions::action_button(
            (id.clone(), "start-chat"),
            IconName::SquarePen,
            label.clone(),
            label,
            &focus,
            cx,
        )
        .on_click(move |_, window, cx| handler(&project_id, window, cx))
    });
    let has_action = start_chat.is_some();
    let room = if has_action {
        row_actions::shown_room(1)
    } else {
        tokens.space.row_padding_x
    };

    div()
        .id((id.clone(), "hover"))
        .relative()
        .w_full()
        .on_hover(move |hovered, _, cx| {
            state.update(cx, |state, cx| {
                state.hovered = *hovered;
                cx.notify();
            });
        })
        .child(
            div()
                .id((id.clone(), "label"))
                .flex()
                .items_center()
                .gap_2()
                .min_h(px(tokens.size.row))
                .py(px(tokens.space.row_padding_y))
                .pl(px(tokens.space.row_padding_x))
                .pr(px(room))
                .rounded(px(tokens.radius.control))
                .text_color(colors.muted_foreground)
                .child(
                    Icon::new(IconName::Folder)
                        .with_size(px(tokens.size.icon))
                        .text_color(colors.subtle_foreground),
                )
                .child(MarqueeLabel::new((id, "name"), project.name, body).active(revealed))
                .tooltip(move |window, cx| Tooltip::new(name.clone()).build(window, cx)),
        )
        .when_some(start_chat, |row, button| {
            row.child(
                div()
                    .absolute()
                    .top_0()
                    .bottom_0()
                    .right(row_actions::inset())
                    .flex()
                    .items_center()
                    .opacity(if revealed { 1. } else { 0. })
                    .child(button),
            )
        })
}

/// The new project form keeps its field and error between frames.
struct AddForm {
    input: Entity<InputState>,
    error: Option<SharedString>,
}

/// A form action that needs no event.
type FormAction = Rc<dyn Fn(&mut Window, &mut App)>;

impl ProjectList {
    fn add_form(&self, window: &mut Window, cx: &mut App) -> Div {
        let form = window.use_keyed_state((self.id.clone(), "add"), cx, |window, cx| {
            let input = cx.new(|cx| InputState::new(window, cx).placeholder("Project name"));
            // The form opens on an explicit "Add new project", so focus
            // follows it into the field.
            input.focus_handle(cx).focus(window, cx);
            AddForm { input, error: None }
        });
        let AddForm { input, error } = form.read(cx);
        let (input, error) = (input.clone(), error.clone());

        let submit: FormAction = {
            let (input, on_add) = (input.clone(), self.on_add.clone());
            let projects: Rc<[Project]> = self.projects.clone().into();
            Rc::new(move |window, cx| {
                let error = match check_name(&input.read(cx).value(), &projects) {
                    Ok(name) => {
                        input.update(cx, |input, cx| input.set_value("", window, cx));
                        if let Some(on_add) = &on_add {
                            on_add(&name, window, cx);
                        }
                        None
                    }
                    Err(error) => Some(error),
                };
                form.update(cx, |form, cx| {
                    form.error = error;
                    cx.notify();
                });
            })
        };
        let cancel: FormAction = {
            let on_cancel = self.on_cancel_add.clone();
            Rc::new(move |window, cx| {
                if let Some(on_cancel) = &on_cancel {
                    on_cancel(&DismissEvent, window, cx);
                }
            })
        };

        let field_focus = input.focus_handle(cx);
        let (on_enter, on_escape) = (Rc::clone(&submit), Rc::clone(&cancel));
        let caption = &composerkit_theme::tokens().text.caption;
        div()
            .flex()
            .flex_col()
            .gap_1()
            .p_1()
            .capture_key_down(move |event: &KeyDownEvent, window, cx| {
                if !field_focus.is_focused(window) {
                    return;
                }
                match event.keystroke.key.as_str() {
                    "enter" => on_enter(window, cx),
                    "escape" => on_escape(window, cx),
                    _ => return,
                }
                cx.stop_propagation();
            })
            .child(Input::new(&input).aria_label("Project name"))
            .when_some(error, |form, error| {
                form.child(
                    div()
                        .id((self.id.clone(), "add-error"))
                        .role(Role::Alert)
                        .px_1()
                        .text_color(composerkit_theme::colors(cx).destructive)
                        .text_size(px(caption.size))
                        .line_height(px(caption.line_height))
                        .child(error),
                )
            })
            .child(
                div()
                    .flex()
                    .justify_end()
                    .gap_1()
                    .child(
                        Button::new((self.id.clone(), "add-cancel"))
                            .keyboard_ring(cx)
                            .small()
                            .label("Cancel")
                            .on_click(move |_, window, cx| cancel(window, cx)),
                    )
                    .child(
                        Button::new((self.id.clone(), "add-submit"))
                            .keyboard_ring(cx)
                            .primary()
                            .small()
                            .label("Add project")
                            .on_click(move |_, window, cx| submit(window, cx)),
                    ),
            )
    }
}

impl RenderOnce for ProjectList {
    fn render(self, window: &mut Window, cx: &mut App) -> impl IntoElement {
        let rows: Vec<_> = self
            .projects
            .iter()
            .cloned()
            .map(|project| project_row(&self.id, project, self.on_start_chat.clone(), window, cx))
            .collect();
        let form = self.adding.then(|| self.add_form(window, cx));

        div()
            .flex()
            .flex_col()
            .gap(px(composerkit_theme::tokens().size.row_gap))
            .children(rows)
            .children(form)
    }
}
