import * as React from "react";
import { createRoot } from "react-dom/client";
import {
	DefaultContextMenu,
	DefaultContextMenuContent,
	DefaultMainMenu,
	DefaultMainMenuContent,
	Editor,
	TLComponents,
	Tldraw,
	TldrawEditorStoreProps,
	TldrawUiMenuGroup,
	TldrawUiMenuItem,
	TldrawUiMenuSubmenu,
	TLStateNodeConstructor,
	TLStoreSnapshot,
	TLUiAssetUrlOverrides,
	TLUiEventHandler,
	TLUiOverrides,
	useActions,
	useEditor,
} from "tldraw";
import { OPEN_FILE_ACTION, SAVE_FILE_COPY_ACTION, SAVE_FILE_COPY_IN_VAULT_ACTION } from "src/utils/file";
import { PLUGIN_ACTION_TOGGLE_ZOOM_LOCK, uiOverrides } from "src/tldraw/ui-overrides";
import TldrawPlugin from "src/main";
import { Platform, FuzzySuggestModal, Notice, TFile } from "obsidian";
import { useTldrawAppEffects } from "src/hooks/useTldrawAppHook";
import { useClickAwayListener } from "src/hooks/useClickAwayListener";
import { TLDataDocumentStore } from "src/utils/document";
import PluginKeyboardShortcutsDialog from "./PluginKeyboardShortcutsDialog";
import PluginQuickActions from "./PluginQuickActions";
import { lockZoomIcon } from "src/assets/data-icons";
import { isObsidianThemeDark } from "src/utils/utils";
import { TldrawInObsidianPluginProvider } from "src/contexts/plugin";
import { PTLEditorBlockBlur } from "src/utils/dom-attributes";
import { usePdfDynamicRendering } from "./pdf/usePdfDynamicRendering";
import { upgradeLegacyPdfShapes } from "src/utils/migration";

type TldrawAppOptions = {
	iconAssetUrls?: TLUiAssetUrlOverrides['icons'],
	isReadonly?: boolean,
	autoFocus?: boolean,
	focusOnMount?: boolean,
	/**
	 * Takes precedence over the user's plugin preference
	 */
	initialTool?: string,
	hideUi?: boolean,
	/**
	 * Whether to call `.selectNone` on the Tldraw editor instance when it is mounted.
	 */
	selectNone?: boolean,
	tools?: readonly TLStateNodeConstructor[],
	uiOverrides?: TLUiOverrides,
	components?: TLComponents,
	onEditorMount?: (editor: Editor) => void,
	/**
	 * 
	 * @param snapshot The snapshot that is initially loaded into the editor.
	 * @returns 
	 */
	onInitialSnapshot?: (snapshot: TLStoreSnapshot) => void,
	/**
	 * 
	 * @param event 
	 * @returns `true` if the editor should be blurred.
	 */
	onClickAwayBlur?: (event: PointerEvent) => boolean,
	onUiEvent?: (editor: Editor | undefined, ...rest: Parameters<TLUiEventHandler>) => void,
};

/**
 * Whether to use native tldraw store props or the plugin based store props.
 */
export type TldrawAppStoreProps = {
	plugin?: undefined,
	/**
	 * Use the native tldraw store props.
	 */
	tldraw: TldrawEditorStoreProps,
} | {
	/**
	 * Use the plugin based store props.
	 */
	plugin: TLDataDocumentStore,
	tldraw?: undefined,
};

export type TldrawAppProps = {
	plugin: TldrawPlugin;
	/**
	 * If this value is undefined, then the tldraw document will not be persisted.
	 */
	store?: TldrawAppStoreProps,
	options: TldrawAppOptions;
	targetDocument: Document;
};

// https://github.com/tldraw/tldraw/blob/58890dcfce698802f745253ca42584731d126cc3/apps/examples/src/examples/custom-main-menu/CustomMainMenuExample.tsx
const components = (plugin: TldrawPlugin): TLComponents => ({
	MainMenu: () => (
		<DefaultMainMenu>
			<LocalFileMenu plugin={plugin} />
			<DefaultMainMenuContent />
		</DefaultMainMenu>
	),
	KeyboardShortcutsDialog: PluginKeyboardShortcutsDialog,
	QuickActions: PluginQuickActions,
	ContextMenu: (props) => <CustomContextMenu {...props} />,
});

// Custom context menu with PDF DPI option
function CustomContextMenu(props: any) {
	const editor = useEditor();
	const actions = useActions();

	// Helper to recursively get all descendant shapes
	function getAllDescendants(shapes: any[]): any[] {
		const result: any[] = [];
		for (const shape of shapes) {
			result.push(shape);
			if (shape.type === 'group') {
				const children = editor.getSortedChildIdsForParent(shape.id)
					.map((id: any) => editor.getShape(id))
					.filter(Boolean);
				result.push(...getAllDescendants(children as any[]));
			}
		}
		return result;
	}

	// Check if any selected shape is a PDF
	const selectedShapes = editor.getSelectedShapes();
	const allShapes = getAllDescendants(selectedShapes);
	const hasPdfSelected = allShapes.some((shape: any) => {
		if (shape.type !== 'image') return false;
		const asset = editor.getAsset((shape.props as any).assetId);
		return asset && (asset.meta as any)?.isPdfAsset;
	});

	const handleChangePdfDpi = React.useCallback(() => {
		actions['change-pdf-dpi']?.onSelect('context-menu' as any);
	}, [actions]);

	return (
		<DefaultContextMenu {...props}>
			{hasPdfSelected && (
				<TldrawUiMenuGroup id="pdf-options">
					<TldrawUiMenuItem
						id="change-pdf-dpi"
						label="Change PDF Quality (DPI)"
						onSelect={handleChangePdfDpi}
					/>
				</TldrawUiMenuGroup>
			)}
			<DefaultContextMenuContent />
		</DefaultContextMenu>
	);
}


function LocalFileMenu(props: { plugin: TldrawPlugin }) {
	const actions = useActions();
	const editor = useEditor();

	const handleImportPdf = React.useCallback(async () => {
		if (!editor) return;

		console.log("[PDF Import] Starting import...");
		try {
			// Import PDF loading utilities
			const { loadPdfMetadata } = await import("./pdf/loadPdf");
			const { AssetRecordType } = await import("tldraw");

			// Get PDF files from vault
			// @ts-ignore
			const pdfFiles = props.plugin.app.vault.getFiles().filter((file: any) => file.extension === "pdf");

			if (pdfFiles.length === 0) {
				new Notice("No PDF files found in vault");
				return;
			}

			// Use Obsidian's suggest modal
			// @ts-ignore
			class PdfPickerModal extends FuzzySuggestModal {
				private resolve: (file: any) => void;

				constructor(app: any, resolve: (file: any) => void) {
					super(app);
					this.resolve = resolve;
					// @ts-ignore
					this.setPlaceholder("Search for a PDF file...");
				}

				getItems() {
					return pdfFiles;
				}

				getItemText(item: any) {
					return item.path;
				}

				onChooseItem(item: any) {
					this.resolve(item);
				}
			}

			const selectedFile = await new Promise<any>((resolve) => {
				// @ts-ignore
				const modal = new PdfPickerModal(props.plugin.app, resolve);
				// @ts-ignore
				modal.open();
			});

			if (!selectedFile) return;

			console.log("[PDF Import] File selected:", selectedFile.path);

			// Load pages metadata (no images!)
			const pages = await loadPdfMetadata(
				props.plugin.app,
				selectedFile.path
			);

			console.log("[PDF Import] Loaded metadata for", pages.length, "pages");

			// Show import options modal
			const { default: PdfImportModal, PdfImportCanceled } = await import("src/obsidian/modal/PdfImportModal");
			let importOptions;
			try {
				importOptions = await PdfImportModal.show(
					props.plugin,
					selectedFile,
					pages
				);
			} catch (e) {
				if (e instanceof PdfImportCanceled) {
					console.log("[PDF Import] Canceled by user");
					return;
				}
				throw e;
			}

			const { selectedPages, groupPages, spacing } = importOptions;
			const pagesToImport = pages.filter(p => selectedPages.includes(p.pageNumber));

			if (pagesToImport.length === 0) {
				new Notice("No pages selected");
				return;
			}

			console.log("[PDF Import] Importing", pagesToImport.length, "pages");

			// Calculate start X position (to the right of existing shapes)
			const existingBounds = editor.getCurrentPageBounds();
			const startX = existingBounds ? existingBounds.maxX + spacing : 0;

			const PAGE_SPACING = 32;
			let top = existingBounds ? existingBounds.minY : 0;
			let widest = 0;

			// Calculate layout
			for (const page of pagesToImport) {
				widest = Math.max(widest, page.width);
			}

			const shapes: any[] = [];
			const assets: any[] = [];
			const shapeIds: any[] = [];
			const now = Date.now();

			// Create image shapes with PDF protocol assets
			for (const page of pagesToImport) {
				const assetId = `asset:pdf-${now}-${page.pageNumber}` as any;
				const shapeId = `shape:pdf-${now}-${page.pageNumber}` as any;
				shapeIds.push(shapeId);

				const x = startX + (widest - page.width) / 2;
				const y = top;

				// Create asset with PDF protocol URL (no image data stored!)
				assets.push({
					id: assetId,
					type: 'image',
					typeName: 'asset',
					props: {
						name: `${selectedFile.basename} page ${page.pageNumber}`,
						src: `asset:pdf.[[${selectedFile.name}]]#${page.pageNumber}`,
						w: page.width,
						h: page.height,
						mimeType: 'image/png',
						isAnimated: false,
					},
					meta: { isPdfAsset: true, pdfPath: selectedFile.path, pageNumber: page.pageNumber, dpi: importOptions.dpi },
				});

				// Create standard image shape
				shapes.push({
					id: shapeId,
					type: 'image',
					x: x,
					y: y,
					props: {
						assetId: assetId,
						w: page.width,
						h: page.height,
					},
					meta: { isPdfPage: true },
				});

				top += page.height + PAGE_SPACING;
			}

			// Batch create assets and shapes
			editor.run(() => {
				editor.store.put(assets);
				editor.createShapes(shapes);

				// Group if requested
				if (groupPages && shapeIds.length > 1) {
					editor.select(...shapeIds);
					editor.groupShapes(shapeIds);
				}
			});

			console.log("[PDF Import] Created", shapes.length, "shapes", groupPages ? "(grouped)" : "");

			// Set zoom to 100% and center on first page
			setTimeout(() => {
				editor.resetZoom();
				console.log("[PDF Import] Set zoom to 100%");
			}, 100);


		} catch (error) {
			console.error("[PDF Import] Error:", error);
			new Notice("PDF Import failed: " + (error as Error).message);
		}
	}, [editor, props.plugin]);


	return (
		<TldrawUiMenuSubmenu id="file" label="menu.file">
			{
				Platform.isMobile
					? <></>
					: <TldrawUiMenuItem  {...actions[SAVE_FILE_COPY_ACTION]} />
			}
			<TldrawUiMenuItem {...actions[SAVE_FILE_COPY_IN_VAULT_ACTION]} />
			<TldrawUiMenuItem {...actions[OPEN_FILE_ACTION]} />
			<TldrawUiMenuItem
				id="import-pdf"
				label="Import PDF"
				icon="file"
				onSelect={handleImportPdf}
			/>
			<TldrawUiMenuItem
				id="change-pdf-dpi-menu"
				label="Change PDF Quality (DPI)"
				onSelect={() => actions['change-pdf-dpi']?.onSelect?.('menu' as any)}
			/>
		</TldrawUiMenuSubmenu>
	);
}

function getEditorStoreProps(storeProps: TldrawAppStoreProps) {
	return storeProps.tldraw ? storeProps.tldraw : {
		store: storeProps.plugin.store
	}
}

const TldrawApp = ({ plugin, store,
	options: {
		components: otherComponents,
		focusOnMount = true,
		hideUi = false,
		iconAssetUrls,
		initialTool,
		isReadonly = false,
		onEditorMount,
		onClickAwayBlur,
		onInitialSnapshot,
		onUiEvent: _onUiEvent,
		selectNone = false,
		tools,
		uiOverrides: otherUiOverrides,
	},
	targetDocument: ownerDocument,
}: TldrawAppProps) => {
	const assetUrls = React.useRef({
		fonts: plugin.getFontOverrides(),
		icons: {
			...plugin.getIconOverrides(),
			...iconAssetUrls,
			[PLUGIN_ACTION_TOGGLE_ZOOM_LOCK]: lockZoomIcon
		},
	})
	const overridesUi = React.useRef({
		...uiOverrides(plugin),
		...otherUiOverrides
	})
	const overridesUiComponents = React.useRef({
		...components(plugin),
		...otherComponents
	});

	const storeProps = React.useMemo(() => !store ? undefined : getEditorStoreProps(store), [store])

	const [editor, setEditor] = React.useState<Editor>();

	const [_onInitialSnapshot, setOnInitialSnapshot] = React.useState<typeof onInitialSnapshot>(() => onInitialSnapshot);
	const setAppState = React.useCallback((editor: Editor) => {
		setEditor(editor);
		if (_onInitialSnapshot) {
			_onInitialSnapshot(editor.store.getStoreSnapshot());
			setOnInitialSnapshot(undefined);
		}
		// Run auto-migration for legacy PDF shapes
		setTimeout(() => {
			upgradeLegacyPdfShapes(editor);
		}, 1000);
	}, [_onInitialSnapshot])

	const onUiEvent = React.useCallback<TLUiEventHandler>((...args) => {
		_onUiEvent?.(editor, ...args)
	}, [_onUiEvent, editor]);

	const [isFocused, setIsFocused] = React.useState(false);

	const setFocusedEditor = (isMounting: boolean, editor?: Editor) => {
		const { currTldrawEditor } = plugin;
		if (currTldrawEditor !== editor) {
			if (currTldrawEditor) {
				currTldrawEditor.blur();
			}
			if (isMounting && !focusOnMount) {
				plugin.currTldrawEditor = undefined;
				return;
			}
			if (editor && editor.getContainer().win === editor.getContainer().win.activeWindow) {
				editor.focus()
				setIsFocused(true);
				plugin.currTldrawEditor = editor;
			}
		}
	}

	useTldrawAppEffects({
		editor, initialTool, isReadonly,
		selectNone,
		settingsManager: plugin.settingsManager,
		onEditorMount,
		setFocusedEditor: (editor) => setFocusedEditor(true, editor),
	});

	// Enable dynamic PDF rendering
	// Moved from LocalFileMenu to ensure it stays mounted
	// usePdfDynamicRendering(editor ?? null, plugin.app); // REPLACED BY CUSTOM SHAPE

	const editorContainerRef = useClickAwayListener<HTMLDivElement>({
		enableClickAwayListener: isFocused,
		handler(ev) {
			// We allow event targets to specify if they should block the editor from being blurred.
			if (PTLEditorBlockBlur.shouldEventBlockBlur(ev)) return;

			const blurEditor = onClickAwayBlur?.(ev);
			if (blurEditor !== undefined && !blurEditor) return;

			editor?.blur();
			setIsFocused(false);
			const { currTldrawEditor } = plugin;
			if (currTldrawEditor) {
				if (currTldrawEditor === editor) {
					plugin.currTldrawEditor = undefined;
				}
			}
		}
	});

	/**
	 * "Flashbang" workaround
	 * 
	 * The editor shows a loading screen which doesn't reflect the user's preference until the editor is loaded.
	 * This works around it by checking the user's preference ahead of time and passing the dark theme className.
	 */
	const fbWorkAroundClassname = React.useMemo(() => {
		const themeMode = plugin.settings.themeMode;
		if (themeMode === "dark") return 'tl-theme__dark';
		else if (themeMode === "light") return;
		else return !isObsidianThemeDark() ? undefined : 'tl-theme__dark';
	}, [plugin]);

	return (
		<div
			className="tldraw-view-root"
			// e.stopPropagation(); this line should solve the mobile swipe menus bug
			// The bug only happens on the mobile version of Obsidian.
			// When a user tries to interact with the tldraw canvas,
			// Obsidian thinks they're swiping down, left, or right so it opens various menus.
			// By preventing the event from propagating, we can prevent those actions menus from opening.
			onTouchStart={(e) => e.stopPropagation()}
			ref={editorContainerRef}
			onFocus={(e) => {
				setFocusedEditor(false, editor);
			}}
		>
			<Tldraw
				{...storeProps}
				assetUrls={assetUrls.current}
				hideUi={hideUi}
				onUiEvent={onUiEvent}
				overrides={overridesUi.current}
				components={overridesUiComponents.current}
				// Set this flag to false when a tldraw document is embed into markdown to prevent it from gaining focus when it is loaded.
				autoFocus={false}
				onMount={setAppState}
				tools={tools}
				className={fbWorkAroundClassname}
			/>
		</div>
	);
};

export const createRootAndRenderTldrawApp = (
	node: Element,
	plugin: TldrawPlugin,
	options: {
		app?: TldrawAppOptions,
		store?: TldrawAppStoreProps,
	} = {}
) => {
	const root = createRoot(node);
	root.render(
		<TldrawInObsidianPluginProvider plugin={plugin}>
			<TldrawApp
				plugin={plugin}
				store={options.store}
				options={options.app ?? {}}
				targetDocument={node.ownerDocument}
			/>
		</TldrawInObsidianPluginProvider>
	);

	return root;
};

export default TldrawApp;
