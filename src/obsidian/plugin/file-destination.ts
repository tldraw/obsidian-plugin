import { TFile, TFolder } from 'obsidian'
import TldrawPlugin from 'src/main'
import { getAttachmentsFolder, getColocationFolder, validateFolderPath } from '../helpers/app'
import NewTldrawFileConfirmationModal from '../modal/NewTldrawFileConfirmationModal'

/**
 * Get the colocation destination, and add the sub-folder if defined.
 * @param plugin
 * @returns
 */
export function getColocationDestination(plugin: TldrawPlugin) {
	const subfolder = plugin.settings.fileDestinations.colocationSubfolder
	const colocationFolder = getColocationFolder(plugin.app)
	if (subfolder === '') {
		return colocationFolder
	}
	const path = `${colocationFolder.path}/${subfolder}`
	return {
		path,
		folder: validateFolderPath(plugin.app, path),
	}
}

/**
 * Will ask for confirmation if the confirmDestination option is true.
 * @param plugin
 * @param filename
 * @param attachTo
 * @returns
 */
export async function getTldrawFileDestination(
	plugin: TldrawPlugin,
	filename: string,
	attachTo?: TFile
) {
	const {
		fileDestinations: { confirmDestination, destinationMethod, defaultFolder },
	} = plugin.settings

	const defaultRes = (() => {
		if (attachTo || destinationMethod === 'attachments-folder') {
			return getAttachmentsFolder(plugin.app, attachTo)
		}
		switch (destinationMethod) {
			case 'colocate':
				return getColocationDestination(plugin)
			case 'default-folder':
				return {
					path: defaultFolder,
					folder: validateFolderPath(plugin.app, defaultFolder),
				}
		}
	})()

	return !confirmDestination
		? {
				filename,
				folder: (() => {
					if (defaultRes instanceof TFolder) {
						return defaultRes.path
					}
					if (!defaultRes.folder) {
						throw new Error(`Unable to create new tldraw file, ${defaultRes.path} exists as file.`)
					}
					return defaultRes.folder instanceof TFolder ? defaultRes.folder.path : defaultRes.folder
				})(),
			}
		: await NewTldrawFileConfirmationModal.confirm(plugin, {
				filename,
				folder: defaultRes,
			})
}
