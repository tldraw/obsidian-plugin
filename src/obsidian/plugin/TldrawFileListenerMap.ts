import { TFile } from 'obsidian'
import TldrawPlugin from 'src/main'

export type TldrawFileListener = {
	/**
	 * Set this to true to pause the listener, or set it to false to resume.
	 */
	isPaused: boolean
	/**
	 * If {@linkcode TldrawFileListener.isPaused} is true, this will not call the underlying callback.
	 */
	call: () => void
	remove: () => void
}

export class TldrawFileListenerMap {
	private plugin: TldrawPlugin
	private map = new Map<string, TldrawFileListener[]>()

	constructor(plugin: TldrawPlugin) {
		this.plugin = plugin
	}

	addListener(
		tFile: TFile,
		callback: () => void,
		{
			immediatelyPause = false,
		}: {
			/**
			 * Whether to immediately set the listener to a paused state so that {@linkcode callback} doesn't trigger.
			 */
			immediatelyPause?: boolean
		} = {}
	): TldrawFileListener {
		if (!this.plugin.isTldrawFile(tFile)) {
			throw new Error(`${tFile.path} is not a valid tldraw markdown file.`)
		}

		const { path } = tFile

		let listeners = this.map.get(path)
		if (listeners === undefined) {
			this.map.set(path, (listeners = []))
		}

		const listener = {
			isPaused: immediatelyPause,
			call() {
				if (this.isPaused) return
				callback()
			},
			remove: () => {
				listeners.remove(listener)
				if (listeners.length === 0) {
					this.map.delete(path)
					// console.log('No longer listening to changes on tldraw document:', path);
				}
			},
		}

		listeners.push(listener)

		return listener
	}

	getListeners(tFile: TFile) {
		const listeners = this.map.get(tFile.path)
		if (listeners === undefined) return
		return [...listeners]
	}
}
