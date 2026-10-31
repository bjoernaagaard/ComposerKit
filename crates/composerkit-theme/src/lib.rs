// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

//! The ComposerKit theme for gpui-kit apps.
//!
//! The palette in `design-tokens.json` has one light and one dark
//! scheme. [`init`] installs both as gpui-kit themes, so gpui-kit components
//! pick them up. Colors gpui-kit has no field for, such as subtle text or the
//! composer card, are read with [`colors`].
//!
//! ```ignore
//! gpui_kit::init(cx);
//! composerkit_theme::init(cx);
//! composerkit_theme::set_scheme(Scheme::Dark, cx);
//! ```
//!
//! With [`Scheme::System`] the variant follows the system appearance. Call
//! [`sync_system_appearance`] when it changes, for example from
//! `cx.observe_window_appearance` in the root view.
//!
//! Every function that takes `cx` panics if [`init`] has not run.

use std::collections::BTreeMap;
use std::error::Error;
use std::fmt;
use std::rc::Rc;
use std::sync::LazyLock;
use std::time::Duration;

use gpui_kit::base::TooltipDefaults;
use gpui_kit::base::motion::Easing;
use gpui_kit::component::theme::{Theme, ThemeConfig, ThemeConfigColors, ThemeMode};
use gpui_kit::{App, Global, Hsla, Rgba, SharedString};
use serde::Deserialize;

const TOKENS_JSON: &str = include_str!("../design-tokens.json");

/// Sizes and spacing from `design-tokens.json`, in pixels. Only the
/// groups and fields native components read so far are listed.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
#[non_exhaustive]
pub struct DesignTokens {
    pub radius: Radius,
    pub size: Size,
    pub space: Space,
    pub text: TextScale,
    pub border: Border,
    pub motion: Motion,
}

/// Line widths.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
#[non_exhaustive]
pub struct Border {
    /// The thin rule between rows, such as above an embedded tray.
    pub hairline: f32,
    pub focus_width: f32,
    pub toggle_underline_width: f32,
    pub toggle_underline_offset: f32,
    pub rail_rule: f32,
    /// The gap between a focused control and its ring.
    pub focus_offset: f32,
    /// The outline of menus, tooltips and the composer.
    pub panel: f32,
}

/// Corner radii.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
#[non_exhaustive]
pub struct Radius {
    pub small: f32,
    pub tab: f32,
    pub control: f32,
    pub menu: f32,
    /// A highlighted menu row.
    pub menu_item: f32,
    pub tray: f32,
    pub composer: f32,
    pub user_bubble: f32,
    pub conversation_composer: f32,
    /// The buttons under a turn.
    pub action: f32,
    pub tooltip: f32,
    /// The list the composer's add button opens.
    pub add_menu: f32,
}

/// Fixed sizes of app chrome and controls.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
#[non_exhaustive]
pub struct Size {
    pub titlebar: f32,
    pub sidebar: f32,
    pub row: f32,
    pub row_compact: f32,
    pub row_two_line: f32,
    pub section_heading: f32,
    pub tab_width: f32,
    pub tab_height: f32,
    pub icon: f32,
    pub icon_small: f32,
    /// An icon-only button, such as Copy or Retry under a chat turn.
    pub icon_button: f32,
    /// The height of a small text button, such as "Copy code".
    pub button_small: f32,
    pub composer_width: f32,
    pub message_column: f32,
    pub composer_min_height: f32,
    pub composer_inline_min_height: f32,
    pub conversation_composer_min_height: f32,
    pub composer_roomy_text_min_height: f32,
    pub composer_control: f32,
    pub tray_tuck: f32,
    pub rail: f32,
    pub rail_button: f32,
    pub rail_icon: f32,
    pub row_action: f32,
    pub row_gap: f32,
    pub mode_toggle_width: f32,
    pub mode_toggle_height: f32,
    pub suggestion_row: f32,
    pub suggestion_icon: f32,
    /// The round controls in the composer are a pixel wider than tall.
    pub composer_control_width: f32,
    /// The composer stops growing here and its text scrolls.
    pub composer_max_height: f32,
    /// The text box once the text sits on its own row.
    pub composer_two_row_text_min_height: f32,
    pub composer_expand_width: f32,
    pub composer_expand_height: f32,
    pub action_button_width: f32,
    pub action_button_height: f32,
    /// The row of buttons under a turn.
    pub turn_action_row: f32,
    pub jump_button: f32,
    pub tooltip_height: f32,
    pub menu_item: f32,
    pub model_menu_width: f32,
    /// The model picker's first row, which names the model.
    pub model_menu_header: f32,
    /// The model picker's row of effort steps.
    pub model_menu_slider: f32,
    pub more_menu_width: f32,
    pub submenu_width: f32,
    /// One row of the add menu.
    pub add_menu_item: f32,
    /// The add menu scrolls past this height.
    pub add_menu_max_height: f32,
}

/// Padding and gaps.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
#[non_exhaustive]
pub struct Space {
    pub sidebar_padding: f32,
    /// Inside a menu's edge.
    pub menu_padding: f32,
    /// Inside a menu row, before its text.
    pub menu_item_padding_x: f32,
    /// Between a menu and the control that opened it.
    pub menu_offset: f32,
    /// Between the model picker's rows.
    pub model_menu_row_gap: f32,
    pub mode_toggle_inset: f32,
    pub conversation_list_padding: f32,
    pub bubble_padding_y: f32,
    pub tray_inset: f32,
    pub document_action_inset: f32,
    pub transcript_action_inset: f32,
    pub transcript_gutter: f32,
    pub composer_focus_offset: f32,
    pub row_padding_x: f32,
    pub row_padding_y: f32,
    pub composer_padding_x: f32,
    pub user_bubble_padding_x: f32,
    pub user_bubble_padding_y: f32,
    pub composer_footer_padding: f32,
    pub rail_padding: f32,
    pub rail_gap: f32,
    pub home_bottom: f32,
    pub suggestion_inset: f32,
    pub suggestion_gap: f32,
    pub suggestion_icon_gap: f32,
    pub suggestion_narrow_inset: f32,
    pub suggestion_native_inset: f32,
    pub suggestion_native_offset: f32,
    pub suggestion_native_narrow_offset: f32,
    /// Between the add button and the text on one row.
    pub composer_add_gap: f32,
    /// Between dictation and the round button at the end.
    pub composer_trailing_gap: f32,
    /// Above the text once it sits on its own row.
    pub composer_two_row_top: f32,
    /// Between the text and the controls below it.
    pub composer_row_gap: f32,
    /// The expand control's distance from the top right corner.
    pub composer_expand_inset: f32,
    /// Room the text leaves for the expand control.
    pub composer_expand_reserve: f32,
    /// How far below the top an expanded composer starts.
    pub composer_expanded_top: f32,
    /// Below the docked composer.
    pub composer_bottom: f32,
    /// On both sides of the conversation.
    pub conversation_gutter: f32,
    pub paragraph_gap: f32,
    /// Between your message bubble and the right edge of the column.
    pub bubble_end_inset: f32,
    /// Between your message and its buttons.
    pub prompt_action_gap: f32,
    /// Between a reply and its buttons.
    pub reply_action_gap: f32,
    /// Below your message's buttons, above the reply.
    pub prompt_to_reply: f32,
    /// Below a reply's buttons, above your next message.
    pub reply_to_prompt: f32,
    pub turn_action_gap: f32,
    /// Between the jump button and the composer.
    pub jump_offset: f32,
    pub tooltip_offset: f32,
    /// Inside the add menu, around its rows.
    pub add_menu_padding: f32,
}

/// How long state changes take, and their curve.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
#[non_exhaustive]
pub struct Motion {
    pub duration_ms: u64,
    pub marquee_delay_ms: u64,
    pub marquee_ms_per_pixel: f32,
    pub jump_duration_ms: u64,
    /// How long the pointer rests on a control before its tooltip shows.
    pub tooltip_delay_ms: u64,
    /// How long a tooltip stays after the pointer leaves.
    pub tooltip_close_delay_ms: u64,
    /// How long a stopped reply's stop button stays, disabled.
    pub stop_settle_ms: u64,
    /// How long a finger presses a tab before it can be dragged.
    pub drag_press_ms: u64,
    /// The control points of the curve that slows to a stop.
    pub ease_out: CubicBezier,
}

/// A CSS `cubic-bezier()` curve. Its x control points are in `0..=1`, so it
/// always makes a valid [`Easing`].
#[derive(Clone, Copy, Debug, PartialEq, Deserialize)]
#[serde(try_from = "String")]
pub struct CubicBezier([f32; 4]);

impl CubicBezier {
    /// The curve as a gpui-kit easing.
    #[must_use]
    pub fn easing(self) -> Easing {
        let [x1, y1, x2, y2] = self.0;
        // Construction already ran this check, so it cannot fail here.
        Easing::cubic_bezier(x1, y1, x2, y2).unwrap_or_default()
    }
}

/// A string that is not `cubic-bezier(x1, y1, x2, y2)` with finite numbers
/// and x1 and x2 in `0..=1`.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CubicBezierError {
    css: String,
}

impl fmt::Display for CubicBezierError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "{:?} is not cubic-bezier(x1, y1, x2, y2) with x1 and x2 in 0..=1",
            self.css
        )
    }
}

impl Error for CubicBezierError {}

impl TryFrom<String> for CubicBezier {
    type Error = CubicBezierError;

    fn try_from(css: String) -> Result<Self, Self::Error> {
        let points: Option<[f32; 4]> = css
            .trim()
            .strip_prefix("cubic-bezier(")
            .and_then(|rest| rest.strip_suffix(')'))
            .and_then(|list| {
                list.split(',')
                    .map(|point| point.trim().parse().ok())
                    .collect::<Option<Vec<f32>>>()
            })
            .and_then(|points| points.try_into().ok());
        // gpui-kit's own check decides which curves are valid.
        match points {
            Some([x1, y1, x2, y2]) if Easing::cubic_bezier(x1, y1, x2, y2).is_ok() => {
                Ok(Self([x1, y1, x2, y2]))
            }
            _ => Err(CubicBezierError { css }),
        }
    }
}

/// The type scale.
#[derive(Debug, Deserialize)]
#[non_exhaustive]
pub struct TextScale {
    pub caption: TextStyle,
    pub label: TextStyle,
    pub body: TextStyle,
    pub heading: TextStyle,
    /// The composer's text.
    pub composer: TextStyle,
    /// Messages in a conversation.
    pub message: TextStyle,
    /// The note under the docked composer.
    pub footnote: TextStyle,
}

/// One step of the type scale.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
#[non_exhaustive]
pub struct TextStyle {
    pub size: f32,
    pub line_height: f32,
}

static TOKENS: LazyLock<DesignTokens> =
    LazyLock::new(|| serde_json::from_str(TOKENS_JSON).expect("design-tokens.json parses"));

/// The design tokens both schemes share.
#[must_use]
pub fn tokens() -> &'static DesignTokens {
    &TOKENS
}

/// The colors of one scheme, by role. The roles match shadcn's CSS
/// variables, so `muted_foreground` here is `--muted-foreground` on the web.
#[derive(Clone, Copy, Debug, PartialEq, Deserialize)]
#[serde(rename_all = "kebab-case")]
#[non_exhaustive]
pub struct Colors {
    /// Behind everything: the title bar and the rail.
    pub window: Hsla,
    /// The page a conversation sits on.
    pub background: Hsla,
    pub foreground: Hsla,
    /// Raised surfaces such as the composer.
    pub card: Hsla,
    pub card_foreground: Hsla,
    pub popover: Hsla,
    pub popover_foreground: Hsla,
    /// The fill of the one main action, such as Send.
    pub primary: Hsla,
    pub primary_foreground: Hsla,
    /// Quiet fills such as the track of a switch.
    pub secondary: Hsla,
    pub secondary_foreground: Hsla,
    /// The tray under the composer and the user's message bubble.
    pub muted: Hsla,
    /// Text that is less important than the body.
    pub muted_foreground: Hsla,
    /// Captions, placeholders and idle icons.
    pub subtle_foreground: Hsla,
    /// The hover and highlight fill of rows, items and quiet buttons.
    pub accent: Hsla,
    pub accent_foreground: Hsla,
    pub destructive: Hsla,
    pub warning: Hsla,
    pub success: Hsla,
    /// Hairlines between areas.
    pub border: Hsla,
    /// Outlines of controls, which need more contrast than a border.
    pub input: Hsla,
    /// The keyboard focus ring.
    pub ring: Hsla,
    pub link: Hsla,
    pub selection: Hsla,
    pub avatar: Hsla,
    pub avatar_foreground: Hsla,
    pub sidebar: Hsla,
    pub sidebar_foreground: Hsla,
    pub sidebar_primary: Hsla,
    pub sidebar_primary_foreground: Hsla,
    pub sidebar_accent: Hsla,
    pub sidebar_accent_foreground: Hsla,
    pub sidebar_border: Hsla,
    pub sidebar_ring: Hsla,
}

/// The palette part of the token file: ramps of hex colors, and each scheme
/// as a map from role to a ramp step such as `neutral.900`.
#[derive(Deserialize)]
struct PaletteFile {
    palette: BTreeMap<String, BTreeMap<String, String>>,
    color: SchemeRoles,
}

#[derive(Deserialize)]
struct SchemeRoles {
    light: BTreeMap<String, String>,
    dark: BTreeMap<String, String>,
}

impl PaletteFile {
    fn colors(&self, variant: Variant) -> Colors {
        let roles = match variant {
            Variant::Light => &self.color.light,
            Variant::Dark => &self.color.dark,
        };
        let resolved: serde_json::Map<String, serde_json::Value> = roles
            .iter()
            .map(|(role, step)| (role.clone(), serde_json::Value::from(self.step(step))))
            .collect();
        serde_json::from_value(resolved.into()).unwrap_or_else(|error| {
            panic!("design-tokens.json: the {variant:?} colors do not parse: {error}")
        })
    }

    fn step(&self, reference: &str) -> &str {
        reference
            .split_once('.')
            .and_then(|(ramp, step)| self.palette.get(ramp)?.get(step))
            .unwrap_or_else(|| panic!("design-tokens.json: no palette step {reference}"))
    }
}

/// A light or a dark scheme.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Hash)]
pub enum Variant {
    #[default]
    Light,
    Dark,
}

/// How the theme picks between the light and the dark scheme.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Hash)]
pub enum Scheme {
    /// Follow the system appearance.
    #[default]
    System,
    Light,
    Dark,
}

impl Scheme {
    /// Every scheme, in the order a picker shows them.
    pub const ALL: [Self; 3] = [Self::System, Self::Light, Self::Dark];

    /// The name a picker shows.
    #[must_use]
    pub const fn label(self) -> &'static str {
        match self {
            Self::System => "Same as system",
            Self::Light => "Light",
            Self::Dark => "Dark",
        }
    }
}

/// Both schemes, ready to install.
struct Looks {
    light: Look,
    dark: Look,
}

impl Global for Looks {}

impl Looks {
    const fn look(&self, variant: Variant) -> &Look {
        match variant {
            Variant::Light => &self.light,
            Variant::Dark => &self.dark,
        }
    }
}

/// One scheme: the gpui-kit theme and the full color set.
struct Look {
    config: Rc<ThemeConfig>,
    colors: Colors,
}

impl Look {
    fn new(file: &PaletteFile, variant: Variant) -> Self {
        let colors = file.colors(variant);
        Self {
            config: Rc::new(theme_config(variant, &colors, tokens())),
            colors,
        }
    }
}

struct Active {
    scheme: Scheme,
    variant: Variant,
    colors: Colors,
}

impl Global for Active {}

/// Reads both schemes and shows the one the system appearance asks for.
/// Call after `gpui_kit::init`.
///
/// It also sets the application's tooltip timing to the theme's: every
/// tooltip waits the theme's delay before it shows and closes as soon as
/// the pointer leaves. It starts from the installed [`TooltipDefaults`], so
/// any other setting stays as the application left it. Install your own
/// timing after this call to override it.
///
/// # Panics
///
/// If `design-tokens.json` is malformed or a role names a palette step
/// that does not exist. The file is compiled in, so this fails on the first
/// run after a bad edit.
pub fn init(cx: &mut App) {
    let file: PaletteFile = serde_json::from_str(TOKENS_JSON).expect("design-tokens.json parses");
    let looks = Looks {
        light: Look::new(&file, Variant::Light),
        dark: Look::new(&file, Variant::Dark),
    };
    cx.set_global(Active {
        scheme: Scheme::System,
        variant: Variant::Light,
        colors: looks.light.colors,
    });
    cx.set_global(looks);
    show(cx);
    let motion = &tokens().motion;
    TooltipDefaults::global(cx)
        .with_show_delay(Duration::from_millis(motion.tooltip_delay_ms))
        .with_grace_period(Duration::from_millis(motion.tooltip_close_delay_ms))
        .install(cx);
}

/// Shows this scheme.
pub fn set_scheme(scheme: Scheme, cx: &mut App) {
    cx.global_mut::<Active>().scheme = scheme;
    show(cx);
}

/// Shows the system's variant again if [`Scheme::System`] is chosen. Call
/// it when the system appearance changes.
pub fn sync_system_appearance(cx: &mut App) {
    if cx.global::<Active>().scheme == Scheme::System {
        show(cx);
    }
}

/// The chosen scheme.
#[must_use]
pub fn scheme(cx: &App) -> Scheme {
    cx.global::<Active>().scheme
}

/// The variant on screen. With [`Scheme::System`] the system decides it.
#[must_use]
pub fn variant(cx: &App) -> Variant {
    cx.global::<Active>().variant
}

/// The full color set of the variant on screen.
#[must_use]
pub fn colors(cx: &App) -> &Colors {
    &cx.global::<Active>().colors
}

fn show(cx: &mut App) {
    let dark = match cx.global::<Active>().scheme {
        Scheme::Light => false,
        Scheme::Dark => true,
        Scheme::System => ThemeMode::from(cx.window_appearance()).is_dark(),
    };
    let variant = if dark { Variant::Dark } else { Variant::Light };
    let look = cx.global::<Looks>().look(variant);
    let (config, colors) = (look.config.clone(), look.colors);

    let active = cx.global_mut::<Active>();
    active.variant = variant;
    active.colors = colors;
    Theme::update(cx, |theme| theme.apply_config(&config));
}

/// `#rrggbbaa`, the form gpui-kit theme configs take.
fn to_hex(color: Hsla) -> SharedString {
    let Rgba { r, g, b, a } = Rgba::from(color);
    SharedString::from(format!(
        "#{:02x}{:02x}{:02x}{:02x}",
        to_byte(r),
        to_byte(g),
        to_byte(b),
        to_byte(a)
    ))
}

#[expect(
    clippy::cast_possible_truncation,
    clippy::cast_sign_loss,
    reason = "the channel is clamped to 0..=1 first, so the result fits a u8"
)]
fn to_byte(channel: f32) -> u8 {
    (channel.clamp(0.0, 1.0) * 255.0).round() as u8
}

/// WCAG 2 relative luminance.
fn luminance(color: Hsla) -> f32 {
    let Rgba { r, g, b, .. } = Rgba::from(color);
    let linear = |channel: f32| {
        if channel <= 0.040_45 {
            channel / 12.92
        } else {
            ((channel + 0.055) / 1.055).powf(2.4)
        }
    };
    0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
}

/// WCAG 2 contrast ratio, from 1 to 21.
fn contrast(a: Hsla, b: Hsla) -> f32 {
    let (a, b) = (luminance(a), luminance(b));
    (a.max(b) + 0.05) / (a.min(b) + 0.05)
}

/// The minimum contrast for body text, WCAG 2 level AA.
const TEXT_CONTRAST: f32 = 4.5;

/// Maps the scheme onto the gpui-kit fields its components read. Fields
/// left out keep gpui-kit's own colors for that mode.
fn theme_config(variant: Variant, c: &Colors, tokens: &DesignTokens) -> ThemeConfig {
    let hex = |color: Hsla| Some(to_hex(color));
    // The web button's `hover:bg-primary/85`.
    let faded = |color: Hsla| hex(color.opacity(0.85));
    let clear = || hex(c.background.opacity(0.0));
    // Text on a status fill: the page color if it reads, else the text color.
    let on = |fill: Hsla| {
        if contrast(c.background, fill) >= TEXT_CONTRAST {
            hex(c.background)
        } else {
            hex(c.foreground)
        }
    };

    // Some fields of ThemeConfigColors are private, so it is filled in by
    // assignment.
    let mut colors = ThemeConfigColors::default();
    colors.background = hex(c.background);
    colors.foreground = hex(c.foreground);
    colors.muted = hex(c.muted);
    colors.muted_foreground = hex(c.muted_foreground);
    colors.border = hex(c.border);
    colors.input = hex(c.input);
    colors.ring = hex(c.ring);
    colors.selection = hex(c.selection);
    colors.caret = hex(c.foreground);
    colors.window_border = hex(c.border);
    colors.accent = hex(c.accent);
    colors.accent_foreground = hex(c.accent_foreground);
    // Popovers have no backdrop blur here, so menus are opaque.
    colors.popover = hex(c.popover);
    colors.popover_foreground = hex(c.popover_foreground);
    colors.link = hex(c.link);
    colors.link_hover = hex(c.link);
    colors.link_active = hex(c.link);

    colors.primary = hex(c.primary);
    colors.primary_foreground = hex(c.primary_foreground);
    colors.primary_hover = faded(c.primary);
    colors.primary_active = faded(c.primary);
    colors.button_primary = hex(c.primary);
    colors.button_primary_foreground = hex(c.primary_foreground);
    colors.button_primary_hover = faded(c.primary);
    colors.button_primary_active = faded(c.primary);
    // The web outline button is gpui-kit's default button.
    colors.button = clear();
    colors.button_foreground = hex(c.foreground);
    colors.button_hover = hex(c.accent);
    colors.button_active = hex(c.accent);
    colors.secondary = hex(c.secondary);
    colors.secondary_foreground = hex(c.secondary_foreground);
    colors.secondary_hover = hex(c.input);
    colors.secondary_active = hex(c.input);

    colors.danger = hex(c.destructive);
    colors.danger_foreground = on(c.destructive);
    colors.danger_hover = faded(c.destructive);
    colors.danger_active = faded(c.destructive);
    colors.button_danger = hex(c.destructive);
    colors.button_danger_foreground = on(c.destructive);
    colors.button_danger_hover = faded(c.destructive);
    colors.button_danger_active = faded(c.destructive);
    colors.warning = hex(c.warning);
    colors.warning_foreground = on(c.warning);
    colors.warning_hover = faded(c.warning);
    colors.warning_active = faded(c.warning);
    colors.success = hex(c.success);
    colors.success_foreground = on(c.success);
    colors.success_hover = faded(c.success);
    colors.success_active = faded(c.success);
    colors.info = hex(c.link);
    colors.info_foreground = on(c.link);
    colors.info_hover = faded(c.link);
    colors.info_active = faded(c.link);

    colors.list = hex(c.background);
    colors.list_even = hex(c.background);
    colors.list_head = hex(c.background);
    colors.list_hover = hex(c.accent);
    colors.list_active = hex(c.accent);
    colors.sidebar = hex(c.sidebar);
    colors.sidebar_foreground = hex(c.sidebar_foreground);
    colors.sidebar_border = hex(c.sidebar_border);
    colors.sidebar_accent = hex(c.sidebar_accent);
    colors.sidebar_accent_foreground = hex(c.sidebar_accent_foreground);
    colors.sidebar_primary = hex(c.sidebar_primary);
    colors.sidebar_primary_foreground = hex(c.sidebar_primary_foreground);
    colors.title_bar = hex(c.window);
    colors.title_bar_border = hex(c.border);
    colors.tab_bar = hex(c.window);
    colors.tab_bar_segmented = hex(c.secondary);
    colors.tab = clear();
    colors.tab_active = hex(c.background);
    colors.tab_foreground = hex(c.muted_foreground);
    colors.tab_active_foreground = hex(c.foreground);

    ThemeConfig {
        name: SharedString::from(match variant {
            Variant::Light => "ComposerKit Light",
            Variant::Dark => "ComposerKit Dark",
        }),
        mode: match variant {
            Variant::Light => ThemeMode::Light,
            Variant::Dark => ThemeMode::Dark,
        },
        font_size: Some(tokens.text.body.size),
        radius: Some(px_round(tokens.radius.control)),
        radius_lg: Some(px_round(tokens.radius.menu)),
        colors,
        ..ThemeConfig::default()
    }
}

#[expect(
    clippy::cast_possible_truncation,
    clippy::cast_sign_loss,
    reason = "radius tokens are small positive pixel values"
)]
fn px_round(value: f32) -> usize {
    value.round() as usize
}
