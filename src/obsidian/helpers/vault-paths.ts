import { FileManager, Notice, TAbstractFile, TFile, TFolder, Vault, normalizePath } from 'obsidian'
import { pathBasename } from './path'

/**
 * Open or create a folderpath if it does not exist
 * @param folderpath
 */
export async function checkAndCreateFolder(folderpath: string, vault: Vault) {
	folderpath = normalizePath(folderpath)
	const folder = vault.getAbstractFileByPathInsensitive(folderpath)
	if (folder && folder instanceof TFolder) {
		return
	}
	if (folder && folder instanceof TFile) {
		new Notice(`The folder cannot be created because it already exists as a file: ${folderpath}.`)
	}
	await vault.createFolder(folderpath)
}

/**
 * Create new file, if file already exists find first unique filename by adding a number to the end of the filename
 * @param filename
 * @param folderpath
 * @returns
 */
export function getNewUniqueFilepath(vault: Vault, filename: string, folderpath: string): string {
	let fname = normalizePath(`${folderpath}/${filename}`)
	let file: TAbstractFile | null = vault.getAbstractFileByPath(fname)
	let i = 0

	const extension = filename.slice(filename.lastIndexOf('.'))
	while (file) {
		fname = normalizePath(
			`${folderpath}/${filename.slice(0, filename.lastIndexOf(extension))} (${i})${extension}`
		)
		i++
		file = vault.getAbstractFileByPath(fname)
	}
	return fname
}

/**
 * Create an object that describes the filepath for a new attachment using the user's Obsidian preferences.
 * @param attachmentFilename
 * @param attachTo
 * @param fileManager
 * @returns
 */
export async function createAttachmentFilepath(
	fileManager: FileManager,
	attachmentFilename: string,
	attachTo?: TFile
) {
	const attachmentPath = await fileManager.getAvailablePathForAttachment(
		attachmentFilename,
		attachTo?.path
	)
	const filename = pathBasename(attachmentPath)
	const folder = attachmentPath.slice(0, -(filename.length + 1))
	return {
		filename,
		folder: folder.length === 0 ? '/' : folder,
	}
}
