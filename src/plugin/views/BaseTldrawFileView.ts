import { FileView, TFile } from 'obsidian'
import { Root } from 'react-dom/client'
import InFrontOfTheCanvas from 'src/plugin/app/components/InFrontOfTheCanvas'
import {
	createRootAndRenderTldrawApp,
	TldrawAppProps,
	TldrawAppStoreProps,
} from 'src/plugin/app/TldrawApp'
import TldrawPlugin from 'src/plugin/TldrawPlugin'
import { MARKDOWN_ICON_NAME, VIEW_TYPE_MARKDOWN } from 'src/plugin/constants'
import { TLDataDocumentStore } from 'src/plugin/document/document'
import { createDeepLinkString, parseDeepLinkString, TLDeepLink } from 'tldraw'
import { getViewport } from 'src/plugin/viewport-storage'
import TldrawAssetsModal from 'src/plugin/modals/TldrawAssetsModal'
import { ErrorHandler } from 'src/plugin/error-handler'

export interface DataUpdate {
	getData(): string
	saveFile(): Promise<void>
}


/**
 * Implements overrides for {@linkcode FileView} by intercepting its methods.
 * We do this to mixin specific behavior into subclasses of FileView.
 *
 * #NOTE: may need to embed the react root in an iframe so that the right click context menus are positioned within the frame, and not partially hidden.
 */
export abstract class BaseTldrawFileView<View extends FileView = FileView> {
	abstract plugin: TldrawPlugin

	#reactRoot?: Root
	#onUnloadCallbacks: (() => void)[] = []

	#storeProps?: TldrawAppStoreProps
	#deepLink?: TLDeepLink

	#unregisterViewAssetsActionCallback?: () => void
	#unregisterOnWindowMigrated?: () => void

	messagesEl?: HTMLElement
	onMessagesClick?: (evt: MouseEvent) => void

	constructor(public fileView: View) {
		this.fileView.onload = this.onload.bind(this)
		this.fileView.onunload = this.onunload.bind(this)
		this.fileView.onLoadFile = this.onLoadFile.bind(this)
		this.fileView.onUnloadFile = this.onUnloadFile.bind(this)
		this.fileView.setEphemeralState = this.setEphemeralState.bind(this)
	}

	private getTldrawContainer() {
		return this.fileView.contentEl
	}

	/**
	 * Whether store instances created for this view should synchronize their
	 * changes to the shared main store (which persists to the file).
	 */
	protected abstract syncToMain(): boolean
	/**
	 *
	 * @param update An object to manage the update.
	 */
	protected abstract onUpdated(update: DataUpdate): void

	onload(): void {
		this.fileView.contentEl.addClass('tldraw-view-content')

		this.#unregisterOnWindowMigrated?.()
		this.#unregisterOnWindowMigrated = this.fileView.contentEl.onWindowMigrated(() => {
			this.refreshView()
		})

		this.fileView.addAction(MARKDOWN_ICON_NAME, 'View as markdown', () =>
			this.viewAsMarkdownClicked()
		)
		this.messagesEl = this.fileView.addAction('message-square', 'View messages', (evt) =>
			this.onMessagesClick?.(evt)
		)
	}

	onunload(): void {
		this.#unregisterOnWindowMigrated?.()
		this.fileView.contentEl.removeClass('tldraw-view-content')
		this.unmountReactRoot()
	}

	async onLoadFile(file: TFile): Promise<void> {
		const fileData = await this.fileView.app.vault.read(file)

		const storeInstance = this.plugin.tlDataDocumentStoreManager.register(
			file,
			() => fileData,
			(newFileData) => {
				// TODO: newFileData is currently a string, which means it was already converted to a string by the store instance.
				// We should probably pass an object with reference to the snapshot here instead of a string.
				// This way we can avoid an unnecessary conversion to a string if none of the methods below are called.
				this.onUpdated({
					getData: () => newFileData,
					saveFile: () => {
						// TODO: Check if the implementation is similar to TextFileView.save()
						return this.fileView.app.vault.modify(file, newFileData)
					},
				})
			},
			this.syncToMain()
		)

		this.registerOnUnloadFile(() => storeInstance.unregister())

		const registration = this.plugin.instance.registerDocumentMessagesAction({
			key: storeInstance.getInstanceId(),
			actionEl: this.messagesEl!,
			messages: storeInstance.messages,
		})

		this.onMessagesClick = (evt) => {
			registration.onMessagesClicked(evt)
		}

		this.registerOnUnloadFile(() => {
			this.onMessagesClick = undefined
			registration.unregister()
		})

		const processedStore = await this.processStore(storeInstance.documentStore)

		if (!processedStore) {
			this.fileView.unload()
			return
		}

		this.setStore({
			plugin: processedStore,
		})
	}

	/**
	 * Processes the store and returns a new store or `null` if the store should be unloaded.
	 * @param documentStore
	 * @returns
	 */
	protected abstract processStore(
		documentStore: TLDataDocumentStore
	): Promise<TLDataDocumentStore | null>

	async onUnloadFile(): Promise<void> {
		const callbacks = [...this.#onUnloadCallbacks]
		this.#onUnloadCallbacks = []
		callbacks.forEach((e) => e())
	}

	public registerOnUnloadFile(cb: () => void) {
		this.#onUnloadCallbacks.push(cb)
	}

	setEphemeralState(state: unknown): void {
		// If a deep link is present when the document is opened, set the deeplink variable so the editor is opened at the deep link.
		if (
			typeof state === 'object' &&
			state &&
			'tldrawDeepLink' in state &&
			typeof state.tldrawDeepLink === 'string'
		) {
			const tldrawDeepLink = state.tldrawDeepLink
			try {
				this.#deepLink = parseDeepLinkString(tldrawDeepLink)
				return
			} catch (e) {
				console.error('Unable to parse deeplink:', tldrawDeepLink, e)
			}
		}
	}

	protected getTldrawOptions(): TldrawAppProps['options'] {
		const initialDeepLink = this.#deepLink
			? createDeepLinkString(this.#deepLink)
			: undefined

		const filePath = this.fileView.file?.path
		const hasSavedViewport = filePath
			? getViewport(this.plugin.app, filePath) !== null
			: false

		return {
			components: {
				InFrontOfTheCanvas,
			},
			initialDeepLink,
			onEditorMount: (editor) => {
				if (!initialDeepLink && !hasSavedViewport) {
					editor.zoomToFit()
				}
			},
		}
	}

	private createReactRoot(entryPoint: Element, store: TldrawAppStoreProps) {
		return createRootAndRenderTldrawApp(entryPoint, this.plugin, {
			app: this.getTldrawOptions(),
			store,
			filePath: this.fileView.file?.path,
		})
	}

	/**
	 * Set the store props to be used inside the react root element.
	 * @param storeProps
	 * @returns
	 */
	private setStore(storeProps?: TldrawAppStoreProps) {
		this.#storeProps = storeProps
		this.updateViewAssetsAction()
		this.refreshView()
	}

	protected viewAsMarkdownClicked() {
		this.plugin.updateViewMode(VIEW_TYPE_MARKDOWN).catch(ErrorHandler.notice)
	}

	private updateViewAssetsAction() {
		const storeProps = this.#storeProps
		this.#unregisterViewAssetsActionCallback?.()
		if (!storeProps) return

		const viewAssetsAction = this.fileView.addAction('library', 'View assets', () => {
			const assetsModal = new TldrawAssetsModal(this.fileView.app, storeProps, this.fileView.file)
			assetsModal.open()
			this.registerOnUnloadFile(() => assetsModal.close())
		})

		const removeCb = () => {
			viewAssetsAction.remove()
		}
		this.registerOnUnloadFile(removeCb)
		this.#unregisterViewAssetsActionCallback = () => {
			const cbIndex = this.#onUnloadCallbacks.indexOf(removeCb)
			if (cbIndex !== -1) this.#onUnloadCallbacks.splice(cbIndex, 1)
			removeCb()
		}
	}

	private unmountReactRoot() {
		this.#reactRoot?.unmount()
		this.#reactRoot = undefined
	}

	refreshView() {
		const storeProps = this.#storeProps
		this.unmountReactRoot()
		if (!storeProps) return
		this.#reactRoot = this.createReactRoot(this.getTldrawContainer(), storeProps)
	}
}
