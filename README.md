# Vault Keeper

Vault Keeper is a small Obsidian plugin that blocks accidental deletion of selected folders and files from inside Obsidian.

It uses Obsidian's native settings UI and stores the protected paths in the plugin data file.

## Features

- Protect individual files from delete/trash actions in Obsidian.
- Protect folders from delete/trash actions in Obsidian.
- Choose whether protected folders also protect everything inside them.
- Add existing files and folders with native autocomplete suggestions.
- Keep saved settings simple and portable.

## Installation

### Manual testing

1. Copy this folder to:
   `<your-vault>/.obsidian/plugins/vault-keeper/`
2. Run `npm install`.
3. Run `npm run build`.
4. Open Obsidian settings.
5. Enable community plugins.
6. Enable **Vault Keeper**.

### Release files

For a packaged Obsidian plugin release, include:

- `manifest.json`
- `main.js`
- `styles.css`
- `LICENSE`

## Usage

1. Open **Settings -> Community plugins -> Vault Keeper**.
2. Search for an existing folder or file under **Add protection**.
3. Select a suggestion and click **Add**.
4. Remove protection with the trash button beside a protected path.

## Settings

### Block deleting folder contents

When enabled, protected folders and everything inside them cannot be deleted from Obsidian.

When disabled, only the protected folder itself is blocked. Files and folders inside it can still be deleted.

## Development

```bash
npm install
npm run typecheck
npm run build
npm run dev
```

- `npm run typecheck` validates TypeScript without writing build output.
- `npm run build` typechecks and writes the production `main.js`.
- `npm run dev` starts esbuild in watch mode.

### Source layout

- `src/main.ts` contains the plugin lifecycle and deletion guards.
- `src/core/` contains settings normalization and protection logic.
- `src/settings/` contains the settings tab and autocomplete UI.

## Release Checklist

1. Update the version in `manifest.json` and `package.json`.
2. Run `npm run typecheck`.
3. Run `npm run build`.
4. Test in a local vault.
5. Package `manifest.json`, `main.js`, and `LICENSE`.

## Limitations

Vault Keeper only blocks deletion through Obsidian APIs. It cannot prevent deletion from Finder, Explorer, terminal commands, sync tools, mobile file managers, or other apps.

For stronger protection, use operating-system permissions, backups, and sync history in addition to this plugin.

## Troubleshooting

- If a path does not appear in autocomplete, make sure it already exists in the vault.
- If protection does not seem active, reload Obsidian and confirm the plugin is enabled.
- If files are deleted outside Obsidian, restore them from backups or sync history; Vault Keeper cannot intercept external deletion.
