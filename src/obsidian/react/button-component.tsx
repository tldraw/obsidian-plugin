import { ButtonComponent } from 'obsidian'
import React, { useEffect, useRef } from 'react'

/**
 * A wrapper for the Obsidian {@linkcode ButtonComponent} component that allows for React rendering inside the button.
 */
export function ButtonComponentWrapper({ text, onClick }: { text: string; onClick: () => void }) {
	const buttonRef = useRef<HTMLDivElement>(null)
	const buttonComponentRef = useRef<ButtonComponent | null>(null)

	useEffect(() => {
		const container = buttonRef.current
		if (!container) return

		// Clean up previous button if it exists
		if (buttonComponentRef.current) {
			// ButtonComponent doesn't have a cleanup method, but we can remove the element
			container.empty()
		}

		const button = new ButtonComponent(container)
		button.setButtonText(text).onClick(onClick)
		buttonComponentRef.current = button

		return () => {
			if (buttonComponentRef.current) {
				container.empty()
				buttonComponentRef.current = null
			}
		}
	}, [text, onClick])

	return <div ref={buttonRef} />
}
