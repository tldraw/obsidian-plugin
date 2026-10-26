import { Notice } from 'obsidian'
import { errorMessage } from 'src/utils/error'

/**
 * Handlers for promises that nothing awaits, e.g. `promise.catch(ErrorHandler.log)`.
 *
 * The methods declare `this: void` so they can be passed as callbacks without binding.
 */
export abstract class ErrorHandler {
	/**
	 * Report the error to the console. Use this for background work the user did not start.
	 */
	static log(this: void, error: unknown): void {
		console.error(error)
	}

	/**
	 * Report the error to the console and show it to the user. Use this when an action the user
	 * started has failed.
	 */
	static notice(this: void, error: unknown): void {
		console.error(error)
		new Notice(`Something went wrong: ${errorMessage(error)}`)
	}
}
