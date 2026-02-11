import { FileView, TFile } from 'obsidian'
import { Root } from 'react-dom/client'
import InFrontOfTheCanvas from 'src/components/InFrontOfTheCanvas'
import {
	createRootAndRenderTldrawApp,
	TldrawAppProps,
	TldrawAppStoreProps,
} from 'src/components/TldrawApp'
import TldrawPlugin from 'src/main'
import { MARKDOWN_ICON_NAME, VIEW_TYPE_MARKDOWN } from 'src/utils/constants'
import { TLDataDocumentStore } from 'src/utils/document'
import { parseDeepLinkString, TLDeepLink } from 'tldraw'
import { intercept, Interceptor, MethodKeys } from '../utils/decorators/methods'
import TldrawAssetsModal from './modal/TldrawAssetsModal'

export interface DataUpdate {
	getData(): string
	saveFile(): Promise<void>
}

export function interceptFileViewMethod<
	TMethod extends MethodKeys<FileView>,
	TMethodArgs extends any[],
	TMethodReturn,
>(method: TMethod, interceptor: Interceptor<BaseTldrawFileView, FileView, TMethod, TMethodArgs, TMethodReturn>) {
	return intercept((instance: BaseTldrawFileView) => instance.fileView, method, interceptor)
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

	constructor(public fileView: View) {}

	private getTldrawContainer() {
		return this.fileView.contentEl
	}

	protected abstract isReadOnly(): boolean
	/**
	 *
	 * @param update An object to manage the update.
	 */
	protected abstract onUpdated(update: DataUpdate): void

	/**
	 * Adds the entry point `tldraw-view-content` for the {@linkcode #reactRoot},
	 * and the "View as markdown" action button.
	 */
	@interceptFileViewMethod('onload', (original, thisMethod) => {
		return (...args) => {
			original(...args)
			thisMethod()
		}
	})
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

	/**
	 * Removes the previously added entry point `tldraw-view-content`, and unmounts {@linkcode #reactRoot}.
	 */
	@interceptFileViewMethod('onunload', (original, thisMethod) => {
		return (...args) => {
			original(...args)
			thisMethod()
		}
	})
	onunload(): void {
		this.#unregisterOnWindowMigrated?.()
		this.fileView.contentEl.removeClass('tldraw-view-content')
		this.unmountReactRoot()
	}

	/**
	 * Intercepts the {@linkcode FileView.onLoadFile} method to add the ability to load the file and initialize the store.
	 * @returns
	 */
	@interceptFileViewMethod('onLoadFile', (original, thisMethod) => {
		return async (...args) => {
			await thisMethod(...args)
			return original(...args)
		}
	})
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
			this.isReadOnly()
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

	@interceptFileViewMethod('onUnloadFile', (original, thisMethod) => {
		return async (...args) => {
			await thisMethod()
			return original(...args)
		}
	})
	async onUnloadFile(): Promise<void> {
		const callbacks = [...this.#onUnloadCallbacks]
		this.#onUnloadCallbacks = []
		callbacks.forEach((e) => e())
	}

	public registerOnUnloadFile(cb: () => void) {
		this.#onUnloadCallbacks.push(cb)
	}

	@interceptFileViewMethod('setEphemeralState', (original, thisMethod) => {
		return (...args) => {
			original(...args)
			thisMethod(...args)
		}
	})
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
		return {
			components: {
				InFrontOfTheCanvas,
			},
			onEditorMount: (editor) => {
				const viewState = this.fileView.getEphemeralState()
				console.log(this.#deepLink)
				console.log({ viewState })
				if (this.#deepLink) {
					console.log(this.#deepLink)
					editor.navigateToDeepLink(this.#deepLink)
					return
				}
				return editor.zoomToFit()
			},
		}
	}

	private createReactRoot(entryPoint: Element, store: TldrawAppStoreProps) {
		return createRootAndRenderTldrawApp(entryPoint, this.plugin, {
			app: this.getTldrawOptions(),
			store,
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
		this.plugin.updateViewMode(VIEW_TYPE_MARKDOWN)
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
			console.log('unregisterViewAssetsActionCallback')
			this.#onUnloadCallbacks.remove(removeCb)
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
