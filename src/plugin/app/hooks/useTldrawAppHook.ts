import * as React from 'react'
import TldrawPlugin from 'src/plugin/TldrawPlugin'
import { TldrawPluginMetaData } from 'src/plugin/document/document'
import { Editor, TldrawFile } from 'tldraw'
import useUserPluginSettings from './useUserPluginSettings'

export type SetTldrawFileData = (data: {
	meta: TldrawPluginMetaData
	tldrawFile: TldrawFile
}) => void

export function useTldrawAppEffects({
	editor,
	initialTool,
	isReadonly,
	settingsManager,
	selectNone,
	onEditorMount,
	setFocusedEditor,
}: {
	editor?: Editor
	initialTool?: string
	isReadonly: boolean
	settingsManager: TldrawPlugin['settingsManager']
	selectNone: boolean
	setFocusedEditor: (editor: Editor) => void
	onEditorMount?: (editor: Editor) => void
}) {
	const settings = useUserPluginSettings(settingsManager)

	/**
	 * Applies the initial editor state. It is an effect event so that it reads the latest props
	 * without re-running (and resetting the tool and instance state) when one of them changes.
	 */
	const mountEditor = React.useEffectEvent((editor: Editor) => {
		if (selectNone) {
			editor.selectNone()
		}

		const { gridMode, debugMode, snapMode, focusMode, toolSelected } = settingsManager.settings

		editor.setCurrentTool(initialTool ?? toolSelected)

		editor.user.updateUserPreferences({
			isSnapMode: snapMode,
		})

		editor.updateInstanceState({
			isReadonly: isReadonly,
			isGridMode: gridMode,
			isDebugMode: debugMode,
			isFocusMode: focusMode,
		})

		setFocusedEditor(editor)
		onEditorMount?.(editor)
		// NOTE: These could probably be utilized for storing assets as files in the vault instead of tldraw's default indexedDB.
		// editor.registerExternalAssetHandler
		// editor.registerExternalContentHandler
	})

	/**
	 * Effect for editor mounting
	 */
	React.useEffect(() => {
		if (!editor) return
		mountEditor(editor)
	}, [editor, settingsManager])

	/**
	 * Effect for user settings change
	 */
	React.useEffect(() => {
		if (!editor) return
		const laserDelayMs = settings.tldrawOptions?.laserDelayMs
		if (laserDelayMs && !Number.isNaN(laserDelayMs)) {
			// @ts-ignore
			// Even this is typed as readonly, we can still modify this property.
			// NOTE: We do not want to re-render the editor, so we do not pass it to the TldrawApp component.
			editor.options.laserDelayMs = laserDelayMs
		}

		if (settings.cameraOptions) {
			editor.setCameraOptions(settings.cameraOptions)
		}

		editor.user.updateUserPreferences({
			isPasteAtCursorMode: settings.clipboard?.pasteAtCursor,
		})
	}, [editor, settings])
}
