import { Notifier } from './notifier'

export interface AddListener<Callback extends (...args: unknown[]) => void = () => void> {
	(listener: Callback): () => void
}

/**
 * Create a trigger that can be used to call a function at most once per event loop, with the ability to attach listeners to the result.
 * @param fn - The function to trigger.
 */
export function createTrigger<Params extends unknown[], Return>(
	fn: (...args: Params) => Return
): {
	trigger(...args: Params): void
	addListener: AddListener<Return extends void ? () => void : (data: Return) => void>
} {
	const notifier = new Notifier<(data: Return) => void>()
	let timeout: Timer
	return {
		trigger: (...args: Parameters<typeof fn>) => {
			// We only want to call the function once per event loop so we utilize a timeout
			clearTimeout(timeout)
			timeout = setTimeout(() => {
				const res = fn(...args)
				notifier.notifyListeners(res)
			})
		},
		addListener: (listener) => notifier.addListener(listener),
	}
}
