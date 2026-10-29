# Changelog

The list below describes the changes in each version of the `composerkit` npm package. The shadcn registry on the docs site changes with every merge to `main`, so it has no versions.

## 0.1.0 (2026-10-29)

Version 0.1.0 is the first version on npm. It has the same components as the shadcn registry, compiled to JavaScript with type declarations.

- Components
  - The composer, with attachments, dictation, the model and permission menus, and the Work mode tray
  - The conversation view, with three layouts, replies that stream in, copy and retry
  - The button, the icon button, the tip and the menu
- Package
  - Each source file is a module at the same path, such as `composerkit/components/composer/composer`
  - `composerkit/styles.css` adds the theme in light and dark, and it tells Tailwind CSS v4 where the component classes are
