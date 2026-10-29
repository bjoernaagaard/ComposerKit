// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

//! The models, efforts and permission modes the composer's menus offer. The
//! names are made up for the demo and match the web demo's menus.

/// A model the model menu offers.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Hash)]
pub enum Model {
    Auto,
    #[default]
    Sparrow3,
    Sparrow3Mini,
    Heron2,
    Heron2Long,
}

impl Model {
    /// Every model, in the order the menu lists them.
    pub const ALL: [Self; 5] = [
        Self::Auto,
        Self::Sparrow3,
        Self::Sparrow3Mini,
        Self::Heron2,
        Self::Heron2Long,
    ];

    /// The name the menu and its trigger show.
    #[must_use]
    pub const fn label(self) -> &'static str {
        match self {
            Self::Auto => "Auto",
            Self::Sparrow3 => "Sparrow 3",
            Self::Sparrow3Mini => "Sparrow 3 Mini",
            Self::Heron2 => "Heron 2",
            Self::Heron2Long => "Heron 2 Long",
        }
    }

    /// A second line under the name, for the models that have one.
    #[must_use]
    pub const fn description(self) -> Option<&'static str> {
        match self {
            Self::Auto => Some("Picks a model for each message"),
            _ => None,
        }
    }
}

/// How long the model thinks before it answers.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub enum Effort {
    Brief,
    Quick,
    #[default]
    Balanced,
    Careful,
    Exhaustive,
}

impl Effort {
    /// Every effort, from least to most.
    pub const ALL: [Self; 5] = [
        Self::Brief,
        Self::Quick,
        Self::Balanced,
        Self::Careful,
        Self::Exhaustive,
    ];

    /// The name the menu and its trigger show.
    #[must_use]
    pub const fn label(self) -> &'static str {
        match self {
            Self::Brief => "Brief",
            Self::Quick => "Quick",
            Self::Balanced => "Balanced",
            Self::Careful => "Careful",
            Self::Exhaustive => "Exhaustive",
        }
    }

    /// The line under the name in the menu.
    #[must_use]
    pub const fn description(self) -> &'static str {
        match self {
            Self::Brief => "The shortest answer that works",
            Self::Quick => "Answers right away",
            Self::Balanced => "Thinks a little first",
            Self::Careful => "Checks its work before answering",
            Self::Exhaustive => "Takes as long as the task needs",
        }
    }
}

/// What the agent may do without asking, in Work mode.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Hash)]
pub enum Permission {
    Ask,
    Trusted,
    Open,
    #[default]
    Project,
}

impl Permission {
    /// Every permission mode, in the order the menu lists them.
    pub const ALL: [Self; 4] = [Self::Ask, Self::Trusted, Self::Open, Self::Project];

    /// The name the menu and its trigger show.
    #[must_use]
    pub const fn label(self) -> &'static str {
        match self {
            Self::Ask => "Ask first",
            Self::Trusted => "Trust safe actions",
            Self::Open => "No limits",
            Self::Project => "Project rules",
        }
    }

    /// The line under the name in the menu.
    #[must_use]
    pub const fn description(self) -> &'static str {
        match self {
            Self::Ask => "Checks with you before it edits files outside the project or goes online",
            Self::Trusted => "Asks only when an action looks risky",
            Self::Open => "Can change any file and use the network without asking",
            Self::Project => "Follows the rules saved with the project",
        }
    }

    /// Whether the trigger warns about this mode, because it never asks.
    #[must_use]
    pub const fn caution(self) -> bool {
        matches!(self, Self::Open)
    }
}
