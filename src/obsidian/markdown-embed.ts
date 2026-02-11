import { getCmViewWidget } from 'src/obsidian/helpers/cm-view'
import { parseEmbedValues, updateEmbed, updateEmbedBounds } from 'src/obsidian/helpers/embeds'
import toPageId from 'src/tldraw/helpers/string-to-page-id'
import { logClass } from 'src/utils/logging'
import { BoxLike, TLDeepLink } from 'tldraw'

interface WorkspaceLeafIsShownCallback {
	(isShown: boolean, workspaceLeafEl: HTMLElement, ...args: Parameters<MutationCallback>): void
}

interface ObserveEmbedValuesCallback {
	(values: ReturnType<typeof parseEmbedValues>, ...args: Parameters<MutationCallback>): void
}

export class MarkdownEmbed {
	constructor(
		/**
		 * The element corresponding to the markdown embed.
		 */
		public readonly containerEl: HTMLElement
	) {}

	/**
	 * When the page is printing to pdf, then this does not exist.
	 */
	get workspaceLeafEl() {
		const element = this.containerEl.closest('.workspace-leaf')
		if (!element?.instanceOf(HTMLElement)) return null
		return element
	}

	getUpdater() {
		const widget = getCmViewWidget(this.containerEl)
		if (!widget) {
			return
		}
		return {
			updateBounds: (page: string, bounds: BoxLike | undefined) => {
				logClass(MarkdownEmbed, this.getUpdater, 'updateBounds', { page, bounds })
				updateEmbedBounds(widget, { page, bounds }, widget.editor.editor)
			},
			updateSize: (size: { width: number; height: number }) =>
				updateEmbed(widget.editor.editor, widget, { size }),
		}
	}

	isWorkspaceLeafShown() {
		const workspaceLeafEl = this.workspaceLeafEl
		if (workspaceLeafEl?.instanceOf(HTMLElement)) return workspaceLeafEl.isShown()
		return false
	}

	/**
	 *
	 * @returns A callback to disconnect from the observer.
	 */
	observeEmbedValues(cb: ObserveEmbedValuesCallback, getShowBgDefault: () => boolean) {
		const containerEl = this.containerEl
		const parent = containerEl.parentElement
		if (!parent) {
			console.warn("containerEl's parentElement is null")
			return
		}

		const observer = new MutationObserver((m, observer) => {
			const { target, attributeName } = m[0]
			if (
				!(target === containerEl) ||
				!(['alt', 'width', 'height'] as (string | null)[]).contains(attributeName)
			) {
				return
			}
			cb(this.parseEmbedValues(getShowBgDefault()), m, observer)
		})
		observer.observe(containerEl, { attributes: true })

		return () => observer.disconnect()
	}

	/**
	 *
	 * @returns A callback to disconnect from the observer.
	 */
	observeWorkspaceLeafIsShown(cb: WorkspaceLeafIsShownCallback) {
		const workspaceLeafEl = this.workspaceLeafEl
		if (!workspaceLeafEl?.instanceOf(HTMLElement)) {
			console.warn('containerEl is not a descendant of a workspace leaf')
			return
		}

		/**
		 * This observer is interested in the style attribute of the workspace leaf element since it includes
		 * display: none; whenever the leaf is behind a tab.
		 */
		const observer = new MutationObserver((...args) =>
			cb(workspaceLeafEl.isShown(), workspaceLeafEl, ...args)
		)
		observer.observe(workspaceLeafEl, { attributeFilter: ['style'] })

		return () => observer.disconnect()
	}

	parseEmbedValues(showBgDefault: boolean) {
		return parseEmbedValues(this.containerEl, { showBgDefault })
	}

	getEditorWidget() {
		return getCmViewWidget(this.containerEl)
	}

	getDeepLink(): TLDeepLink | undefined {
		const { bounds, page } = this.parseEmbedValues(
			// This value does not matter, we just want the destructured values from the return
			false
		)

		const pageId = toPageId(page)

		if (bounds) {
			return {
				type: 'viewport',
				pageId,
				bounds,
			}
		}

		if (pageId) {
			return {
				type: 'page',
				pageId,
			}
		}
	}
}
