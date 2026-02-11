import { Component } from 'obsidian'
import { ComponentProps, createElement, ReactNode } from 'react'
import { createRoot, Root } from 'react-dom/client'
import TldrawApp from 'src/components/TldrawApp'
import {
	SnapshotPreviewSyncStore,
	TldrawImageSnapshotView,
} from 'src/components/TldrawImageSnapshotView'
import { TldrawInObsidianPluginProvider } from 'src/contexts/plugin'
import { logClass } from 'src/utils/logging'

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
		TLDRAW_COMPONENT_LOGGING && logClass(TldrawViewComponent, this.onload, this)
		this.#setRoot(createRoot(this.containerEl))
	}

	onunload(): void {
		TLDRAW_COMPONENT_LOGGING && logClass(TldrawViewComponent, this.onunload, this)
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
				children: createElement(TldrawApp, options),
				plugin: options.plugin,
			})
		)
		this.#setReadyAttribute()
	}
}
