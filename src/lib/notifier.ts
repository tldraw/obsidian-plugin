export class Notifier<Listener extends (...args: never[]) => unknown = () => void> {
	readonly #listeners = new Set<Listener>()

	#timeout?: Timer

	notifyListeners(...args: Parameters<Listener>) {
		// We only want to notify the listeners once per event loop so we utilize a timeout
		window.clearTimeout(this.#timeout)

		this.#timeout = window.setTimeout(() => {
			for (const listener of this.#listeners) {
				listener(...args)
			}
		})
	}

	addListener(listener: Listener): () => void {
		this.#listeners.add(listener)
		return () => {
			this.#listeners.delete(listener)
		}
	}
}
