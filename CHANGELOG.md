# Changelog

The list below describes the changes in each version of the `composerkit` npm package. The shadcn registry on the docs site changes with every merge to `main`, so it has no versions.

## Unreleased

- Components
  - A button is never wider than its container. To let a label from data end in an ellipsis, wrap it in `<span className="truncate">`.
  - The inline composer moves to two rows when its placeholder doesn't fit on one, so a narrow box no longer wraps "Send a message" a few letters to a line.
  - A code block in a reply draws its keyboard focus ring inside the block, where the block's rounded corners no longer cut it off.
  - Text from people and from the model runs in its own direction. An Arabic or Hebrew message reads right to left in an English app, and English reads left to right in a right-to-left app. Code always runs left to right.
  - Padding, margins and corners use the start and end sides instead of left and right, so the composer, the conversation and the buttons mirror in a right-to-left page. Submenu arrows point the other way there too.

## 0.1.0 (2026-10-29)

Version 0.1.0 is the first version on npm. It has the same components as the shadcn registry, compiled to JavaScript with type declarations.

- Components
  - The composer, with attachments, dictation, the model and permission menus, and the Work mode tray
  - The conversation view, with three layouts, replies that stream in, copy and retry
  - The button, the icon button, the tip and the menu
- Package
  - Each source file is a module at the same path, such as `composerkit/components/composer/composer`
  - `composerkit/styles.css` adds the theme in light and dark, and it tells Tailwind CSS v4 where the component classes are
