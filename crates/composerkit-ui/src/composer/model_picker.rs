// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

use gpui_kit::accesskit::{Role, Toggled};
use gpui_kit::assets::IconName;
use gpui_kit::component::popover::{Popover, PopoverState};
use gpui_kit::component::{Icon, Sizable as _, ThemeStyled as _};
use gpui_kit::{
    Anchor, AnyElement, App, Context, Div, ElementId, Entity, FocusHandle, InteractiveElement as _,
    IntoElement, KeyDownEvent, ParentElement as _, RenderOnce, SharedString, Stateful,
    StatefulInteractiveElement as _, Styled as _, Window, div, prelude::FluentBuilder as _, px,
};

use crate::accessibility::live_region;

use super::choices::{Effort, Model};
use super::machine::ComposerAction;
use super::menus::footer_button;
use super::view::Handlers;

/// Which panel the picker shows. The list of models replaces the first
/// panel in place rather than opening beside it.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
enum Panel {
    #[default]
    Main,
    Models,
}

/// The first panel's rows.
const MODEL_ROW: usize = 0;
const EFFORT_ROW: usize = 1;
const MAIN_ROWS: usize = 2;

/// What the picker keeps between frames.
struct PickerState {
    panel: Panel,
    /// The row the keyboard or pointer is on. None while the panel itself
    /// has focus, as it does after it opens.
    highlighted: Option<usize>,
    focus: FocusHandle,
}

impl PickerState {
    fn rows(&self) -> usize {
        match self.panel {
            Panel::Main => MAIN_ROWS,
            Panel::Models => Model::ALL.len(),
        }
    }

    /// Up and Down move between rows and wrap; Home and End go to the ends.
    /// From the panel itself, Down goes to the first row and Up to the last.
    fn step(&mut self, key: &str) -> bool {
        let last = self.rows() - 1;
        self.highlighted = Some(match (key, self.highlighted) {
            ("down", None) | ("home", _) => 0,
            ("up", None | Some(0)) | ("end", _) => last,
            ("down", Some(row)) => (row + 1) % (last + 1),
            ("up", Some(row)) => row - 1,
            _ => return false,
        });
        true
    }

    fn show(&mut self, panel: Panel, highlighted: usize) {
        self.panel = panel;
        self.highlighted = Some(highlighted);
    }
}

/// The model and effort picker, the native twin of the web `ModelMenu`.
///
/// A panel opens above the trigger with two rows. The first names the
/// model; Enter or a click on it swaps the panel for the list of models,
/// with the current one highlighted, and Left goes back to the first row.
/// The second is the effort, five steps that Left and Right move along. Up
/// and Down move between rows and wrap, Home and End go to the ends,
/// picking a model closes the picker, and Escape closes it and returns
/// focus to where it was. In the inline layout the effort is hidden on the
/// trigger, so a tooltip names both.
#[derive(IntoElement)]
pub(super) struct ModelPicker {
    pub(super) model: Model,
    pub(super) effort: Effort,
    pub(super) compact: bool,
    pub(super) handlers: Handlers,
}

impl ModelPicker {
    fn trigger(&self, cx: &App) -> gpui_kit::component::button::Button {
        let colors = composerkit_theme::colors(cx);
        let (model, effort) = (self.model.label(), self.effort.label());
        // The name starts with the words on the button, so speech input can
        // say them to press it.
        footer_button("model", cx)
            .accessibility_label(format!("{model} {effort} effort, choose model"))
            .when(self.compact, |button| {
                button.tooltip(SharedString::from(format!("{model}, {effort}")))
            })
            .child(div().truncate().text_color(colors.foreground).child(model))
            .when(!self.compact, |button| {
                button.child(div().truncate().child(effort))
            })
            .child(Icon::new(IconName::ChevronDown).small())
    }
}

impl RenderOnce for ModelPicker {
    fn render(self, window: &mut Window, cx: &mut App) -> impl IntoElement {
        let state = window.use_keyed_state("model-picker", cx, |_, cx| PickerState {
            panel: Panel::Main,
            highlighted: None,
            focus: cx.focus_handle(),
        });
        let focus = state.read(cx).focus.clone();
        let trigger = self.trigger(cx);
        let closed = state.clone();
        let Self {
            model,
            effort,
            handlers,
            ..
        } = self;
        let popover = Popover::new("model-picker-popover")
            .anchor(Anchor::BottomRight)
            .offset(px(composerkit_theme::tokens().space.menu_offset))
            .appearance(false)
            .track_focus(&focus)
            .trigger(trigger)
            .on_open_change(move |open, _, cx| {
                if !*open {
                    closed.update(cx, |state, _| {
                        state.panel = Panel::Main;
                        state.highlighted = None;
                    });
                }
            })
            .content(move |_, _, cx| {
                OpenPanel {
                    state: state.clone(),
                    popover: cx.entity(),
                    model,
                    effort,
                    handlers: handlers.clone(),
                }
                .render(cx)
            });
        // A click on the trigger leaves focus where it was, so closing the
        // picker returns focus there, such as to the message field. The
        // popover still opens, since it does not wait on this.
        div()
            .id("model-picker")
            .flex()
            .min_w_0()
            .capture_any_mouse_down(|_, window, _| window.prevent_default())
            .child(popover)
    }
}

/// The width of the effort's name in front of its steps.
const EFFORT_LABEL_WIDTH: f32 = 64.;
/// The effort steps' dots, and the larger dot on the current step.
const DOT: f32 = 6.;
const CURRENT_DOT: f32 = 10.;

/// The open panel, built on every frame from the picker's state.
#[derive(Clone)]
struct OpenPanel {
    state: Entity<PickerState>,
    popover: Entity<PopoverState>,
    model: Model,
    effort: Effort,
    handlers: Handlers,
}

/// What the picker does for a key, worked out before anything changes.
enum KeyResult {
    Moved,
    OpenModels,
    Back,
    Choose(Model),
    Effort(Effort),
    Ignored,
}

/// The effort `steps` away from `effort`, held at the ends.
fn effort_step(effort: Effort, steps: isize) -> Effort {
    let at = Effort::ALL
        .iter()
        .position(|choice| *choice == effort)
        .unwrap_or_default();
    let last = Effort::ALL.len() - 1;
    Effort::ALL[at.saturating_add_signed(steps).min(last)]
}

impl OpenPanel {
    fn key_result(&self, key: &str, cx: &mut App) -> KeyResult {
        let effort = self.effort;
        self.state.update(cx, |state, _| match (state.panel, key) {
            (_, "up" | "down" | "home" | "end") => {
                if state.step(key) {
                    KeyResult::Moved
                } else {
                    KeyResult::Ignored
                }
            }
            (Panel::Main, "enter" | "space") if state.highlighted == Some(MODEL_ROW) => {
                KeyResult::OpenModels
            }
            (Panel::Main, "left") if state.highlighted == Some(EFFORT_ROW) => {
                KeyResult::Effort(effort_step(effort, -1))
            }
            (Panel::Main, "right") if state.highlighted == Some(EFFORT_ROW) => {
                KeyResult::Effort(effort_step(effort, 1))
            }
            (Panel::Models, "left") => KeyResult::Back,
            (Panel::Models, "enter" | "space") => state
                .highlighted
                .and_then(|row| Model::ALL.get(row).copied())
                .map_or(KeyResult::Ignored, KeyResult::Choose),
            _ => KeyResult::Ignored,
        })
    }

    fn on_key(&self, event: &KeyDownEvent, window: &mut Window, cx: &mut App) {
        let result = self.key_result(event.keystroke.key.as_str(), cx);
        match result {
            KeyResult::Ignored => return,
            KeyResult::Moved => {}
            KeyResult::OpenModels => self.open_models(cx),
            KeyResult::Back => self
                .state
                .update(cx, |state, _| state.show(Panel::Main, MODEL_ROW)),
            KeyResult::Choose(model) => self.choose(model, window, cx),
            KeyResult::Effort(effort) => self.set_effort(effort, window, cx),
        }
        cx.stop_propagation();
        window.refresh();
    }

    fn open_models(&self, cx: &mut App) {
        let current = Model::ALL
            .iter()
            .position(|choice| *choice == self.model)
            .unwrap_or_default();
        self.state
            .update(cx, |state, _| state.show(Panel::Models, current));
    }

    fn choose(&self, model: Model, window: &mut Window, cx: &mut App) {
        self.handlers
            .act(&ComposerAction::ModelChanged { model }, window, cx);
        self.popover
            .update(cx, |popover, cx| popover.dismiss(window, cx));
    }

    fn set_effort(&self, effort: Effort, window: &mut Window, cx: &mut App) {
        if effort != self.effort {
            self.handlers
                .act(&ComposerAction::EffortChanged { effort }, window, cx);
        }
    }

    /// A row that takes the highlight when the pointer is over it and
    /// shows a rounded fill while highlighted.
    fn row(&self, id: impl Into<ElementId>, row: usize, cx: &App) -> Stateful<Div> {
        let tokens = composerkit_theme::tokens();
        let colors = composerkit_theme::colors(cx);
        let highlighted = self.state.read(cx).highlighted == Some(row);
        let state = self.state.clone();
        div()
            .id(id)
            .flex()
            .items_center()
            .rounded(px(tokens.radius.menu_item))
            .px(px(tokens.space.menu_item_padding_x))
            .when(highlighted, |row| {
                row.bg(colors.accent)
                    .text_color(colors.accent_foreground)
                    .aria_active_descendant()
            })
            .on_hover(move |hovered, window, cx| {
                if *hovered {
                    state.update(cx, |state, _| state.highlighted = Some(row));
                    window.refresh();
                }
            })
    }

    /// The first row names the model and opens the list of models.
    fn model_row(&self, cx: &App) -> Stateful<Div> {
        let tokens = composerkit_theme::tokens();
        let colors = composerkit_theme::colors(cx);
        let panel = self.clone();
        self.row("model-row", MODEL_ROW, cx)
            .role(Role::MenuItem)
            .aria_label(format!("Model: {}", self.model.label()))
            .h(px(tokens.size.model_menu_header))
            .justify_center()
            .gap_1()
            .child(self.model.label())
            .child(
                Icon::new(IconName::ChevronRight)
                    .small()
                    .text_color(colors.subtle_foreground),
            )
            .on_click(move |_, window, cx| {
                panel.open_models(cx);
                window.refresh();
            })
    }

    /// The second row: the effort as a row of steps. Left and Right move
    /// along it, a click picks the step under the pointer, and a status
    /// says which step it is on.
    fn effort_row(&self, cx: &App) -> Stateful<Div> {
        let tokens = composerkit_theme::tokens();
        let colors = composerkit_theme::colors(cx);
        let caption = &tokens.text.caption;
        let at = Effort::ALL
            .iter()
            .position(|choice| *choice == self.effort)
            .unwrap_or_default();
        let label = self.effort.label();
        let steps = Effort::ALL.into_iter().enumerate().map(|(step, choice)| {
            let panel = self.clone();
            let dot = if step == at { CURRENT_DOT } else { DOT };
            let fill = if step <= at {
                colors.foreground
            } else {
                colors.input
            };
            div()
                .id(("effort-step", step))
                .flex()
                .flex_1()
                .h_full()
                .items_center()
                .justify_center()
                .child(div().size(px(dot)).rounded_full().bg(fill))
                .on_click(move |_, window, cx| {
                    panel.set_effort(choice, window, cx);
                    window.refresh();
                })
        });
        self.row("effort-row", EFFORT_ROW, cx)
            .role(Role::MenuItem)
            .aria_label(format!("Effort: {label}"))
            .aria_description("Left and Right arrow keys change the effort.")
            .h(px(tokens.size.model_menu_slider))
            .gap_3()
            .text_size(px(caption.size))
            .line_height(px(caption.line_height))
            .child(
                div()
                    .w(px(EFFORT_LABEL_WIDTH))
                    .flex_shrink_0()
                    .truncate()
                    .text_color(colors.subtle_foreground)
                    .child(label),
            )
            .child(
                div()
                    .flex()
                    .flex_1()
                    .h_full()
                    .items_center()
                    .children(steps),
            )
            .child(live_region(
                "effort-status",
                format!("{label}, {} of {}", at + 1, Effort::ALL.len()),
            ))
    }

    /// One model in the list. The current one has a check mark.
    fn model_item(&self, row: usize, choice: Model, cx: &App) -> Stateful<Div> {
        let tokens = composerkit_theme::tokens();
        let colors = composerkit_theme::colors(cx);
        let current = choice == self.model;
        let panel = self.clone();
        self.row(("model", row), row, cx)
            .role(Role::MenuItemRadio)
            .aria_label(choice.label())
            .aria_toggled(if current {
                Toggled::True
            } else {
                Toggled::False
            })
            .min_h(px(tokens.size.menu_item))
            .gap_2()
            .child(div().flex_1().min_w_0().truncate().child(choice.label()))
            .when(current, |item| {
                item.child(
                    Icon::new(IconName::Check)
                        .small()
                        .text_color(colors.muted_foreground),
                )
            })
            .on_click(move |_, window, cx| panel.choose(choice, window, cx))
    }

    fn render(self, cx: &mut Context<PopoverState>) -> AnyElement {
        let tokens = composerkit_theme::tokens();
        let label = &tokens.text.label;
        let (panel, focus) = {
            let state = self.state.read(cx);
            (state.panel, state.focus.clone())
        };
        let keys = self.clone();
        div()
            .id("model-picker-panel")
            .track_focus(&focus)
            .role(Role::Menu)
            .aria_label("Model and effort")
            .popover_style(cx)
            .rounded(px(tokens.radius.menu))
            .p(px(tokens.space.menu_padding))
            .w(px(tokens.size.model_menu_width))
            .flex()
            .flex_col()
            .text_size(px(label.size))
            .line_height(px(label.line_height))
            .on_key_down(move |event, window, cx| keys.on_key(event, window, cx))
            .map(|list| match panel {
                Panel::Main => list
                    .gap(px(tokens.space.model_menu_row_gap))
                    .child(self.model_row(cx))
                    .child(self.effort_row(cx)),
                Panel::Models => list.children(
                    Model::ALL
                        .into_iter()
                        .enumerate()
                        .map(|(row, choice)| self.model_item(row, choice, cx)),
                ),
            })
            .into_any_element()
    }
}
