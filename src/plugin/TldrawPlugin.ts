import { around } from 'monkey-around'
import {
	addIcon,
	getIcon,
	MarkdownView,
	Notice,
	Plugin,
	TFile,
	ViewState,
	WorkspaceLeaf,
} from 'obsidian'
import { Root } from 'react-dom/client'
import { Editor, TLDRAW_FILE_EXTENSION } from 'tldraw'
import { createReactStatusBarViewMode } from 'src/plugin/app/components/StatusBarViewMode'
import createMain from 'src/plugin/app/main/TldrawInObsidian'
import { TldrawOfflineFileView } from 'src/plugin/views/TldrawOfflineFileView'
import { ReadonlyTldrawView } from 'src/plugin/views/TldrawReadonlyView'
import { TldrawSettingsTab } from 'src/plugin/settings/TldrawSettingsTab'
import { EditableTldrawView } from 'src/plugin/views/TldrawView'
import { createEmbedTldraw } from 'src/plugin/embed/markdown-render-child'
import { pluginMenuLabel } from 'src/plugin/menu'
import TLDataDocumentStoreManager from 'src/plugin/stores/TLDataDocumentStoreManager'
import { TldrawFileListenerMap } from 'src/plugin/stores/TldrawFileListenerMap'
import { registerCommands } from 'src/plugin/commands'
import TldrawInObsidianPluginInstance from 'src/plugin/instance'
import { markdownPostProcessor } from 'src/plugin/embed/markdown-post-processor'
import { processFontOverrides, processIconOverrides } from 'src/plugin/settings/process-overrides'
import UserSettingsManager from 'src/plugin/settings/UserSettingsManager'
import {
	isValidViewType,
	MARKDOWN_ICON,
	MARKDOWN_ICON_NAME,
	RIBBON_NEW_FILE,
	TLDRAW_ICON,
	TLDRAW_ICON_NAME,
	VIEW_TYPE_MARKDOWN,
	VIEW_TYPE_TLDRAW,
	VIEW_TYPE_TLDRAW_OFFLINE,
	VIEW_TYPE_TLDRAW_READ_ONLY,
	ViewType,
} from 'src/plugin/constants'
import { migrateTldrawFileDataIfNecessary } from 'src/plugin/document/migrate/tl-data-to-tlstore'
import { useStatusBarState } from 'src/plugin/app/status-bar-store'
import { installObsidianLinkHandler } from 'src/plugin/uri/open-obsidian-link'
import { hasTldrawFrontMatterKey, isTldrawFile } from 'src/plugin/document/detect'
import TldrawFileCreator from 'src/plugin/file/creator'
import ViewModeManager from 'src/plugin/view-mode-manager'
import { ErrorHandler } from 'src/plugin/error-handler'

export default class TldrawPlugin extends Plugin {
	#instance?: TldrawInObsidianPluginInstance
	// status bar stuff:
	statusBarRoot?: HTMLElement
	statusBarViewModeReactRoot?: Root
	unsubscribeToViewModeState?: () => void
	transientUpdate: boolean = false

	readonly settingsManager = new UserSettingsManager(this)
	readonly viewModeManager = new ViewModeManager(this)
	readonly fileCreator = new TldrawFileCreator(this)
	readonly tldrawFileListeners = new TldrawFileListenerMap(this)
	readonly tldrawFileMetadataListeners = new TldrawFileListenerMap(this)
	readonly tlDataDocumentStoreManager = new TLDataDocumentStoreManager(this)
	currTldrawEditor?: Editor

	// misc:
	embedBoundsSelectorIcon?: string

	get instance() {
		return (
			this.#instance ??
			(() => {
				throw new Error('Plugin not loaded')
			})()
		)
	}

	async onload() {
		await super.onload()
		installObsidianLinkHandler(this.app)
		const instance = (this.#instance = new TldrawInObsidianPluginInstance(this.app))

		this.register(() => {
			if (this.#instance === instance) {
				this.#instance = undefined
			}
			instance.dispose()
		})

		this.registerView(VIEW_TYPE_TLDRAW, (leaf) => new EditableTldrawView(leaf, this))

		this.registerView(VIEW_TYPE_TLDRAW_READ_ONLY, (leaf) => new ReadonlyTldrawView(leaf, this))

		this.registerView(VIEW_TYPE_TLDRAW_OFFLINE, (leaf) => new TldrawOfflineFileView(leaf))

		// settings:
		await this.settingsManager.loadSettings()
		this.addSettingTab(new TldrawSettingsTab(this.app, this))

		// icons:
		addIcon(TLDRAW_ICON_NAME, TLDRAW_ICON)
		addIcon(MARKDOWN_ICON_NAME, MARKDOWN_ICON)
		this.embedBoundsSelectorIcon = URL.createObjectURL(
			new Blob([getIcon('frame')?.outerHTML ?? ''], {
				type: 'image/svg+xml',
			})
		)

		// this creates an icon in the left ribbon:
		this.addRibbonIcon(TLDRAW_ICON_NAME, RIBBON_NEW_FILE, async () => {
			const activeFile = this.app.workspace.activeEditor?.file
			const file = await this.createUntitledTldrFile({
				attachTo: activeFile || undefined,
			})
			await this.openTldrFile(file, 'current-tab')
		})

		// status bar:
		this.statusBarRoot = this.addStatusBarItem()
		this.statusBarViewModeReactRoot = createReactStatusBarViewMode(this.statusBarRoot)
		this.setStatusBarViewModeVisibility(false)

		// subscribe to status bar state within react via zustand:
		this.unsubscribeToViewModeState = useStatusBarState.subscribe(
			(state) => state,
			(state, prevState) => {
				if (state.view.mode !== prevState.view.mode && state.view.source === 'react')
					this.updateViewMode(state.view.mode).catch(ErrorHandler.notice)
			}
		)

		// registers all events needed:
		this.registerEvents()

		// registers all commands:
		this.registerCommands()

		// switches to the tldraw view mode on initial launch
		this.switchToTldrawViewAfterLoad()

		// Change how tldraw files are displayed when reading the document, e.g. when it is embed in another Obsidian document.
		this.registerMarkdownPostProcessor((e, c) => markdownPostProcessor(this, e, c))

		this.app.embedRegistry.registerExtension('tldr', (context, tFile, _) => {
			const { component } = createEmbedTldraw({
				file: tFile,
				internalEmbedDiv: context.containerEl,
				plugin: this,
			})
			return component
		})

		this.register(() => this.app.embedRegistry.unregisterExtension('tldr'))

		this.registerExtensions(['tldr'], VIEW_TYPE_TLDRAW)

		try {
			this.registerExtensions(['tldraw'], VIEW_TYPE_TLDRAW_OFFLINE)
		} catch (e) {
			// Obsidian throws if another plugin already owns the extension. Explaining that we can't
			// open these files isn't worth taking the file type away from a plugin that can.
			console.error(e)
		}

		const unmount = createMain(this, this.app.dom.statusBarEl)
		this.register(() => {
			unmount()
		})
	}

	onunload() {
		this.tlDataDocumentStoreManager.dispose()
		this.unsubscribeToViewModeState?.()
		this.statusBarViewModeReactRoot?.unmount()
		if (this.embedBoundsSelectorIcon) URL.revokeObjectURL(this.embedBoundsSelectorIcon)
		this.#instance = undefined
		super.onunload()
	}

	private registerEvents() {
		// eslint-disable-next-line @typescript-eslint/no-this-alias -- `this` is shadowed inside the patched methods below
		const plugin = this
		// Monkey patch WorkspaceLeaf to open Tldraw drawings with TldrawView by default
		// inspired from https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/f79181c76a9d6ef9f17ecdfd054aa0e6d7564d1f/src/main.ts#L1649C9-L1649C9
		this.register(
			around(WorkspaceLeaf.prototype, {
				setViewState(next) {
					return function (this: WorkspaceLeaf, state: ViewState, eState?: unknown) {
						const rstate = state.state // "real" state
						const filePath = rstate?.file as string
						const viewType = state.type
						const validViewType = isValidViewType(viewType)

						if (plugin.settingsManager.settings.workspace.switchMarkdownView && validViewType && filePath) {
							const matr = Boolean(rstate?.manuallyTriggered)

							const file = plugin.app.vault.getAbstractFileByPath(filePath)

							if (file instanceof TFile && plugin.hasTldrawFrontMatterKey(file)) {
								const view = matr ? viewType : plugin.settingsManager.settings.workspace.tldrMarkdownViewType
								const newState = { ...state, type: view }

								plugin.setLeafFileViewMode(view, this, file)
								plugin.updateStatusBarViewMode(view)

								return next.call(this, newState, eState)
							}
						}
						return next.call(this, state, eState)
					}
				},
			})
		)

		// adds a menu item to the context menu:
		this.registerEvent(
			this.app.workspace.on('editor-menu', (menu, editor, source) => {
				const file = source.file
				const leaf = this.app.workspace.getActiveViewOfType(MarkdownView)?.leaf

				if (!leaf || !(file instanceof TFile)) return
				if (!this.isTldrawFile(file)) return

				menu.addItem((item) => {
					item
						.setIcon(TLDRAW_ICON_NAME)
						.setSection('close')
						.setTitle('View as tldraw')
						.onClick(async () => {
							await this.updateViewMode(VIEW_TYPE_TLDRAW, leaf)
						})
				})
			})
		)

		// adds a menu item to the file menu (three dots) depending on view mode
		this.registerEvent(
			this.app.workspace.on('file-menu', (menu, file, source, leaf) => {
				if (!(file instanceof TFile)) return

				if (file.path.endsWith(TLDRAW_FILE_EXTENSION)) {
					menu
						.addItem((item) => pluginMenuLabel(item.setSection('tldraw')))
						.addItem((item) => {
							item
								.setIcon('edit')
								.setSection('tldraw')
								.setTitle('Edit as new note')
								.onClick(async () => {
									const newFile = await this.createUntitledTldrFile({
										tlStore: migrateTldrawFileDataIfNecessary(await this.app.vault.read(file)),
									})
									await this.openTldrFile(newFile, 'new-tab', VIEW_TYPE_TLDRAW)
									new Notice(`Created a new file for editing "${newFile.path}"`)
								})
						})
					return
				}

				if (!leaf) return

				if (!this.isTldrawFile(file)) return

				const { type } = leaf.getViewState()
				const viewMode = this.getLeafFileViewMode(leaf, file) || type // current view mode
				const isMDMode = viewMode === VIEW_TYPE_MARKDOWN

				const view = isMDMode ? VIEW_TYPE_TLDRAW : VIEW_TYPE_MARKDOWN // opposite view mode
				const icon = isMDMode ? TLDRAW_ICON_NAME : MARKDOWN_ICON_NAME
				const title = isMDMode ? 'View as tldraw' : 'View as Markdown'

				menu.addItem((item) => {
					item
						.setIcon(icon)
						.setSection('tldraw')
						.setTitle(title)
						.onClick(async () => {
							await this.updateViewMode(view, leaf)
						})
				})
			})
		)

		// handles how this plugin decides what view mode the file should be displayed in
		this.registerEvent(
			this.app.workspace.on('active-leaf-change', async (leaf) => {
				// always set this to false on a leaf change to prevent it from showing on non tldr files
				this.setStatusBarViewModeVisibility(false)

				// guard clause:
				if (!leaf) return
				const leafViewState = leaf.getViewState()
				const leafViewMode = leafViewState.type
				const validViewType = isValidViewType(leafViewMode)

				// more guard clause:
				if (!validViewType) return
				const fileFromState = leafViewState.state?.file
				const file = this.app.workspace.getActiveFile()

				if (typeof fileFromState !== 'string') return

				// even more guard clauses:
				if (!file || !fileFromState) return
				if (fileFromState !== file.path || !this.isTldrawFile(file)) return

				// update the status bar:
				const viewMode = this.getLeafFileViewMode(leaf, file)
				this.setStatusBarViewModeVisibility(true)
				this.updateStatusBarViewMode(viewMode)
			})
		)

		this.registerEvent(
			this.app.vault.on('modify', async (file) => {
				if (!(file instanceof TFile)) return

				if (!this.hasTldrawFrontMatterKey(file)) return

				const listeners = this.tldrawFileListeners.getListeners(file)

				if (listeners === undefined || listeners.length === 0) return

				listeners.forEach((e) => e.call())
			})
		)

		this.registerEvent(
			this.app.metadataCache.on('changed', async (file) => {
				if (!(file instanceof TFile)) return

				if (!this.hasTldrawFrontMatterKey(file)) return

				const listeners = this.tldrawFileMetadataListeners.getListeners(file)

				if (listeners === undefined || listeners.length === 0) return

				listeners.forEach((e) => e.call())
			})
		)
	}

	private registerCommands = () => registerCommands(this)

	public setStatusBarViewModeVisibility(visible: boolean) {
		this.viewModeManager.setStatusBarViewModeVisibility(visible)
	}

	public updateStatusBarViewMode(view: ViewType) {
		this.viewModeManager.updateStatusBarViewMode(view)
	}

	public setMarkdownView = (leaf: WorkspaceLeaf, eState?: unknown) =>
		this.viewModeManager.setMarkdownView(leaf, eState)

	public setTldrawView = (leaf: WorkspaceLeaf, eState?: unknown) =>
		this.viewModeManager.setTldrawView(leaf, eState)

	public setTldrawViewPreview = (leaf: WorkspaceLeaf, eState?: unknown) =>
		this.viewModeManager.setTldrawViewPreview(leaf, eState)

	public getLeafFileId(leaf?: WorkspaceLeaf, file?: TFile | null) {
		return this.viewModeManager.getLeafFileId(leaf, file)
	}

	public getLeafFileViewMode(leaf?: WorkspaceLeaf, file?: TFile) {
		return this.viewModeManager.getLeafFileViewMode(leaf, file)
	}

	public setLeafFileViewMode(viewMode: ViewType, leaf?: WorkspaceLeaf, file?: TFile) {
		this.viewModeManager.setLeafFileViewMode(viewMode, leaf, file)
	}

	public updateViewMode(view: ViewType, leaf?: WorkspaceLeaf, eState?: unknown) {
		return this.viewModeManager.updateViewMode(view, leaf, eState)
	}

	public createFile(filename: string, foldername: string, data?: string): Promise<TFile> {
		return this.fileCreator.createFile(filename, foldername, data)
	}

	public createTldrFile = (...args: Parameters<TldrawFileCreator['createTldrFile']>) =>
		this.fileCreator.createTldrFile(...args)

	public createDefaultFilename(options: { currentFile?: Pick<TFile, 'basename'> }) {
		return this.fileCreator.createDefaultFilename(options)
	}

	public createUntitledTldrFile = (
		...args: Parameters<TldrawFileCreator['createUntitledTldrFile']>
	) => this.fileCreator.createUntitledTldrFile(...args)

	public openTldrFile = (...args: Parameters<TldrawFileCreator['openTldrFile']>) =>
		this.fileCreator.openTldrFile(...args)

	/**
	 * Check if {@linkcode file} is a markdown file for tldraw documents.
	 */
	public isTldrawFile(file: TFile) {
		return isTldrawFile(this.app, this.settingsManager.settings, file)
	}

	public hasTldrawFrontMatterKey(file: TFile) {
		return hasTldrawFrontMatterKey(this.app, this.settingsManager.settings, file)
	}

	private switchToTldrawViewAfterLoad() {
		this.viewModeManager.switchToTldrawViewAfterLoad()
	}

	async saveSettings() {
		await this.saveData(this.settingsManager.settings)
	}

	getEmbedBoundsSelectorIcon() {
		return this.embedBoundsSelectorIcon
	}

	getFontOverrides() {
		return processFontOverrides(this.settingsManager.settings.fonts?.overrides, (font) => {
			return this.app.vault.adapter.getResourcePath(font).split('?')[0]
		})
	}

	getIconOverrides() {
		return processIconOverrides(this.settingsManager.settings.icons?.overrides, (icon) => {
			return this.app.vault.adapter.getResourcePath(icon).split('?')[0]
		})
	}
}
