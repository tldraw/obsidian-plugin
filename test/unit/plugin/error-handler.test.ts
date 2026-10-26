import { afterEach, describe, expect, it, vi } from 'vitest'
import { Notice } from 'obsidian'
import { ErrorHandler } from 'src/plugin/error-handler'

afterEach(() => {
	vi.restoreAllMocks()
	Notice.lastMessage = undefined
})

describe('ErrorHandler', () => {
	it('log reports the error to the console without showing a notice', () => {
		const error = vi.spyOn(console, 'error').mockImplementation(() => {})
		const failure = new Error('boom')

		ErrorHandler.log(failure)

		expect(error).toHaveBeenCalledWith(failure)
		expect(Notice.lastMessage).toBeUndefined()
	})

	it('notice reports the error to the console and shows its message', () => {
		const error = vi.spyOn(console, 'error').mockImplementation(() => {})
		const failure = new Error('boom')

		ErrorHandler.notice(failure)

		expect(error).toHaveBeenCalledWith(failure)
		expect(Notice.lastMessage).toBe('Something went wrong: boom')
	})

	it('can be passed to catch without binding', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {})

		await Promise.reject(new Error('later')).catch(ErrorHandler.notice)

		expect(Notice.lastMessage).toBe('Something went wrong: later')
	})
})
