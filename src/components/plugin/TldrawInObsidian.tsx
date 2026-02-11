import React from 'react'
import { createRoot } from 'react-dom/client'
import { TldrawInObsidianPluginProvider } from 'src/contexts/plugin'
import TldrawPlugin from 'src/main'
import AuditSessionRunner from './AuditSessionRunner'
import DocumentMessages from './DocumentMessages'

export default function createMain(plugin: TldrawPlugin, el: HTMLElement) {
	const mainDiv = el.createDiv(undefined, (el) => {
		el.id = 'ptl-app-root'
		el.append(el.doc.createComment('tldraw in Obsidian'))
	})
	const main = createRoot(mainDiv.createDiv(undefined))

	main.render(<TldrawInObsidian plugin={plugin} />)

	return () => {
		mainDiv.remove()
		main.unmount()
	}
}

/**
 * Manages the lifecycle of each independent UI components created by the plugin through the use of React Portals.
 *
 * @returns
 */
function TldrawInObsidian({ plugin }: { plugin: TldrawPlugin }) {
	return (
		<TldrawInObsidianPluginProvider plugin={plugin}>
			<DocumentMessages />
			<AuditSessionRunner />
		</TldrawInObsidianPluginProvider>
	)
}
