# Obsidian Plugin Best Practices

This guide documents practical standards for Vault Keeper and similar Obsidian plugins. It is written for contributors working on this repository.

## Plugin Metadata

- Keep `manifest.json` accurate: `id`, `name`, `version`, `minAppVersion`, `description`, `author`, and `isDesktopOnly`.
- Keep `manifest.json`, `package.json`, and `package-lock.json` versions aligned.
- Use a short description that explains the user value without overstating the plugin's reach.
- Only set `isDesktopOnly` to `true` if the plugin depends on desktop-only APIs.

## Settings UX

- Use Obsidian's native `PluginSettingTab`, `Setting`, toggles, buttons, and suggestion components.
- Prefer existing vault paths for path-based settings; avoid asking users to type fragile paths manually.
- Show empty states for lists so users know nothing is configured yet.
- Keep dangerous or important behavior visible near the setting that controls it.
- Use clear labels that describe the resulting behavior, not the internal variable name.

For Vault Keeper, the key setting is **Block deleting folder contents**:

- Enabled means the folder and its descendants are protected.
- Disabled means only the folder itself is protected.

## File Safety

- Be explicit about what the plugin can and cannot protect.
- Guard destructive behavior before calling Obsidian's delete or trash APIs.
- Restore patched or wrapped APIs during plugin unload.
- Normalize paths before comparing them.
- Avoid broad filesystem access unless a feature truly requires it.
- Never claim to prevent deletion by external tools unless the plugin actually controls those tools.

Vault Keeper only blocks deletion through Obsidian APIs. It does not protect against Finder, Explorer, terminal commands, sync tools, mobile file managers, or other apps.

## Mobile Compatibility

- Treat `isDesktopOnly: false` as a commitment to avoid desktop-only assumptions.
- Test settings layout on narrow screens when changing UI.
- Avoid relying on Node-only APIs in runtime plugin code.
- Keep controls tappable and labels short enough for mobile settings panes.

## Build and Release

- Keep generated release files predictable: `main.js`, `manifest.json`, and `styles.css`.
- Run `npm run check` before release.
- Run `npm run build` before testing release artifacts.
- Keep the release workflow and README release instructions in sync.
- Use conventional commits so automated versioning remains understandable.

## Accessibility

- Use native Obsidian controls where possible.
- Give icon-only buttons tooltips.
- Avoid using color as the only signal for important warnings.
- Keep text concise and readable in both light and dark themes.
- Check that warning styles have sufficient contrast in both themes.

## Security and Privacy

- Store only the data the plugin needs.
- Do not send vault paths, filenames, or note contents to external services.
- Do not introduce telemetry unless it is explicit, documented, and opt-in.
- Treat vault paths as private user data in logs, screenshots, and bug reports.
- Avoid dependencies that run network requests or postinstall scripts unless they are essential and understood.

## Testing

Test deletion behavior in a real vault after changing protection logic:

- Protected files are blocked.
- Protected folders are blocked.
- Folder descendants follow the **Block deleting folder contents** setting.
- Unprotected paths are not blocked.
- Removed paths become deletable again.
- Settings survive Obsidian reloads.
- Plugin unload restores the original Obsidian methods.

Also run:

```bash
npm run check
npm run build
```

## Documentation

- Document the happy path first: install, configure, use.
- Add limitations close to feature claims.
- Keep screenshots current with user-facing behavior.
- Prefer accurate short marketing over broad promises.
- Link contributor docs from the README.
