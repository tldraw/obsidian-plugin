import { MarkdownView, TFile, WorkspaceLeaf } from 'obsidian'
import { useStatusBarState } from 'src/plugin/app/status-bar-store'
import {
	VIEW_TYPE_MARKDOWN,
	VIEW_TYPE_TLDRAW,
	VIEW_TYPE_TLDRAW_READ_ONLY,
	ViewType,
} from 'src/plugin/constants'
import { ErrorHandler } from 'src/plugin/error-handler'
import TldrawPlugin from 'src/plugin/TldrawPlugin'

/**
 * Tracks and switches the view mode (markdown / tldraw / read-only) per
 * leaf-file combination, and keeps the status bar in sync.
 */
export default class ViewModeManager {
	// keeps track of what view mode each tab-file combo should be in:
	private leafFileViewModes: { [leafFileId: string]: ViewType } = {}

	constructor(private readonly plugin: TldrawPlugin) {}

	setStatusBarViewModeVisibility(visible: boolean) {
		if (visible) this.plugin.statusBarRoot?.removeClass('ptl-hide-statusbar-viewmode')
		else this.plugin.statusBarRoot?.addClass('ptl-hide-statusbar-viewmode')
	}

	updateStatusBarViewMode(view: ViewType) {
		useStatusBarState.setState({ view: { mode: view, source: 'plugin' } })
	}

	setMarkdownView = async (leaf: WorkspaceLeaf, eState?: unknown) => {
		await leaf.setViewState(
			{
				type: VIEW_TYPE_MARKDOWN,
				state: { ...leaf.view.getState(), manuallyTriggered: true },
			},
			eState
		)
	}

	setTldrawView = async (leaf: WorkspaceLeaf, eState?: unknown) => {
		await leaf.setViewState(
			{
				type: VIEW_TYPE_TLDRAW,
				state: { ...leaf.view.getState(), manuallyTriggered: true },
			},
			eState
		)
	}

	setTldrawViewPreview = async (leaf: WorkspaceLeaf, eState?: unknown) => {
		await leaf.setViewState(
			{
				type: VIEW_TYPE_TLDRAW_READ_ONLY,
				state: { ...leaf.view.getState(), manuallyTriggered: true },
			},
			eState
		)
	}

	/**
	 * the leafFileViewMode ID is a combination of the leaf (or tab) id and the file in that tab's path. This is how we can look up what view mode each leaf-file combo has been set.
	 * @param leaf
	 * @param file
	 * @returns
	 */
	getLeafFileId(leaf?: WorkspaceLeaf, file?: TFile | null) {
		leaf ??= this.plugin.app.workspace.getLeaf(false)
		file ??= this.plugin.app.workspace.getActiveFile()

		// @ts-ignore: leaf.id exists but the typescript declarations don't say so
		const leafId = leaf.id as string
		const filePath = file?.path ?? ''

		return `${leafId}-${filePath}`
	}

	getLeafFileViewMode(leaf?: WorkspaceLeaf, file?: TFile) {
		const id = this.getLeafFileId(leaf, file)
		const viewMode = this.leafFileViewModes[id]
		return viewMode
	}

	setLeafFileViewMode(viewMode: ViewType, leaf?: WorkspaceLeaf, file?: TFile) {
		const id = this.getLeafFileId(leaf, file)
		this.leafFileViewModes[id] = viewMode
	}

	async updateViewMode(view: ViewType, leaf?: WorkspaceLeaf, eState?: unknown) {
		view ??= VIEW_TYPE_TLDRAW
		leaf ??= this.plugin.app.workspace.getLeaf(false)

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
				console.warn('Unknown tldraw plugin view: ', view)
				await this.setMarkdownView(leaf, eState)
		}
	}

	switchToTldrawViewAfterLoad() {
		this.plugin.app.workspace.onLayoutReady(() => {
			for (const leaf of this.plugin.app.workspace.getLeavesOfType('markdown')) {
				if (
					leaf.view instanceof MarkdownView &&
					leaf.view.file &&
					this.plugin.isTldrawFile(leaf.view.file)
				) {
					this.updateViewMode(VIEW_TYPE_TLDRAW, leaf).catch(ErrorHandler.notice)
				}
			}
		})
	}
}
