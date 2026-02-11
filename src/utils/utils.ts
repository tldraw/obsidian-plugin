import { FileManager, Notice, TAbstractFile, TFile, TFolder, Vault, normalizePath } from 'obsidian'
import { FILE_EXTENSION, VIEW_TYPES, ViewType } from './constants'
import { pathBasename } from './path'

export const removeAllChildNodes = (parent: HTMLElement) => {
	while (parent.firstChild) {
		parent.removeChild(parent.firstChild)
	}
}

export const hasKewords = (input: string, keyword1: string, keyword2: string) => {
	const pattern = new RegExp(`${keyword1}(.*?)${keyword2}`, 's')
	return pattern.test(input)
}

export const extractDataBetweenKeywords = (input: string, keyword1: string, keyword2: string) => {
	const pattern = new RegExp(`${keyword1}(.*?)${keyword2}`, 's')
	const match = input.match(pattern)
	return match ? match[1] : null
}

export const replaceBetweenKeywords = (
	input: string,
	keyword1: string,
	keyword2: string,
	replacement: string
) => {
	const regex = new RegExp(`${keyword1}[\\s\\S]*?${keyword2}`, 'g')
	return input.replace(regex, `${keyword1}\n${replacement}\n${keyword2}`)
}

/**
 * Open or create a folderpath if it does not exist
 * @param folderpath
 */
export async function checkAndCreateFolder(folderpath: string, vault: Vault) {
	folderpath = normalizePath(folderpath)
	//@ts-ignore
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

	const extension = filename.endsWith(FILE_EXTENSION)
		? FILE_EXTENSION
		: filename.slice(filename.lastIndexOf('.'))
	while (file) {
		fname = normalizePath(
			`${folderpath}/${filename.slice(0, filename.lastIndexOf(extension))} (${i})${extension}`
		)
		i++
		file = vault.getAbstractFileByPath(fname)
	}
	return fname
}

export const isObsidianThemeDark = () => document.body.classList.contains('theme-dark')

export const clamp = (num: number, min: number, max: number) => Math.max(min, Math.min(num, max))

export const msToSeconds = (ms: number) => ms / 1000
export const safeSecondsToMs = (s: number) => Math.round(s * 1000)

export const isValidViewType = (str: string): str is ViewType => {
	return (VIEW_TYPES as readonly string[]).includes(str)
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
	const attachmentPath = await (fileManager.getAvailablePathForAttachment(
		attachmentFilename,
		attachTo?.path
	) as Promise<string>)
	const filename = pathBasename(attachmentPath)
	const folder = attachmentPath.slice(0, -(filename.length + 1))
	return {
		filename,
		folder: folder.length === 0 ? '/' : folder,
	}
}
