import { Editor } from 'obsidian'

export type InternalEmbedWidget = {
	start: number
	end: number
	/**
	 * The filename of the embed
	 */
	href: string
	/**
	 * This is corresponds to the "alt", "width", and "height" attribute of the internaleEmbedDiv.
	 *
	 * ```js
	 * `${alt}|${width}x${height}`
	 * ```
	 */
	title: string
	editor: {
		editor: Editor
	}
}

export function getCmViewWidget(element: HTMLElement) {
	if (
		'cmView' in element &&
		typeof element.cmView === 'object' &&
		element.cmView &&
		'widget' in element.cmView &&
		typeof element.cmView.widget === 'object' &&
		element.cmView.widget &&
		'editor' in element.cmView.widget &&
		typeof element.cmView.widget.editor === 'object' &&
		element.cmView.widget.editor &&
		'editor' in element.cmView.widget.editor &&
		element.cmView.widget.editor.editor instanceof Editor
	) {
		return element.cmView.widget as InternalEmbedWidget
	}
	return undefined
}
