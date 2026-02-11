import { FileView, Menu, Notice, TFile, WorkspaceLeaf } from 'obsidian'
import { TldrawAppProps } from 'src/components/TldrawApp'
import TldrawPlugin from 'src/main'
import {
	PaneTarget,
	TLDRAW_ICON_NAME,
	VIEW_TYPE_TLDRAW,
	VIEW_TYPE_TLDRAW_READ_ONLY,
	ViewType,
} from 'src/utils/constants'
import { TLDataDocumentStore } from 'src/utils/document'
import { migrateTldrawFileDataIfNecessary } from 'src/utils/migrate/tl-data-to-tlstore'
import { TLDRAW_FILE_EXTENSION } from 'tldraw'
import { BaseTldrawFileView } from './BaseTldrawFileView'
import { pluginMenuLabel } from './menu'

export class TldrawReadonlyView extends BaseTldrawFileView {
	plugin: TldrawPlugin

	constructor(fileView: FileView, plugin: TldrawPlugin) {
		super(fileView)
		this.plugin = plugin
	}

	isReadOnly() {
		// We don't want to sync to the main store because we don't want to accidentally modify the file.
		return false
	}

	override onUpdated() {
		// Do nothing (read-only)
	}

	override async processStore(documentStore: TLDataDocumentStore): Promise<TLDataDocumentStore> {
		// Read-only doesn't need to process the store.
		return documentStore
	}

	override getTldrawOptions(): TldrawAppProps['options'] {
		return {
			...super.getTldrawOptions(),
			isReadonly: true,
		}
	}

	override viewAsMarkdownClicked(): void {
		const { file } = this.fileView
		if (file !== null && file.path.endsWith(TLDRAW_FILE_EXTENSION)) {
			this.createAndOpen(file, 'new-tab', 'markdown')
			return
		} else {
			super.viewAsMarkdownClicked()
		}
	}

	private async createAndOpen(tFile: TFile, location: PaneTarget, viewType: ViewType) {
		// TODO: Add a dialog to confirm the creation of a file.
		const newFile = await this.plugin.createUntitledTldrFile({
			inMarkdown: true,
			tlStore:
				// NOTE: Maybe this should be retreiving the current tlStore from the tldraw editor instead of re-reading the file.
				migrateTldrawFileDataIfNecessary(await this.fileView.app.vault.read(tFile)),
		})
		await this.plugin.openTldrFile(newFile, location, viewType)
		new Notice(`Created a new file for editing "${newFile.path}"`)
	}
}

export class ReadonlyTldrawView extends FileView {
	adapter: TldrawReadonlyView

	constructor(
		leaf: WorkspaceLeaf,
		public plugin: TldrawPlugin
	) {
		super(leaf)
		this.adapter = new TldrawReadonlyView(this, plugin)
		this.navigation = true
	}

	override getViewType(): string {
		return VIEW_TYPE_TLDRAW_READ_ONLY
	}

	override getDisplayText(): string {
		return `[Preview] ${super.getDisplayText()}`
	}

	override onload(): void {
		super.onload()
		this.addAction(TLDRAW_ICON_NAME, 'Edit', async () => {
			await this.plugin.updateViewMode(VIEW_TYPE_TLDRAW)
		})
	}

	override onPaneMenu(menu: Menu, source: 'more-options' | 'tab-header' | string): void {
		super.onPaneMenu(menu, source)
		const { file } = this
		if (!file) return

		menu
			.addItem((item) => pluginMenuLabel(item.setSection('tldraw')))
			.addItem((item) =>
				item
					.setIcon('external-link')
					.setSection('tldraw')
					.setTitle('Open in default app')
					.onClick(() => this.app.openWithDefaultApp(file.path))
			)
	}
}
