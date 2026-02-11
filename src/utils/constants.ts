export type PaneTarget = (typeof PANE_TARGETS)[number]
export type ViewType = (typeof VIEW_TYPES)[number]
/**
 * For `.md` and `.tldr` ending files.
 */
export const VIEW_TYPE_TLDRAW = 'tldraw-view' // custom view type

export const VIEW_TYPE_TLDRAW_READ_ONLY = 'tldraw-read-only' // custom view type
export const VIEW_TYPE_MARKDOWN = 'markdown' // NOT ACTUALLY A CUSTOM VIEW TYPE, its built in from obsidian
export const VIEW_TYPES = [
	VIEW_TYPE_MARKDOWN,
	VIEW_TYPE_TLDRAW,
	VIEW_TYPE_TLDRAW_READ_ONLY,
] as const
export const PANE_TARGETS = ['new-window', 'new-tab', 'current-tab', 'split-tab'] as const

export const FILE_EXTENSION = '.md'
export const FRONTMATTER_KEY = 'tldraw-file'
export const TLDATA_DELIMITER_START = '!!!_START_OF_TLDRAW_DATA__DO_NOT_CHANGE_THIS_PHRASE_!!!'
export const TLDATA_DELIMITER_END = '!!!_END_OF_TLDRAW_DATA__DO_NOT_CHANGE_THIS_PHRASE_!!!'

export const RIBBON_NEW_FILE = 'Create new tldrawing'

export const DEFAULT_SAVE_DELAY = 500 // in ms
export const MIN_SAVE_DELAY = 250 // in ms
export const MAX_SAVE_DELAY = 3_600_000 // in ms

export const TLDRAW_ICON_NAME = 'tldraw-icon'
export const TLDRAW_ICON = `<rect width="100" height="100" fill="none"/>
<path fill-rule="evenodd" clip-rule="evenodd" d="M16 -2.38419e-07C7.16344 -2.38419e-07 0 7.16345 0 16V84C0 92.8366 7.16345 100 16 100H84C92.8366 100 100 92.8366 100 84V16C100 7.16344 92.8366 -2.38419e-07 84 -2.38419e-07H16ZM62.2887 32.655C62.2887 39.4418 56.7868 44.9437 50 44.9437C43.2131 44.9437 37.7113 39.4418 37.7113 32.655C37.7113 25.8681 43.2131 20.3663 50 20.3663C56.7868 20.3663 62.2887 25.8681 62.2887 32.655ZM62.0364 64.2825C62.2018 63.4786 62.2887 62.6461 62.2887 61.7933C62.2887 55.0065 56.7868 49.5047 50 49.5047C43.2131 49.5047 37.7113 55.0065 37.7113 61.7933C37.7113 67.7087 41.8909 72.6479 47.4581 73.8188C47.2699 75.3136 46.5203 78.4089 44.8263 80.1029C43.0653 81.8639 43.1253 83.5715 43.3755 84.2052C43.7757 85.039 45.4266 86.2063 48.8285 84.2052C53.0809 81.7038 57.4333 77.2513 61.5856 67.0456C61.7166 66.5497 61.9117 65.555 62.0364 64.2825Z" fill="currentColor"/>
`

export const MARKDOWN_ICON_NAME = 'custom-markdown-icon'
export const MARKDOWN_ICON = `<path d="M14 72.5V27.5L29 42.5L44 27.5V72.5" stroke="currentColor" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/><path d="M59 57.5L74 72.5M74 72.5L89 57.5M74 72.5V27.5" stroke="currentColor" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>`
