import { Editor } from 'obsidian'
import { BoxLike } from 'tldraw'
import { InternalEmbedWidget } from './cm-view'

function parseAltText(altText: string): Partial<Record<string, string>> {
	const altSplit = altText.split(';').map((e) => e.trim())
	const altEntries = altSplit.map((e) => e.split('='))
	return Object.fromEntries(altEntries)
}

export function parseEmbedValues(
	el: HTMLElement,
	{
		showBgDefault,
		imageBounds = {
			pos: { x: 0, y: 0 },
			size: {
				w: Number.NaN,
				h: Number.NaN,
			},
		},
	}: {
		showBgDefault: boolean
		imageBounds?: {
			pos: { x: number; y: number }
			size: { w: number; h: number }
		}
	}
) {
	const alt = el.attributes.getNamedItem('alt')?.value ?? ''
	const altNamedProps = parseAltText(alt)

	const posValue = altNamedProps['pos']?.split(',').map((e) => Number.parseFloat(e)) ?? []
	const pos = { x: posValue.at(0) ?? imageBounds.pos.x, y: posValue.at(1) ?? imageBounds.pos.y }

	const sizeValue = altNamedProps['size']?.split(',').map((e) => Number.parseFloat(e)) ?? []
	const size = {
		w: sizeValue.at(0) ?? imageBounds.size.w,
		h: sizeValue.at(1) ?? imageBounds.size.h,
	}
	const bounds =
		Number.isNaN(pos.x) || Number.isNaN(pos.y) || Number.isNaN(size.w) || Number.isNaN(size.h)
			? undefined
			: { pos, size }
	const imageSize = {
		width: Number.parseFloat(el.attributes.getNamedItem('width')?.value ?? ''),
		height: Number.parseFloat(el.attributes.getNamedItem('height')?.value ?? ''),
	}

	const showBg = (() => {
		switch (altNamedProps['showBg']) {
			case 'true':
			case 'yes':
				return true
			case 'false':
			case 'no':
				return false
			default:
				return showBgDefault
		}
	})()

	const page = altNamedProps['page']

	return {
		bounds:
			bounds === undefined
				? undefined
				: {
						...bounds.pos,
						...bounds.size,
					},
		imageSize,
		showBg,
		page,
	}
}

function replaceBoundsProps(
	pageBounds: EmbedUpdate['pageBounds'],
	props: Partial<Record<string, string>>
) {
	const bounds = pageBounds?.bounds
	if (bounds) {
		props['page'] = pageBounds.page
		props['pos'] = `${bounds.x.toFixed(0)},${bounds.y.toFixed(0)}`
		props['size'] = `${bounds.w.toFixed(0)},${bounds.h.toFixed(0)}`
	} else {
		delete props['page']
		delete props['pos']
		delete props['size']
	}
	return props
}

export function updateEmbedBounds(
	widget: InternalEmbedWidget,
	pageBounds: EmbedUpdate['pageBounds'],
	editor: Editor
) {
	return updateEmbed(editor, widget, { pageBounds })
}

export function updateEmbed(editor: Editor, widget: InternalEmbedWidget, update: EmbedUpdate) {
	const token = editor.getClickableTokenAt(editor.offsetToPos(widget.end))

	if (!token || token.type !== 'internal-link') {
		console.warn(`No internal link token at end position ${widget.end}`, widget)
		return
	}

	if (widget.href !== token.text) {
		console.warn(`Internal link token does not match the provided widget`, {
			widget,
			token,
		})
		return
	}

	updateEmbedAtInternalLink(editor, token, update)
}

type InternalLinkToken = Extract<
	ReturnType<Editor['getClickableTokenAt']>,
	{
		type: 'internal-link'
	}
>

function formatDisplaySize(size: { width: number; height: number }) {
	if (Number.isNaN(size.width) && Number.isNaN(size.height)) return ''
	if (Number.isNaN(size.height)) return size.width.toFixed()
	const widthString = Number.isNaN(size.width) ? '0' : size.width.toFixed()
	return `${widthString}x${size.height.toFixed()}`
}

type EmbedUpdate = Partial<{
	pageBounds: {
		page: string
		bounds?: BoxLike
	}
	size: { width: number; height: number }
}>

export function updateEmbedLinkText(
	token: Pick<InternalLinkToken, 'displayText' | 'text'>,
	update: EmbedUpdate
) {
	const { size, pageBounds } = update
	const [altText, ...rest] = token.displayText.split('|')
	const restButSize = rest.splice(0, rest.length - 1)
	/**
	 * After the splice, rest should either contain only the size portion of the display text or no elements.
	 */
	const maybeOnlySize = rest
	const maybeSize =
		size === undefined && 'size' in update
			? undefined
			: (size ??
				/**
				 * If no string was in the size slot, return undefined. Otherwise,
				 *
				 * split the string by the `x` character and if the first string parses as NaN, then return the original string.
				 *
				 * If the first number was parsed as non-NaN then use it as the width, and parse the next number as the height regardless
				 * of the the next number parsing as NaN.
				 */
				(() => {
					const maybeSize = maybeOnlySize.at(0)
					if (!maybeSize) return undefined
					const sizeSplit = maybeSize.split('x')
					const width = Number.parseInt(sizeSplit.at(0) ?? '')
					if (Number.isNaN(width)) return maybeSize
					const height = Number.parseInt(sizeSplit.at(1) ?? '')
					return {
						width,
						height,
					}
				})())

	return [
		token.text,
		(() => {
			if (pageBounds === undefined && !('pageBounds' in update)) {
				return altText
			}
			const props = parseAltText(altText)
			return Object.entries(replaceBoundsProps(pageBounds, props))
				.filter(([key, value]) => key.length > 0 && value !== undefined)
				.map(([key, value]) => `${key}=${value}`)
				.join(';')
		})(),
		...restButSize,
		...(maybeSize === undefined
			? []
			: typeof maybeSize === 'string'
				? [maybeSize]
				: [formatDisplaySize(maybeSize)]),
	].join('|')
}

/**
 * Updates the internal link within the editor.
 */
function updateEmbedAtInternalLink(editor: Editor, token: InternalLinkToken, update: EmbedUpdate) {
	editor.replaceRange(updateEmbedLinkText(token, update), token.start, token.end)
	// NOTE: We do this in order to force an immediate update to the internalEmbedDiv, and allow the observer to update the TldrawMarkdownRenderChild component
	editor.setCursor(token.start)
}
