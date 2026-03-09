# Change Report: tldraw 4.4.0 Upgrade Branch

**Branch commits** (oldest to newest):

1. `9b090ea` — theme compatibility
2. `9180c53` — tooltip position fix
3. `1aa760d` — improve styles
4. `d4a7df4` — hide pages menu when not in use
5. `309655c` — handle deep links
6. `ee001f6` — navigate to page on create

**Files changed**: 7 (231 insertions, 27 deletions)

---

## 1. tldraw 3.15.3 → 4.4.0 Upgrade (package.json, package-lock.json)

The core dependency was upgraded from `tldraw@^3.15.3` to `tldraw@^4.4.0`. This is a major version jump that pulls in updated `@tldraw/*` sub-packages (editor, store, state, tlschema, utils, validate) and updated `@tiptap/*` dependencies (v2 → v3). The old `patch-package` patches for 3.15.3 (`patches/@tldraw+editor+3.15.3+001+no-source-maps.patch`, etc.) were removed since they no longer apply.

---

## 2. Theme Compatibility (`src/components/TldrawApp.tsx`, `src/styles.css`)

### Problem
After upgrading to tldraw 4.4.0, the editor's background color and panel colors did not integrate with Obsidian's theme (light/dark), creating visual mismatches.

### Changes

**CSS variable overrides** (`src/styles.css`):
- Maps tldraw's internal CSS variables to Obsidian's theme variables:
  - `--tl-color-panel` → `var(--background-primary)`
  - `--tl-color-low` → `var(--background-secondary)`
  - `--tl-color-background` → `var(--background-primary)`
- Adds dark-mode-specific overrides using `.theme-dark` selector:
  - `--tl-color-panel` → `var(--background-secondary)` (panels use secondary bg in dark mode)
  - Extra controls use `var(--background-primary)` in dark mode
- Adjusts `--tl-shadow-2` to tighter shadow values that work better in both themes.

**Runtime background sync** (`src/components/TldrawApp.tsx`):
- The `css-change` event listener now also updates `DefaultColorThemePalette.darkMode.background` and `DefaultColorThemePalette.lightMode.background` to match Obsidian's `--background-primary` CSS variable.
- A new `useReactor('set bg color', ...)` ensures the background color stays in sync reactively when the `isDarkMode` atom changes.

These changes ensure the tldraw canvas background always matches whatever Obsidian theme (including community themes) the user has active.

---

## 3. Tooltip Positioning Fix (`patches/tldraw+4.4.0.patch`)

### Problem
tldraw's tooltip singleton uses `position: fixed` with viewport coordinates from `getBoundingClientRect()` to position an invisible trigger element. However, the plugin's `.tldraw-view-root` has `transform: translate3d(0, 0, 0)` (for GPU compositing), which creates a CSS containing block. This causes `position: fixed` to resolve relative to the container instead of the viewport, placing tooltips at incorrect positions.

### Fix
A `patch-package` patch on `tldraw/dist-esm/lib/ui/components/primitives/TldrawUiTooltip.mjs` that:

1. Sets the trigger to `position: fixed; left: 0px; top: 0px`
2. Measures where that actually renders via `getBoundingClientRect()` — this reveals the containing block offset
3. Compensates by subtracting the offset: `left = activeRect.left - cbOffset.left`, `top = activeRect.top - cbOffset.top`

This approach is robust against any combination of ancestor transforms, filters, or other properties that create containing blocks, without needing to walk the DOM tree.

---

## 4. Style Improvements (`src/styles.css`)

- Added `max-width: 100%`, `max-height: 100%`, and `overflow: hidden` to `.tldraw-view-root` to prevent content overflow.
- Adjusted toolbar positioning: `.tlui-layout__top__left` gets `top: -4px` and `.tlui-style-panel__wrapper:only-child` gets `margin-top: 4px` to remove extra padding from the native toolbar.
- Added `border-radius: var(--radius-m)` to `.tlui-main-toolbar__tools` and `.tlui-style-panel__wrapper` for rounded corners matching Obsidian's design language.
- Split `.tlui-navigation-panel::before` and `.tlui-menu-zone` into separate rules (they were previously combined with `,`).
- Added `padding-left: 6px` to `.tlui-main-toolbar__extras__controls` and `.tlui-menu-zone`.

---

## 5. Pages Menu Panel (`src/components/TldrawApp.tsx`, `src/tldraw/ui-overrides.ts`)

### Custom MenuPanel component
A new `MenuPanel` component override in the `TLComponents` configuration:
- Shows the main menu and page menu in a horizontal row (`TldrawUiRow`).
- The page menu is only visible when there are multiple pages (`hasMultiplePages`).
- Uses `usePassThroughWheelEvents` to prevent scroll capture.

### "New page" action (`CREATE_PAGE_ACTION`)
A new action registered in `ui-overrides.ts`:
- Auto-generates page names ("Page 1", "Page 2", etc.) avoiding collisions with existing names.
- Uses `PageRecordType.createId()` to generate a stable ID before creation.
- Calls `editor.createPage({ name, id })` then `editor.setCurrentPage(id)` to immediately navigate to the new page.
- Adds a history stopping point so the action is undoable.

The action is exposed in the file menu via `<TldrawUiMenuItem {...actions[CREATE_PAGE_ACTION]} />`.

### Translations
Added a custom translation override for `menu.pages` → `"Pages"` and `menu.file` → `"File"` in the overrides config.

---

## 6. Persistent Camera Viewport (`src/utils/viewport-storage.ts`, `src/components/TldrawApp.tsx`, `src/obsidian/BaseTldrawFileView.ts`)

### Problem
Previously, every time a tldraw document was opened, the camera reset to `zoomToFit()`. Users lost their pan/zoom position when switching tabs or restarting Obsidian.

### Solution
Uses tldraw's deep links feature with custom handlers to persist the viewport state per document in `localStorage`.

**New file `src/utils/viewport-storage.ts`**:
- `saveViewport(vaultName, filePath, deepLinkString)` — writes to localStorage
- `getViewport(vaultName, filePath)` — reads from localStorage
- `removeViewport(vaultName, filePath)` — removes from localStorage
- Key format: `tldraw-viewport:${vaultName}:${filePath}`
- All operations wrapped in try/catch for safety

**Deep links configuration** (`TldrawApp.tsx`):
- `tldrawOptions.deepLinks` is configured with custom `getUrl()` and `onChange()` handlers.
- `getUrl()` returns a URL containing the saved viewport deep link string from localStorage (or an explicit deep link if one was passed via navigation).
- `onChange(url)` extracts the `d` query parameter and saves it to localStorage.
- Debounced at 1000ms to avoid excessive writes during panning/zooming.

**Precedence** (`BaseTldrawFileView.ts`):
- Explicit deep link (from `setEphemeralState`, e.g. clicking an internal link) → takes highest priority
- Saved viewport from localStorage → used on normal document open
- `zoomToFit()` → fallback only when no deep link and no saved viewport exist

**Props threading**:
- `filePath?: string` added to `TldrawAppProps` and `createRootAndRenderTldrawApp`
- `initialDeepLink?: string` added to `TldrawAppOptions`
- `BaseTldrawFileView.createReactRoot` passes `this.fileView.file?.path`
- `BaseTldrawFileView.getTldrawOptions` converts `#deepLink` to a string via `createDeepLinkString()` and checks for saved viewport existence

**Cleanup of old code**:
- Removed `console.log` debug statements from `getTldrawOptions`
- Removed manual `editor.navigateToDeepLink()` call from `onEditorMount` — tldraw now handles this automatically via the `deepLinks` option

---

## 7. Null Safety in Plugin Lifecycle (`src/main.ts`)

Changed three properties on `TldrawPlugin` from required to optional:
- `statusBarRoot: HTMLElement` → `statusBarRoot?: HTMLElement`
- `statusBarViewModeReactRoot: Root` → `statusBarViewModeReactRoot?: Root`
- `unsubscribeToViewModeState: () => void` → `unsubscribeToViewModeState?: () => void`

Updated `onunload()` and `setStatusBarViewModeVisibility()` to use optional chaining (`?.`) on these properties. This prevents crashes if the status bar elements haven't been initialized when the plugin unloads (e.g. during rapid enable/disable cycles or mobile startup edge cases).
