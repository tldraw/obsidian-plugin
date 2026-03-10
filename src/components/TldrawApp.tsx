import { Platform } from 'obsidian'
import * as React from 'react'
import { useEffect, useMemo } from 'react'
import { createRoot } from 'react-dom/client'
import { lockZoomIcon } from 'src/assets/data-icons'
import { TldrawInObsidianPluginProvider } from 'src/contexts/plugin'
import { useClickAwayListener } from 'src/hooks/useClickAwayListener'
import { useTldrawAppEffects } from 'src/hooks/useTldrawAppHook'
import TldrawPlugin from 'src/main'
import {
	CREATE_PAGE_ACTION,
	PLUGIN_ACTION_TOGGLE_ZOOM_LOCK,
	uiOverrides,
} from 'src/tldraw/ui-overrides'
import { TLDataDocumentStore } from 'src/utils/document'
import { PTLEditorBlockBlur } from 'src/utils/dom-attributes'
import {
	OPEN_FILE_ACTION,
	SAVE_FILE_COPY_ACTION,
	SAVE_FILE_COPY_IN_VAULT_ACTION,
} from 'src/utils/file'
import { getIsDarkMode } from 'src/utils/utils'
import { getViewport, saveViewport } from 'src/utils/viewport-storage'
import {
	DefaultColorThemePalette,
	DefaultMainMenu,
	DefaultPageMenu,
	DefaultZoomMenu,
	DefaultZoomMenuContent,
	Editor,
	TLComponents,
	Tldraw,
	TldrawEditorStoreProps,
	TldrawOptions,
	EditSubmenu,
	ExportFileContentSubMenu,
	ExtrasGroup,
	PreferencesGroup,
	TldrawUiMenuActionItem,
	TldrawUiMenuCheckboxItem,
	TldrawUiMenuGroup,
	TldrawUiMenuItem,
	TldrawUiMenuSubmenu,
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
import PluginKeyboardShortcutsDialog from './PluginKeyboardShortcutsDialog'
import PluginQuickActions from './PluginQuickActions'

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
		uiOverrides: otherUiOverrides,
	},
	targetDocument: _ownerDocument,
	filePath,
}: TldrawAppProps) => {
	const assetUrls = React.useRef({
		fonts: plugin.getFontOverrides(),
		icons: {
			...plugin.getIconOverrides(),
			...iconAssetUrls,
			[PLUGIN_ACTION_TOGGLE_ZOOM_LOCK]: lockZoomIcon,
		},
	})
	const overridesUi = React.useRef({
		...uiOverrides(plugin),
		...otherUiOverrides,
	})
	const overridesUiComponents = React.useRef({
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
			setEditor(editor)
			if (_onInitialSnapshot) {
				_onInitialSnapshot(editor.store.getStoreSnapshot())
				setOnInitialSnapshot(undefined)
			}
		},
		[_onInitialSnapshot]
	)

	const onUiEvent = React.useCallback<TLUiEventHandler>(
		(...args) => {
			_onUiEvent?.(editor, ...args)
		},
		[_onUiEvent, editor]
	)

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

	const isDarkMode = useAtom('isDarkMode', getIsDarkMode(plugin.settings.themeMode))

	useEffect(() => {
		const updateTheme = () => {
			isDarkMode.set(getIsDarkMode(plugin.settings.themeMode))
		}
		const eventRef = plugin.app.workspace.on('css-change', updateTheme)
		return () => plugin.app.workspace.offref(eventRef)
	}, [plugin, isDarkMode])

	useReactor('sync bg color with obsidian theme', () => {
		const palette = isDarkMode.get()
			? DefaultColorThemePalette.darkMode
			: DefaultColorThemePalette.lightMode
		palette.background = getComputedStyle(document.body)
			.getPropertyValue('--background-primary')
			.trim()
	})

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

	const vaultName = plugin.app.vault.getName()

	const tldrawOptions = useMemo<Partial<TldrawOptions>>(() => {
		const deepLinksConfig = filePath
			? {
					debounceMs: 100,
					getUrl() {
						const url = new URL('https://obsidian.local')
						const deepLink = initialDeepLink ?? getViewport(vaultName, filePath)
						if (deepLink) url.searchParams.set('d', deepLink)
						return url
					},
					onChange(url: URL, editor: Editor) {
						const deepLink = url.searchParams.get('d')
						if (!deepLink) return
						// Only save when this editor has focus, so we don't persist viewport on tab blur
						const container = editor.getContainer()
						if (!container.contains(container.ownerDocument.activeElement)) return
						saveViewport(vaultName, filePath, deepLink)
					},
				}
			: undefined

		return {
			actionShortcutsLocation: 'toolbar',
			deepLinks: deepLinksConfig,
		}
	}, [filePath, vaultName, initialDeepLink])

	return (
		<div
			className={`tldraw-view-root ${plugin.settings.themeMode === 'match-theme' ? 'tl-obsidian-theme' : ''}`}
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
				assetUrls={assetUrls.current}
				hideUi={hideUi}
				onUiEvent={onUiEvent}
				overrides={overridesUi.current}
				options={tldrawOptions}
				user={user}
				components={overridesUiComponents.current}
				// Set this flag to false when a tldraw document is embed into markdown to prevent it from gaining focus when it is loaded.
				autoFocus={false}
				onMount={setAppState}
				tools={tools}
				licenseKey="tldraw-tldraw-2026-07-10/WyIyU3h6ZzhTZyIsWyIqLnRsZHJhdy5jb20iLCIqLnRsZHJhdy5kZXYiLCIqLnRsZHJhdy5jbHViIiwiKi50bGRyYXcud29ya2Vycy5kZXYiXSw5LCIyMDI2LTA3LTEwIl0.+21jrvz5ZFmIvvA/DusCcnFV6Ab1iQQYR+INTqw/i/MmZe/5I/lhdLtqm9nprkQ1MfWL2PeyBmQui1+rjoQS1w"
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
