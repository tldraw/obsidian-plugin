import { Editor, TLExportType, TLImageExportOptions, TLUiActionItem, TLUiActionsContextType, TLUiEventContextType, TLUiEventSource, TLUiOverrideHelpers, TLUiOverrides, useUiEvents } from "tldraw";
import { Platform } from "obsidian";
import TldrawPlugin from "src/main";
import { downloadBlob, getSaveFileCopyAction, getSaveFileCopyInVaultAction, importFileAction, OPEN_FILE_ACTION, SAVE_FILE_COPY_ACTION, SAVE_FILE_COPY_IN_VAULT_ACTION } from "src/utils/file";

const DEFAULT_CAMERA_STEPS = [0.1, 0.25, 0.5, 1, 2, 4, 8];

export const PLUGIN_ACTION_TOGGLE_ZOOM_LOCK = 'toggle-zoom-lock';

export function uiOverrides(plugin: TldrawPlugin): TLUiOverrides {
	const trackEvent = useUiEvents();
	return {
		tools(editor, tools, helpers) {
			// console.log(tools);
			// // this is how you would override the kbd shortcuts
			// tools.draw = {
			// 	...tools.draw,
			// 	kbd: "!q",
			// };
			return tools;
		},
		actions: (editor, actions, { msg, addDialog, addToast, paste }) => {
			const defaultDocumentName = msg("document.default-name");
			if (!Platform.isMobile) {
				actions[SAVE_FILE_COPY_ACTION] = getSaveFileCopyAction(
					editor,
					defaultDocumentName
				);
			}

			actions[SAVE_FILE_COPY_IN_VAULT_ACTION] = getSaveFileCopyInVaultAction(
				editor,
				defaultDocumentName,
				plugin
			);

			actions[OPEN_FILE_ACTION] = importFileAction(plugin, addDialog);

			(['jpeg', 'png', 'svg', 'webp'] satisfies TLExportType[]).map((e) => exportAllAsOverride(editor, actions, plugin, {
				exportOptions: {
					format: e,
				},
				defaultDocumentName,
				trackEvent
			}));

			actions['paste'] = pasteFromClipboardOverride(editor, { msg, paste, addToast });

			/**
			 * https://tldraw.dev/examples/editor-api/lock-camera-zoom
			 */
			actions[PLUGIN_ACTION_TOGGLE_ZOOM_LOCK] = {
				id: PLUGIN_ACTION_TOGGLE_ZOOM_LOCK,
				label: {
					default: 'Toggle zoom lock'
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

			// Change PDF DPI action
			actions['change-pdf-dpi'] = {
				id: 'change-pdf-dpi',
				label: { default: 'Change PDF Quality (DPI)' },
				readonlyOk: false,
				onSelect() {
					const selectedShapes = editor.getSelectedShapes();
					if (selectedShapes.length === 0) return;

					// Helper to recursively get all descendant shapes
					function getAllDescendants(shapes: any[]): any[] {
						const result: any[] = [];
						for (const shape of shapes) {
							result.push(shape);
							if (shape.type === 'group') {
								const children = editor.getSortedChildIdsForParent(shape.id)
									.map((id: any) => editor.getShape(id))
									.filter(Boolean);
								result.push(...getAllDescendants(children));
							}
						}
						return result;
					}

					const allShapes = getAllDescendants(selectedShapes);

					// Get all PDF asset IDs from all shapes (including group children)
					const pdfAssetIds = new Set<string>();
					const pdfImageShapes: any[] = [];
					for (const shape of allShapes) {
						if (shape.type === 'image' && (shape.props as any).assetId) {
							const asset = editor.getAsset((shape.props as any).assetId);
							if (asset && (asset.meta as any)?.isPdfAsset) {
								pdfAssetIds.add(asset.id);
								pdfImageShapes.push(shape);
							}
						}
					}

					if (pdfAssetIds.size === 0) {
						return;
					}

					// Prompt for new DPI
					const currentDpi = (() => {
						const firstAssetId = Array.from(pdfAssetIds)[0];
						const asset = editor.getAsset(firstAssetId as any);
						return (asset?.meta as any)?.dpi || 150;
					})();

					// Create a simple input dialog using DOM (Electron doesn't support prompt())
					const container = editor.getContainer();
					// Check Obsidian theme (body.theme-dark), not Tldraw theme
					const isDark = container.ownerDocument.body.classList.contains('theme-dark');

					const overlay = document.createElement('div');
					overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:10000';

					// Theme-aware colors
					const bgColor = isDark ? '#2d2d2d' : '#ffffff';
					const textColor = isDark ? '#fff' : '#1a1a1a';
					const mutedColor = isDark ? '#aaa' : '#666';
					const inputBg = isDark ? '#1a1a1a' : '#f5f5f5';
					const inputBorder = isDark ? '#555' : '#ccc';
					const btnBg = isDark ? '#444' : '#e0e0e0';
					const btnText = isDark ? '#fff' : '#333';

					const dialog = document.createElement('div');
					dialog.style.cssText = `background:${bgColor};color:${textColor};padding:20px;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.5);min-width:300px;font-family:system-ui,-apple-system,sans-serif`;
					dialog.innerHTML = `
						<div style="margin-bottom:12px;font-weight:bold;font-size:16px">Change PDF Quality (DPI)</div>
						<div style="margin-bottom:8px;font-size:13px;color:${mutedColor}">Higher = sharper but slower (72-300)</div>
						<input type="number" min="72" max="300" value="${currentDpi}" style="width:100%;padding:10px;margin-bottom:16px;border:1px solid ${inputBorder};border-radius:4px;background:${inputBg};color:${textColor};font-size:14px;box-sizing:border-box">
						<div style="display:flex;gap:8px;justify-content:flex-end">
							<button class="cancel-btn" style="padding:10px 20px;border-radius:4px;border:none;cursor:pointer;background:${btnBg};color:${btnText};font-size:14px">Cancel</button>
							<button class="ok-btn" style="padding:10px 20px;border-radius:4px;border:none;cursor:pointer;background:#4a9eff;color:#fff;font-size:14px">Apply</button>
						</div>
					`;

					overlay.appendChild(dialog);
					container.ownerDocument.body.appendChild(overlay);

					const input = dialog.querySelector('input') as HTMLInputElement;
					input.focus();
					input.select();

					const cleanup = () => overlay.remove();

					const apply = () => {
						const newDpi = Math.min(300, Math.max(72, parseInt(input.value) || 150));
						cleanup();

						// Update all selected PDF assets
						editor.run(() => {
							for (const assetId of pdfAssetIds) {
								const asset = editor.getAsset(assetId as any);
								if (asset) {
									editor.updateAssets([{
										...asset,
										meta: { ...asset.meta, dpi: newDpi }
									}]);
								}
							}
						});

						// Force re-render by nudging shapes slightly
						editor.run(() => {
							for (const shape of pdfImageShapes) {
								editor.updateShape({ id: shape.id, type: shape.type, x: shape.x + 0.001 });
								editor.updateShape({ id: shape.id, type: shape.type, x: shape.x });
							}
						});
					};

					dialog.querySelector('.cancel-btn')?.addEventListener('click', cleanup);
					dialog.querySelector('.ok-btn')?.addEventListener('click', apply);
					overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(); });
					input.addEventListener('keydown', (e) => {
						if (e.key === 'Enter') apply();
						if (e.key === 'Escape') cleanup();
					});
				},
			}

			return actions;
		},
		contextMenu(editor, schema, helpers) {
			// Helper to recursively get all descendant shapes
			function getAllDescendants(shapes: any[]): any[] {
				const result: any[] = [];
				for (const shape of shapes) {
					result.push(shape);
					if (shape.type === 'group') {
						const children = editor.getSortedChildIdsForParent(shape.id)
							.map((id: any) => editor.getShape(id))
							.filter(Boolean);
						result.push(...getAllDescendants(children));
					}
				}
				return result;
			}

			// Add PDF DPI option if a PDF shape is selected (or inside a selected group)
			const selectedShapes = editor.getSelectedShapes();
			const allShapes = getAllDescendants(selectedShapes);

			console.log('[PDF Menu Debug] Selected shapes:', selectedShapes.length, selectedShapes.map((s: any) => ({ id: s.id, type: s.type })));
			console.log('[PDF Menu Debug] All shapes (including children):', allShapes.length);

			const hasPdfSelected = allShapes.some((shape: any) => {
				if (shape.type !== 'image') return false;
				const assetId = (shape.props as any).assetId;
				const asset = editor.getAsset(assetId);
				console.log('[PDF Menu Debug] Image shape:', shape.id, 'assetId:', assetId, 'asset:', asset, 'meta:', asset?.meta);
				return asset && (asset.meta as any)?.isPdfAsset;
			});

			console.log('[PDF Menu Debug] hasPdfSelected:', hasPdfSelected);

			if (hasPdfSelected) {
				// Add to the beginning of context menu
				schema.unshift({
					id: 'pdf-options',
					type: 'group',
					children: [
						{ id: 'change-pdf-dpi', type: 'item' }
					]
				});
			}

			return schema;
		},
		actionsMenu(editor, schema, helpers) {
			// Helper to recursively get all descendant shapes
			function getAllDescendants(shapes: any[]): any[] {
				const result: any[] = [];
				for (const shape of shapes) {
					result.push(shape);
					if (shape.type === 'group') {
						const children = editor.getSortedChildIdsForParent(shape.id)
							.map((id: any) => editor.getShape(id))
							.filter(Boolean);
						result.push(...getAllDescendants(children));
					}
				}
				return result;
			}

			// Add PDF DPI option if a PDF shape is selected
			const selectedShapes = editor.getSelectedShapes();
			const allShapes = getAllDescendants(selectedShapes);

			const hasPdfSelected = allShapes.some((shape: any) => {
				if (shape.type !== 'image') return false;
				const asset = editor.getAsset((shape.props as any).assetId);
				return asset && (asset.meta as any)?.isPdfAsset;
			});

			if (hasPdfSelected) {
				// Add to menu
				schema.push({
					id: 'pdf-options',
					type: 'group',
					children: [
						{ id: 'change-pdf-dpi', type: 'item' }
					]
				});
			}

			return schema;
		},
	}
}

function exportAllAsOverride(editor: Editor, actions: TLUiActionsContextType, plugin: TldrawPlugin, options: {
	exportOptions?: TLImageExportOptions,
	trackEvent: TLUiEventContextType,
	defaultDocumentName: string
}) {
	const format = options.exportOptions?.format ?? 'png';
	const key = `export-all-as-${format}` as const;
	actions[key] = {
		...actions[key],
		async onSelect(source) {
			const ids = Array.from(editor.getCurrentPageShapeIds().values())
			if (ids.length === 0) return

			options.trackEvent('export-all-as', {
				// @ts-ignore
				format,
				source
			})

			const blob = (await editor.toImage(ids, options.exportOptions)).blob;

			const res = await downloadBlob(blob, `${options.defaultDocumentName}.${format}`, plugin);

			if (typeof res === 'object') {
				res.showResultModal()
			}
		}
	}
}

/**
 * Obsidian doesn't allow manual access to the clipboard API on mobile,
 * so we add a fallback when an error occurs on the initial clipboard read.
 */
function pasteFromClipboardOverride(
	editor: Editor,
	{
		addToast,
		msg,
		paste,
	}: Pick<TLUiOverrideHelpers, 'addToast' | 'msg' | 'paste'>
): TLUiActionItem {
	const pasteClipboard = (source: TLUiEventSource, items: ClipboardItem[]) => paste(
		items,
		source,
		source === 'context-menu' ? editor.inputs.currentPagePoint : undefined
	)
	return {
		id: 'paste',
		label: 'action.paste',
		kbd: '$v',
		onSelect(source) {
			// Adapted from src/lib/ui/context/actions.tsx of the tldraw library
			navigator.clipboard
				?.read()
				.then((clipboardItems) => {
					pasteClipboard(source, clipboardItems);
				})
				.catch((e) => {
					// Fallback to reading the clipboard as plain text.
					navigator.clipboard
						?.readText()
						.then((val) => {
							pasteClipboard(source, [
								new ClipboardItem(
									{
										'text/plain': new Blob([val], { type: 'text/plain' }),
									}
								)
							]);
						}).catch((ee) => {
							console.error({ e, ee });
							addToast({
								title: msg('action.paste-error-title'),
								description: msg('action.paste-error-description'),
								severity: 'error',
							})
						})
				})
		},
	};
}