import * as React from "react";
import { createRoot } from "react-dom/client";
import {
	STROKE_SIZES, DefaultMainMenu,
	DefaultMainMenuContent,
	Editor,
	Rectangle2d,
	TLComponents,
	Tldraw,
	TldrawEditorStoreProps,
	TldrawUiMenuItem,
	TldrawUiMenuSubmenu,
	TLStateNodeConstructor,
	TLUiAssetUrlOverrides,
	TLUiEventHandler,
	TLUiOverrides,
	useActions,
	AssetRecordType,
	StoreSnapshot,
	TLAssetStore,
	TLRecord,
	createTLStore,
	defaultShapeTools,
	defaultTools,
	throttle,
	uniqueId
} from "tldraw";

// Mutate the built-in stroke sizes - Moved to useTldrawAppHook
import { OPEN_FILE_ACTION, SAVE_FILE_COPY_ACTION, SAVE_FILE_COPY_IN_VAULT_ACTION } from "src/utils/file";
import { PLUGIN_ACTION_TOGGLE_ZOOM_LOCK, uiOverrides } from "src/tldraw/ui-overrides";
import { CustomToolbar } from "./CustomToolbar";
import TldrawPlugin from "src/main";
import { Platform } from "obsidian";
import { useTldrawAppEffects } from "src/hooks/useTldrawAppHook";
import { useClickAwayListener } from "src/hooks/useClickAwayListener";
import { TLDataDocumentStore } from "src/utils/document";
import PluginKeyboardShortcutsDialog from "./PluginKeyboardShortcutsDialog";
import PluginQuickActions from "./PluginQuickActions";
import { lockZoomIcon } from "src/assets/data-icons";
import { isObsidianThemeDark } from "src/utils/utils";
import { TldrawInObsidianPluginProvider } from "src/contexts/plugin";
import { PTLEditorBlockBlur } from "src/utils/dom-attributes";
import { LassoSelectTool } from "src/tldraw/tools/lasso-select-tool";
import LassoOverlays from "./LassoOverlays";

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
	onInitialSnapshot?: (snapshot: StoreSnapshot<TLRecord>) => void,
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
	Toolbar: CustomToolbar,
	Overlays: LassoOverlays,
});

function LocalFileMenu(props: { plugin: TldrawPlugin }) {
	const actions = useActions();

	return (
		<TldrawUiMenuSubmenu id="file" label="menu.file">
			{
				Platform.isMobile
					? <></>
					: <TldrawUiMenuItem  {...(actions[SAVE_FILE_COPY_ACTION] as any)} />
			}
			<TldrawUiMenuItem {...(actions[SAVE_FILE_COPY_IN_VAULT_ACTION] as any)} />
			<TldrawUiMenuItem {...(actions[OPEN_FILE_ACTION] as any)} />
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
	const [activeTool, setActiveTool] = React.useState<string>('select');

	const [_onInitialSnapshot, setOnInitialSnapshot] = React.useState<typeof onInitialSnapshot>(() => onInitialSnapshot);
	const setAppState = React.useCallback((editor: Editor) => {
		setEditor(editor);
		setActiveTool(editor.getCurrentToolId());
		if (_onInitialSnapshot) {
			_onInitialSnapshot(editor.store.getStoreSnapshot());
			setOnInitialSnapshot(undefined);
		}
	}, [_onInitialSnapshot])

	React.useEffect(() => {
		if (!editor) return;

		const unlisten = editor.store.listen(() => {
			const currentToolId = editor.getCurrentToolId();
			if (currentToolId !== activeTool) {
				setActiveTool(currentToolId);
			}
		});

		return unlisten;
	}, [editor, activeTool]);

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

	const setFocusedEditorForHook = React.useCallback((editor: Editor) => {
		setFocusedEditor(true, editor);
	}, [setFocusedEditor]);

	useTldrawAppEffects({
		editor,
		settingsManager: plugin.settingsManager,
		selectNone,
		initialTool,
		onEditorMount,
		isReadonly,
		setFocusedEditor: setFocusedEditorForHook,
	});

	React.useEffect(() => {
		if (!editor) return;

		const pointingCanvasState = editor.getStateDescendant('select.pointing_canvas');
		if (!pointingCanvasState) return;

		const originalOnEnter = pointingCanvasState.onEnter;

		pointingCanvasState.onEnter = function (info) {
			const selectedShapeIds = editor.getSelectedShapeIds();
			const selectionBounds = editor.getSelectionPageBounds();

			if (selectedShapeIds.length === 0 || (selectionBounds && !selectionBounds.containsPoint(info.point))) {
				editor.setCurrentTool('lasso-select');
				return;
			}

			originalOnEnter?.call(this, info);
		};

		return () => {
			if (originalOnEnter) {
				pointingCanvasState.onEnter = originalOnEnter;
			}
		};
	}, [editor]);

	// Inject stroke parameters into window for patched getPath
	React.useEffect(() => {
		(window as any).tldrawStrokeOptions = plugin.settings.tldrawOptions?.strokeParameters;
	}, [plugin.settings.tldrawOptions?.strokeParameters]);



	const enabledTools = React.useMemo(() => {
		const toolbarTools = plugin.settings.tldrawOptions?.toolbarTools;
		const defaults = [...defaultTools, ...defaultShapeTools];

		// Always include LassoSelectTool
		const allTools = [...defaults, LassoSelectTool];

		if (!toolbarTools || !Array.isArray(toolbarTools) || toolbarTools.length === 0) {
			// No settings or empty array - return all tools
			return allTools;
		}

		// Create a map for quick access to default tools
		const toolMap = new Map<string, TLStateNodeConstructor>(defaults.map(t => [t.id, t]));
		// Add custom tools
		toolMap.set(LassoSelectTool.id, LassoSelectTool);

		// Map ordered settings to tool definitions
		const orderedTools: TLStateNodeConstructor[] = [];

		toolbarTools.forEach(setting => {
			if (setting.enabled) {
				const tool = toolMap.get(setting.id);
				if (tool) {
					orderedTools.push(tool);
				}
			}
		});

		// Fallback to all tools if orderedTools is empty
		return orderedTools.length > 0 ? orderedTools : allTools;
	}, [plugin.settings.tldrawOptions?.toolbarTools]);

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

	// Prevent gesture events from bubbling to Obsidian (Fixes Mac trackpad zoom interference)
	React.useEffect(() => {
		const el = editorContainerRef.current;
		if (!el) return;

		// We must stop propagation of the wheel event to prevent Obsidian from scrolling/zooming the parent.
		// We also prevent default to ensure the browser doesn't perform a native page zoom.
		const handleWheel = (e: WheelEvent) => {
			e.stopPropagation();
			if (e.cancelable) e.preventDefault();
		};

		// For gestures (pinch-zoom on trackpad), we must NOT stop propagation, 
		// because Tldraw likely relies on global window listeners to track the gesture state.
		// However, we prevent default to stop the browser's native response.
		// AND we explicitly interrupt the editor on 'gestureend' to prevent it from getting stuck in a zoom state.
		const handleGesture = (e: Event) => {
			if (e.cancelable) e.preventDefault();
			if (e.type === 'gestureend') {
				editor?.interrupt();
			}
		};

		// "Clean Slate" Protocol:
		// If the user presses the pointer down (to draw, select, etc.), we forcefully interrupt
		// any lingering states (like a stuck zoom or pan). This runs in the CAPTURE phase,
		// triggering BEFORE Tldraw receives the event. This ensures Tldraw is in an 'idle' state
		// and ready to accept the new input.
		const handlePointerDownCapture = (e: PointerEvent) => {
			// We do NOT stop propagation here, because Tldraw needs this event to start drawing.
			editor?.interrupt();
		};

		el.addEventListener('wheel', handleWheel, { passive: false });
		el.addEventListener('gesturestart', handleGesture, { passive: false });
		el.addEventListener('gesturechange', handleGesture, { passive: false });
		el.addEventListener('gestureend', handleGesture, { passive: false });
		el.addEventListener('pointerdown', handlePointerDownCapture, { capture: true });

		return () => {
			el.removeEventListener('wheel', handleWheel);
			el.removeEventListener('gesturestart', handleGesture);
			el.removeEventListener('gesturechange', handleGesture);
			el.removeEventListener('gestureend', handleGesture);
			el.removeEventListener('pointerdown', handlePointerDownCapture, { capture: true });
		};
	}, [editorContainerRef, editor]);

	/**
	 * "Flashbang" workaround
	 * 
	 * The editor shows a loading screen which doesn't reflect the user's preference until the editor is loaded.
	 * This works around it by checking the user's preference ahead of time and passing the dark theme className.
	 */
	const fbWorkAroundClassname = React.useMemo(() => {
		const themeMode = plugin.settings.themeMode;
		const classes = [];
		if (themeMode === "dark") classes.push('tl-theme__dark');
		else if (themeMode === "light") { }
		else if (isObsidianThemeDark()) classes.push('tl-theme__dark');

		return classes.join(' ');
	}, [plugin]);

	return (
		<div
			className="tldraw-view-root"
			data-active-tool={activeTool}
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
				forceMobile={plugin.settings.tldrawOptions?.forceCompactMode}
				onMount={setAppState}
				tools={enabledTools}
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
