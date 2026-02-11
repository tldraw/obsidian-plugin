import { App, ButtonComponent, Modal, normalizePath, Notice, Setting, TFile } from 'obsidian'
import TldrawPlugin from 'src/main'
import { getDir, pathBasename } from 'src/utils/path'

type SaveFileModalOptions = NonNullable<unknown>

type FileSavedResult = {
	tFile: TFile
	showResultModal: () => void
}

class SaveFileModal extends Modal {
	plugin: TldrawPlugin
	file: File
	options: SaveFileModalOptions & {
		onFileSaved: (tFile?: FileSavedResult) => void
	}

	constructor(plugin: TldrawPlugin, file: File, options: SaveFileModal['options']) {
		super(plugin.app)
		this.plugin = plugin
		this.file = file
		this.options = options
	}

	onOpen(): void {
		const { contentEl, file } = this
		const activeFilePath = this.app.workspace.getActiveFile()?.path ?? ''
		const defaultDir = getDir(activeFilePath)
		const defaultName = file.name
		const defaultExt = defaultName.slice(defaultName.lastIndexOf('.'))

		contentEl.createEl('h1', {
			text: 'Save file',
		})

		let filePath = ''
		let saveSetting: Setting | undefined = undefined
		const setSaveSetting = (folder: string, fileName: string) => {
			filePath = normalizePath(`${folder}/${fileName}`)
			saveSetting?.setDesc(`Saving to "${filePath}"`)
		}

		const folderSetting = {
			folder: defaultDir,
			setting: new Setting(contentEl).setName('Folder'),
			init() {
				this.setting.addText((text) =>
					text.setValue(defaultDir).onChange((value) => this.update(value))
				)
				this.update(defaultDir)
			},
			update(value: string) {
				value = normalizePath(value)
				if (value.length === 0) {
					value = '/'
				}
				this.folder = value
				this.setting.setDesc(`Using "${this.folder}"\n`)
				setSaveSetting(folderSetting.folder, fileNameSetting.fileName)
			},
		}

		const fileNameSetting = {
			fileName: defaultName,
			setting: new Setting(contentEl).setName('File name'),
			init() {
				this.setting.addText((text) =>
					text.setValue(defaultName).onChange((value) => this.update(value))
				)
				this.update(defaultName)
			},
			update(value: string) {
				value = pathBasename(normalizePath(value))
				if (value.length === 0) {
					value = defaultName
				}
				if (!value.endsWith(defaultExt)) {
					value += defaultExt
				}
				this.fileName = value
				this.setting.setDesc(`Using "${this.fileName}"`)
				setSaveSetting(folderSetting.folder, fileNameSetting.fileName)
			},
		}

		saveSetting = new Setting(contentEl).addButton((btn) =>
			btn
				.setButtonText('Submit')
				.setCta()
				.onClick(() => {
					this.saveFile(filePath).catch((e) => {
						console.log(e)
						const notice = new Notice(`There was an error saving the file to "${filePath}".`)
						notice.noticeEl.createDiv({
							text: `${e}`,
						})
					})
				})
		)

		fileNameSetting.init()
		folderSetting.init()
	}

	onClose(): void {
		this.contentEl.empty()
	}

	private async saveFile(path: string) {
		const tFile = await this.plugin.app.vault.createBinary(path, await this.file.arrayBuffer())
		this.close()

		this.options.onFileSaved({
			tFile,
			showResultModal: () => new FileSavedModal(this.app, this.plugin, tFile).open(),
		})
	}
}

class FileSavedModal extends Modal {
	tFile: TFile
	plugin: TldrawPlugin

	constructor(app: App, plugin: TldrawPlugin, tFile: TFile) {
		super(app)
		this.tFile = tFile
		this.plugin = plugin
	}

	onOpen(): void {
		const { contentEl, tFile } = this
		contentEl.createEl('h1', {
			text: 'File saved',
		})

		contentEl.createEl('p', {
			text: `Created file "${tFile.path}"`,
		})

		new ButtonComponent(contentEl)
			.setCta()
			.setButtonText('Open (system default)')
			.onClick(async () => {
				await this.app.openWithDefaultApp(tFile.path)
				this.close()
			})

		new ButtonComponent(contentEl)
			.setCta()
			.setButtonText('Open in new tab')
			.onClick(async () => {
				await this.plugin.app.workspace.getLeaf('tab').openFile(tFile)
				this.close()
			})
	}
}

export function showSaveFileModal(plugin: TldrawPlugin, file: File, options: SaveFileModalOptions) {
	return new Promise<FileSavedResult | undefined>((res) =>
		new SaveFileModal(plugin, file, {
			...options,
			onFileSaved: res,
		}).open()
	)
}
