// SPDX-FileCopyrightText: 2026 Bjørn Aagaard
// SPDX-License-Identifier: MIT

use std::borrow::Cow;

use gpui_kit::{AssetSource, Result, SharedString};

// The Lucide icons these components draw that gpui-kit's default bundle
// leaves out.
gpui_kit::assets::icon_assets!(
    ExtraIcons,
    [
        AudioLines,
        Blocks,
        CalendarClock,
        Circle,
        File,
        Files,
        FolderPlus,
        House,
        Image,
        Laptop,
        Maximize2,
        MessageCircle,
        MicVocal,
        Minimize2,
        NotebookPen,
        Pencil,
        Pin,
        PinOff,
        Plug,
        Share,
        Shield,
        SquarePen,
        Volume2,
        X,
    ]
);

/// gpui-kit's component icons plus every icon these components draw.
/// Register it with `gpui_kit::application().with_assets(composerkit_ui::Assets)`;
/// with gpui-kit's own `Assets` the rail, row, tab and composer icons stay blank.
#[derive(Clone, Copy, Debug, Default)]
pub struct Assets;

impl AssetSource for Assets {
    fn load(&self, path: &str) -> Result<Option<Cow<'static, [u8]>>> {
        match ExtraIcons.load(path)? {
            Some(bytes) => Ok(Some(bytes)),
            None => gpui_kit::assets::Assets.load(path),
        }
    }

    fn list(&self, path: &str) -> Result<Vec<SharedString>> {
        let mut paths = gpui_kit::assets::Assets.list(path)?;
        paths.extend(ExtraIcons.list(path)?);
        paths.sort();
        paths.dedup();
        Ok(paths)
    }
}
