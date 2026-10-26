import { FileView, Menu, WorkspaceLeaf } from 'obsidian'
import { TLDRAW_ICON_NAME, VIEW_TYPE_TLDRAW_OFFLINE } from 'src/plugin/constants'
import { TLDRAW_OFFLINE_UNSUPPORTED_TITLE } from 'src/plugin/document/constants'
import { appendTldrawOfflineMessage } from 'src/utils/tldraw-offline-message'
import { pluginMenuLabel } from 'src/plugin/menu'
import { ErrorHandler } from 'src/plugin/error-handler'

const OPEN_IN_DEFAULT_APP = 'Open in default app'

/**
 * Shown when a `.tldraw` file is opened. tldraw offline saves documents as an archive holding a
 * SQLite database rather than the JSON a `.tldr` file holds, so we can't render one. We claim the
 * extension anyway so that opening the file explains that, rather than leaving the user on
 * Obsidian's generic "no view for this file type" screen.
 *
 * Claiming the extension takes away Obsidian's own handling, so this offers "open in default app"
 * to keep a route to whatever program can read the file.
 *
 * This extends `FileView` directly rather than `BaseTldrawFileView`, which reads the file as text
 * and parses it as JSON — on an archive that only produces an opaque parse error.
 */
export class TldrawOfflineFileView extends FileView {
	constructor(leaf: WorkspaceLeaf) {
		super(leaf)
		this.navigation = true
	}

	override getViewType() {
		return VIEW_TYPE_TLDRAW_OFFLINE
	}

	override getIcon() {
		return TLDRAW_ICON_NAME
	}

	override getDisplayText() {
		return this.file ? this.file.basename : 'NO_FILE'
	}

	override onload() {
		super.onload()
		this.addAction('external-link', OPEN_IN_DEFAULT_APP, () => this.openInDefaultApp())
	}

	override onPaneMenu(menu: Menu, source: string): void {
		super.onPaneMenu(menu, source)
		if (!this.file) return

		menu
			.addItem((item) => pluginMenuLabel(item.setSection('tldraw')))
			.addItem((item) =>
				item
					.setIcon('external-link')
					.setSection('tldraw')
					.setTitle(OPEN_IN_DEFAULT_APP)
					.onClick(() => this.openInDefaultApp())
			)
	}

	override async onOpen() {
		this.contentEl.empty()
		const container = this.contentEl.createDiv({ cls: 'ptl-offline-unsupported' })
		container.createEl('h3', { text: TLDRAW_OFFLINE_UNSUPPORTED_TITLE })
		appendTldrawOfflineMessage(container)
	}

	private openInDefaultApp() {
		if (!this.file) return
		// Obsidian does not document whether this returns a promise.
		Promise.resolve(this.app.openWithDefaultApp(this.file.path)).catch(ErrorHandler.notice)
	}
}
