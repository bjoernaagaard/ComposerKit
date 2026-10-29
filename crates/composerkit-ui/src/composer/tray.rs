// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

use gpui_kit::assets::IconName;
use gpui_kit::component::button::Button;
use gpui_kit::component::menu::{DropdownMenu as _, PopupMenuItem};
use gpui_kit::component::{Disableable as _, Icon, Sizable as _};
use gpui_kit::{
    Anchor, AnyElement, App, ElementId, IntoElement, ParentElement as _, SharedString, Styled as _,
    div, px,
};

use super::machine::ComposerAction;
use super::menus::{described_item, footer_button};
use super::view::{ComposerProject, ComposerRequest, Handlers};

/// The utility bar in Work mode: project, files, plugins and where the chat
/// runs. Tucked under the composer, or embedded inside it as its last row.
pub(super) struct Tray {
    pub(super) project_id: Option<String>,
    pub(super) projects: Vec<ComposerProject>,
    pub(super) sending: bool,
    pub(super) embedded: bool,
    pub(super) handlers: Handlers,
}

/// A tray button: a dim icon, then a label in the text color.
fn tray_button(
    id: impl Into<ElementId>,
    icon: IconName,
    label: impl Into<SharedString>,
    cx: &App,
) -> Button {
    let text = composerkit_theme::colors(cx).foreground;
    footer_button(id, cx)
        .gap_1p5()
        .child(Icon::new(icon).small())
        .child(div().truncate().text_color(text).child(label.into()))
}

impl Tray {
    fn project_menu(&self, cx: &App) -> impl IntoElement {
        let project = self
            .projects
            .iter()
            .find(|project| Some(project.id.as_ref()) == self.project_id.as_deref());
        let (label, accessible) = match project {
            Some(project) => (
                project.name.clone(),
                format!("Project {}. Change", project.name),
            ),
            None => ("Pick a project".into(), "Pick a project".to_owned()),
        };
        let projects = self.projects.clone();
        let current = self.project_id.clone();
        let handlers = self.handlers.clone();

        tray_button("project", IconName::Folder, label, cx)
            .accessibility_label(accessible)
            .dropdown_menu(move |menu, _, _| {
                let choices = std::iter::once((None, SharedString::from("No project"))).chain(
                    projects
                        .iter()
                        .map(|project| (Some(project.id.to_string()), project.name.clone())),
                );
                choices.fold(menu, |menu, (id, name)| {
                    let handlers = handlers.clone();
                    let checked = id == current;
                    menu.item(PopupMenuItem::new(name).checked(checked).on_click(
                        move |_, window, cx| {
                            handlers.act(
                                &ComposerAction::ProjectChanged {
                                    project_id: id.clone(),
                                },
                                window,
                                cx,
                            );
                        },
                    ))
                })
            })
    }

    pub(super) fn render(self, cx: &App) -> AnyElement {
        let tokens = composerkit_theme::tokens();
        let colors = composerkit_theme::colors(cx);
        let handlers = self.handlers.clone();

        let files = tray_button("files", IconName::Files, "Files", cx)
            .disabled(self.sending)
            .on_click(move |_, window, cx| {
                handlers.request(ComposerRequest::PickFiles, window, cx);
            });
        let plugins =
            tray_button("plugins", IconName::Plug, "Tools", cx).dropdown_menu(|menu, _, _| {
                menu.item(
                    described_item("No tools yet", Some("Tools you connect show up here."))
                        .disabled(true),
                )
            });
        let location = footer_button("run-location", cx)
            .w(px(tokens.size.composer_control))
            .px_0()
            .tooltip("Where this runs")
            .accessibility_label("Where this runs")
            .child(Icon::new(IconName::Laptop).small())
            .dropdown_menu_with_anchor(Anchor::TopRight, |menu, _, _| {
                menu.item(described_item("This computer", Some("Uses this device")).checked(true))
                    .item(
                        described_item("Remote machine", Some("Not available yet")).disabled(true),
                    )
            });

        let row = div()
            .flex()
            .items_center()
            .gap_2()
            .min_w_0()
            .py_1p5()
            .child(self.project_menu(cx))
            .child(files)
            .child(plugins)
            .child(div().flex_1())
            .child(location);

        if self.embedded {
            div()
                .mx(px(tokens.space.composer_footer_padding))
                .border_t(px(tokens.border.hairline))
                .border_color(colors.border)
                .child(row)
                .into_any_element()
        } else {
            // The tray tucks under the surface, which paints over its top.
            let tuck = px(tokens.size.tray_tuck);
            div()
                .mx(px(tokens.space.tray_inset))
                .mt(-tuck)
                .pt(tuck)
                .px_1()
                .bg(colors.muted)
                .rounded_b(px(tokens.radius.tray))
                .child(row)
                .into_any_element()
        }
    }
}
