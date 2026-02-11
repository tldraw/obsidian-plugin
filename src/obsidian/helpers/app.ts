import { App, normalizePath, TAbstractFile, TFile, TFolder } from 'obsidian'

export function getColocationFolder(app: App, file?: TAbstractFile) {
	return (file ?? app.workspace.getActiveFile())?.parent ?? app.vault.getRoot()
}

/**
 * Add {@linkcode path} onto the path of the active file.
 * @param app
 * @param path
 * @returns
 */
function colocateWithPath(app: App, path: string, file?: TAbstractFile) {
	const filePath = (file ?? app.workspace.getActiveFile())?.parent?.path
	return normalizePath(!filePath ? path : `${filePath}/${path}`)
}

function startInCurrentPath(path: string): path is `./${string}` {
	return path.startsWith('./')
}

/**
 * either a folder, `null` if the path was a file, or string if it was not a folder or file.
 */
type ValidatedFolderPath = TFolder | string | null

/**
 *
 * @param app
 * @param path
 * @returns Returns either a folder, `null` if the path was a file, or {@linkcode path} if it was not a folder or file.
 */
export function validateFolderPath(app: App, path: string): ValidatedFolderPath {
	const file = app.vault.getAbstractFileByPath(path)
	return file instanceof TFolder ? file : file instanceof TFile ? null : path
}

/**
 * Utilizes the user's vault configuration for the attachment folder path.
 * @param app
 * @returns
 */
export function getAttachmentsFolder(
	app: App,
	attachTo?: TFile
): {
	/**
	 * The path that was tried.
	 */
	path: string
	/**
	 * A folder if it could be resolved directly from the user's config, null if a file exists in this path, or a string if no file exists.
	 */
	folder: ValidatedFolderPath
} {
	const { attachmentFolderPath } = app.vault.config
	return !attachmentFolderPath || attachmentFolderPath === '/'
		? {
				folder: app.vault.getRoot(),
				path: '/',
			}
		: !startInCurrentPath(attachmentFolderPath)
			? {
					folder: validateFolderPath(app, attachmentFolderPath),
					path: attachmentFolderPath,
				}
			: attachmentFolderPath === './'
				? (() => {
						const folder = getColocationFolder(app, attachTo)
						return {
							folder,
							path: folder.path,
						}
					})()
				: (() => {
						const path = colocateWithPath(app, attachmentFolderPath.slice(2), attachTo)
						const folder = validateFolderPath(app, path)
						return { folder, path }
					})()
}
