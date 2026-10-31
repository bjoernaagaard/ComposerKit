# Releasing ComposerKit

The shadcn registry and the npm package each have their own release. The Pages workflow publishes the shadcn registry every time a change merges to `main`. The npm package only changes when a maintainer publishes a new version by hand, with the steps below.

## What a release runs

`bun publish` builds the package before it uploads it, because the package's `prepack` script runs the build. You don't need to build the package yourself first.

```text
bun publish
  prepack
    bun run build
      vite build                    # writes dist/**/*.js, one module per source file
      tsc -p tsconfig.build.json    # writes dist/**/*.d.ts
      bun scripts/finish-dist.ts    # makes type imports relative, copies styles.css and theme/tokens.css
  packs dist, package.json, README.md and LICENSE
  uploads the package to the npm registry
```

## Pick the version number

The package follows semantic versioning. While the version is below 1.0.0, a change that breaks an app that uses the package raises the minor number, such as 0.1.0 to 0.2.0. A fix or a new feature that breaks nothing raises the patch number, such as 0.1.0 to 0.1.1.

A change breaks apps when it removes or renames a module, an export or a prop, or when it changes what a prop does. A change to a CSS variable name also breaks apps, because apps can set the variables to change the theme.

## Publish a version

You need an npm account with permission to publish `composerkit`. On <https://www.npmjs.com>, open Access Tokens and create a granular token that can publish `composerkit`. Keep it in your shell as `NPM_TOKEN`, out of the repository. Step 5 hands it to `bun publish`, which reads `NPM_CONFIG_TOKEN`.

Run every step from the root of the repository. The package commands run in a subshell, so the shell stays at the root.

1. Update `main`, and check that the working tree is clean.

   ```bash
   git switch main
   git pull
   git status
   ```

2. Create a release branch, and set the new version in the package. Replace `0.2.0` with the version you picked.

   ```bash
   git switch -c release/0.2.0
   (cd packages/composerkit && bun pm pkg set version=0.2.0)
   ```

3. In `CHANGELOG.md`, give the new version a heading, or replace "unreleased" in its heading with the date. Check that the list describes every change since the last release. Then commit the version, the lockfile and the changelog, and open a pull request. Merge it after the checks pass.

4. Update `main` again, and check the files that the package would publish. The list should hold only `dist/`, `package.json`, `README.md` and `LICENSE`.

   ```bash
   git switch main
   git pull
   (cd packages/composerkit && bun pm pack --dry-run)
   ```

5. Publish the package. If your account uses two factor authentication, Bun opens the npm page that asks for your second factor.

   ```bash
   (cd packages/composerkit && NPM_CONFIG_TOKEN="$NPM_TOKEN" bun publish)
   ```

6. Tag the release, and create a GitHub release with the changelog entry as its notes.

   ```bash
   git tag composerkit@0.2.0
   git push origin composerkit@0.2.0
   gh release create composerkit@0.2.0 --title "composerkit 0.2.0" --notes "<the changelog entry>"
   ```

7. Check the result. Run `bun info composerkit version` to see the new version, and open <https://www.npmjs.com/package/composerkit> to see the README. When you publish with two factor authentication, the npm registry may also publish a placeholder version named `0.0.0-stage`. The placeholder is harmless, because the `latest` tag points at the real version.

## Test the package in an app before you publish

You can install the package into a separate app before you publish it, to check that the imports, the types and the styles work outside the repository. The steps below pack the package into a file and install the file.

```bash
(cd packages/composerkit && bun pm pack --destination /tmp)
cd path/to/a/vite-or-next-app
bun add /tmp/composerkit-0.2.0.tgz
```

Then import `composerkit/styles.css` after Tailwind, and render the example from the package README. The app's type check and build should pass, and the conversation should show the theme's colors in light and dark.

## Undo a release

The npm registry lets you unpublish a version only in a few cases, such as within 72 hours of publishing it, and you can never publish the same version number again. To fix a broken release, publish a new patch version with the fix.
