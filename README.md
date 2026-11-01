# Plugin Share Linker

Plugin Share Linker is a desktop-only Obsidian plugin for sharing community plugins, themes and CSS snippets from the current vault to another Obsidian vault.

It supports two sharing modes:

- **Copy**: copies the selected items into the target vault.
- **Symlink**: creates symbolic links in the target vault that point back to items in the current vault.

## Features

- List community plugins, themes and CSS snippets from the current Obsidian vault.
- Pick the target vault instead of only typing its path: a **Choose…** button lists the vaults Obsidian has recorded (`obsidian.json`, most recently opened first, marked current / open / missing), and **Browse…** opens the system folder dialog for any other folder.
- See the target vault's state next to every resource: each row pairs the current-vault item with its target status (Linked / Physical copy / Conflict / Broken link / Source unreachable / Not shared), and items that exist only in the target vault are listed in the same paired list.
- Check link health on demand: scan `.obsidian/plugins`, `themes` and `snippets` in the target vault for links whose physical target is gone, distinguishing broken links from an unmounted source drive.
- Repair or clean up: rebuild a broken link to the same-named item in the current vault, or delete a broken link that has no source left — and clean the matching entries from the target vault's enable records.
- Select plugins across paginated plugin lists; select themes and snippets from their own sections.
- Copy or symlink the selection per section, so each resource type can use its own mode.
- Optionally enable the shared plugins in the target vault by appending their IDs to `.obsidian/community-plugins.json`.
- Optionally enable the shared CSS snippets in the target vault by appending their names to `.obsidian/appearance.json` (`enabledCssSnippets`).
- Optionally set the target vault's current theme (`cssTheme`) from a theme radio, or let it be set automatically when the target has no custom theme and exactly one theme is shared.
- Skip existing target folders, files or conflicting symlinks without overwriting.
- Back up and atomically replace target config files before writing them.
- Switch the plugin UI between English and Chinese.

## Requirements

- Obsidian desktop app.
- A filesystem that supports symbolic links if you use Symlink mode.
- The target vault folder must already exist; `.obsidian` is created inside it if missing.

This plugin is marked as desktop-only because it uses Node.js filesystem APIs.

## Installation

Copy these files into:

```text
<your-vault>/.obsidian/plugins/plugin-share-linker/
```

Required files:

```text
main.js
manifest.json
styles.css
README.md
```

Then enable **Plugin Share Linker** in Obsidian's Community Plugins settings.

## Usage

1. Open **Settings -> Share Linker**.
2. Pick the target vault: click **Choose…** for a vault Obsidian has recorded, **Browse…** for the system folder dialog, or keep typing/pasting the path. The current vault cannot be the target.
3. Optionally click **Check links** in **Target link health** to scan the target vault's existing links (see below).
4. In the **Plugins** section, pick plugins and their **Enable** flags, then click **Copy** or **Symlink**.
5. In the **Themes** section, pick themes, optionally choose the target vault's current theme, then click **Copy** or **Symlink**.
6. In the **CSS snippets** section, pick snippets and their **Enable** flags, then click **Copy** or **Symlink**.

The target paths are:

```text
<target-vault>/.obsidian/plugins/<plugin-folder-name>
<target-vault>/.obsidian/themes/<theme-folder-name>
<target-vault>/.obsidian/snippets/<snippet-file-name>.css
```

## Target Vault Picker

The target vault path row keeps a normal, editable text field (hand-typed and pasted paths, including network paths, still work). Two extra buttons sit below it:

- **Choose…** opens a modal listing the vaults recorded in Obsidian's own registry (`obsidian.json` in Obsidian's user-data folder), sorted by most recently opened. Each entry shows whether it is the saved path (当前), currently open in Obsidian (打开中), the current vault (not selectable) or missing from disk. A footer **Browse…** button falls back to the system folder dialog. If the registry cannot be read, the modal degrades to the saved path plus **Browse…** instead of failing.
- **Browse…** opens the system folder dialog directly (Electron `showOpenDialog`). This is the only way to pick a folder Obsidian has never opened, e.g. a brand-new vault folder.

Picking a vault saves the path and shows a notice. Typing a new path into the field saves it as you type. In both cases any previous link-health result is cleared, because it belonged to the old target.

## Target Link Health

Symlinked plugins, themes and snippets break silently when the source vault moves, is renamed, or an item is deleted: Obsidian just behaves as if the item were missing. **Target link health** (between the target path row and the Plugins section) scans for exactly that.

- **Detection is manual.** Press **Check links** to touch the target vault; nothing is scanned when the settings page opens, so an unreachable network drive cannot stall the page.
- Results have three states. **Broken**: the link's target is gone and its parent folder is reachable (the item was deleted or moved). **Source unreachable**: the link's drive or network share itself cannot be accessed (external disk unplugged, network share offline) — links in this state get no repair/delete buttons, because the right fix is usually to plug the source back in.
- **Rebuild link** re-points a broken link at the same-named item in the current vault (matching by folder/file name against the validated current-vault lists). If creating the new link fails, the old link is restored.
- **Delete link** is offered only when the current vault has no item with that name. It removes the link (never the physical resource), and also cleans the matching entry from the target vault's enable records: `community-plugins.json`, `enabledCssSnippets` and — when the deleted theme is the target's current theme — `cssTheme`.
- **Rebuild all** / **Delete all** act only on their respective subsets and ask for confirmation with the full list of affected links.

Every target config write is backed up to `<file>.bak` and replaced atomically.

## Source ↔ Target Diff

The Plugins, Themes and CSS snippets sections are paired two-column lists. The left column is the current vault (checkbox, version, description); the right column shows what the target vault has under the same name: Linked, Physical copy, Conflict (a link pointing somewhere else), Broken link, Source unreachable, Not shared, or Not checked before the first scan. Items that exist only in the target vault appear at their alphabetical position with an empty left cell, showing their type (link / physical copy) and path. The right column is filled by the same **Check links** scan; plugin pagination applies to the merged list, and the enable/select-all actions only apply to current-vault rows.

## Enabling items in the target vault

- **Plugins**: each shared plugin you enable is appended to the target vault's `.obsidian/community-plugins.json`. Entries are appended, never removed; unchecking **Enable** does not disable a plugin that the target vault already has enabled.
- **Snippets**: each shared snippet you enable is appended to the target vault's `.obsidian/appearance.json` under `enabledCssSnippets`.
- **Theme**: picking a theme in the radio group writes it to the target vault's `appearance.json` (`cssTheme`), overriding an existing theme. When nothing is picked, the plugin only sets the theme automatically if the target vault has no custom theme and exactly one theme is shared.

Config files are backed up to `<file>.bak` and replaced atomically (write to a temporary file, then rename). Only items that actually landed in the target vault are enabled.

Restart Obsidian in the target vault (or press `Ctrl/Cmd + R`) for plugin, theme and snippet changes to take effect.

## Copy vs Symlink

Use **Copy** when you want the target vault to have its own independent copy of the items.

Use **Symlink** when you want multiple vaults to share the same files from the source vault.

**Copy mode does not update existing copies**: re-sharing an item that already exists in the target vault is skipped and reported as "Exists (not updated)".

## Safety Behavior

Plugin Share Linker does not overwrite existing target plugins, themes or snippets.

If the target path already contains a folder, file, or conflicting symlink with the same name, the plugin skips that item and reports the result.

Config writes target only the shared and enabled items; other entries in `community-plugins.json` and `appearance.json` are preserved.

Link-health actions are conservative: only symlinks are ever removed, never physical folders or files; links whose source drive is unreachable are excluded from both rebuild and delete, and both bulk actions ask for confirmation listing the affected links. Deleting a link also removes only its own entries from the target vault's enable records.

## Language

Use the language button at the top of the plugin settings page to switch between English and Chinese.

## Testing

The repository ships a regression suite that runs the plugin headlessly against a mocked `obsidian` module and temporary vaults (no Obsidian installation needed). Requires Node.js 18+:

```bash
node tests/run.js
```

It covers filesystem behavior (listing, copy, symlink, target-vault enable lists, backups, broken JSON, error handling), link-health scanning (healthy / broken / source-unreachable classification, rebuild, delete plus enable-record cleanup), the target-vault picker list, UI wiring against a DOM stub, and timeout/interruption handling. The `tests/` folder is not part of the release bundle.

## Release Notes

For a GitHub release, upload the unpacked plugin files directly:

```text
main.js
manifest.json
styles.css
README.md
```
