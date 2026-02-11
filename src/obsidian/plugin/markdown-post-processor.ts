import { MarkdownPostProcessorContext, TFile } from 'obsidian'
import TldrawPlugin from 'src/main'
import { ConsoleLogParams, logFn } from 'src/utils/logging'
import { createEmbedTldraw } from '../components/markdown-render-child'

/**
 * Processes the embed view for a tldraw white when including it in another obsidian note.
 * @param plugin
 * @param element
 * @param context
 * @returns
 */
export async function markdownPostProcessor(
	plugin: TldrawPlugin,
	element: HTMLElement,
	context: MarkdownPostProcessorContext
) {
	const log = (...args: ConsoleLogParams) => logFn(markdownPostProcessor, args[0], ...args.slice(1))
	MARKDOWN_POST_PROCESSING_LOGGING && log()

	// Inspired by: https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/94fbac38bfc5036187a81c7883c03830a622bc1d/src/MarkdownPostProcessor.ts#L575

	const file = plugin.app.vault.getAbstractFileByPath(context.sourcePath)

	if (!(file instanceof TFile)) return

	if (!plugin.hasTldrawFrontMatterKey(file)) {
		return
	}

	//@ts-ignore
	const containerEl: HTMLElement = context.containerEl

	const internalEmbedDiv: HTMLElement | undefined = (() => {
		let internalEmbedDiv: HTMLElement = containerEl

		while (
			!internalEmbedDiv.hasClass('print') &&
			!internalEmbedDiv.hasClass('dataview') &&
			!internalEmbedDiv.hasClass('cm-preview-code-block') &&
			!internalEmbedDiv.hasClass('cm-embed-block') &&
			!internalEmbedDiv.hasClass('internal-embed') &&
			!internalEmbedDiv.hasClass('markdown-reading-view') &&
			!internalEmbedDiv.hasClass('markdown-embed') &&
			internalEmbedDiv.parentElement
		) {
			internalEmbedDiv = internalEmbedDiv.parentElement
		}

		if (
			internalEmbedDiv.hasClass('dataview') ||
			internalEmbedDiv.hasClass('cm-preview-code-block') ||
			internalEmbedDiv.hasClass('cm-embed-block')
		) {
			return undefined
		}

		return internalEmbedDiv
	})()

	if (internalEmbedDiv === undefined) return //https://github.com/zsviczian/obsidian-excalidraw-plugin/issues/835

	const markdownEmbed = internalEmbedDiv.hasClass('markdown-embed')
	const markdownReadingView = internalEmbedDiv.hasClass('markdown-reading-view')
	const isMarkdownView = markdownEmbed || markdownReadingView
	const isInternal = internalEmbedDiv.hasClass('internal-embed')
	const isCanvas = internalEmbedDiv.hasClass('canvas-node-content')
	const isEmbed = isInternal || isCanvas
	if (isEmbed && isMarkdownView) {
		const codeblock = element.querySelector('code.language-json')

		if (!codeblock) {
			// log(`not tldraw json code block`);
			// log('element', internalEmbedDiv);
			// log('element', element);
			// log('context', context);
			if (element.parentElement === containerEl) {
				containerEl.removeChild(element)
			}
			return
		}

		MARKDOWN_POST_PROCESSING_LOGGING && log('tldraw json code block')
		MARKDOWN_POST_PROCESSING_LOGGING && log('element', internalEmbedDiv)
		MARKDOWN_POST_PROCESSING_LOGGING && log('element', element)
		MARKDOWN_POST_PROCESSING_LOGGING && log('context', context)

		internalEmbedDiv.empty()

		if (markdownEmbed) {
			internalEmbedDiv.removeClass('markdown-embed')
			internalEmbedDiv.removeClass('inline-embed')
			// TODO: Uncomment later when added prerendered tldraw view support.
			// internalEmbedDiv.addClass("media-embed");
			// internalEmbedDiv.addClass("image-embed");
		}

		const { component, preload } = createEmbedTldraw({
			file,
			internalEmbedDiv,
			plugin,
		})

		await preload()

		context.addChild(component)

		const awaitInitialLoad = () => component.awaitInitialLoad(2500).catch(errorLoading)
		const errorLoading = (e: unknown) => {
			// const errorDiv = internalEmbedDiv.createDiv();
			// errorDiv.createEl('p', {
			//     text: e instanceof Error ? e.message : 'Error'
			// });
			// new ButtonComponent(errorDiv).setButtonText('Reload').onClick(() => {
			//     errorDiv.remove();
			//     if (component.isContentLoaded()) return;
			//     component.unload();
			//     component.load();
			//     awaitInitialLoad();
			// });
		}

		return awaitInitialLoad()
	} else if (!isEmbed && isMarkdownView) {
		throw new Error(`${markdownPostProcessor.name}: Unexpected`)
	}
	throw new Error(`${markdownPostProcessor.name}: Unexpected`)
}
