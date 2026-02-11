import { Menu, MenuItem } from 'obsidian'
import { MARKDOWN_ICON_NAME, PaneTarget, ViewType } from 'src/utils/constants'
import { PTLEditorBlockBlur } from 'src/utils/dom-attributes'
import { BoxLike } from 'tldraw'
import { pluginMenuLabel } from '.'
import { TldrawAppViewModeController } from '../helpers/TldrawAppEmbedViewController'

export type TldrAppControllerForMenu = Pick<
	TldrawAppViewModeController,
	'getViewMode' | 'toggleInteractive' | 'toggleBackground' | 'getViewOptions'
> & {
	enableEditing: () => void
}

function background(menuItem: MenuItem, controller: TldrAppControllerForMenu) {
	return menuItem
		.setTitle('Show background')
		.setChecked(controller.getViewOptions().background ?? null)
}

function interactiveMode(menuItem: MenuItem, controller: TldrAppControllerForMenu) {
	return menuItem
		.setTitle('Interactive Mode')
		.setIcon('hand')
		.setChecked(controller.getViewMode() === 'interactive')
}

function openMdNewTab(menuItem: MenuItem) {
	return menuItem.setIcon(MARKDOWN_ICON_NAME).setTitle('Open as markdown (new tab)')
}

function editInteractive(menuItem: MenuItem) {
	return menuItem.setIcon('pencil').setTitle('Edit drawing (interactive)')
}

function editNewTab(menuItem: MenuItem) {
	return menuItem.setIcon('pencil').setTitle('Edit drawing (new tab)')
}

function readOnlyNewTab(menuItem: MenuItem) {
	return menuItem.setIcon('eye').setTitle('Read-only view (new tab)')
}

function boundsText(bounds: BoxLike) {
	const { w, h, x, y } = bounds
	return `size=${w.toFixed(0)},${h.toFixed(0)};pos=${x.toFixed(0)},${y.toFixed(0)}`
}

class EmbedTldrawMenu extends Menu {
	constructor() {
		super()
		// Clicking within the menu element shouldn't blur the editor.
		PTLEditorBlockBlur.blockBlurOnElement(this.dom)
	}
}

export function createEmbedMenu({
	controller,
	selectEmbedLinkText,
	title,
	openFile,
}: {
	controller: TldrAppControllerForMenu
	selectEmbedLinkText: (ev: MouseEvent) => void
	title: string
	openFile: (location: PaneTarget, viewType: ViewType) => void
}) {
	const bounds = controller.getViewOptions().bounds
	return new EmbedTldrawMenu()
		.addItem((item) =>
			pluginMenuLabel(item, {
				title,
			})
		)
		.addItem((item) =>
			background(item, controller).onClick(() => {
				controller.toggleBackground()
				background(item, controller)
			})
		)
		.addItem((item) =>
			interactiveMode(item, controller).onClick(() => {
				controller.toggleInteractive()
				interactiveMode(item, controller)
			})
		)
		.addItem((item) => editInteractive(item).onClick(() => controller.enableEditing()))
		.addItem((item) =>
			item.setTitle('Select embed link text').setIcon('text-cursor').onClick(selectEmbedLinkText)
		)
		.addSeparator()
		.addItem((item) =>
			openMdNewTab(item).onClick(() => {
				openFile('new-tab', 'markdown')
			})
		)
		.addItem((item) =>
			editNewTab(item).onClick(() => {
				openFile('new-tab', 'tldraw-view')
			})
		)
		.addItem((item) => readOnlyNewTab(item).onClick(() => openFile('new-tab', 'tldraw-read-only')))
		.addSeparator()
		.addItem((item) =>
			item
				.setIsLabel(true)
				.setIcon('info')
				.setTitle(`Bounds: ${bounds ? boundsText(bounds) : '[No bounds set]'}`)
		)
		.addItem((item) =>
			item
				.setIcon('frame')
				.setTitle('Copy bounds')
				.setDisabled(bounds === undefined)
				.onClick(() => {
					if (bounds) {
						window.navigator.clipboard.writeText(boundsText(bounds))
					}
				})
		)
}
