import { Component } from 'obsidian'
import { ComponentProps, createElement, ReactNode } from 'react'
import { createRoot, Root } from 'react-dom/client'
import TldrawApp from 'src/plugin/app/TldrawApp'
import {
	SnapshotPreviewSyncStore,
	TldrawImageSnapshotView,
} from 'src/plugin/app/components/TldrawImageSnapshotView'
import { TldrawInObsidianPluginProvider } from 'src/plugin/app/contexts/plugin'

/**
 * A {@linkcode Component} that contains tldraw view content.
 */
export default class TldrawViewComponent extends Component {
	static readonly readyAttribute = 'data-view-ready'
	#root?: Root

	constructor(private readonly containerEl: HTMLElement) {
		super()
		this.containerEl.setAttribute(TldrawViewComponent.readyAttribute, 'false')
	}

	#setRoot(root?: Root) {
		this.#root?.unmount()
		this.#root = root
	}

	onload(): void {
		this.#setRoot(createRoot(this.containerEl))
	}

	onunload(): void {
		this.#setRoot(undefined)
		this.containerEl.removeAttribute(TldrawViewComponent.readyAttribute)
	}

	#renderRoot(cb: () => ReactNode) {
		if (this.#root === undefined) {
			throw new Error('Root is not set. Call onload() first.')
		}
		this.#root.render(cb())
	}

	#setReadyAttribute() {
		this.containerEl.setAttribute(TldrawViewComponent.readyAttribute, 'true')
	}

	renderImage(snapshotPreviewStore: SnapshotPreviewSyncStore) {
		this.#renderRoot(() =>
			createElement(TldrawImageSnapshotView, {
				previewStore: snapshotPreviewStore,
			})
		)
		this.#setReadyAttribute()
	}

	renderInteractive(options: ComponentProps<typeof TldrawApp>) {
		this.#renderRoot(() =>
			createElement(TldrawInObsidianPluginProvider, {
				plugin: options.plugin,
			}, createElement(TldrawApp, options))
		)
		this.#setReadyAttribute()
	}
}
