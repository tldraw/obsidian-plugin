import { BlockCache } from 'obsidian'
import { Notifier } from 'src/lib/notifier'
import { createTrigger } from 'src/lib/trigger'
import { LOGGING_ENABLED } from 'src/utils/logging'

interface BaseDocumentMessage<T extends string = string> {
	type: T
	dismiss(): void
}

interface BaseAssetBlockRefError<T extends string> {
	message: T
	item?: BlockCache
	link?: string
}

interface AssetBlockRefNotFound extends BaseAssetBlockRefError<'notFound'> {
	item?: undefined
}

interface AssetBlockRefNotALink extends BaseAssetBlockRefError<'notALink'> {
	item: BlockCache
}

interface AssetBlockRefUnknownFile extends BaseAssetBlockRefError<'unknownFile'> {
	item: BlockCache
	link: string
}

interface AssetBlockRefLoadingError extends BaseAssetBlockRefError<'errorLoading'> {
	item: BlockCache
	link: string
	error: unknown
}

type AssetBlockRefErrorState =
	| AssetBlockRefNotFound
	| AssetBlockRefNotALink
	| AssetBlockRefUnknownFile
	| AssetBlockRefLoadingError

interface BlockRefErrorState {
	blockId: string
	asset?: AssetBlockRefErrorState
}

interface BlockRefErrorDocumentMessage extends BaseDocumentMessage<'blockRefError'> {
	state: BlockRefErrorState
}

export type DocumentMessage = BlockRefErrorDocumentMessage

class BlockRefErrors {
	readonly #notifier = new Notifier()
	readonly #stateMap = new Map<string, BlockRefErrorState>()

	#hasErrors(state: BlockRefErrorState) {
		return Boolean(state.asset)
	}

	#isSameAssetError(a: BlockRefErrorState['asset'], b: AssetBlockRefErrorState) {
		if (a?.message !== b.message) {
			return false
		}
		switch (b.message) {
			case 'notFound':
				return true
			case 'notALink':
				return a.item === b.item
			case 'unknownFile':
			case 'errorLoading':
				// return a.link === b.link
				return a.link === b.link
		}
	}

	setAssetError<T extends AssetBlockRefErrorState>(
		blockRefError: BlockRefErrorState & { asset: T }
	) {
		let blockRefState = this.#stateMap.get(blockRefError.blockId)
		let shouldNotify = false
		if (!blockRefState) {
			this.#stateMap.set(
				blockRefError.blockId,
				(blockRefState = {
					blockId: blockRefError.blockId,
				})
			)
		}

		const prev = blockRefState.asset
		const next = blockRefError.asset

		if (!this.#isSameAssetError(prev, next)) {
			shouldNotify = true
		} else {
			LOGGING_ENABLED &&
				console.info('Same asset error; skipping notifying', {
					a: prev,
					b: next,
				})
		}

		blockRefState.asset = next

		if (shouldNotify) {
			this.#notifier.notifyListeners()
		}

		return {
			id: blockRefError.blockId,
			shouldNotify,
			prev,
			next,
		}
	}

	getCount() {
		let count = 0

		for (const e of this.#stateMap.values()) {
			if (e.asset) count++
		}

		return count
	}

	getAll() {
		return [...this.#stateMap.values()]
	}

	removeAssetError(blockId: string) {
		const state = this.#stateMap.get(blockId)

		if (!state?.asset) return

		delete state.asset

		if (!this.#hasErrors(state)) {
			this.#stateMap.delete(blockId)
		}

		this.#notifier.notifyListeners()
	}

	addListener(listener: () => void): () => void {
		return this.#notifier.addListener(listener)
	}

	clearAll() {
		for (const blockId of this.#stateMap.keys()) {
			this.removeAssetError(blockId)
		}
	}
}

export default class TLDataDocumentMessages {
	readonly #notifier = new Notifier()
	readonly #blockRefErrors = new BlockRefErrors()
	readonly #counts = {
		blockRefErrors: 0,
	}

	readonly triggers = {
		blockRef: {
			asset: {
				/**
				 * The block ref was not found
				 */
				notFound: createTrigger((id: string) => {
					return this.#blockRefErrors.setAssetError({
						blockId: id,
						asset: {
							message: 'notFound',
						},
					})
				}),
				notALink: createTrigger((block: BlockCache) => {
					return this.#blockRefErrors.setAssetError({
						blockId: block.id,
						asset: {
							message: 'notALink',
							item: block,
						},
					})
				}),
				unknownFile: createTrigger((block: BlockCache, link: string) => {
					return this.#blockRefErrors.setAssetError({
						blockId: block.id,
						asset: {
							message: 'unknownFile',
							item: block,
							link,
						},
					})
				}),
				errorLoading: createTrigger((block: BlockCache, link: string, error: unknown) => {
					return this.#blockRefErrors.setAssetError({
						blockId: block.id,
						asset: {
							message: 'errorLoading',
							item: block,
							link,
							error,
						},
					})
				}),
				/**
				 * The asset was loaded into the document
				 */
				loaded: createTrigger((block: BlockCache) => {
					this.#blockRefErrors.removeAssetError(block.id)
					return block
				}),
				/**
				 * The asset was deleted from the document
				 */
				deleted: createTrigger((id: string) => {
					this.#blockRefErrors.removeAssetError(id)
					return id
				}),
			},
		},
	}

	constructor() {
		this.#blockRefErrors.addListener(() => {
			this.#counts.blockRefErrors = this.#blockRefErrors.getCount()
			this.#notifier.notifyListeners()
		})
	}

	getErrorCount() {
		return this.#counts.blockRefErrors
	}

	/**
	 * Add a listener that is called when the messages are changed.
	 * @param listener
	 * @returns A callback to unregister the listener.
	 */
	addListener(listener: () => void): () => void {
		return this.#notifier.addListener(listener)
	}

	getTriggers() {
		return this.triggers
	}

	getBlockRefError(): DocumentMessage[] {
		return this.#blockRefErrors.getAll().map((e) => {
			return {
				type: 'blockRefError',
				state: e,
				dismiss: () => {
					this.#blockRefErrors.removeAssetError(e.blockId)
				},
			}
		})
	}

	removeAll() {
		this.#blockRefErrors.clearAll()
	}
}
