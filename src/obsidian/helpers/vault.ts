import { TFile } from 'obsidian'

/**
 * Helper method which gets the contents of a vault file as a blob, including the proper mime-type.
 */
export async function vaultFileToBlob(tFile: TFile) {
	const resource = tFile.vault.getResourcePath(tFile)
	return (await fetch(resource)).blob()
}
