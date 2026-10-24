import { browser } from '@wdio/globals'

import { DEFAULT_LINKABLE_GEO_SHAPE, type TldrawEditorRef } from './types'

async function pauseAfterEditorOp(ms = 200): Promise<void> {
	await browser.pause(ms)
}

/** createShapes does not always leave a selection; pick the latest geo shape explicitly. */
export async function ensureLinkableShapeSelected(): Promise<void> {
	await browser.executeObsidian(({ app }, geoShape: typeof DEFAULT_LINKABLE_GEO_SHAPE) => {
		const editor = (app.plugins.plugins.tldraw as { currTldrawEditor?: TldrawEditorRef })
			?.currTldrawEditor
		if (!editor) throw new Error('tldraw editor not mounted')

		const latestGeoId = () =>
			editor.getCurrentPageShapes().filter((s) => s.type === 'geo').at(-1)?.id

		let id: string | undefined = editor.getSelectedShapeIds()[0] ?? latestGeoId()
		if (!id) {
			editor.run(() => editor.createShapes([geoShape]))
			id = latestGeoId()
		}
		if (!id) throw new Error('no geo shape available for Edit link')
		editor.select(id)
		editor.setCurrentTool('select')
	}, DEFAULT_LINKABLE_GEO_SHAPE)
	await pauseAfterEditorOp()
}

export async function ensureTldrawSelectTool(): Promise<void> {
	await browser.executeObsidian(({ app }) => {
		const editor = (app.plugins.plugins.tldraw as { currTldrawEditor?: TldrawEditorRef })
			?.currTldrawEditor
		if (!editor) throw new Error('tldraw editor not mounted')
		editor.setCurrentTool('select')
	})
	await pauseAfterEditorOp()
}
