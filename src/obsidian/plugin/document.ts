import { BlockCache, TFile } from 'obsidian'
import TldrawPlugin from 'src/main'
import { TLDataDocumentStore } from 'src/utils/document'
import { TLStore } from 'tldraw'

type Tail<T> = T extends [unknown, ...infer U] ? U : never
type OpenArgs = Tail<Parameters<TldrawPlugin['openTldrFile']>>

export class TldrawDocument {
	#plugin: TldrawPlugin
	#tFile: TFile
	#instance?: {
		getData: () => string
		getDocumentStore: () => TLDataDocumentStore
		pruneStoreImages: (...srcs: BlockCache[]) => Promise<void>
		getStore: () => TLStore
		unregister: () => void
	}

	constructor(plugin: TldrawPlugin, tFile: TFile) {
		this.#plugin = plugin
		this.#tFile = tFile
	}

	static async create(
		plugin: TldrawPlugin,
		...args: Parameters<TldrawPlugin['createUntitledTldrFile']>
	): Promise<TldrawDocument> {
		const tFile = await plugin.createUntitledTldrFile(...args)

		return new TldrawDocument(plugin, tFile)
	}

	get path() {
		return this.#tFile.path
	}

	open(...args: OpenArgs) {
		return this.#plugin.openTldrFile(this.#tFile, ...args)
	}

	getBlockCache() {
		return this.getCachedMetadata()?.blocks
	}

	getCachedMetadata() {
		return this.#plugin.app.metadataCache.getFileCache(this.#tFile)
	}

	/**
	 * A helper to wait for the metadata to change once.
	 */
	async onceMetadataChanged(abortSignal?: AbortSignal) {
		const { resolve, promise } = Promise.withResolvers<void>()
		const off = this.#plugin.app.metadataCache.on('changed', (file) => {
			if (file === this.#tFile) {
				this.#plugin.app.metadataCache.offref(off)
				resolve()
			}
		})
		abortSignal?.addEventListener('abort', () => {
			resolve()
		})
		return promise
	}

	async getInstance() {
		if (this.#instance) {
			return this.#instance
		}
		let fileData = await this.#plugin.app.vault.cachedRead(this.#tFile)
		const instance = this.#plugin.tlDataDocumentStoreManager.register(
			this.#tFile,
			() => fileData,
			(newFileData) => {
				fileData = newFileData
			},
			false
		)
		this.#instance = {
			getData: () => fileData,
			getDocumentStore: () => instance.documentStore,
			pruneStoreImages: (...args) => instance.assets.pruneStoreImages(...args),
			getStore: () => instance.documentStore.store,
			unregister: () => {
				this.#instance = undefined
				instance.unregister()
			},
		}
		return this.#instance
	}
}
