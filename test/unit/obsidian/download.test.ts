import { requestUrl, TFolder } from 'obsidian'
import type { Vault } from 'obsidian'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DownloadError, fetchAndSaveDownload } from 'src/obsidian/download/download'

function createVault() {
	const folder = Object.assign(new TFolder(), { path: 'Downloads' })
	const createBinary = vi.fn().mockResolvedValue({ path: 'Downloads/file.bin' })
	const vault = {
		getAbstractFileByPath: vi.fn((path: string) => (path === 'Downloads' ? folder : null)),
		createFolder: vi.fn(),
		createBinary,
	} as unknown as Vault
	return { vault, createBinary }
}

describe('fetchAndSaveDownload', () => {
	beforeEach(() => {
		vi.mocked(requestUrl).mockReset()
	})

	it('requests the url without throwing and saves the body', async () => {
		const body = new Uint8Array([1, 2]).buffer
		vi.mocked(requestUrl).mockResolvedValue({ status: 200, arrayBuffer: body } as never)
		const { vault, createBinary } = createVault()

		await fetchAndSaveDownload(vault, {
			url: new URL('https://example.com/file.bin'),
			destination: 'Downloads/file.bin',
		})

		expect(requestUrl).toHaveBeenCalledWith({ url: 'https://example.com/file.bin', throw: false })
		expect(createBinary).toHaveBeenCalledWith('Downloads/file.bin', body)
	})

	it('throws a DownloadError and saves nothing for an unsuccessful status', async () => {
		vi.mocked(requestUrl).mockResolvedValue({ status: 404, arrayBuffer: new ArrayBuffer(0) } as never)
		const { vault, createBinary } = createVault()

		await expect(
			fetchAndSaveDownload(vault, { url: 'https://example.com/missing', destination: 'Downloads/file.bin' })
		).rejects.toBeInstanceOf(DownloadError)
		expect(createBinary).not.toHaveBeenCalled()
	})
})
