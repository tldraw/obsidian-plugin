import { BlockCache } from 'obsidian'
import { useSyncExternalStore } from 'react'
import { TldrawDocument } from 'src/obsidian/plugin/document'
import TldrawInObsdianPluginInstance from 'src/obsidian/plugin/instance'

export function useDocumentAudit(pluginInstance: TldrawInObsdianPluginInstance) {
	const manager = pluginInstance.auditSessionManager

	const state = useSyncExternalStore(manager.store.addListener, manager.store.getState)

	return {
		...state,
		handleNext: () => manager.stepForward(),
		handleBack: () => manager.stepBackward(),
		handleRefresh: () => manager.refreshCurrent(),
		handleAuditAll: () => manager.auditAll(),
		handleStop: () => manager.stop(),
		handleSetIndex: (index: number) => manager.setIndex(index),
		handlePrune: async (doc: TldrawDocument, blocks: BlockCache[]) => {
			const instance = await doc.getInstance()
			await instance.pruneStoreImages(...blocks)
			await doc.onceMetadataChanged()
			manager.refreshCurrent()
		},
	}
}
