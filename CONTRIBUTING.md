# Contributing to Vault Keeper

Thanks for helping improve Vault Keeper. This plugin is intentionally small, so changes should stay focused on protecting Obsidian files and folders from accidental deletion inside Obsidian.

## Local Setup

Requirements:

- Node.js 18 or newer
- npm
- A local Obsidian vault for manual testing

Install dependencies:

```bash
npm install
```

Validate the project:

```bash
npm run check
npm run build
```

During development, run:

```bash
npm run dev
```

Then load the plugin from:

```text
<your-vault>/.obsidian/plugins/vault-keeper/
```

You can copy the repository there or symlink it from your development location.

## Workflow

1. Open an issue or describe the problem clearly in your pull request.
2. Keep the change scoped to one behavior, bug fix, or documentation improvement.
3. Run `npm run check` before submitting.
4. Run `npm run build` if the change affects runtime code, build output, or release packaging.
5. Test in a real Obsidian vault when changing deletion behavior or settings UI.

## Pull Request Expectations

Include:

- What changed and why.
- How you tested it.
- Any limitations or follow-up work.
- Screenshots for settings UI or README visual changes.

Avoid:

- Broad refactors mixed with behavior changes.
- New dependencies unless the benefit is clear.
- Claims that Vault Keeper protects files outside Obsidian.
- Changes to release behavior without explaining compatibility impact.

## Testing Checklist

For code changes, test the relevant items:

- A protected file cannot be deleted or trashed inside Obsidian.
- A protected folder cannot be deleted or trashed inside Obsidian.
- With **Block deleting folder contents** enabled, files inside protected folders are blocked.
- With **Block deleting folder contents** disabled, child files can be deleted while the folder itself remains protected.
- Removing protection allows normal delete and trash actions again.
- The plugin unloads cleanly and restores Obsidian's original deletion methods.
- Settings persist after reloading Obsidian.
- Autocomplete only adds existing files and folders.

## Commit Style

Use conventional commits because the release workflow uses commit messages to calculate version bumps:

```text
feat: add a new user-facing behavior
fix: correct a bug
docs: update documentation
refactor: restructure code without changing behavior
test: add or update tests
chore: maintenance work
```

Breaking changes should use `!` or include `BREAKING CHANGE` in the commit body.

## Documentation Changes

Documentation should be accurate and conservative:

- Say "inside Obsidian" when describing protection.
- Mention external deletion limitations where relevant.
- Keep install instructions aligned with the current release files.
- Update README screenshots or assets when the settings UI changes meaningfully.

## Release Notes

The GitHub Actions release workflow packages:

- `main.js`
- `manifest.json`
- `styles.css`

Do not add files to release expectations without updating the workflow and README together.
