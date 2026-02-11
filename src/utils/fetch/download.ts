import { normalizePath, TAbstractFile, TFolder, Vault } from 'obsidian'
import { getDir, pathBasename } from '../path'

export class DownloadError extends Error {}

export class DownloadErrorTAbstractFileExists extends DownloadError {
	constructor(public readonly tAbstractFile: TAbstractFile) {
		super(`File exists: ${tAbstractFile.path}`)
	}
}
export type DownloadInfo = {
	/**
	 * Destination path of the new file.
	 */
	destination: string
	url: string
}

/**
 * Creates the destination folder if it does not exist.
 */
export async function fetchAndSaveDownload(
	vault: Vault,
	{
		url,
		destination,
	}: {
		url: string | URL
		destination: string
	}
) {
	const dir = getDir(destination)
	let maybeDir = vault.getAbstractFileByPath(dir)

	if (maybeDir === null) {
		maybeDir = await vault.createFolder(dir)
	} else if (!(maybeDir instanceof TFolder)) {
		throw new DownloadError(`Could not download file: ${dir} is not a folder.`)
	}
	const downloadTo = normalizePath(`${maybeDir.path}/${pathBasename(destination)}`)

	const existing = vault.getAbstractFileByPath(downloadTo)

	if (existing) {
		throw new DownloadErrorTAbstractFileExists(existing)
	}

	const res = await fetch(url)
	if (!res.ok) {
		throw new DownloadError(`Fetch unsuccessful: ${url}`)
	}

	return vault.createBinary(normalizePath(downloadTo), await res.arrayBuffer())
}
