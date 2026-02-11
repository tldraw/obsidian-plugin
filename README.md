# Tldraw in Obsidian Plugin

https://github.com/holxsam/holxsam/assets/41220650/1786cc75-3a15-431f-b13a-e8f51cfde952

This Obsidian plugin allows users to use [Tldraw](https://tldraw.com), which is a tiny little drawing app, inside of Obsidian. Users can draw, plan, and use all of Tldraw's tools to augment their Obsidian experience. The data for each drawing is stored as a regular markdown file similar to the Excalidraw plugin meaning users will always have access to their data in plain markdown. Users have the option to switch between the Tldraw view or the markdown view in case they wish to include backlinks, tags, or any other elements to facilitate linking their drawings with their existing knowledge base.

TIP: You can toggle between the view modes, using the command palette, keyboard shortcuts, status bar toggle at the bottom right, file menu, and context menu. See the plugin settings tab for customization options as well.

## Plugin Usage Guides

- [Custom icons and fonts](https://github.com/tldraw/obsidian-plugin/issues/58#issue-2571070259)
- [Customizing embeds](https://github.com/tldraw/obsidian-plugin/issues/59)

## Development Goals

The main goals of this plugin and repo is to keep up to date with the Tldraw's latest version and to add these features:

-   Preview the drawing when a tldraw file is referenced in markdown.
-   Add markdown notes into tldraw.
-   Export and import tools.

## Structure

- `src/` - Source code for the Obsidian plugin
- `dist/` - Compiled output (generated during build)
  - `development/` - Development build
  - `production/` - Production build
- `release/` - Files that are needed for the plugin release
  - `manifest.json` 
  - `versions.json`

`manifest.json` and `versions.json` are updated by `npm run make-release-files` and should be committed if there are any changes.

## Installation

### Community Plugins (Recommended)

Tldraw in Obsidian is now available on the official community plugins list! 

- Here's a link that will take you to the plugin page: `obsidian://show-plugin?id=tldraw` (paste in your browser's address bar).
- You can also find it by going into `Settings` > `Community plugins` > `Browse` > `Type 'tldraw'` > `Install`.

### Using BRAT

- Download `Obsidian42 - BRAT` from the community plugins.
- Go into the settings for `Obsidian42 - Brat` and select `Add Beta Plugin`
- Copy and paste this repo: `https://github.com/tldraw/obsidian-plugin`
- Go back `Community plugins` and make sure to enable `Tldraw`
- This is also the only way to get Tldraw in Obsidian on the mobile app as far as I know.

### Manual

-   Head over to [releases](https://github.com/tldraw/obsidian-plugin/releases) and download a release (latest is recommended).
-   Navigate to your plugin folder in your prefered vault: `VaultFolder/.obsidian/plugins/`
-   Create a new folder called `tldraw-in-obsidian`
-   Copy and paste over `main.js`, `styles.css`, `manifest.json` into the newly created `/tldraw-in-obsidian` folder.
-   Make sure you enable the plugin by going into Settings > Community plugins > Installed plugins > toggle 'Tldraw'.

## Development

-   Clone this repo or a fork to a local development folder.
-   Place this folder in your `.obsidian/plugins` folder.
-   Install NodeJS, then run `npm i` in the command line under your repo folder.
-   Run `npm run dev` to compile your plugin. Changes to `src/` will be automatically compiled to `dist/development/`.
-   Make changes to the files in `/src`. Those changes should be automatically compiled into `main.js` and `styles.css`.
-   To refresh your changes, go to Settings > Community Plugins > disable and enable the plugin. You can also close your vault and then reopen it but that's more bothersome.
-   Do not edit the `styles.css` file at the root of the repo. Edit the one in `/src/styles.css` and the changes will be reflected automatically.

## Building

To build the plugin for production:

```bash
npm run build
```

## Releasing

See [Creating a Release](./release/README.md)

## Contributions

This plugin was created by [Sam Alhaqab](https://github.com/szamsolo), the original author whose initial contributions kickstarted the beginning of using tldraw within Obsidian. So a huge shoutout to him!

-   This plugin is open to contributions. If you have a feature idea or want to report a bug, you can create an issue. If you are a developer wanting to fix a bug or add a feature to feel free to submit pull requests.!

## License and Attribution

All [Tldraw's](https://github.com/tldraw/tldraw) code is theirs, a few patches were made to address issues when using pop-out windows within Obsidian. Also shout out to the [Excalidraw plugin](https://github.com/zsviczian/obsidian-excalidraw-plugin) for inspiration on how I should structure this Tldraw plugin.
