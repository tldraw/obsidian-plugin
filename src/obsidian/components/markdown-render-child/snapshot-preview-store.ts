import {
	SnapshotPreviewSyncStore,
	TldrawImageSnapshot,
} from 'src/components/TldrawImageSnapshotView'
import { ImageViewModeOptions } from '../../helpers/TldrawAppEmbedViewController'
import { PreviewImage } from './preview-image'

type Callback = () => void

export default class SnapshotPreviewSyncStoreImpl implements SnapshotPreviewSyncStore {
	#previewImage: PreviewImage

	constructor(previewImage: PreviewImage) {
		this.#previewImage = previewImage

		// Bind methods to ensure they have the correct context when called
		this.getSnapshot = this.getSnapshot.bind(this)
		this.onSnapshot = this.onSnapshot.bind(this)
		this.getPreviewOptions = this.getPreviewOptions.bind(this)
		this.onPreviewOptions = this.onPreviewOptions.bind(this)
		this.getPreviewSize = this.getPreviewSize.bind(this)
		this.onPreviewSize = this.onPreviewSize.bind(this)
		this.getPlaceHolder = this.getPlaceHolder.bind(this)
		this.syncPlaceHolder = this.syncPlaceHolder.bind(this)
	}

	getSnapshot(): undefined | TldrawImageSnapshot {
		return this.#previewImage.snapshot
	}

	onSnapshot(cb: Callback): Callback {
		return this.#previewImage.setSnapshotCallback(cb)
	}

	getPreviewOptions(): ImageViewModeOptions {
		return this.#previewImage.options
	}

	onPreviewOptions(cb: Callback): Callback {
		return this.#previewImage.setOptionsCallback(cb)
	}

	getPreviewSize(): undefined | { width: number; height: number } {
		return this.#previewImage.size
	}

	onPreviewSize(cb: Callback): Callback {
		return this.#previewImage.setSizeCallback(cb)
	}

	getPlaceHolder(): HTMLElement | undefined {
		return this.#previewImage.rendered
	}

	syncPlaceHolder(cb: Callback): Callback {
		return this.#previewImage.setPlaceHolderCallback(cb)
	}
}
