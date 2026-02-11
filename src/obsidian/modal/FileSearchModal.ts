import { normalizePath, setIcon, SuggestModal, TAbstractFile, TFile, TFolder } from 'obsidian'
import TldrawPlugin from 'src/main'
import { getDir } from 'src/utils/path'

type Suggestion = {
	icon: string
	title: string
	label?: string
} & (
	| {
			type: 'selection'
			value: TAbstractFile | string
	  }
	| {
			type: 'navigate'
			value: TAbstractFile
			from?: TAbstractFile
	  }
)

export class FileSearchCanceled extends Error {}

export class FileSearchModal extends SuggestModal<Suggestion> {
	plugin: TldrawPlugin

	/**
	 * If undefined then any extension, otherwise only if included.
	 */
	readonly extensions?: string[]
	readonly selectDir: boolean
	readonly allowAnyPath: boolean

	private readonly setSelection: (file: TAbstractFile | string) => void
	private readonly onEmptyStateText: (searchPath: string) => string
	private readonly _onClose?: () => void

	private currRes: {
		searchPath: string
		closestDir: TFolder
		currentPath: TAbstractFile | string
		results: (TFolder | TFile)[]
	}

	private searchResolver?: (res: typeof this.currRes) => void

	constructor(
		plugin: TldrawPlugin,
		options: {
			allowAnyPath?: boolean
			initialSearchPath?: string
			extensions?: FileSearchModal['extensions']
			onEmptyStateText: FileSearchModal['onEmptyStateText']
			setSelection: FileSearchModal['setSelection']
			/**
			 * default value is false
			 */
			selectDir?: boolean
			onClose?: () => void
		}
	) {
		super(plugin.app)
		this.plugin = plugin
		this.extensions = options.extensions
		this.onEmptyStateText = options.onEmptyStateText
		this.setSelection = options.setSelection
		this.selectDir = options.selectDir ?? false
		this.allowAnyPath = options.allowAnyPath ?? false
		this.currRes = this.search(options.initialSearchPath ?? '', true)
		this._onClose = options.onClose
	}

	static async chooseFolder(
		plugin: TldrawPlugin,
		{
			allowAnyPath,
			initialSearchPath,
		}: {
			allowAnyPath?: boolean
			initialSearchPath?: string
		}
	): Promise<string | TAbstractFile> {
		return new Promise((res, rej) => {
			new FileSearchModal(plugin, {
				allowAnyPath,
				initialSearchPath,
				extensions: [],
				selectDir: true,
				setSelection(file) {
					if (typeof file === 'string' || file instanceof TFolder) {
						res(file)
						return
					}
					rej(new Error(`Not a folder: ${file.path}`))
				},
				onEmptyStateText(searchPath) {
					return `There are no folders in ${searchPath}`
				},
				onClose() {
					rej(new FileSearchCanceled())
				},
			}).open()
		})
	}

	onOpen(): void {
		super.onOpen()
		if (this.currRes) {
			const currentPath = this.currRes.currentPath
			this.changeInputValue(
				typeof currentPath === 'string'
					? currentPath
					: currentPath instanceof TFolder
						? currentPath.path + '/'
						: currentPath.path
			)
		}
	}

	onClose(): void {
		this._onClose?.()
		super.onClose()
	}

	private getFirstFile(searchPath: string): TAbstractFile {
		let _searchPath = normalizePath(searchPath)
		// eslint-disable-next-line no-constant-condition
		while (true) {
			const folder = this.app.vault.getAbstractFileByPath(_searchPath)
			if (folder) return folder
			_searchPath = getDir(_searchPath)
			if (_searchPath === '/') return this.app.vault.getRoot()
		}
	}

	private search(searchPath: string, initialSearch?: boolean): typeof this.currRes {
		const normalizedPath = normalizePath(searchPath)
		if (normalizedPath === '/') {
			const root = this.app.vault.getRoot()
			return {
				searchPath,
				closestDir: root,
				currentPath: root,
				results: this.filterSearchPath(root, ''),
			}
		}

		const file = this.getFirstFile(searchPath)
		if (!(file instanceof TFolder)) {
			const closestDir = file.parent ?? this.app.vault.getRoot()
			return {
				searchPath,
				closestDir,
				currentPath: file,
				results: this.filterSearchPath(closestDir, file.path),
			}
		}

		const dir = file
		if (searchPath.endsWith('/') || initialSearch) {
			if (!initialSearch && !dir.path.startsWith(normalizedPath)) {
				return {
					searchPath,
					closestDir: dir,
					currentPath: normalizedPath,
					results: [],
				}
			}
			return {
				searchPath,
				closestDir: dir,
				currentPath: dir,
				results: this.filterSearchPath(dir, normalizedPath),
			}
		} else if (!dir.parent || normalizedPath !== dir.path)
			return {
				searchPath,
				closestDir: dir,
				currentPath: normalizedPath,
				results: this.filterSearchPath(dir, normalizedPath),
			}

		return {
			searchPath,
			closestDir: dir.parent,
			currentPath: normalizedPath,
			results: this.filterSearchPath(dir.parent, normalizedPath),
		}
	}

	/**
	 * Search a path for files in a debounced manner.
	 */
	debouncedSearch = debounce(
		(searchPath: string, res: (result: typeof this.currRes) => void) =>
			res(this.search(searchPath)),
		100
	)

	async changeInputValue(value: string) {
		this.inputEl.value = value
		this.updateSuggestions()
	}

	getSuggestions(query: string): Promise<Suggestion[]> {
		const lastResolver = this.searchResolver
		return new Promise<Suggestion[]>((res) => {
			const resolver: typeof this.searchResolver = (r) => {
				this.searchResolver = undefined
				this.currRes = r
				const suggestions: Suggestion[] = []

				if (r.currentPath instanceof TAbstractFile) {
					if (r.currentPath.parent) {
						suggestions.push({
							type: 'navigate',
							icon: 'undo-2',
							from: r.currentPath,
							value: r.currentPath.parent,
							title: `Go to parent dir`,
							label: `../`,
						})
					}
				} else {
					const difference = r.currentPath.slice(r.closestDir.path.length).split('/')
					if (difference.length === 2) {
						suggestions.push({
							type: 'navigate',
							icon: 'undo-2',
							value: r.closestDir,
							title: `Go to parent dir`,
							label: `../`,
						})
					} else {
						suggestions.push({
							type: 'navigate',
							icon: 'undo-2',
							value: r.closestDir,
							title: 'Go to closest dir',
							label: r.closestDir.path,
						})
					}
				}

				/**
				 * Sorted first by folders, then files.
				 */
				const files = r.results.sort((a, b) =>
					(a instanceof TFolder && b instanceof TFolder) ||
					(a instanceof TFile && b instanceof TFolder)
						? a.path.localeCompare(b.path)
						: a instanceof TFolder
							? -1
							: 1
				)

				const normalizedSearchPath = normalizePath(r.searchPath)
				if (this.allowAnyPath && !this.app.vault.getAbstractFileByPath(normalizedSearchPath)) {
					suggestions.push({
						type: 'selection',
						icon: 'space',
						value: normalizedSearchPath,
						title: 'Select path',
						label: normalizedSearchPath,
					})
				}

				if (this.selectDir && r.currentPath instanceof TFolder) {
					suggestions.push({
						type: 'selection',
						icon: 'folder-check',
						value: r.currentPath,
						title: 'Select current directory',
						label: r.currentPath.path,
					})
				}

				suggestions.push(
					...files.map<Suggestion>((e) =>
						e instanceof TFolder
							? {
									type: 'navigate',
									icon: 'folder-open',
									value: e,
									from: r.closestDir,
									title: e.name,
								}
							: {
									type: 'selection',
									icon: 'file',
									value: e,
									title: e.name,
								}
					)
				)

				return res(suggestions)
			}

			this.searchResolver = resolver
			if (lastResolver) {
				lastResolver(this.currRes)
			}
			this.debouncedSearch(query, resolver)
		})
	}

	renderSuggestion(suggestion: Suggestion, el: HTMLElement) {
		const div = el.createDiv({ cls: 'ptl-suggestion-item' })
		setIcon(div.createSpan({ cls: 'ptl-suggestion-item-icon' }), suggestion.icon)
		div.createSpan({
			cls: 'ptl-file-search-title',
			text: suggestion.title,
		})
		if (suggestion.label) {
			el.createDiv({ cls: 'ptl-suggestion-label', text: suggestion.label })
		}
	}

	onChooseSuggestion(suggestion: Suggestion, evt: MouseEvent | KeyboardEvent) {
		switch (suggestion.type) {
			case 'navigate':
				{
					const path = !(suggestion.value instanceof TFolder)
						? suggestion.value.path
						: suggestion.value.isRoot()
							? '/'
							: suggestion.value.path + '/'
					this.changeInputValue(path)
				}
				return
			case 'selection': {
				this.setSelection(suggestion.value)
				this.close()
			}
		}
	}

	selectSuggestion(value: Suggestion, evt: MouseEvent | KeyboardEvent): void {
		this.onChooseSuggestion(value, evt)
	}

	onNoSuggestion(): void {
		this.emptyStateText = this.onEmptyStateText(this.currRes.searchPath)
		return super.onNoSuggestion()
	}

	filterSearchPath(tFolder: TFolder, searchPath: string) {
		return filterSearchPath(tFolder, searchPath, this.extensions)
	}
}

function filterSearchPath(tFolder: TFolder, searchPath: string, extensions?: string[]) {
	return tFolder.children
		.map((e) =>
			!(e instanceof TFolder) && !(e instanceof TFile)
				? undefined
				: e instanceof TFolder
					? e
					: extensions === undefined
						? e
						: extensions.includes(e.extension)
							? e
							: undefined
		)
		.filter((e) => e !== undefined)
		.filter((e) => e.path.startsWith(searchPath))
}

function debounce<T extends [unknown, ...unknown[]]>(
	/** callback to debounce */ cb: (...args: T) => void,
	/** milliseconds */ wait: number
) {
	let timeout: undefined | NodeJS.Timeout
	return function (...args: T) {
		clearTimeout(timeout)
		timeout = setTimeout(() => cb(...args), wait)
	}
}
