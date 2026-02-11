import { BlockCache, debounce, EventRef, Notice, TFile, Workspace } from 'obsidian'
import { createRecordStore } from 'src/lib/stores'
import TldrawPlugin from 'src/main'
import {
	BlockRefAssetId,
	ObsidianMarkdownFileTLAssetStoreProxy,
	ObsidianTLAssetStore,
} from 'src/tldraw/asset-store'
import { processInitialData } from 'src/tldraw/helpers'
import TldrawStoresManager, {
	MainStore,
	StoreGroup,
	StoreInstanceInfo,
	StoreListenerContext,
} from 'src/tldraw/TldrawStoresManager'
import {
	getTLMetaTemplate,
	makeFileDataTldr,
	TLDataDocumentStore,
	updateFileData,
} from 'src/utils/document'
import { migrateTldrawFileDataIfNecessary } from 'src/utils/migrate/tl-data-to-tlstore'
import { parseTLDataDocument } from 'src/utils/parse'
import { safeSecondsToMs } from 'src/utils/utils'
import {
	loadSnapshot,
	TLAsset,
	TLDRAW_FILE_EXTENSION,
	TLImageAsset,
	TLImageShape,
	TLStore,
	TLUnknownShape,
} from 'tldraw'
import TLDataDocumentMessages, { DocumentMessage } from './TLDataDocumentMessages'

const formats = {
	markdown: 'markdown',
	tldr: 'tldr',
} as const

type Format = (typeof formats)[keyof typeof formats]

type MainData = {
	documentStore: TLDataDocumentStore
	fileData: string
	tFile: TFile
	format: Format
	assets: {
		/**
		 * This method can be called to remove unreferenced assets from the store.
		 *
		 * If any of the assets are referenced by shapes in the store, they will not be removed.
		 *
		 * @param srcs The sources of the assets to prune.
		 *
		 */
		pruneStoreImages(...srcs: BlockCache[]): Promise<void>
	}
	/**
	 * Messages associated with the main document.
	 */
	messages: {
		getAll(): DocumentMessage[]
		addListener(listener: () => void): () => void
		getCount(): number
		dismissAll(): void
		getFile(): TFile
	}
}

export type MainDataMessages = MainData['messages']

type InstanceData = {
	tFile: TFile
	onUpdatedData: (data: string) => void
}

type InstanceInfo = StoreInstanceInfo<InstanceData>

/**
 * #TODO: Handle the case where files are renamed.
 */
export default class TLDataDocumentStoreManager {
	private storesManager = new TldrawStoresManager<MainData, InstanceData>()

	constructor(public readonly plugin: TldrawPlugin) {}

	dispose() {
		this.storesManager.dispose()
	}

	/**
	 *
	 * @param tFile
	 * @param getData Will be called if a store instance does not yet exist for {@linkcode tFile}.
	 * @param onUpdatedData Will be called when the store instance has been registered, and before data is saved to {@linkcode tFile}.
	 * @returns A {@linkcode TLDataDocumentStore} with a new store instance.
	 */
	register(
		tFile: TFile,
		getData: () => string,
		onUpdatedData: (data: string) => void,
		syncToMain: boolean
	): {
		documentStore: TLDataDocumentStore
		messages: MainDataMessages
		assets: MainData['assets']
		getInstanceId(): string
		unregister: () => void
	} & Pick<
		ReturnType<typeof this.storesManager.registerInstance>['instance'],
		'syncToMain' | 'isSynchronizingToMain'
	> {
		const instanceInfo: InstanceInfo = {
			instanceId: window.crypto.randomUUID(),
			syncToMain,
			data: {
				tFile,
				onUpdatedData,
			},
		}

		const storeContext = this.storesManager.registerInstance(instanceInfo, {
			createMain: () => this.createMain(instanceInfo, getData),
			getSharedId: () => tFile.path,
		})

		// Ensure the instance's data is up to date.
		instanceInfo.data.onUpdatedData(storeContext.storeGroup.main.data.fileData)

		return {
			documentStore: {
				meta: storeContext.storeGroup.main.data.documentStore.meta,
				store: storeContext.instance.store,
			},
			messages: storeContext.storeGroup.main.data.messages,
			assets: storeContext.storeGroup.main.data.assets,
			getInstanceId: () => instanceInfo.instanceId,
			unregister: () => {
				storeContext.instance.unregister()
			},
			syncToMain: (sync: boolean) => storeContext.instance.syncToMain(sync),
			isSynchronizingToMain: () => storeContext.instance.isSynchronizingToMain(),
		}
	}

	private createMain(info: InstanceInfo, getData: () => string): MainStore<MainData, InstanceData> {
		const { tFile } = info.data
		const { workspace, vault } = this.plugin.app
		const fileData = getData()

		const format = this.plugin.isTldrawFile(tFile)
			? formats.markdown
			: tFile.path.endsWith(TLDRAW_FILE_EXTENSION)
				? formats.tldr
				: (() => {
						throw new Error()
					})()

		const documentStore = this.processFormatInitialData(format, fileData)
		const debouncedSave = this.createDebouncedSaveStoreListener(documentStore)
		let onExternalModificationsRef: undefined | EventRef
		let onFileRenamedRef: undefined | EventRef
		let onFileDeletedRef: undefined | EventRef
		let onQuickPreviewRef: undefined | EventRef
		let assetStore: undefined | ObsidianTLAssetStore
		let removeAssetChanges: undefined | ReturnType<typeof listenAssetChanges>

		const documentMessages = new TLDataDocumentMessages()

		const disposableListeners = new Set<() => void>()

		return {
			store: documentStore.store,
			data: {
				fileData,
				tFile,
				documentStore,
				format,
				assets: {
					pruneStoreImages: async (...srcs: BlockCache[]) => {
						if (srcs.length === 0 || !assetStore?.proxy) {
							// For now, we only support pruning assets from markdown files.
							return
						}
						// Method:
						// - Get all image shapes in the store
						// - Check if assets referenced by image shapes exists in the store
						// - If exists, remove from the list of ids to remove
						// - Remove remaining ids from the asset store
						const srcsToRemove = new Set(srcs.map((s) => `obsidian.blockref.${s.id}` as const))
						const imageIds = documentStore.store.query
							.records('shape')
							.get()
							.filter((e) => isShapeOfType<TLImageShape>(e, 'image'))
							.map((e) => e.props.assetId)
							.filter((e) => typeof e === 'string')
						for (const image of imageIds) {
							const asset = documentStore.store.get(image)
							if (!asset || !isAssetOfType<TLImageAsset>(asset, 'image')) continue
							if (!asset.props.src)
								continue
								// A shape exists with this asset, delete it from the list of srcs to remove if it exists.
							;(srcsToRemove as Set<string>).delete(asset.props.src)
						}
						if (srcsToRemove.size === 0) return
						// All that remain are assets that are not referenced by any shapes, these are prunable.
						return assetStore.proxy.removeBlockRef(...Array.from(srcsToRemove))
					},
				},
				messages: {
					getCount: () => documentMessages.getErrorCount(),
					getAll: () => [...documentMessages.getBlockRefError()],
					addListener: (listener: () => void) => {
						return documentMessages.addListener(listener)
					},
					dismissAll: () => {
						documentMessages.removeAll()
					},
					getFile: () => tFile,
				},
			},
			init: (storeGroup) => {
				onExternalModificationsRef = vault.on('modify', async (file) => {
					if (!(file instanceof TFile) || file.path !== storeGroup.main.data.tFile.path) return
					const data = await vault.cachedRead(file)
					this.onExternalModification(workspace, storeGroup, data)
				})

				onFileRenamedRef = vault.on('rename', async (file, oldPath) => {
					if (!(file instanceof TFile) || file.path !== storeGroup.main.data.tFile.path) return
					this.storesManager.refreshSharedId(oldPath)
				})

				onFileDeletedRef = vault.on('delete', async (file) => {
					if (!(file instanceof TFile) || file.path !== storeGroup.main.data.tFile.path) return
					storeGroup.unregister()
				})

				onQuickPreviewRef = workspace.on('quick-preview', (file, data) => {
					if (file.path !== storeGroup.main.data.tFile.path) return
					this.onExternalModification(workspace, storeGroup, data)
				})

				if (format !== formats.markdown) {
					// We don't want to proxy storing the assets in the file using the markdown file proxy if it isn't a markdown file.
					return
				}

				const triggers = documentMessages.getTriggers()

				disposableListeners.add(
					triggers.blockRef.asset.notFound.addListener(({ id, shouldNotify }) => {
						if (!shouldNotify) return
						new Notice(`Asset block reference not found: ${id}`)
					})
				)

				disposableListeners.add(
					triggers.blockRef.asset.notALink.addListener(({ shouldNotify, next }) => {
						if (!shouldNotify) return
						new Notice(`Asset block did not reference a link: ${next.item.id}`)
					})
				)

				disposableListeners.add(
					triggers.blockRef.asset.unknownFile.addListener(({ shouldNotify, next }) => {
						if (!shouldNotify) return
						new Notice(`Asset block did not link to a known file: ${next.link}`)
					})
				)

				disposableListeners.add(
					triggers.blockRef.asset.errorLoading.addListener(({ shouldNotify, next }) => {
						if (!shouldNotify) return
						new Notice(`Error loading asset from ${next.link}, see console for more details.`)
						console.error('Error loading asset', { error: next.error })
					})
				)

				const assetStoreProxy = new ObsidianMarkdownFileTLAssetStoreProxy(this.plugin, tFile, {
					contents: {
						addedAsset: (fileContents, _, assetFile) => {
							new Notice(`Added asset: ${assetFile.path}`)
							this.propagateData(workspace, storeGroup, fileContents)
						},
					},
					blockRef: {
						removed: (block, contents, newData) => {
							this.propagateData(workspace, storeGroup, newData)
							new Notice(`Removed ${contents} from ${tFile.path}`)
							triggers.blockRef.asset.deleted.trigger(block.id)
						},
						resolveAsset: {
							loaded: (block) => {
								triggers.blockRef.asset.loaded.trigger(block)
							},
							errorLoading: (block, link, error) => {
								triggers.blockRef.asset.errorLoading.trigger(block, link, error)
							},
							notFound: (ref) => {
								triggers.blockRef.asset.notFound.trigger(ref)
							},
							notALink: (block) => {
								triggers.blockRef.asset.notALink.trigger(block)
							},
							linkToUnknownFile: (block, link) => {
								triggers.blockRef.asset.unknownFile.trigger(block, link)
							},
						},
					},
				})

				assetStore = documentStore.store.props.assets = new ObsidianTLAssetStore(
					documentStore.meta.uuid,
					assetStoreProxy
				)

				removeAssetChanges = listenAssetChanges(documentStore.store)
			},
			dispose: () => {
				for (const disposableListener of disposableListeners) {
					disposableListener()
				}
				removeAssetChanges?.dispose()
				assetStore?.dispose()
				if (onExternalModificationsRef) {
					vault.offref(onExternalModificationsRef)
				}
				if (onFileRenamedRef) {
					vault.offref(onFileRenamedRef)
				}
				if (onFileDeletedRef) {
					vault.offref(onFileDeletedRef)
				}
				if (onQuickPreviewRef) {
					workspace.offref(onQuickPreviewRef)
				}
			},
			storeListener: (entry, context) => debouncedSave(context),
		}
	}

	private createDebouncedSaveStoreListener(documentStore: TLDataDocumentStore) {
		return debounce(
			async (context: StoreListenerContext<MainData, InstanceData>) => {
				const { fileData: currData, tFile, format } = context.storeGroup.main.data
				const data = await this.formatData(currData, documentStore, format)
				if (currData === data) return
				// Do this to prevent the data from being reset by Obsidian.
				this.propagateData(this.plugin.app.workspace, context.storeGroup, data)
				await this.plugin.app.vault.modify(tFile, data)
			},
			safeSecondsToMs(this.plugin.settings.saveFileDelay),
			true
		)
	}

	/**
	 * If the file used for this view was modified externally (not by this view), ensure this {@linkcode TldrawView.data} is synced with the new {@linkcode data}
	 * @param tFile
	 * @param data
	 * @returns
	 */
	private onExternalModification(
		workspace: Workspace,
		storeGroup: StoreGroup<MainData, InstanceData>,
		data: string
	) {
		if (storeGroup.main.data.fileData === data) return
		this.propagateData(workspace, storeGroup, data, true)
	}

	/**
	 * Ensures each {@linkcode TldrawView} has the same data so no old data overwrites any new data.
	 *
	 * ---
	 *
	 * If {@linkcode isExternal} is provided, then we should treat it as if it was modified by hand.
	 *
	 * - #TODO: Ensure the data is properly checked for errors
	 *
	 * ---
	 * @param tFile
	 * @param data
	 * @param store If defined, replace the store with a new instance
	 * @param isExternal default `false`
	 * @returns
	 */
	private propagateData(
		workspace: Workspace,
		storeGroup: StoreGroup<MainData, InstanceData>,
		data: string,
		isExternal: boolean = false
	) {
		if (isExternal) {
			const snapshot = this.processFormatInitialData(
				storeGroup.main.data.format,
				data
			).store.getStoreSnapshot()
			loadSnapshot(storeGroup.main.store, snapshot)
			for (const instance of storeGroup.instances) {
				loadSnapshot(instance.store, snapshot)
			}
		}

		storeGroup.main.data.fileData = data
		for (const instance of storeGroup.instances) {
			instance.source.data.onUpdatedData(data)
		}

		if (!isExternal) {
			workspace.onQuickPreview(storeGroup.main.data.tFile, data)
		}
	}

	private processFormatInitialData(format: Format, data: string) {
		const { plugin } = this

		switch (format) {
			case formats.markdown:
				return processInitialData(parseTLDataDocument(plugin.manifest.version, data))
			case formats.tldr:
				return processInitialData({
					meta: getTLMetaTemplate(plugin.manifest.version),
					...(data.length === 0
						? { raw: undefined }
						: { store: migrateTldrawFileDataIfNecessary(data) }),
				})
		}

		throw new Error("Unable to process format's initial data", {
			cause: { format, data },
		})
	}

	private formatData(currData: string, documentStore: TLDataDocumentStore, format: Format) {
		switch (format) {
			case formats.markdown:
				return updateFileData(this.plugin.manifest, currData, documentStore)
			case formats.tldr:
				return makeFileDataTldr(documentStore)
		}

		throw new Error('Unsupported update format', {
			cause: { format },
		})
	}
}

function isShapeOfType<T extends TLUnknownShape>(
	shape: TLUnknownShape,
	type: T['type']
): shape is T {
	return shape.type === type
}

function isAssetOfType<T extends TLAsset>(asset: TLAsset, type: T['type']): asset is T {
	return asset.type === type
}

function listenAssetChanges(store: TLStore) {
	const assets = store.props.assets
	console.log({ assets })
	if (!(assets instanceof ObsidianTLAssetStore)) return
	const deleteStore = createRecordStore<BlockRefAssetId, TLImageAsset>()
	const removeAfterDelete = store.sideEffects.registerAfterDeleteHandler('shape', (shape) => {
		if (!isShapeOfType<TLImageShape>(shape, 'image')) return

		console.log({ shape })

		const { assetId } = shape.props

		if (!assetId) return

		// Check if the asset belongs to an obsidian blockref
		const asset = store.get(assetId)

		if (!asset || !isAssetOfType<TLImageAsset>(asset, 'image') || !asset.props.src) return

		const id = asset.props.src.split(':').at(1)

		if (!id || !ObsidianMarkdownFileTLAssetStoreProxy.isBlockRefId(id)) return

		deleteStore.add(id, asset)
	})

	const removeDeleteStoreListener = deleteStore.addListener(() => {
		const all = deleteStore.getAll()

		for (const [id, asset] of all) {
			// Check if asset being used by some more shapes
			const someMatching = store.query
				.records('shape')
				.get()
				.some((e) => isShapeOfType<TLImageShape>(e, 'image') && e.props.assetId === asset.id)

			if (someMatching) return

			assets.proxy
				.removeBlockRef(id)
				.then(() => {
					deleteStore.remove(id)
				})
				.catch((error) => {
					console.error('Unable to remove block ref', { error })
				})
		}
	})

	return {
		deleteStore,
		dispose: () => {
			removeAfterDelete()
			removeDeleteStoreListener()
		},
	}
}
