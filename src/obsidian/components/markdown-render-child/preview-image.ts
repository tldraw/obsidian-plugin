import { TldrawAppStoreProps } from 'src/components/TldrawApp'
import { TldrawImageSnapshot } from 'src/components/TldrawImageSnapshotView'
import { Store } from 'tldraw'
import { ImageViewModeOptions } from '../../helpers/TldrawAppEmbedViewController'
import TLDataDocumentStoreManager from '../../plugin/TLDataDocumentStoreManager'

type Timeout = number

type Callback = () => void

export interface PreviewImage {
	get options(): ImageViewModeOptions
	/**
	 * This is used so that the image does not have to re-render the snapshot everytime.
	 *
	 * This should be set to undefined whenever the tldraw data changes.
	 */
	get rendered(): HTMLElement | undefined
	get size(): { width: number; height: number }
	/**
	 * Should only recompute the snapshot if the tldraw data has changed.
	 */
	get snapshot(): TldrawImageSnapshot | undefined
	setSizeCallback(cb: Callback): Callback
	setOptionsCallback(cb: Callback): Callback
	setSnapshotCallback(cb: Callback): Callback
	setPlaceHolderCallback(cb: Callback): Callback
}

type DocumentStoreInstance = ReturnType<TLDataDocumentStoreManager['register']>

interface SnapshotContext {
	getStoreInstance: () => DocumentStoreInstance | undefined
	/**
	 * Used to determine if the screen area where the image preview is located is visible to the user.
	 */
	isVisible: () => boolean
	/**
	 * Defer until the screen area where the image preview is located is visible to the user.
	 * @param cb The callback to invoke when the screen area where the image preview is located is visible to the user.
	 * @returns
	 */
	deferUntilIsShown: (cb: Callback) => Callback
}

function getEditorStoreProps(storeProps: TldrawAppStoreProps) {
	return storeProps.tldraw
		? storeProps.tldraw
		: {
				store: storeProps.plugin.store,
			}
}

type PreviewImageInit = {
	/**
	 * The number of milliseconds to use as the timeout delay for {@linkcode refreshTimeout}
	 */
	refreshTimeoutDelay?: number
	options: PreviewImage['options']
	size: PreviewImage['size']
}

export default class PreviewImageImpl implements PreviewImage {
	#context: SnapshotContext
	/**
	 * The observer that observes changes to the img src attribute.
	 */
	#observer?: MutationObserver
	#placeHolderSizeInterval?: Timer
	#snapshot?: TldrawImageSnapshot
	#rendered?: HTMLElement
	#size: PreviewImageInit['size']
	#options: PreviewImageInit['options']
	/**
	 * The timeout that is used to update the preview.
	 */
	#refreshTimeout?: Timer
	#refreshTimeoutDelay?: PreviewImageInit['refreshTimeoutDelay']
	#placeHolderCallback?: Callback

	#callbacks: {
		snapshot?: Callback
		options?: Callback
		size?: Callback
		placeHolder?: Callback
		/**
		 * Call this to cancel the triggered snapshot callback when the workspace leaf is reshown.
		 */
		cancelDeferredSnapshotCallback?: Callback
	} = {}

	constructor({ size, options, refreshTimeoutDelay }: PreviewImageInit, context: SnapshotContext) {
		this.#context = context
		this.#size = size
		this.#options = options
		this.#refreshTimeoutDelay = refreshTimeoutDelay
	}

	get options() {
		return this.#options
	}

	get rendered() {
		return this.#rendered
	}

	get size() {
		return this.#size
	}

	/**
	 * @returns A lazily computed snapshot.
	 */
	get snapshot() {
		return (this.#snapshot ??= (() => {
			const storeInstance = this.#context.getStoreInstance()
			const storeProps = !storeInstance
				? undefined
				: getEditorStoreProps({ plugin: storeInstance.documentStore })
			return !storeProps
				? undefined
				: !storeProps.store
					? storeProps.snapshot
					: storeProps.store instanceof Store
						? storeProps.store.getStoreSnapshot()
						: storeProps.store.store?.getStoreSnapshot()
		})())
	}

	setOptionsCallback(cb: Callback) {
		this.#callbacks.options = cb
		return () => {
			if (this.#callbacks.options === cb) {
				this.#callbacks.options = undefined
			}
		}
	}

	setSnapshotCallback(cb: Callback) {
		this.#callbacks.snapshot = cb
		return () => {
			if (this.#callbacks.snapshot === cb) {
				this.#callbacks.snapshot = undefined
			}
		}
	}

	setSizeCallback(cb: Callback) {
		this.#callbacks.size = cb
		return () => {
			if (this.#callbacks.size === cb) {
				this.#callbacks.size = undefined
			}
		}
	}

	setPlaceHolderCallback(cb: Callback) {
		this.#callbacks.placeHolder = cb
		return () => {
			if (this.#callbacks.placeHolder === cb) {
				this.#callbacks.placeHolder = undefined
			}
		}
	}

	clearRefreshTimeout() {
		clearTimeout(this.#refreshTimeout)
		this.#refreshTimeout = undefined
	}

	markSnapshotStale() {
		this.#rendered = undefined
		this.#snapshot = undefined
		this.triggerSnapshotCallback()
	}

	/**
	 * Refreshes the preview image if within the .
	 *
	 * This will set the {@linkcode rendered} property to `undefined` and trigger the snapshot callback.
	 *
	 * If `options` is provided, it will update the {@linkcode options} property.
	 */
	refreshPreview(options?: ImageViewModeOptions) {
		clearTimeout(this.#refreshTimeout)
		this.#refreshTimeout = setTimeout(() => {
			if (options) {
				this.#options = options
			}
			// this.#currentPage = this.options.pageId;
			this.#rendered = undefined
			this.#placeHolderCallback?.()
			this.#callbacks.options?.()
		}, this.#refreshTimeoutDelay)
	}

	setOptions(options: ImageViewModeOptions) {
		this.#options = options
		this.refreshPreview()
	}

	setSize(size: { width: number; height: number }) {
		this.#size = size
		this.#callbacks.size?.()
	}

	/**
	 * The purpose of this method is to only notify "snapshot observers" that an image should be rendered when the
	 * workspace leaf is visible to the user.
	 *
	 * - If a "deferred snapshot" was already triggered, then cancel it.
	 * - If the workspace leaf where the image preview is located is shown, then invoke the "snapshot callback"
	 * - , else: defer triggering the snapshot callback until the workspace leaf is shown.
	 */
	triggerSnapshotCallback() {
		this.#callbacks.cancelDeferredSnapshotCallback?.()
		this.#callbacks.cancelDeferredSnapshotCallback = undefined
		if (this.#context.isVisible()) {
			this.#callbacks.snapshot?.()
		} else {
			this.#callbacks.cancelDeferredSnapshotCallback = this.#context.deferUntilIsShown(() =>
				this.triggerSnapshotCallback()
			)
		}
	}

	observePreviewImage(containerEl: HTMLElement, onSize: (rect: DOMRect) => void) {
		this.#observer?.disconnect()
		this.#observer = PreviewImageImpl.srcMutationObserver(containerEl, (_, tlContainer) => {
			this.#rendered = tlContainer
		})

		// TODO: Replace this with something that does not poll the bounding rect
		// https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver/ResizeObserver
		clearInterval(this.#placeHolderSizeInterval)
		this.#placeHolderSizeInterval = setInterval(() => {
			onSize(containerEl.getBoundingClientRect())
		}, 100)
	}

	observePreviewImageDisconnect() {
		this.#observer?.disconnect()
		this.#observer = undefined
		clearInterval(this.#placeHolderSizeInterval)
		this.#placeHolderSizeInterval = undefined
	}

	/**
	 * Creates a {@linkcode MutationObserver} that observes the `src` attribute of the target image element that
	 * contains the rendered tldrawing.
	 */
	static srcMutationObserver(
		containerEl: HTMLElement,
		cb: (el: HTMLImageElement, tlContainer: HTMLElement) => void
	) {
		const mutationObserver = new MutationObserver((m) => {
			for (const mutation of m) {
				if (mutation.target.instanceOf(HTMLElement)) {
					if (
						mutation.type === 'attributes' &&
						mutation.target.instanceOf(HTMLImageElement) &&
						mutation.target.hasAttribute('src') &&
						mutation.target.parentElement !== null &&
						mutation.target.parentElement.hasClass('tl-container')
					) {
						cb(mutation.target, mutation.target.parentElement)
					}
				}
			}
		})

		mutationObserver.observe(containerEl, {
			childList: true,
			subtree: true,
			attributeFilter: ['src'],
		})

		return mutationObserver
	}
}
