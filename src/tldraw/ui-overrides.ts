import { Platform } from 'obsidian'
import TldrawPlugin from 'src/main'
import {
	downloadBlob,
	getSaveFileCopyAction,
	getSaveFileCopyInVaultAction,
	importFileAction,
	OPEN_FILE_ACTION,
	SAVE_FILE_COPY_ACTION,
	SAVE_FILE_COPY_IN_VAULT_ACTION,
} from 'src/utils/file'
import {
	Editor,
	TLExportType,
	TLImageExportOptions,
	TLUiActionItem,
	TLUiActionsContextType,
	TLUiEventContextType,
	TLUiEventSource,
	TLUiOverrideHelpers,
	TLUiOverrides,
	useUiEvents,
} from 'tldraw'

const DEFAULT_CAMERA_STEPS = [0.1, 0.25, 0.5, 1, 2, 4, 8]

export const PLUGIN_ACTION_TOGGLE_ZOOM_LOCK = 'toggle-zoom-lock'

export function uiOverrides(plugin: TldrawPlugin): TLUiOverrides {
	const trackEvent = useUiEvents()
	return {
		tools(editor, tools, helpers) {
			// console.log(tools);
			// // this is how you would override the kbd shortcuts
			// tools.draw = {
			// 	...tools.draw,
			// 	kbd: "!q",
			// };
			return tools
		},
		actions: (editor, actions, { msg, addDialog, addToast, paste }) => {
			const defaultDocumentName = msg('document.default-name')
			if (!Platform.isMobile) {
				actions[SAVE_FILE_COPY_ACTION] = getSaveFileCopyAction(editor, defaultDocumentName)
			}

			actions[SAVE_FILE_COPY_IN_VAULT_ACTION] = getSaveFileCopyInVaultAction(
				editor,
				defaultDocumentName,
				plugin
			)

			actions[OPEN_FILE_ACTION] = importFileAction(plugin, addDialog)

			;(['jpeg', 'png', 'svg', 'webp'] satisfies TLExportType[]).map((e) =>
				exportAllAsOverride(editor, actions, plugin, {
					exportOptions: {
						format: e,
					},
					defaultDocumentName,
					trackEvent,
				})
			)

			actions['paste'] = pasteFromClipboardOverride(editor, { msg, paste, addToast })

			/**
			 * https://tldraw.dev/examples/editor-api/lock-camera-zoom
			 */
			actions[PLUGIN_ACTION_TOGGLE_ZOOM_LOCK] = {
				id: PLUGIN_ACTION_TOGGLE_ZOOM_LOCK,
				label: {
					default: 'Toggle zoom lock',
				},
				icon: PLUGIN_ACTION_TOGGLE_ZOOM_LOCK,
				kbd: '!k',
				readonlyOk: true,
				onSelect() {
					const isCameraZoomLockedAlready = editor.getCameraOptions().zoomSteps.length === 1
					editor.setCameraOptions({
						zoomSteps: isCameraZoomLockedAlready ? DEFAULT_CAMERA_STEPS : [editor.getZoomLevel()],
					})
				},
			}

			return actions
		},
		// toolbar(editor, toolbar, { tools }) {
		// 	// console.log(toolbar);
		// 	// toolbar.splice(4, 0, toolbarItem(tools.card))
		// 	return toolbar;
		// },
		// keyboardShortcutsMenu(editor, keyboardShortcutsMenu, { tools }) {
		// 	// console.log(keyboardShortcutsMenu);
		// 	// const toolsGroup = keyboardShortcutsMenu.find(
		// 	// 	(group) => group.id === 'shortcuts-dialog.tools'
		// 	// ) as TLUiMenuGroup
		// 	// toolsGroup.children.push(menuItem(tools.card))
		// 	return keyboardShortcutsMenu;
		// },
		// contextMenu(editor, schema, helpers) {
		// 	// console.log({ schema });
		// 	// console.log(JSON.stringify(schema[0]));
		// 	return schema;
		// },
	}
}

function exportAllAsOverride(
	editor: Editor,
	actions: TLUiActionsContextType,
	plugin: TldrawPlugin,
	options: {
		exportOptions?: TLImageExportOptions
		trackEvent: TLUiEventContextType
		defaultDocumentName: string
	}
) {
	const format = options.exportOptions?.format ?? 'png'
	const key = `export-all-as-${format}` as const
	actions[key] = {
		...actions[key],
		async onSelect(source) {
			const ids = Array.from(editor.getCurrentPageShapeIds().values())
			if (ids.length === 0) return

			options.trackEvent('export-all-as', {
				// @ts-ignore
				format,
				source,
			})

			const blob = (await editor.toImage(ids, options.exportOptions)).blob

			const res = await downloadBlob(blob, `${options.defaultDocumentName}.${format}`, plugin)

			if (typeof res === 'object') {
				res.showResultModal()
			}
		},
	}
}

/**
 * Obsidian doesn't allow manual access to the clipboard API on mobile,
 * so we add a fallback when an error occurs on the initial clipboard read.
 */
function pasteFromClipboardOverride(
	editor: Editor,
	{ addToast, msg, paste }: Pick<TLUiOverrideHelpers, 'addToast' | 'msg' | 'paste'>
): TLUiActionItem {
	const pasteClipboard = (source: TLUiEventSource, items: ClipboardItem[]) =>
		paste(items, source, source === 'context-menu' ? editor.inputs.currentPagePoint : undefined)
	return {
		id: 'paste',
		label: 'action.paste',
		kbd: '$v',
		onSelect(source) {
			// Adapted from src/lib/ui/context/actions.tsx of the tldraw library
			navigator.clipboard
				?.read()
				.then((clipboardItems) => {
					pasteClipboard(source, clipboardItems)
				})
				.catch((e) => {
					// Fallback to reading the clipboard as plain text.
					navigator.clipboard
						?.readText()
						.then((val) => {
							pasteClipboard(source, [
								new ClipboardItem({
									'text/plain': new Blob([val], { type: 'text/plain' }),
								}),
							])
						})
						.catch((ee) => {
							console.error({ e, ee })
							addToast({
								title: msg('action.paste-error-title'),
								description: msg('action.paste-error-description'),
								severity: 'error',
							})
						})
				})
		},
	}
}
