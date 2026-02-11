import { useMemo, useSyncExternalStore } from 'react'

/**
 * A hook that allows for using a store that doesn't yet cache the data.
 */
export function useStorify<T>(
	addListener: (listener: () => void) => () => void,
	getData: () => T
): T {
	const storified = useMemo(() => {
		let cached: T | undefined
		return {
			addListener: (listener: () => void) => {
				return addListener(() => {
					cached = undefined
					listener()
				})
			},
			getData: () => (cached ??= getData()),
		}
	}, [addListener, getData])

	const store = useSyncExternalStore(storified.addListener, storified.getData)

	return store
}
