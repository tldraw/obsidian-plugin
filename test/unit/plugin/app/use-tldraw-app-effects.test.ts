import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Editor } from 'tldraw'
import { useTldrawAppEffects } from 'src/plugin/app/hooks/useTldrawAppHook'
import { DEFAULT_SETTINGS } from 'src/plugin/settings/settings-types'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function createFakeEditor() {
	return {
		selectNone: vi.fn(),
		setCurrentTool: vi.fn(),
		setCameraOptions: vi.fn(),
		updateInstanceState: vi.fn(),
		user: { updateUserPreferences: vi.fn() },
		options: {},
	}
}

function createFakeSettingsManager() {
	const settings = structuredClone(DEFAULT_SETTINGS)
	return {
		settings,
		store: { subscribe: () => () => {}, get: () => settings },
	}
}

type Props = Parameters<typeof useTldrawAppEffects>[0]

function Harness(props: Props) {
	useTldrawAppEffects(props)
	return null
}

const roots: ReturnType<typeof createRoot>[] = []

async function render(props: Props) {
	const root = createRoot(document.createElement('div'))
	roots.push(root)
	await act(async () => root.render(createElement(Harness, props)))
	return (next: Props) => act(async () => root.render(createElement(Harness, next)))
}

afterEach(async () => {
	await act(async () => roots.splice(0).forEach((r) => r.unmount()))
})

describe('useTldrawAppEffects', () => {
	it('applies the initial editor state once the editor is available', async () => {
		const editor = createFakeEditor()
		const onEditorMount = vi.fn()
		const setFocusedEditor = vi.fn()

		await render({
			editor: editor as unknown as Editor,
			initialTool: 'hand',
			isReadonly: true,
			selectNone: true,
			settingsManager: createFakeSettingsManager() as never,
			onEditorMount,
			setFocusedEditor,
		})

		expect(editor.selectNone).toHaveBeenCalledTimes(1)
		expect(editor.setCurrentTool).toHaveBeenCalledWith('hand')
		expect(editor.updateInstanceState).toHaveBeenCalledWith(
			expect.objectContaining({ isReadonly: true })
		)
		expect(setFocusedEditor).toHaveBeenCalledWith(editor)
		expect(onEditorMount).toHaveBeenCalledWith(editor)
	})

	it('does not re-apply the initial state when callbacks or props change identity', async () => {
		const editor = createFakeEditor()
		const settingsManager = createFakeSettingsManager() as never
		const props = (onEditorMount: Props['onEditorMount']): Props => ({
			editor: editor as unknown as Editor,
			isReadonly: false,
			selectNone: true,
			settingsManager,
			onEditorMount,
			setFocusedEditor: vi.fn(),
		})
		const first = vi.fn()
		const rerender = await render(props(first))
		const second = vi.fn()

		await rerender(props(second))

		expect(editor.selectNone).toHaveBeenCalledTimes(1)
		expect(editor.setCurrentTool).toHaveBeenCalledTimes(1)
		expect(first).toHaveBeenCalledTimes(1)
		expect(second).not.toHaveBeenCalled()
	})

	it('applies the initial state again, with the latest props, for a new editor', async () => {
		const editor = createFakeEditor()
		const nextEditor = createFakeEditor()
		const settingsManager = createFakeSettingsManager() as never
		const onEditorMount = vi.fn()
		const rerender = await render({
			editor: editor as unknown as Editor,
			isReadonly: false,
			selectNone: false,
			settingsManager,
			onEditorMount,
			setFocusedEditor: vi.fn(),
		})

		await rerender({
			editor: nextEditor as unknown as Editor,
			initialTool: 'draw',
			isReadonly: false,
			selectNone: false,
			settingsManager,
			onEditorMount,
			setFocusedEditor: vi.fn(),
		})

		expect(nextEditor.setCurrentTool).toHaveBeenCalledWith('draw')
		expect(onEditorMount).toHaveBeenLastCalledWith(nextEditor)
		expect(onEditorMount).toHaveBeenCalledTimes(2)
	})
})
