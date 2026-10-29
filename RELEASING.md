# Releasing ComposerKit

The shadcn registry and the npm package each have their own release. The shadcn registry is part of the docs site, so the Pages workflow publishes it every time a change merges to `main`. The npm package only changes when a maintainer publishes a new version by hand, with the steps below.

## What a release runs

`npm publish` builds the package before it uploads it, because the package's `prepack` script runs the build. You don't need to build the package yourself first.

```text
npm publish --workspace composerkit
  prepack
    npm run build
      vite build                    # writes dist/**/*.js, one module per source file
      tsc -p tsconfig.build.json    # writes dist/**/*.d.ts
      node scripts/finish-dist.ts   # makes type imports relative, copies styles.css and theme/tokens.css
  packs dist, package.json, README.md and LICENSE
  uploads the package to the npm registry
```

## Pick the version number

The package follows semantic versioning. While the version is below 1.0.0, a change that breaks an app that uses the package raises the minor number, such as 0.1.0 to 0.2.0. A fix or a new feature that breaks nothing raises the patch number, such as 0.1.0 to 0.1.1.

A change breaks apps when it removes or renames a module, an export or a prop, or when it changes what a prop does. A change to a CSS variable name also breaks apps, because apps can set the variables to change the theme.

## Publish a version

You need an npm account with permission to publish `composerkit`. Run `npm whoami` to check that you are logged in, and run `npm login` if you aren't.

1. Update `main`, and check that the working tree is clean.

   ```bash
   git switch main
   git pull
   git status
   ```

2. Create a release branch, and set the new version in the package. Replace `0.2.0` with the version you picked.

   ```bash
   git switch -c release/0.2.0
   npm version 0.2.0 --workspace composerkit --no-git-tag-version
   ```

   For the first release, the package already has the version 0.1.0, so skip the `npm version` command.

3. In `CHANGELOG.md`, give the new version a heading, or replace "unreleased" in its heading with the date. Check that the list describes every change since the last release. Then commit the version, the lockfile and the changelog, and open a pull request. Merge it after the checks pass.

4. Update `main` again, and check the files that the package would publish. The list should hold only `dist/`, `package.json`, `README.md` and `LICENSE`.

   ```bash
   git switch main
   git pull
   npm pack --workspace composerkit --dry-run
   ```

5. Publish the package. If your account uses two factor authentication, npm asks you to confirm with your second factor.

   ```bash
   npm publish --workspace composerkit
   ```

6. Tag the release, and create a GitHub release with the changelog entry as its notes.

   ```bash
   git tag composerkit@0.2.0
   git push origin composerkit@0.2.0
   gh release create composerkit@0.2.0 --title "composerkit 0.2.0" --notes "<the changelog entry>"
   ```

7. Check the result. Run `npm view composerkit version` to see the new version, and open <https://www.npmjs.com/package/composerkit> to see the README.

## Test the package in an app before you publish

You can install the package into a separate app before you publish it, to check that the imports, the types and the styles work outside the repository. The steps below pack the package into a file and install the file.

```bash
npm pack --workspace composerkit --pack-destination /tmp
cd path/to/a/vite-or-next-app
npm install /tmp/composerkit-0.2.0.tgz
```

Then import `composerkit/styles.css` after Tailwind, and render the example from the package README. The app's type check and build should pass, and the conversation should show the theme's colors in light and dark.

## Undo a release

npm lets you unpublish a version only in a few cases, such as within 72 hours of publishing it, and you can never publish the same version number again. To fix a broken release, publish a new patch version with the fix. To warn users away from the broken version, run `npm deprecate composerkit@0.2.0 "Use 0.2.1 instead"`.
