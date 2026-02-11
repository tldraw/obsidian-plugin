import { logFn, TLDRAW_STORES_MANAGER_LOGGING } from 'src/utils/logging'
import { createTLStore, HistoryEntry, TLRecord, TLStore } from 'tldraw'

export type StoreInstanceInfo<T> = {
	instanceId: string
	syncToMain: boolean
	data: T
}

type StoreInstance<T = unknown> = {
	store: TLStore
	source: StoreInstanceInfo<T>
	unregister: () => void
	/**
	 * Controls if this instance should synchronize its modifications to the main store.
	 * @param sync If true, then sync to main. If false, then do not sync to main.
	 * @returns
	 */
	syncToMain: (sync: boolean) => void
	/**
	 *
	 * @returns `true` if this instance is synchronizing its changes to the main store.
	 */
	isSynchronizingToMain: () => boolean
}

export type StoreGroup<MainData = unknown, InstanceData = unknown> = {
	/**
	 * Contains the "main" store, which should be responsible for persisting data.
	 */
	main: MainStore<MainData, InstanceData>
	/**
	 * Theses are instances derived from {@linkcode StoreGroup.main}
	 */
	instances: StoreInstance<InstanceData>[]
	/**
	 *
	 * @param source The source view
	 * @param entry The entry that should be synced to the "main" store.
	 * @returns
	 */
	apply: (instanceId: string, entry: HistoryEntry<TLRecord>) => void
	getSharedId: () => string
	unregister: () => void
}

export type StoreListenerContext<MainData, InstanceData> = {
	storeGroup: StoreGroup<MainData, InstanceData>
	removeListener: () => void
}

export type MainStore<MainData, InstanceData> = {
	store: TLStore
	data: MainData
	/**
	 * This will be called when all instances are removed.
	 * @returns
	 */
	dispose: () => void
	init: (storeGroup: StoreGroup<MainData, InstanceData>) => void
	storeListener: (
		entry: HistoryEntry<TLRecord>,
		context: StoreListenerContext<MainData, InstanceData>
	) => void
}

export type StoreContext<MainData, InstanceData> = {
	storeGroup: StoreGroup<MainData, InstanceData>
	instance: StoreInstance<InstanceData>
}

export default class TldrawStoresManager<MainData, InstanceData> {
	private storeGroupMap = new Map<string, StoreGroup<MainData, InstanceData>>()

	dispose() {
		this.storeGroupMap.forEach((e) => e.unregister())
	}

	/**
	 *
	 * @param info
	 * @returns An object containing a new {@linkcode TLStore} instance.
	 */
	registerInstance(
		info: StoreInstanceInfo<InstanceData>,
		{
			createMain,
			getSharedId,
		}: {
			createMain: () => MainStore<MainData, InstanceData>
			getSharedId: () => string
		}
	): StoreContext<MainData, InstanceData> {
		const initialSharedId = getSharedId()
		let storeGroup = this.storeGroupMap.get(initialSharedId)
		if (!storeGroup) {
			const main = createMain()
			const _storeGroup: StoreGroup<MainData, InstanceData> = {
				main,
				instances: [],
				getSharedId,
				apply: (instanceId, entry) => {
					// TODO: Find a way to debounce the synchronziation of entry to the other stores.
					syncToStore(main.store, entry)
					for (const _instance of _storeGroup.instances) {
						if (_instance.source.instanceId == instanceId) continue
						// We want to sync this entry as a remote change so that it doesn't trigger the store listener of this instance.
						_instance.store.mergeRemoteChanges(() => {
							syncToStore(_instance.store, entry)
						})
					}
				},
				unregister: () => {
					const instances = [..._storeGroup.instances]
					for (const instance of instances) {
						instance.unregister()
					}
				},
			}
			this.storeGroupMap.set(initialSharedId, (storeGroup = _storeGroup))
			main.init(_storeGroup)
			this.listenDocumentStore(_storeGroup)
		}

		const sourceStore = createSourceStore(storeGroup)
		let _unregisterSyncToMain: undefined | (() => void)
		const instance: StoreInstance<InstanceData> = {
			source: info,
			store: sourceStore,
			unregister: () => {
				storeGroup.instances.remove(instance)
				instance.syncToMain(false)
				instance.store.dispose()
				if (storeGroup.instances.length === 0) {
					// NOTE: We call .getSharedId() here in case the sharedId was changed.
					this.storeGroupMap.delete(storeGroup.getSharedId())
					storeGroup.main.store.dispose()
					storeGroup.main.dispose()
				}
			},
			syncToMain: (sync) => {
				if (sync) {
					_unregisterSyncToMain ??= (function registerSyncToMain() {
						TLDRAW_STORES_MANAGER_LOGGING &&
							logFn(
								registerSyncToMain,
								'Registering store instance synchronization to the main store:',
								info.instanceId,
								'->',
								storeGroup.getSharedId()
							)
						const unregister = sourceStore.listen(
							(entry) => storeGroup.apply(info.instanceId, entry),
							{
								scope: 'document',
								// Only listen to changes made by the user
								source: 'user',
							}
						)
						return function unregisterSyncToMain() {
							TLDRAW_STORES_MANAGER_LOGGING &&
								logFn(
									unregisterSyncToMain,
									'Unregistering store instance synchronization to the main store.',
									info.instanceId,
									'->',
									storeGroup.getSharedId()
								)
							unregister()
						}
					})()
				} else {
					_unregisterSyncToMain?.()
					_unregisterSyncToMain = undefined
				}
			},
			isSynchronizingToMain: () => _unregisterSyncToMain !== undefined,
		}
		instance.syncToMain(info.syncToMain)

		storeGroup.instances.push(instance)
		return { instance, storeGroup }
	}

	/**
	 * Should call this when the shared id is modified.
	 *
	 * @param oldSharedId The shared id when {@linkcode registerInstance} was first called.
	 */
	refreshSharedId(oldSharedId: string) {
		const storeGroup = this.storeGroupMap.get(oldSharedId)
		if (!storeGroup) return
		const newSharedId = storeGroup.getSharedId()
		if (oldSharedId === newSharedId) return
		this.storeGroupMap.delete(oldSharedId)
		this.storeGroupMap.set(newSharedId, storeGroup)
	}

	private listenDocumentStore(storeGroup: StoreGroup<MainData, InstanceData>) {
		const removeListener = storeGroup.main.store.listen(
			(entry) =>
				storeGroup.main.storeListener(entry, {
					storeGroup,
					removeListener,
				}),
			{ scope: 'document' }
		)
	}
}

/**
 * Create a new store that optionally synchronizes modifications to the "main" store.
 * @param source
 * @param storeGroup Contains the store to synchronize to
 */
function createSourceStore<Group extends StoreGroup>(storeGroup: Group): TLStore {
	const snapshot = storeGroup.main.store.getStoreSnapshot()
	const store = createTLStore({
		snapshot: snapshot,
	})

	// NOTE: We want to preserve the assets object that is attached to props, otherwise the context will be lost if provided as a param in createTLStore
	store.props.assets = storeGroup.main.store.props.assets

	return store
}

function syncToStore(target: TLStore, entry: HistoryEntry<TLRecord>) {
	// logFn(syncToStore, 'Entry type -', entry.source);
	target.applyDiff(entry.changes)
}
