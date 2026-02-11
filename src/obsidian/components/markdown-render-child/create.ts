import { TFile } from 'obsidian'
import TldrawPlugin from 'src/main'
import { MarkdownEmbed } from 'src/obsidian/markdown-embed'
import { TldrawMarkdownRenderChild } from './tldraw-markdown-render-child'

export default function createEmbedTldraw({
	file,
	internalEmbedDiv,
	plugin,
}: {
	file: TFile
	internalEmbedDiv: HTMLElement
	plugin: TldrawPlugin
}) {
	const component = new TldrawMarkdownRenderChild(new MarkdownEmbed(internalEmbedDiv), plugin, {
		tFile: file,
		refreshTimeoutDelay: 500,
	})

	return {
		component,
		preload: () => component.loadRoot(),
	}
}
