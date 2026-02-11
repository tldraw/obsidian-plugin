import { BlockCache, MarkdownView, Notice, TFile } from 'obsidian'
import TldrawPlugin from 'src/main'
import { VIEW_TYPE_MARKDOWN } from 'src/utils/constants'

export async function navigateToBlockCache(
	plugin: TldrawPlugin,
	tFile: TFile,
	blockCache: BlockCache
) {
	const leaf = await plugin.openTldrFile(tFile, 'new-tab', VIEW_TYPE_MARKDOWN)
	if (leaf.view instanceof MarkdownView) {
		leaf.view.editor.focus()
		leaf.view.editor.scrollIntoView(
			{
				from: leaf.view.editor.offsetToPos(blockCache.position.start.offset),
				to: leaf.view.editor.offsetToPos(blockCache.position.end.offset),
			},
			true
		)
		leaf.view.editor.setSelection(
			leaf.view.editor.offsetToPos(blockCache.position.start.offset),
			leaf.view.editor.offsetToPos(blockCache.position.end.offset)
		)
	} else {
		new Notice('Cannot navigate to block in this view.')
	}
	return leaf
}
