import { ButtonComponent, Modal, TFile } from 'obsidian'
import {
	DownloadErrorTAbstractFileExists,
	DownloadInfo,
	fetchAndSaveDownload,
} from 'src/utils/fetch/download'

type DownloadContext = {
	info: DownloadInfo
	container: HTMLDivElement
}

export default class DownloadManagerModal extends Modal {
	onClose(): void {
		super.onClose()
		this.contentEl.empty()
	}

	async startDownload(
		download: DownloadInfo,
		onSuccess: (tFile: TFile) => Promise<void>,
		container?: HTMLDivElement
	) {
		this.open()
		const downloadCtx: DownloadContext = {
			info: download,
			container:
				container ??
				this.contentEl.createDiv({
					cls: 'ptl-download-job',
				}),
		}
		try {
			container?.empty()
			this.setDownloading(downloadCtx)
			const tFile = await fetchAndSaveDownload(this.app.vault, download)
			this.setFinished({
				...downloadCtx,
				tFile,
			})
			await onSuccess(tFile)
		} catch (e) {
			this.setErrored({
				...downloadCtx,
				error: e,
				onRetrySuccess: onSuccess,
			})
		}
	}

	private setDownloading(item: DownloadContext) {
		item.container.createEl('p', {
			text: item.info.destination,
		})
	}

	private setFinished(item: DownloadContext & { tFile: TFile }) {
		item.container.createEl('p', {
			cls: 'ptl-download-success',
			text: 'Done.',
		})
	}

	private setErrored({
		container,
		error,
		info,
		onRetrySuccess,
	}: DownloadContext & { error: unknown; onRetrySuccess: (tFile: TFile) => Promise<void> }) {
		container.createEl('p', {
			cls: 'ptl-download-error',
			text: error instanceof Error ? error.message : 'Uknown error',
		})

		if (error instanceof DownloadErrorTAbstractFileExists) {
			new ButtonComponent(container).setButtonText('Replace file').onClick(async () => {
				await this.app.vault.delete(error.tAbstractFile)
				await this.startDownload(info, onRetrySuccess, container)
			})
		}
	}
}
