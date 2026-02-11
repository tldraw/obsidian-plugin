import { around } from 'monkey-around'
import {
	addIcon,
	getIcon,
	MarkdownView,
	moment,
	normalizePath,
	Notice,
	OpenViewState,
	Plugin,
	TFile,
	ViewState,
	WorkspaceLeaf,
} from 'obsidian'
import { Root } from 'react-dom/client'
import { Editor, TLDRAW_FILE_EXTENSION, TLStore } from 'tldraw'
import { createReactStatusBarViewMode } from './components/StatusBarViewMode'
import createMain from './components/plugin/TldrawInObsidian'
import { ReadonlyTldrawView } from './obsidian/TldrawReadonlyView'
import {
	DEFAULT_SETTINGS,
	TldrawPluginSettings,
	TldrawSettingsTab,
} from './obsidian/TldrawSettingsTab'
import { EditableTldrawView } from './obsidian/TldrawView'
import { createEmbedTldraw } from './obsidian/components/markdown-render-child'
import { formatFilePrefix } from './obsidian/file/new'
import { pluginMenuLabel } from './obsidian/menu'
import TLDataDocumentStoreManager from './obsidian/plugin/TLDataDocumentStoreManager'
import { TldrawFileListenerMap } from './obsidian/plugin/TldrawFileListenerMap'
import { registerCommands } from './obsidian/plugin/commands'
import { getTldrawFileDestination } from './obsidian/plugin/file-destination'
import TldrawInObsidianPluginInstance from './obsidian/plugin/instance'
import { markdownPostProcessor } from './obsidian/plugin/markdown-post-processor'
import { processFontOverrides, processIconOverrides } from './obsidian/plugin/settings'
import UserSettingsManager from './obsidian/settings/UserSettingsManager'
import {
	FILE_EXTENSION,
	FRONTMATTER_KEY,
	MARKDOWN_ICON,
	MARKDOWN_ICON_NAME,
	PaneTarget,
	RIBBON_NEW_FILE,
	TLDRAW_ICON,
	TLDRAW_ICON_NAME,
	VIEW_TYPE_MARKDOWN,
	VIEW_TYPE_TLDRAW,
	VIEW_TYPE_TLDRAW_READ_ONLY,
	ViewType,
} from './utils/constants'
import {
	codeBlockTemplate,
	frontmatterTemplate,
	getTLDataTemplate,
	tlFileTemplate,
} from './utils/document'
import { migrateTldrawFileDataIfNecessary } from './utils/migrate/tl-data-to-tlstore'
import { useStatusBarState } from './utils/stores'
import { createRawTldrawFile } from './utils/tldraw-file'
import { tldrawFileToJson } from './utils/tldraw-file/tldraw-file-to-json'
import { checkAndCreateFolder, getNewUniqueFilepath, isValidViewType } from './utils/utils'

export default class TldrawPlugin extends Plugin {
	#instance?: TldrawInObsidianPluginInstance
	// status bar stuff:
	statusBarRoot: HTMLElement
	statusBarViewModeReactRoot: Root
	unsubscribeToViewModeState: () => void
	transientUpdate: boolean = false

	// keeps track of what view mode each tab-file combo should be in:
	leafFileViewModes: { [leafFileId: string]: ViewType } = {}
	readonly settingsManager = new UserSettingsManager(this)
	readonly tldrawFileListeners = new TldrawFileListenerMap(this)
	readonly tldrawFileMetadataListeners = new TldrawFileListenerMap(this)
	readonly tlDataDocumentStoreManager = new TLDataDocumentStoreManager(this)
	currTldrawEditor?: Editor

	// misc:
	embedBoundsSelectorIcon: string
	settings: TldrawPluginSettings

	get instance() {
		return (
			this.#instance ??
			(() => {
				throw new Error('Plugin not loaded')
			})()
		)
	}

	async onload() {
		super.onload()
		const instance = (this.#instance = new TldrawInObsidianPluginInstance(this.app))

		this.register(() => {
			if (this.#instance === instance) {
				this.#instance = undefined
			}
			instance.dispose()
		})

		this.registerView(VIEW_TYPE_TLDRAW, (leaf) => new EditableTldrawView(leaf, this))

		this.registerView(VIEW_TYPE_TLDRAW_READ_ONLY, (leaf) => new ReadonlyTldrawView(leaf, this))

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
			async (state, prevState) => {
				if (state.view.mode !== prevState.view.mode && state.view.source === 'react')
					await this.updateViewMode(state.view.mode)
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

		const unmount = createMain(this, this.app.dom.statusBarEl)
		this.register(() => {
			unmount()
		})
	}

	onunload() {
		this.tlDataDocumentStoreManager.dispose()
		this.unsubscribeToViewModeState()
		this.statusBarViewModeReactRoot.unmount()
		URL.revokeObjectURL(this.embedBoundsSelectorIcon)
		this.#instance = undefined
		super.onunload()
	}

	private registerEvents() {
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const plugin = this
		// Monkey patch WorkspaceLeaf to open Tldraw drawings with TldrawView by default
		// inspired from https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/f79181c76a9d6ef9f17ecdfd054aa0e6d7564d1f/src/main.ts#L1649C9-L1649C9
		this.register(
			around(WorkspaceLeaf.prototype, {
				setViewState(next) {
					return function (this: WorkspaceLeaf, state: ViewState, ...rest: unknown[]) {
						const rstate = state.state // "real" state
						const filePath = rstate?.file as string
						const viewType = state.type
						const validViewType = isValidViewType(viewType)

						if (plugin.settings.workspace.switchMarkdownView && validViewType && filePath) {
							const matr = Boolean(rstate?.manuallyTriggered)

							const file = plugin.app.vault.getAbstractFileByPath(filePath)

							if (file instanceof TFile && plugin.hasTldrawFrontMatterKey(file)) {
								const view = matr ? viewType : plugin.settings.workspace.tldrMarkdownViewType
								const newState = { ...state, type: view }

								plugin.setLeafFileViewMode(view, this, file)
								plugin.updateStatusBarViewMode(view)

								return next.apply(this, [newState, ...rest])
							}
						}
						return next.apply(this, [state, ...rest])
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
						.setTitle('View as Tldraw')
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
								.setTitle('Edit as new Note')
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
				const title = isMDMode ? 'View as Tldraw' : 'View as Markdown'

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
		if (visible) this.statusBarRoot.removeClass('ptl-hide-statusbar-viewmode')
		else this.statusBarRoot.addClass('ptl-hide-statusbar-viewmode')
	}

	public updateStatusBarViewMode(view: ViewType) {
		useStatusBarState.setState({ view: { mode: view, source: 'plugin' } })
	}

	public setMarkdownView = async (leaf: WorkspaceLeaf, eState?: unknown) => {
		await leaf.setViewState(
			{
				type: VIEW_TYPE_MARKDOWN,
				state: { ...leaf.view.getState(), manuallyTriggered: true },
			} as ViewState,
			eState
		)
	}

	public setTldrawView = async (leaf: WorkspaceLeaf, eState?: unknown) => {
		await leaf.setViewState(
			{
				type: VIEW_TYPE_TLDRAW,
				state: { ...leaf.view.getState(), manuallyTriggered: true },
			} as ViewState,
			eState
		)
	}

	public setTldrawViewPreview = async (leaf: WorkspaceLeaf, eState?: unknown) => {
		await leaf.setViewState(
			{
				type: VIEW_TYPE_TLDRAW_READ_ONLY,
				state: { ...leaf.view.getState(), manuallyTriggered: true },
			} as ViewState,
			eState
		)
	}

	/**
	 * the leafFileViewMode ID is a combination of the leaf (or tab) id and the file in that tab's path. This is how we can look up what view mode each leaf-file combo has been set.
	 * @param leaf
	 * @param file
	 * @returns
	 */
	public getLeafFileId(leaf?: WorkspaceLeaf, file?: TFile | null) {
		leaf ??= this.app.workspace.getLeaf(false)
		file ??= this.app.workspace.getActiveFile()

		// @ts-ignore: leaf.id exists but the typescript declarations don't say so
		const leafId = leaf.id as string
		const filePath = file?.path ?? ''

		return `${leafId}-${filePath}`
	}

	public getLeafFileViewMode(leaf?: WorkspaceLeaf, file?: TFile) {
		const id = this.getLeafFileId(leaf, file)
		const viewMode = this.leafFileViewModes[id]
		return viewMode
	}

	public setLeafFileViewMode(viewMode: ViewType, leaf?: WorkspaceLeaf, file?: TFile) {
		const id = this.getLeafFileId(leaf, file)
		this.leafFileViewModes[id] = viewMode
	}

	public async updateViewMode(view: ViewType, leaf?: WorkspaceLeaf, eState?: unknown) {
		view ??= VIEW_TYPE_TLDRAW
		leaf ??= this.app.workspace.getLeaf(false)

		// guard clause to prevent changing the view if the view is already correct:
		const { type } = leaf.getViewState()
		if (type === view) return

		// these functions will actually change the view mode:
		switch (view) {
			case VIEW_TYPE_TLDRAW:
				await this.setTldrawView(leaf, eState)
				break
			case VIEW_TYPE_TLDRAW_READ_ONLY:
				await this.setTldrawViewPreview(leaf, eState)
				break
			default:
				console.warn('Uknown tldraw plugin view: ', view)
				await this.setMarkdownView(leaf, eState)
		}
	}

	public async createFile(filename: string, foldername: string, data?: string): Promise<TFile> {
		const folderpath = normalizePath(foldername)
		await checkAndCreateFolder(folderpath, this.app.vault) //create folder if it does not exist
		const fname = getNewUniqueFilepath(this.app.vault, filename, folderpath)

		return await this.app.vault.create(fname, data ?? '')
	}

	public createTldrFile = async (
		filename: string,
		{
			foldername,
			inMarkdown,
			tlStore,
		}: { foldername: string; inMarkdown: boolean; tlStore?: TLStore }
	) => {
		const extension = inMarkdown ? FILE_EXTENSION : TLDRAW_FILE_EXTENSION
		// adds the extension if the filename does not already include it:
		filename = filename.endsWith(extension) ? filename : filename + extension

		const tldrawFile = createRawTldrawFile(tlStore)
		const fileData = !inMarkdown
			? JSON.stringify(tldrawFileToJson(tldrawFile))
			: (() => {
					// constructs the markdown content thats a template:
					const tlData = getTLDataTemplate(
						this.manifest.version,
						tldrawFile,
						window.crypto.randomUUID()
					)
					const frontmatter = frontmatterTemplate(
						`${this.settings.file?.altFrontmatterKey ?? FRONTMATTER_KEY}: true`,
						this.settingsManager.markdownFileTags
					)
					const codeblock = codeBlockTemplate(tlData)
					return tlFileTemplate(frontmatter, codeblock)
				})()

		return await this.createFile(filename, foldername, fileData)
	}

	public createDefaultFilename({ currentFile }: { currentFile?: Pick<TFile, 'basename'> }) {
		const { newFilePrefix, newFileTimeFormat } = this.settings

		const date = newFileTimeFormat.trim() !== '' ? moment().format(newFileTimeFormat) : ''

		// if both the prefix and the date is empty as contentation
		// then we have to use the defaults to name the file
		let filename =
			formatFilePrefix(newFilePrefix, {
				currentFileBasename: currentFile?.basename,
			}) + date
		if (filename.trim() === '')
			filename =
				DEFAULT_SETTINGS.newFilePrefix + moment().format(DEFAULT_SETTINGS.newFileTimeFormat)

		return filename
	}

	/**
	 *
	 * @param attachTo The file that is considered as the "parent" of this new file. If this is not undefined then the new untitled tldr file will be considered as an attachment.
	 * @returns
	 */
	public createUntitledTldrFile = async ({
		attachTo,
		tlStore,
		inMarkdown = true,
	}: {
		attachTo?: TFile
		tlStore?: TLStore
		/**
		 * @default true
		 */
		inMarkdown?: boolean
	} = {}) => {
		const filename = this.createDefaultFilename({ currentFile: attachTo })
		const res = await getTldrawFileDestination(this, filename, attachTo)
		return this.createTldrFile(res.filename, {
			tlStore,
			inMarkdown,
			foldername: res.folder,
		})
	}

	public openTldrFile = async (
		file: TFile,
		location: PaneTarget,
		viewType: ViewType = VIEW_TYPE_TLDRAW,
		openState?: OpenViewState
	) => {
		let leaf: WorkspaceLeaf

		if (location === 'current-tab') leaf = this.app.workspace.getLeaf(false)
		else if (location === 'new-tab') leaf = this.app.workspace.getLeaf(true)
		else if (location === 'new-window') leaf = this.app.workspace.getLeaf('window')
		else if (location === 'split-tab') leaf = this.app.workspace.getLeaf('split')
		else leaf = this.app.workspace.getLeaf(false)

		await leaf.openFile(file, openState)
		await this.updateViewMode(viewType, leaf, openState?.eState)
		return leaf
	}

	/**
	 * Check if {@linkcode file} is a markdown file for tldraw documents.
	 */
	public isTldrawFile(file: TFile) {
		if (!file) return false
		return this.hasTldrawFrontMatterKey(file)
	}

	public hasTldrawFrontMatterKey(file: TFile) {
		const fcache = file ? this.app.metadataCache.getFileCache(file) : null
		const frontmatter = fcache?.frontmatter
		if (!frontmatter) return false

		const altFrontmatterKey = this.settings.file?.altFrontmatterKey

		return (
			Object.hasOwn(frontmatter, FRONTMATTER_KEY) ||
			(!!altFrontmatterKey && Object.hasOwn(frontmatter, altFrontmatterKey))
		)
	}

	private switchToTldrawViewAfterLoad() {
		this.app.workspace.onLayoutReady(() => {
			for (const leaf of this.app.workspace.getLeavesOfType('markdown')) {
				if (
					leaf.view instanceof MarkdownView &&
					leaf.view.file &&
					this.isTldrawFile(leaf.view.file)
				) {
					this.updateViewMode(VIEW_TYPE_TLDRAW, leaf)
				}
			}
		})
	}

	async saveSettings() {
		await this.saveData(this.settings)
	}

	getEmbedBoundsSelectorIcon() {
		return this.embedBoundsSelectorIcon
	}

	getFontOverrides() {
		return processFontOverrides(this.settings.fonts?.overrides, (font) => {
			return this.app.vault.adapter.getResourcePath(font).split('?')[0]
		})
	}

	getIconOverrides() {
		return processIconOverrides(this.settings.icons?.overrides, (icon) => {
			return this.app.vault.adapter.getResourcePath(icon).split('?')[0]
		})
	}
}
