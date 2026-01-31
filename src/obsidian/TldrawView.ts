import { TextFileView, TFile, WorkspaceLeaf } from "obsidian";
import {
	VIEW_TYPE_TLDRAW,
} from "../utils/constants";
import TldrawPlugin from "../main";
import { TLDataDocumentStore } from "src/utils/document";
import { TldrawLoadableMixin } from "./TldrawMixins";
import { loadSnapshot } from "tldraw";
import { TldrawStoreIndexedDB } from "src/tldraw/indexeddb-store";
import TldrawStoreExistsIndexedDBModal, { TldrawStoreConflictResolveCanceled, TldrawStoreConflictResolveFileUnloaded } from "./modal/TldrawStoreExistsIndexedDBModal";

export class TldrawView extends TldrawLoadableMixin(TextFileView) {
	plugin: TldrawPlugin;

	constructor(leaf: WorkspaceLeaf, plugin: TldrawPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.navigation = true;
	}

	getViewType() {
		return VIEW_TYPE_TLDRAW;
	}

	getDisplayText() {
		return this.file ? this.file.basename : "NO_FILE";
	}

	getViewData(): string {
		return this.data;
	}

	private storeInstance?: ReturnType<TldrawPlugin['tlDataDocumentStoreManager']['register']>;

	setViewData(data: string, clear: boolean): void {
		if (!this.file) {
			// Bad state
			return;
		}

		if (this.storeInstance) {
			this.data = data;
			return;
		}

		// All this initialization is done here because this.data is null in onload() and the constructor().
		// However, setViewData() gets called by obsidian right after onload() with its data parameter having the file's data (yay)
		// so we can somewhat safely do initialization stuff in this function.
		// Its worth nothing that at this point this.data is also available but it does not hurt to use what is given
		const storeInstance = this.plugin.tlDataDocumentStoreManager.register(this.file,
			() => data,
			(data) => {
				this.data = data;
			},
			true
		);
		this.storeInstance = storeInstance;

		this.registerOnUnloadFile(() => {
			storeInstance.unregister();
			this.storeInstance = undefined;
		});

		this.checkConflictingData(this.file, storeInstance.documentStore).then(
			(snapshot) => this.loadStore(storeInstance.documentStore, snapshot)
		).catch((e) => {
			if (e instanceof TldrawStoreConflictResolveFileUnloaded) {
				// The FileView was unloaded before the conflict was resolved. Do nothing.
				return;
			} else if (e instanceof TldrawStoreConflictResolveCanceled) {
				// TODO: allow the modal to be recreated and shown.
				console.warn(e);
				return;
			}
			throw e;
		});
	}

	clear(): void { }

	/**
	 * Sets the view to use the {@linkcode documentStore}, and optionally replaces the data with {@linkcode snapshot}.
	 * @param documentStore Contains the store to load.
	 * @param snapshot If defined, then it will replace the store data in {@linkcode documentStore}
	 */
	loadStore(documentStore: TLDataDocumentStore, snapshot?: Awaited<ReturnType<typeof this.checkConflictingData>>) {
		if (snapshot) {
			loadSnapshot(documentStore.store, snapshot);
		}
		this.setStore({ plugin: documentStore });
	}

	/**
	 * Previous version of this plugin utilized a built-in feature of the tldraw package to synchronize drawings across workspace leafs.
	 * As a result, the tldraw store was persisted in the IndexedDB. Let's check if that is the case for this particular document and
	 * prompt the user to delete or ignore it.
	 * 
	 * @param documentStore 
	 * @returns A promise that resolves with undefined, or a snapshot that can be used to replace the contents of the store in {@linkcode documentStore}
	 */
	private async checkConflictingData(tFile: TFile, documentStore: TLDataDocumentStore) {
		if (TldrawStoreExistsIndexedDBModal.ignoreIndexedDBStoreModal(this.app.metadataCache, tFile)) {
			return;
		}
		const exists = await TldrawStoreIndexedDB.exists(documentStore.meta.uuid);
		if (!exists) {
			return;
		}
		return TldrawStoreExistsIndexedDBModal.showResolverModal(this, tFile, documentStore);
	}
}
