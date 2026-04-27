# Vault Keeper

Obsidian plugin that blocks accidental deletion of configured folders and files from inside Obsidian.

## Features

- Protect folders from deletion
- Optionally protect everything inside protected folders
- Protect individual files
- Add existing folders/files with one automatic preview picker
- Auto-detect whether the selected path is a folder or file

## Install for testing

1. Copy this folder to: `<your vault>/.obsidian/plugins/vault-keeper/`
2. Run `npm install`
3. Run `npm run build`
4. Enable community plugins in Obsidian
5. Enable **Vault Keeper**
6. Go to settings and add protected paths

## Limitations

This only blocks deletion through Obsidian APIs. It cannot prevent deletion through your OS file manager, terminal, sync apps, or external tools. For real protection, use operating-system folder permissions too.
