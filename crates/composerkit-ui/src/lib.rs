// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

//! ComposerKit components for gpui-kit apps: the title bar with its tab
//! strip, sidebar sections and rows, the appearance menu, the composer and
//! the conversation view.
//!
//! They read colors and sizes from `composerkit_theme`, so call
//! `composerkit_theme::init` after `gpui_kit::init`. `cargo run --example
//! catalog` shows every component and option.

pub mod composer;
pub mod conversation;

mod accessibility;
mod appearance_menu;
mod assets;
mod conversation_row;
mod focus_ring;
mod home;
mod icon_rail;
mod marquee;
mod mode_toggle;
mod project_list;
mod row_actions;
mod sidebar_section;
mod tab_strip;
mod title_bar;

pub use appearance_menu::AppearanceMenu;
pub use assets::Assets;
pub use conversation_row::{ConversationRow, RowDensity};
pub use home::home_view;
pub use icon_rail::{Destination, IconRail};
pub use mode_toggle::{Mode, ModeToggle, ModeToggleAppearance};
pub use project_list::{Project, ProjectList};
pub use sidebar_section::SidebarSection;
pub use tab_strip::{ChatTab, TabAppearance, TabStrip};
pub use title_bar::{SidebarVisibility, TitleBar};
