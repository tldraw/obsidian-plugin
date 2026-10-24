import { TFile } from 'obsidian'
import { mimeTypeFromExtension } from 'src/utils/mime-type'

/**
 * Helper method which gets the contents of a vault file as a blob, with the mime-type taken from the
 * file extension.
 */
export async function vaultFileToBlob(tFile: TFile) {
	const data = await tFile.vault.readBinary(tFile)
	return new Blob([data], { type: mimeTypeFromExtension(tFile.extension) })
}
