import { afterEach, describe, expect, it, vi } from 'vitest'
import { TldrawStoreIndexedDB } from 'src/tldraw/indexeddb-store'

function stubDeleteDatabase() {
	const request: { onerror?: () => void; error: DOMException | null } = { error: null }
	vi.stubGlobal('indexedDB', { deleteDatabase: () => request })
	return request
}

afterEach(() => {
	vi.unstubAllGlobals()
})

describe('TldrawStoreIndexedDB.delete', () => {
	it('rejects with an Error when the request fails without an error', async () => {
		const request = stubDeleteDatabase()
		const result = TldrawStoreIndexedDB.delete('key')

		request.onerror?.()

		await expect(result).rejects.toBeInstanceOf(Error)
	})

	it('rejects with the error the request reports', async () => {
		const request = stubDeleteDatabase()
		const failure = new DOMException('denied', 'NotAllowedError')
		request.error = failure
		const result = TldrawStoreIndexedDB.delete('key')

		request.onerror?.()

		await expect(result).rejects.toBe(failure)
	})
})
