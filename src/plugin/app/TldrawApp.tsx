import { Platform } from 'obsidian'
import * as React from 'react'
import { useEffect, useMemo } from 'react'
import { createRoot } from 'react-dom/client'
import { lockZoomIcon } from 'src/assets/data-icons'
import { TldrawInObsidianPluginProvider } from 'src/plugin/app/contexts/plugin'
import { useClickAwayListener } from 'src/plugin/app/hooks/useClickAwayListener'
import { useTldrawAppEffects } from 'src/plugin/app/hooks/useTldrawAppHook'
import TldrawPlugin from 'src/plugin/TldrawPlugin'
import { TLDRAW_LICENSE_KEY } from 'src/tldraw/license'
import { installObsidianLinkHandler } from 'src/plugin/uri/open-obsidian-link'
import {
	CREATE_PAGE_ACTION,
	PLUGIN_ACTION_TOGGLE_ZOOM_LOCK,
	uiOverrides,
} from 'src/plugin/actions/ui-overrides'
import { TLDataDocumentStore } from 'src/plugin/document/document'
import { PTLEditorBlockBlur } from 'src/utils/dom-attributes'
import {
	OPEN_FILE_ACTION,
	SAVE_FILE_COPY_ACTION,
	SAVE_FILE_COPY_IN_VAULT_ACTION,
} from 'src/plugin/actions/file'
import { getIsDarkMode } from 'src/plugin/theme'
import { getViewport, saveViewport } from 'src/plugin/viewport-storage'
import {
	DefaultMainMenu,
	DefaultPageMenu,
	DefaultZoomMenu,
	DefaultZoomMenuContent,
	Editor,
	EditSubmenu,
	ExportFileContentSubMenu,
	ExtrasGroup,
	PreferencesGroup,
	TLComponents,
	Tldraw,
	TldrawEditorStoreProps,
	TldrawOptions,
	TldrawUiMenuActionItem,
	TldrawUiMenuCheckboxItem,
	TldrawUiMenuGroup,
	TldrawUiMenuItem,
	TldrawUiMenuSubmenu,
	TLAnyOverlayUtilConstructor,
	TLStateNodeConstructor,
	TLStoreSnapshot,
	TLUiAssetUrlOverrides,
	TLUiEventHandler,
	TLUiOverrides,
	TLUserPreferences,
	track,
	useActions,
	useAtom,
	useComputed,
	useEditor,
	useReactor,
	useValue,
	ZoomTo100MenuItem,
	ZoomToFitMenuItem,
	ZoomToSelectionMenuItem,
} from 'tldraw'
import PluginKeyboardShortcutsDialog from './components/PluginKeyboardShortcutsDialog'
import PluginQuickActions from './components/PluginQuickActions'

type TldrawAppOptions = {
	iconAssetUrls?: TLUiAssetUrlOverrides['icons']
	isReadonly?: boolean
	autoFocus?: boolean
	focusOnMount?: boolean
	/**
	 * Takes precedence over the user's plugin preference
	 */
	initialTool?: string
	hideUi?: boolean
	/**
	 * Whether to call `.selectNone` on the Tldraw editor instance when it is mounted.
	 */
	selectNone?: boolean
	tools?: readonly TLStateNodeConstructor[]
	overlayUtils?: readonly TLAnyOverlayUtilConstructor[]
	uiOverrides?: TLUiOverrides
	components?: TLComponents
	/**
	 * An explicit deep link to navigate to on mount, taking precedence over saved viewport state.
	 */
	initialDeepLink?: string
	onEditorMount?: (editor: Editor) => void
	/**
	 *
	 * @param snapshot The snapshot that is initially loaded into the editor.
	 * @returns
	 */
	onInitialSnapshot?: (snapshot: TLStoreSnapshot) => void
	/**
	 *
	 * @param event
	 * @returns `true` if the editor should be blurred.
	 */
	onClickAwayBlur?: (event: PointerEvent) => boolean
	onUiEvent?: (editor: Editor | undefined, ...rest: Parameters<TLUiEventHandler>) => void
}

/**
 * Whether to use native tldraw store props or the plugin based store props.
 */
export type TldrawAppStoreProps =
	| {
			plugin?: undefined
			/**
			 * Use the native tldraw store props.
			 */
			tldraw: TldrawEditorStoreProps
	  }
	| {
			/**
			 * Use the plugin based store props.
			 */
			plugin: TLDataDocumentStore
			tldraw?: undefined
	  }

export type TldrawAppProps = {
	plugin: TldrawPlugin
	/**
	 * If this value is undefined, then the tldraw document will not be persisted.
	 */
	store?: TldrawAppStoreProps
	options: TldrawAppOptions
	targetDocument: Document
	/**
	 * The vault-relative file path, used for persisting per-document state like camera viewport.
	 */
	filePath?: string
}

// https://github.com/tldraw/tldraw/blob/58890dcfce698802f745253ca42584731d126cc3/apps/examples/src/examples/custom-main-menu/CustomMainMenuExample.tsx
const LockZoomCheckboxItem = track(() => {
	const editor = useEditor()
	const actions = useActions()
	const isZoomLocked = editor.getCameraOptions().zoomSteps.length === 1
	return (
		<TldrawUiMenuCheckboxItem
			id={PLUGIN_ACTION_TOGGLE_ZOOM_LOCK}
			label={{ default: 'Lock zoom' }}
			kbd="!k"
			checked={isZoomLocked}
			onSelect={() => actions[PLUGIN_ACTION_TOGGLE_ZOOM_LOCK].onSelect('zoom-menu')}
		/>
	)
})

function PluginViewSubmenu() {
	return (
		<TldrawUiMenuSubmenu id="view" label="menu.view">
			<TldrawUiMenuGroup id="view-actions">
				<TldrawUiMenuActionItem actionId="zoom-in" />
				<TldrawUiMenuActionItem actionId="zoom-out" />
				<ZoomTo100MenuItem />
				<ZoomToFitMenuItem />
				<ZoomToSelectionMenuItem />
			</TldrawUiMenuGroup>
			<TldrawUiMenuGroup id="zoom-lock">
				<LockZoomCheckboxItem />
			</TldrawUiMenuGroup>
		</TldrawUiMenuSubmenu>
	)
}

const components: TLComponents = {
	MainMenu: () => (
		<DefaultMainMenu>
			<LocalFileMenu />
			<TldrawUiMenuGroup id="basic">
				<EditSubmenu />
				<PluginViewSubmenu />
				<ExportFileContentSubMenu />
				<ExtrasGroup />
			</TldrawUiMenuGroup>
			<PreferencesGroup />
		</DefaultMainMenu>
	),
	KeyboardShortcutsDialog: PluginKeyboardShortcutsDialog,
	QuickActions: PluginQuickActions,
	ZoomMenu: () => (
		<DefaultZoomMenu>
			<TldrawUiMenuGroup id="zoom-menu">
				<DefaultZoomMenuContent />
			</TldrawUiMenuGroup>
			<TldrawUiMenuGroup id="zoom-lock">
				<LockZoomCheckboxItem />
			</TldrawUiMenuGroup>
		</DefaultZoomMenu>
	),
	PageMenu: () => {
		const editor = useEditor()
		const hasMultiplePages = useValue('hasMultiplePages', () => editor.getPages().length > 1, [
			editor,
		])
		if (!hasMultiplePages) return null
		return <DefaultPageMenu />
	},
}

function LocalFileMenu() {
	const actions = useActions()

	const actionItem = (id: keyof typeof actions) =>
		actions[id] as React.ComponentProps<typeof TldrawUiMenuItem>

	return (
		<TldrawUiMenuSubmenu id="file" label="menu.file">
			{Platform.isMobile ? <></> : <TldrawUiMenuItem {...actionItem(SAVE_FILE_COPY_ACTION)} />}
			<TldrawUiMenuItem {...actionItem(SAVE_FILE_COPY_IN_VAULT_ACTION)} />
			<TldrawUiMenuItem {...actionItem(OPEN_FILE_ACTION)} />
			<TldrawUiMenuItem {...actionItem(CREATE_PAGE_ACTION)} />
		</TldrawUiMenuSubmenu>
	)
}

function getEditorStoreProps(storeProps: TldrawAppStoreProps) {
	return storeProps.tldraw
		? storeProps.tldraw
		: {
				store: storeProps.plugin.store,
			}
}

const TldrawApp = ({
	plugin,
	store,
	options: {
		components: otherComponents,
		focusOnMount = true,
		hideUi = false,
		iconAssetUrls,
		initialDeepLink,
		initialTool,
		isReadonly = false,
		onEditorMount,
		onClickAwayBlur,
		onInitialSnapshot,
		onUiEvent: _onUiEvent,
		selectNone = false,
		tools,
		overlayUtils,
		uiOverrides: otherUiOverrides,
	},
	targetDocument: _ownerDocument,
	filePath,
}: TldrawAppProps) => {
	const assetUrlsRef = React.useRef({
		fonts: plugin.getFontOverrides(),
		icons: {
			...plugin.getIconOverrides(),
			...iconAssetUrls,
			[PLUGIN_ACTION_TOGGLE_ZOOM_LOCK]: lockZoomIcon,
		},
	})
	// The overrides are created once, so route UI events through a ref to reach the latest handler.
	const onUiEventRef = React.useRef<TLUiEventHandler>(() => {})
	const overridesUiRef = React.useRef({
		...uiOverrides(plugin, (...args) => onUiEventRef.current(...args)),
		...otherUiOverrides,
	})
	const overridesUiComponentsRef = React.useRef({
		...components,
		...otherComponents,
	})

	const storeProps = React.useMemo(() => (!store ? undefined : getEditorStoreProps(store)), [store])

	const [editor, setEditor] = React.useState<Editor>()

	const [_onInitialSnapshot, setOnInitialSnapshot] = React.useState<typeof onInitialSnapshot>(
		() => onInitialSnapshot
	)
	const setAppState = React.useCallback(
		(editor: Editor) => {
			installObsidianLinkHandler(plugin.app)
			setEditor(editor)
			if (_onInitialSnapshot) {
				_onInitialSnapshot(editor.store.getStoreSnapshot())
				setOnInitialSnapshot(undefined)
			}
		},
		[_onInitialSnapshot, plugin.app]
	)

	const onUiEvent = React.useCallback<TLUiEventHandler>(
		(...args) => {
			_onUiEvent?.(editor, ...args)
		},
		[_onUiEvent, editor]
	)
	React.useLayoutEffect(() => {
		onUiEventRef.current = onUiEvent
	}, [onUiEvent])

	const [isFocused, setIsFocused] = React.useState(false)

	const setFocusedEditor = (isMounting: boolean, editor?: Editor) => {
		const { currTldrawEditor } = plugin
		if (currTldrawEditor !== editor) {
			if (currTldrawEditor) {
				currTldrawEditor.blur()
			}
			if (isMounting && !focusOnMount) {
				plugin.currTldrawEditor = undefined
				return
			}
			if (editor && editor.getContainer().win === editor.getContainer().win.activeWindow) {
				editor.focus()
				setIsFocused(true)
				plugin.currTldrawEditor = editor
			}
		}
	}

	useTldrawAppEffects({
		editor,
		initialTool,
		isReadonly,
		selectNone,
		settingsManager: plugin.settingsManager,
		onEditorMount,
		setFocusedEditor: (editor) => setFocusedEditor(true, editor),
	})

	const editorContainerRef = useClickAwayListener<HTMLDivElement>({
		enableClickAwayListener: isFocused,
		handler(ev) {
			// We allow event targets to specify if they should block the editor from being blurred.
			if (PTLEditorBlockBlur.shouldEventBlockBlur(ev)) return

			const blurEditor = onClickAwayBlur?.(ev)
			if (blurEditor !== undefined && !blurEditor) return

			editor?.blur()
			setIsFocused(false)
			const { currTldrawEditor } = plugin
			if (currTldrawEditor) {
				if (currTldrawEditor === editor) {
					plugin.currTldrawEditor = undefined
				}
			}
		},
	})

	const isDarkMode = useAtom('isDarkMode', getIsDarkMode(plugin.settingsManager.settings.themeMode))

	useEffect(() => {
		const updateTheme = () => {
			isDarkMode.set(getIsDarkMode(plugin.settingsManager.settings.themeMode))
		}
		const eventRef = plugin.app.workspace.on('css-change', updateTheme)
		return () => plugin.app.workspace.offref(eventRef)
	}, [plugin, isDarkMode])

	useReactor(
		'sync bg color with obsidian theme',
		() => {
			if (!editor) return
			const mode = isDarkMode.get() ? 'dark' : 'light'
			const background = getComputedStyle(document.body)
				.getPropertyValue('--background-primary')
				.trim()
			// tldraw 5 replaced the mutable global palette with per-editor themes, so the canvas
			// background is set by updating this editor's theme rather than a shared object.
			editor.updateThemes((themes) => {
				themes.default.colors[mode].background = background
				return themes
			})
		},
		[editor, isDarkMode]
	)

	const userPreferences = useComputed(
		'userPreferences',
		() => {
			return {
				id: '',
				colorScheme: isDarkMode.get() ? 'dark' : 'light',
			} satisfies TLUserPreferences
		},
		[]
	)
	const user = useMemo(() => {
		return {
			setUserPreferences: () => {},
			userPreferences,
		}
	}, [userPreferences])

	const { app } = plugin

	const tldrawOptions = useMemo<Partial<TldrawOptions>>(() => {
		const deepLinksConfig = filePath
			? {
					debounceMs: 100,
					getUrl() {
						const url = new URL('https://obsidian.local')
						const deepLink = initialDeepLink ?? getViewport(app, filePath)
						if (deepLink) url.searchParams.set('d', deepLink)
						return url
					},
					onChange(url: URL, editor: Editor) {
						const deepLink = url.searchParams.get('d')
						if (!deepLink) return
						// Only save when this editor has focus, so we don't persist viewport on tab blur
						const container = editor.getContainer()
						if (!container.contains(container.ownerDocument.activeElement)) return
						saveViewport(app, filePath, deepLink)
					},
				}
			: undefined

		return {
			actionShortcutsLocation: 'toolbar',
			deepLinks: deepLinksConfig,
		}
	}, [filePath, app, initialDeepLink])

	return (
		<div
			className={`tldraw-view-root ${plugin.settingsManager.settings.themeMode === 'match-theme' ? 'tl-obsidian-theme' : ''}`}
			// e.stopPropagation(); this line should solve the mobile swipe menus bug
			// The bug only happens on the mobile version of Obsidian.
			// When a user tries to interact with the tldraw canvas,
			// Obsidian thinks they're swiping down, left, or right so it opens various menus.
			// By preventing the event from propagating, we can prevent those actions menus from opening.
			onTouchStart={(e) => e.stopPropagation()}
			ref={editorContainerRef}
			onFocus={(_e) => {
				setFocusedEditor(false, editor)
			}}
		>
			<Tldraw
				{...storeProps}
				assetUrls={assetUrlsRef.current}
				hideUi={hideUi}
				onUiEvent={onUiEvent}
				overrides={overridesUiRef.current}
				options={tldrawOptions}
				user={user}
				components={overridesUiComponentsRef.current}
				// Set this flag to false when a tldraw document is embed into markdown to prevent it from gaining focus when it is loaded.
				autoFocus={false}
				onMount={setAppState}
				tools={tools}
				overlayUtils={overlayUtils}
				licenseKey={TLDRAW_LICENSE_KEY}
			/>
		</div>
	)
}

export const createRootAndRenderTldrawApp = (
	node: Element,
	plugin: TldrawPlugin,
	options: {
		app?: TldrawAppOptions
		store?: TldrawAppStoreProps
		filePath?: string
	} = {}
) => {
	const root = createRoot(node)
	root.render(
		<TldrawInObsidianPluginProvider plugin={plugin}>
			<TldrawApp
				plugin={plugin}
				store={options.store}
				options={options.app ?? {}}
				targetDocument={node.ownerDocument}
				filePath={options.filePath}
			/>
		</TldrawInObsidianPluginProvider>
	)

	return root
}

export default TldrawApp
