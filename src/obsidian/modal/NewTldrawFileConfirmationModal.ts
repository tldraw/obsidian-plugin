import { Notice, setIcon, SuggestModal, TFolder } from 'obsidian'
import TldrawPlugin from 'src/main'
import { TLDRAW_ICON_NAME } from 'src/utils/constants'
import { getAttachmentsFolder, validateFolderPath } from '../helpers/app'
import { getColocationDestination } from '../plugin/file-destination'
import { destinationMethods, destinationMethodsRecord } from '../settings/constants'
import { FileSearchCanceled, FileSearchModal } from './FileSearchModal'

type Result = {
	filename: string
	folder: string
}

const choices = ['confirm', 'edit', 'active-file-dir', ...destinationMethods] as const

type Choice = (typeof choices)[number]

type SuggestOption = {
	choice: Choice
	/**
	 * If `null`, this was an invalid folder for the choice.
	 *
	 * If a string, the folder needs to be created.
	 */
	folder:
		| TFolder
		| {
				path: string
				folder: ReturnType<typeof validateFolderPath>
		  }
}

type ToConfirm = {
	filename: string
	folder: SuggestOption['folder']
}

export default class NewTldrawFileConfirmationModal extends SuggestModal<SuggestOption> {
	private error?: unknown

	constructor(
		private readonly plugin: TldrawPlugin,
		private toConfirm: ToConfirm,
		private readonly res: (res: Result) => void,
		private readonly rej: (err: unknown) => void
	) {
		super(plugin.app)
	}

	static async confirm(plugin: TldrawPlugin, toConfirm: ToConfirm): Promise<Result> {
		return new Promise((res, rej) => {
			const modal = new NewTldrawFileConfirmationModal(plugin, toConfirm, res, rej)
			modal.open()
		})
	}

	onOpen(): void {
		super.onOpen()
		const promptInputContainer = this.inputEl.parentElement!
		const promptInputContainerParent = promptInputContainer.parentElement!
		promptInputContainer.remove()

		promptInputContainerParent.createDiv(
			{
				text: 'Confirm new file destination',
				cls: 'modal-title ptl-modal-title-with-icon',
				prepend: true,
			},
			(div) => {
				setIcon(div.createSpan({ cls: 'ptl-modal-icon', prepend: true }), TLDRAW_ICON_NAME)
			}
		)

		promptInputContainerParent
			.createDiv({
				cls: 'modal-close-button',
				prepend: true,
			})
			.onClickEvent((ev) => {
				this.close()
			})
	}

	async getSuggestions(query: string): Promise<SuggestOption[]> {
		const suggestions: SuggestOption[] = []
		for (const choice of choices) {
			switch (choice) {
				case 'confirm':
				case 'edit':
					{
						suggestions.push({
							choice: choice,
							folder: this.toConfirm.folder,
						})
					}
					break
				case 'colocate':
					{
						suggestions.push({
							choice: 'colocate',
							folder: getColocationDestination(this.plugin),
						})
					}
					break
				case 'default-folder':
					{
						const { defaultFolder } = this.plugin.settings.fileDestinations
						suggestions.push({
							choice: 'default-folder',
							folder: {
								path: defaultFolder,
								folder: validateFolderPath(this.plugin.app, defaultFolder),
							},
						})
					}
					break
				case 'attachments-folder':
					{
						const attachmentsFolder = getAttachmentsFolder(this.app)
						suggestions.push({
							choice: 'attachments-folder',
							folder: attachmentsFolder,
						})
					}
					break
				case 'active-file-dir': {
					const activeFile = this.app.workspace.activeEditor?.file
					if (activeFile?.parent) {
						suggestions.push({
							choice: 'active-file-dir',
							folder: activeFile.parent,
						})
					}
				}
			}
		}
		return suggestions
	}

	private folderPathLabel(tFolder: TFolder) {
		return `Folder path: ${tFolder.path}`
	}

	renderSuggestion(value: SuggestOption, el: HTMLElement) {
		const div = el.createDiv({ cls: 'ptl-suggestion-item' })
		setIcon(
			div.createSpan({ cls: 'ptl-suggestion-item-icon' }),
			value.choice === 'confirm'
				? 'check'
				: value.choice === 'edit'
					? 'edit'
					: value.choice === 'attachments-folder'
						? 'paperclip'
						: value.choice === 'default-folder'
							? 'default'
							: 'folder-tree'
		)
		div.createDiv({
			text:
				value.choice === 'confirm'
					? 'Confirm'
					: value.choice === 'edit'
						? 'Edit'
						: value.choice === 'active-file-dir'
							? 'In active file directory'
							: destinationMethodsRecord[value.choice],
		})
		el.createDiv(
			{
				cls: 'ptl-suggestion-label',
			},
			(div) => {
				div.createDiv({
					cls: 'ptl-suggestion-sub-label',
					text:
						value.folder instanceof TFolder
							? this.folderPathLabel(value.folder)
							: typeof value.folder.folder === 'string'
								? `New folder: ${value.folder.folder}`
								: value.folder.folder instanceof TFolder
									? this.folderPathLabel(value.folder.folder)
									: `Invalid folder: ${value.folder.path}`,
				})

				const fileLabel =
					value.folder instanceof TFolder ||
					value.folder.folder instanceof TFolder ||
					typeof value.folder.folder === 'string'
						? `File: ${value.folder.path}/${this.toConfirm.filename}`
						: undefined

				if (!fileLabel) return

				div.createDiv({
					cls: 'ptl-suggestion-sub-label',
					text: fileLabel,
				})
			}
		)
	}

	selectSuggestion(value: SuggestOption, evt: MouseEvent | KeyboardEvent): void {
		this.onChooseSuggestion(value, evt)
	}

	confirmFolder(folder: SuggestOption['folder']) {
		const foldername =
			folder instanceof TFolder
				? folder.path
				: typeof folder.folder === 'string'
					? folder.folder
					: folder.folder?.path
		if (!foldername) {
			new Notice('Invalid folder choice')
		} else {
			this.res({
				filename: this.toConfirm.filename,
				folder: foldername,
			})
			this.close()
		}
	}

	onChooseSuggestion(item: SuggestOption, evt: MouseEvent | KeyboardEvent) {
		switch (item.choice) {
			case 'confirm':
			case 'attachments-folder':
			case 'colocate':
			case 'default-folder':
			case 'active-file-dir':
				this.confirmFolder(item.folder)
				return
			case 'edit':
				FileSearchModal.chooseFolder(this.plugin, {
					allowAnyPath: true,
					initialSearchPath: typeof item.folder === 'string' ? item.folder : item.folder?.path,
				})
					.then((res) => {
						this.toConfirm.folder =
							typeof res === 'string'
								? {
										path: res,
										folder: res,
									}
								: res instanceof TFolder
									? res
									: {
											path: res.path,
											folder: null,
										}
						this.updateSuggestions()
					})
					.catch((e) => {
						if (e instanceof FileSearchCanceled) return
						this.onError(e)
					})
				return
		}
		this.onError(new Error('Method not implemented.'))
	}

	onError(err: unknown) {
		this.error = err
		this.close()
	}

	onClose(): void {
		this.rej(this.error ?? new Error('Confirmation canceled.'))
		super.onClose()
	}
}
