import { EditableFileView, TFile, WorkspaceLeaf } from 'obsidian'
import { TldrawStoreIndexedDB } from 'src/tldraw/indexeddb-store'
import { TLDataDocumentStore } from 'src/utils/document'
import { loadSnapshot } from 'tldraw'
import TldrawPlugin from '../main'
import { VIEW_TYPE_TLDRAW } from '../utils/constants'
import { BaseTldrawFileView, DataUpdate } from './BaseTldrawFileView'
import TldrawStoreExistsIndexedDBModal, {
	TldrawStoreConflictResolveCanceled,
	TldrawStoreConflictResolveFileUnloaded,
} from './modal/TldrawStoreExistsIndexedDBModal'

export class TldrawView extends BaseTldrawFileView {
	plugin: TldrawPlugin

	constructor(fileView: EditableFileView, plugin: TldrawPlugin) {
		super(fileView)
		this.plugin = plugin
	}

	override onUpdated(update: DataUpdate) {
		// Always save the data to the file.
		update.saveFile().catch((e) => {
			console.error(e)
		})
	}

	isReadOnly() {
		return true
	}

	override async processStore(
		documentStore: TLDataDocumentStore
	): Promise<TLDataDocumentStore | null> {
		if (!this.fileView.file) {
			// Bad state
			throw new Error('File is not set')
		}

		return this.checkConflictingData(this.fileView.file, documentStore)
			.then((snapshot) => this.loadStore(documentStore, snapshot))
			.catch((e) => {
				if (e instanceof TldrawStoreConflictResolveFileUnloaded) {
					// The FileView was unloaded before the conflict was resolved. Do nothing.
					return null
				} else if (e instanceof TldrawStoreConflictResolveCanceled) {
					// TODO: allow the modal to be recreated and shown.
					console.warn(e)
					return null
				}
				throw e
			})
	}

	/**
	 * Sets the view to use the {@linkcode documentStore}, and optionally replaces the data with {@linkcode snapshot}.
	 * @param documentStore Contains the store to load.
	 * @param snapshot If defined, then it will replace the store data in {@linkcode documentStore}
	 */
	loadStore(
		documentStore: TLDataDocumentStore,
		snapshot?: Awaited<ReturnType<typeof this.checkConflictingData>>
	) {
		if (snapshot) {
			loadSnapshot(documentStore.store, snapshot)
		}
		return documentStore
	}

	/**
	 * Previous version of this plugin utilized a built-in feature of the tldraw package to synchronize drawings across workspace leafs.
	 * As a result, the tldraw store was persisted in the IndexedDB. Let's check if that is the case for this particular document and
	 * prompt the user to delete or ignore it.
	 *
	 * @param documentStore
	 * @param tFile
	 * @returns A promise that resolves with undefined, or a snapshot that can be used to replace the contents of the store in {@linkcode documentStore}
	 */
	private async checkConflictingData(tFile: TFile, documentStore: TLDataDocumentStore) {
		if (
			TldrawStoreExistsIndexedDBModal.ignoreIndexedDBStoreModal(
				this.fileView.app.metadataCache,
				tFile
			)
		) {
			return
		}
		const exists = await TldrawStoreIndexedDB.exists(documentStore.meta.uuid)
		if (!exists) {
			return
		}
		return TldrawStoreExistsIndexedDBModal.showResolverModal(this, tFile, documentStore)
	}
}

export class EditableTldrawView extends EditableFileView {
	adapter: TldrawView
	constructor(leaf: WorkspaceLeaf, plugin: TldrawPlugin) {
		super(leaf)
		this.adapter = new TldrawView(this, plugin)
		this.navigation = true
	}

	override getViewType() {
		return VIEW_TYPE_TLDRAW
	}

	override getDisplayText() {
		return this.file ? this.file.basename : 'NO_FILE'
	}
}
