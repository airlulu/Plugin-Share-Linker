# Plugin Share Linker

Plugin Share Linker is a desktop-only Obsidian plugin for sharing community plugins, themes and CSS snippets from the current vault to another Obsidian vault.

It supports two sharing modes:

- **Copy**: copies the selected items into the target vault.
- **Symlink**: creates symbolic links in the target vault that point back to items in the current vault.

## Features

- List community plugins, themes and CSS snippets from the current Obsidian vault.
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
2. Enter the target vault path (path A).
3. In the **Plugins** section, pick plugins and their **Enable** flags, then click **Copy** or **Symlink**.
4. In the **Themes** section, pick themes, optionally choose the target vault's current theme, then click **Copy** or **Symlink**.
5. In the **CSS snippets** section, pick snippets and their **Enable** flags, then click **Copy** or **Symlink**.

The target paths are:

```text
<target-vault>/.obsidian/plugins/<plugin-folder-name>
<target-vault>/.obsidian/themes/<theme-folder-name>
<target-vault>/.obsidian/snippets/<snippet-file-name>.css
```

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

## Language

Use the language button at the top of the plugin settings page to switch between English and Chinese.

## Testing

The repository ships a regression suite that runs the plugin headlessly against a mocked `obsidian` module and temporary vaults (no Obsidian installation needed). Requires Node.js 18+:

```bash
node tests/run.js
```

It covers filesystem behavior (listing, copy, symlink, target-vault enable lists, backups, broken JSON, error handling), UI wiring against a DOM stub, and timeout/interruption handling. The `tests/` folder is not part of the release bundle.

## Release Notes

For a GitHub release, upload the unpacked plugin files directly:

```text
main.js
manifest.json
styles.css
README.md
```
