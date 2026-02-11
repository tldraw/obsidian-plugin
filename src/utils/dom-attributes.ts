export abstract class PTLEditorBlockBlur {
	static readonly attributeName = 'data-ptl-editor-block-blur'
	static readonly shouldBlockBlurSelector = `[${this.attributeName}=true]` as const

	/**
	 * Checks if the target prevents the editor from being blurred.
	 */
	static shouldEventBlockBlur(event: UIEvent) {
		return Boolean(
			event.targetNode?.instanceOf(HTMLElement)
				? event.targetNode.closest(this.shouldBlockBlurSelector)
				: null
		)
	}

	/**
	 *
	 * @param element The target node for the event checked by {@linkcode shouldEventBlockBlur}
	 */
	static blockBlurOnElement(element: HTMLElement) {
		element.setAttribute(this.attributeName, 'true')
	}
}
