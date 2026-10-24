import type { TFile } from 'obsidian'
import { describe, expect, it, vi } from 'vitest'
import { vaultFileToBlob } from 'src/obsidian/helpers/vault'

function createFile(extension: string, bytes: number[]) {
	const readBinary = vi.fn().mockResolvedValue(new Uint8Array(bytes).buffer)
	return { file: { extension, vault: { readBinary } } as unknown as TFile, readBinary }
}

describe('vaultFileToBlob', () => {
	it('reads the file through the vault and types the blob by extension', async () => {
		const { file, readBinary } = createFile('PNG', [1, 2, 3])
		const blob = await vaultFileToBlob(file)
		expect(readBinary).toHaveBeenCalledWith(file)
		expect(blob.type).toBe('image/png')
		expect(new Uint8Array(await blob.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]))
	})

	it('leaves the type empty for an unknown extension', async () => {
		const { file } = createFile('xyz', [9])
		expect((await vaultFileToBlob(file)).type).toBe('')
	})
})
