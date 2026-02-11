import { Notifier } from './notifier'

export function createSetStore<T>() {
	const notifier = new Notifier()
	const set = new Set<T>()
	let cached: ReadonlyArray<T> | undefined

	return Object.freeze({
		getAll: () => (cached ??= Array.from([...set])),
		add: (item: T) => {
			set.add(item)
			cached = undefined
			notifier.notifyListeners()
		},
		remove: (item: T) => {
			if (set.delete(item)) {
				cached = undefined
				notifier.notifyListeners()
			}
		},
		addListener: (cb: () => void) => notifier.addListener(cb),
	})
}

export function createRecordStore<K, V>() {
	const notifier = new Notifier()
	const map = new Map<K, V>()
	let cached: ReadonlyArray<[key: K, value: V]> | undefined

	return Object.freeze({
		getAll: () => (cached ??= Array.from([...map])),
		add: (key: K, value: V) => {
			map.set(key, value)
			cached = undefined
			notifier.notifyListeners()
		},
		remove: (key: K) => {
			if (map.delete(key)) {
				cached = undefined
				notifier.notifyListeners()
			}
		},
		addListener: (cb: () => void) => notifier.addListener(cb),
	})
}

export type Store<T> = ReturnType<typeof createStore<T>>

export function createStore<T>(initialState: T) {
	const notifier = new Notifier()
	let state = initialState

	return Object.freeze({
		getState: () => state,
		setState: (partial: Partial<T> | ((state: T) => Partial<T>)) => {
			const newState = typeof partial === 'function' ? partial(state) : partial
			if (newState !== state) {
				state = { ...state, ...newState }
				notifier.notifyListeners()
			}
		},
		addListener: (cb: () => void) => notifier.addListener(cb),
	})
}
