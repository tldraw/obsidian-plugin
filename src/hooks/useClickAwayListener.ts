import { useEffect, useRef } from 'react'

export function useClickAwayListener<T extends HTMLElement>({
	enableClickAwayListener,
	handler,
}: {
	enableClickAwayListener: boolean
	handler: (event: PointerEvent) => void
}) {
	const ref = useRef<T>(null)
	useEffect(() => {
		if (!enableClickAwayListener || !ref.current?.win) return
		// NOTE: Event though Obsidian.md's API doesn't declare the same type, it is the same type... as least it works for this particular use case.
		const win = ref.current?.win as typeof window

		const handleClickAway = (event: PointerEvent) => {
			if (event.target instanceof win.Node) {
				if (ref.current && !ref.current.contains(event.target)) {
					handler(event)
				}
			}
		}

		win.document.addEventListener('pointerdown', handleClickAway)
		return () => {
			win.document.removeEventListener('pointerdown', handleClickAway)
		}
	}, [enableClickAwayListener, handler])

	return ref
}
