import { describe, expect, it, vi } from 'vitest'
import type { Editor, TLUiActionsContextType } from 'tldraw'
import type TldrawPlugin from 'src/plugin/TldrawPlugin'
import { downloadBlob } from 'src/plugin/actions/file'
import { uiOverrides } from 'src/plugin/actions/ui-overrides'

vi.mock('src/plugin/actions/file', () => ({
	downloadBlob: vi.fn(async () => undefined),
	getSaveFileCopyAction: vi.fn(() => ({ id: 'save-file-copy' })),
	getSaveFileCopyInVaultAction: vi.fn(() => ({ id: 'save-file-copy-in-vault' })),
	importFileAction: vi.fn(() => ({ id: 'open-file' })),
	OPEN_FILE_ACTION: 'open-file',
	SAVE_FILE_COPY_ACTION: 'save-file-copy',
	SAVE_FILE_COPY_IN_VAULT_ACTION: 'save-file-copy-in-vault',
}))

function buildActions(trackEvent: ReturnType<typeof vi.fn>, shapeIds: string[]) {
	const blob = new Blob(['x'], { type: 'image/png' })
	const editor = {
		getCurrentPageShapeIds: () => new Set(shapeIds),
		toImage: vi.fn(async () => ({ blob })),
	} as unknown as Editor
	const plugin = {} as TldrawPlugin
	const overrides = uiOverrides(plugin, trackEvent as never)
	const actions = overrides.actions!(editor, {} as TLUiActionsContextType, {
		msg: () => 'Untitled',
		addToast: vi.fn(),
		paste: vi.fn(),
	} as never)
	return { actions, editor, blob, plugin }
}

describe('uiOverrides export-all-as actions', () => {
	it('reports the export to the provided event handler and downloads the image', async () => {
		const trackEvent = vi.fn()
		const { actions, blob, plugin } = buildActions(trackEvent, ['shape:a'])

		await actions['export-all-as-png'].onSelect('menu')

		expect(trackEvent).toHaveBeenCalledWith('export-all-as', { format: 'png', source: 'menu' })
		expect(downloadBlob).toHaveBeenCalledWith(blob, 'Untitled.png', plugin)
	})

	it('does nothing when the page has no shapes', async () => {
		const trackEvent = vi.fn()
		const { actions } = buildActions(trackEvent, [])

		await actions['export-all-as-svg'].onSelect('menu')

		expect(trackEvent).not.toHaveBeenCalled()
	})
})
