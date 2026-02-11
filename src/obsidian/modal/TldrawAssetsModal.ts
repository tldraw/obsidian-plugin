import { App, ButtonComponent, Modal, TFile } from 'obsidian'
import { TldrawAppStoreProps } from 'src/components/TldrawApp'
import { ObsidianTLAssetStore } from 'src/tldraw/asset-store'
import { Store } from 'tldraw'

export default class TldrawAssetsModal extends Modal {
	constructor(
		app: App,
		private readonly storeProps: TldrawAppStoreProps,
		private readonly tFile?: TFile | null
	) {
		super(app)
	}

	onOpen(): void {
		super.onOpen()
		this.contentEl.empty()

		const store = this.storeProps.plugin
			? this.storeProps.plugin.store
			: this.storeProps.tldraw.store instanceof Store
				? this.storeProps.tldraw.store
				: this.storeProps.tldraw.store?.store
		const obsidianTLAssetStore =
			store?.props.assets instanceof ObsidianTLAssetStore ? store?.props.assets : undefined
		this.titleEl.createEl('header', {
			text: `Assets for ${
				this.tFile?.path ??
				this.storeProps.plugin?.meta.uuid ??
				(this.storeProps.tldraw &&
				'persistenceKey' in this.storeProps.tldraw &&
				this.storeProps.tldraw.persistenceKey
					? this.storeProps.tldraw.persistenceKey
					: 'unknown tldraw document')
			}`,
		})

		if (obsidianTLAssetStore) {
			this.displayObsidianTLAssetStore(obsidianTLAssetStore)
		}
	}

	private displayObsidianTLAssetStore(assetStore: ObsidianTLAssetStore) {
		assetStore.getAllFromIndexedDB().then((assetSourcesIDB) => {
			this.contentEl.createDiv(undefined, async (div) => {
				if (assetSourcesIDB.length === 0) {
					div.createEl('p', {
						text: 'No assets in the IndexedDB.',
					})
				} else {
					div.createEl(
						'ul',
						{
							text: `${assetSourcesIDB.length} asset(s) in the IndexedDB`,
						},
						(ul) => {
							for (const assetSource of assetSourcesIDB) {
								const li = ul.createEl('li', {
									text: assetSource,
								})
								new ButtonComponent(li).setButtonText('View').onClick(() => {
									const previewImageModal = new Modal(this.app)
									previewImageModal.titleEl.createEl('header', {
										text: assetSource,
									})
									previewImageModal.contentEl.createEl('img', undefined, async (img) => {
										const asset = await assetStore.getFromIndexedDB(assetSource)
										if (!asset) return
										img.src = asset
									})
									previewImageModal.open()
								})
							}
						}
					)
				}
			})
		})

		assetStore.getAllFromMarkdownFile().then((assetSourcesMarkdown) => {
			this.contentEl.createDiv(undefined, async (div) => {
				if (assetSourcesMarkdown.length === 0) {
					div.createEl('p', {
						text: 'No assets references in the markdown file.',
					})
				} else {
					div.createEl(
						'ul',
						{
							text: `${assetSourcesMarkdown.length} asset reference(s) in the markdown file`,
						},
						(ul) => {
							for (const assetSource of assetSourcesMarkdown) {
								const li = ul.createEl('li', {
									text: assetSource,
								})
								new ButtonComponent(li).setButtonText('View').onClick(() => {
									const previewImageModal = new Modal(this.app)
									previewImageModal.titleEl.createEl('header', {
										text: assetSource,
									})
									previewImageModal.contentEl.createEl('img', undefined, async (img) => {
										const asset = await assetStore.getFromMarkdown(assetSource)
										if (!asset) return
										img.src = asset
									})
									previewImageModal.open()
								})
							}
						}
					)
				}
			})
		})
	}
}
