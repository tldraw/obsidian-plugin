import { TFile } from 'obsidian'
import TldrawPlugin from 'src/plugin/TldrawPlugin'
import { InternalEmbedWidget } from 'src/obsidian/helpers/cm-view'
import { updateEmbedLinkText } from 'src/plugin/embed/embeds'
import { MarkdownEmbed } from 'src/plugin/embed/markdown-embed'
import { TLDeepLinkOptions } from 'tldraw'

export default function deepLinkListener(
	plugin: TldrawPlugin,
	tFile: TFile,
	embed: MarkdownEmbed
): TLDeepLinkOptions {
	const getInternalLinkToken = (widget: InternalEmbedWidget | undefined) => {
		const internalLinkToken = (() => {
			if (!widget) return
			const editor = widget?.editor.editor
			const token = editor?.getClickableTokenAt(editor.offsetToPos(widget?.end))
			return !token || token.type !== 'internal-link' ? undefined : token
		})()
		return internalLinkToken
	}
	return {
		onChange(url, editor) {
			const cmViewWidget = embed.getEditorWidget()
			const pageId = editor.getCurrentPageId()
			const internalLinkToken = getInternalLinkToken(cmViewWidget)
			updateEmbedLinkText(
				internalLinkToken ?? {
					// TODO: Utilize the parent document source path to resolve to a possibly shorter link text
					// text: plugin.app.metadataCache.fileToLinktext(tFile, parentDocumentSource)
					text: tFile.path,
					displayText: '',
				},
				{
					pageBounds: {
						// We remove the prefix `page:` from PageId before using it to update the embed link text
						page: pageId.substring(5),
						bounds: editor.getViewportPageBounds(),
					},
				}
			)
		},
	}
}
