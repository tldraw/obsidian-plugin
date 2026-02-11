import TldrawPlugin from 'src/main'
import { createEmbedMenu, TldrAppControllerForMenu } from '../menu/create-embed-menu'

export function showEmbedContextMenu(
	ev: MouseEvent | TouchEvent,
	{
		title,
		controller,
		focusContainer,
		openFile,
	}: {
		title: string
		plugin: TldrawPlugin
		controller: TldrAppControllerForMenu
		focusContainer: HTMLElement
		openFile: Parameters<typeof createEmbedMenu>[0]['openFile']
	}
) {
	createEmbedMenu({
		title,
		controller,
		selectEmbedLinkText: (ev) => {
			focusContainer.dispatchEvent(
				new MouseEvent('click', {
					bubbles: ev.bubbles,
					cancelable: ev.cancelable,
					clientX: ev.clientX,
					clientY: ev.clientY,
				})
			)
		},
		openFile,
	}).showAtMouseEvent(
		ev.instanceOf(MouseEvent)
			? ev
			: // simulate click when it ev is undefined, e.g. MouseEvent not given because it was a touch event.
				new MouseEvent('click', {
					clientX: ev.touches.item(0)?.clientX,
					clientY: ev.touches.item(0)?.clientY,
				})
	)
}
