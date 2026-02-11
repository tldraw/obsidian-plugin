import { AbstractInputSuggest, App, Notice, TFile } from 'obsidian'
import React, { ReactPortal, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useObsidian } from 'src/contexts/plugin'
import { vaultFileToBlob } from 'src/obsidian/helpers/vault'
import { ObsidianTLAssetStore } from 'src/tldraw/asset-store'
import { createDataUrlImageAssetFromBlob } from 'src/tldraw/helpers/create-asset'
import { PTLEditorBlockBlur } from 'src/utils/dom-attributes'
import {
	DEFAULT_SUPPORTED_IMAGE_TYPES,
	TLTextShape,
	richTextValidator,
	track,
	useEditor,
} from 'tldraw'

const imageExtenstions = [
	...DEFAULT_SUPPORTED_IMAGE_TYPES.map((e) => e.split('/')[1]),
	// Define variants
	'jpg',
	'svg',
] as const

function shouldShowSuggestions(suggestionTextShape: TLTextShape) {
	// For now, only allow suggestions if the content contains only a paragraph in the rich text
	const maybeParagraphForSuggestions = suggestionTextShape.props.richText.content.at(0)
	if (
		!maybeParagraphForSuggestions ||
		!richTextValidator.allowUnknownProperties().isValid(maybeParagraphForSuggestions) ||
		maybeParagraphForSuggestions.type !== 'paragraph'
	)
		return

	// Check if the first content is text content
	const maybeTextForSuggestions = maybeParagraphForSuggestions.content.at(0)
	if (
		typeof maybeTextForSuggestions !== 'object' ||
		!maybeTextForSuggestions ||
		!('type' in maybeTextForSuggestions) ||
		maybeTextForSuggestions.type !== 'text' ||
		!('text' in maybeTextForSuggestions) ||
		typeof maybeTextForSuggestions.text !== 'string'
	)
		return

	return Boolean(maybeTextForSuggestions.text)
}

/**
 * Leverages Obsidian API's {@linkcode AbstractInputSuggest} to display suggestions when typing into a text shape.
 */
const TextSuggestions = track(() => {
	const editor = useEditor()
	const app = useObsidian()
	const inputSuggestRef = useRef<TldrawTipTapInputSuggest>()
	const [portals, setPortals] = useState<ReactPortal[]>([])

	const editingShapeId = editor.getEditingShapeId()

	useEffect(() => {
		const removeSideEffectCb = editor.sideEffects.registerAfterChangeHandler(
			'shape',
			(_, next, source) => {
				// Ensure it is a shape edited by the user
				if (source !== 'user' || next.type !== 'text') return
				// Double check it is the shape a user is currently editing
				const editingShape = editor.getEditingShape()
				if (editingShape?.id !== editingShapeId || next.id !== editingShape.id) return

				const tipTap = editor.getRichTextEditor()

				if (!tipTap || tipTap.view.dom !== inputSuggestRef.current?.contentEditable) {
					inputSuggestRef.current?.close()
					inputSuggestRef.current = undefined
				}

				if (!shouldShowSuggestions(next as TLTextShape)) return

				const inputSuggest =
					!tipTap ||
					// To satisfy Obsidian API type definition we check the instance type.
					!tipTap.view.dom.instanceOf(HTMLDivElement)
						? undefined
						: (inputSuggestRef.current ??=
								// We assume user is actually entering text at this point
								new TldrawTipTapInputSuggest(app, tipTap.view.dom))

				if (!inputSuggest) return

				let portals: ReactPortal[] = []

				inputSuggest.setOnRendered(() => {
					setPortals(portals)
					// Reset the variable to a new array just in case the render function is called twice in the same react loop.
					portals = []
				})

				inputSuggest.setRenderSuggestion((value, el) => {
					const portal = createPortal(
						value.type === 'embed' ? <>{value.value.path}</> : <>Unsupported suggestion</>,
						el,
						value.getKey()
					)

					portals.push(portal)
				})

				inputSuggest.onSelect(async (value, evt) => {
					// We explicitly close since there seems to be some delay closing after this callback if we don't.
					inputSuggest.close()
					const assets = editor.store.props.assets

					if (value.type !== 'embed') {
						new Notice('Invalid suggestion selection')
						return
					}

					const tFile = value.value

					try {
						const asset = !(assets instanceof ObsidianTLAssetStore)
							? await createDataUrlImageAssetFromBlob(await vaultFileToBlob(tFile), {
									name: tFile.name,
								})
							: // We "upload" the asset to the markdown file by creating a new link block referencing the selected file, and link a block ref to it.
								await assets.proxy.createImageAsset(tFile, {
									immediatelyCache: true,
								})

						// Replace the text shape with the asset
						editor.run(() => {
							editor.markHistoryStoppingPoint('text-popover-suggestion-replace')
							editor.deleteShape(editingShapeId)
							editor.createAssets([asset])
							editor.createShape({
								type: 'image',
								x: editingShape.x,
								y: editingShape.y,
								props: {
									assetId: asset.id,
									w: asset.props.w,
									h: asset.props.h,
								},
							})
						})
					} catch (e) {
						console.error(e)
						new Notice(`Unable to replace text with asset: ${e}`)
					}
				})
			}
		)
		return () => {
			removeSideEffectCb()
		}
	}, [editor, editingShapeId])

	const bounds = editor.getViewportPageBounds()

	useEffect(() => {
		// Whenever the page bounds change, we always want to repostion the popover ref so that it moves with the user input.
		bounds
		inputSuggestRef.current?.autoReposition()
	}, [bounds])

	return <>{portals}</>
})

interface InputSuggestionValueType<Type extends string, Value = unknown> {
	type: Type
	value: Value
	getKey: () => string
}

interface EmbedInputSuggestion extends InputSuggestionValueType<'embed', TFile> {}

type InputSuggestionValue = EmbedInputSuggestion

/**
 * Matches text inside `![[` and (optionally) between `]]` while taking into consideration the invalid characters mention in https://help.obsidian.md/links#Supported+formats+for+internal+links.
 *
 * Captures the text into a named group called `content`.
 */
const embedMatcher = /^!\[\[(?<content>[^^|:%[\]]*?)(?:\]{1,2})?$/

class TldrawTipTapInputSuggest extends AbstractInputSuggest<InputSuggestionValue> {
	#onRenderedCb?: () => void
	#renderSuggestionCb?: (value: InputSuggestionValue, el: HTMLElement) => void

	constructor(
		app: App,
		public readonly contentEditable: HTMLDivElement
	) {
		super(app, contentEditable)

		/**
		 * We don't want the tldraw editor to blur when a suggestion item is clicked on,
		 * since it will cause the tiptap editor to be destroyed (and thus the popover will disappear before the item's click listener is activated).
		 */
		PTLEditorBlockBlur.blockBlurOnElement(this.suggestEl)
	}

	setValue(value: string): void {
		// We don't ever need to set the value in our case, so disable it just in case.
	}

	protected getSuggestions(text: string): InputSuggestionValue[] | Promise<InputSuggestionValue[]> {
		const embedMatch = embedMatcher.exec(text)
		if (!embedMatch) return []

		const content = embedMatch.groups?.['content'] ?? ''

		return this.app.vault
			.getFiles()
			.filter(
				(file) =>
					file.path.contains(content) && imageExtenstions.some((ee) => ee === file.extension)
			)
			.map((e) => ({
				type: 'embed',
				value: e,
				getKey: () => e.path,
			}))
	}

	renderSuggestion(value: InputSuggestionValue, el: HTMLElement): void {
		this.#renderSuggestionCb?.(value, el)
	}

	setOnRendered(cb: () => void) {
		this.#onRenderedCb = cb
	}

	setRenderSuggestion(cb: (value: InputSuggestionValue, el: HTMLElement) => void) {
		this.#renderSuggestionCb = cb
	}

	override showSuggestions(values: InputSuggestionValue[]) {
		super.showSuggestions(values)
		this.#onRenderedCb?.()
	}

	override autoReposition(): void {
		if (!this.lastRect) return
		super.autoReposition()
	}
}

export default TextSuggestions
