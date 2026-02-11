import { ButtonComponent, MetadataCache, Modal, Setting, TextComponent, TFile } from 'obsidian'
import { Root } from 'react-dom/client'
import { createRootAndRenderTldrawApp, TldrawAppProps } from 'src/components/TldrawApp'
import { tldrawStoreIndexedDBName } from 'src/tldraw/indexeddb-store'
import { TLDataDocumentStore } from 'src/utils/document'
import { StoreSnapshot, TLRecord } from 'tldraw'
import { getFrontMatterList } from '../helpers/front-matter'
import { TldrawView } from '../TldrawView'

export class TldrawStoreConflictResolveFileUnloaded extends Error {}
export class TldrawStoreConflictResolveCanceled extends Error {
	constructor(
		private readonly view: TldrawView,
		private readonly tFile: TFile,
		private readonly documentStore: TLDataDocumentStore
	) {
		super(TldrawStoreConflictResolveCanceled.name)
	}

	reshowModal() {
		return TldrawStoreExistsIndexedDBModal.showResolverModal(
			this.view,
			this.tFile,
			this.documentStore
		)
	}
}

const dataDocumentFlagsKey = 'tl-data-document-flags'
const ignoreIndexedDbStoreFlag = 'ignore-indexed-db-store'

export default class TldrawStoreExistsIndexedDBModal extends Modal {
	private markdownStorePreview: HTMLElement
	private indexedDBStorePreview: HTMLElement
	private markdownTldrawRoot?: Root
	private indexedDBTldrawRoot?: Root
	private replaceButton?: ButtonComponent

	static ignoreIndexedDBStoreModal(metadataCache: MetadataCache, tFile: TFile) {
		const tlDataDocumentFlags = getFrontMatterList(metadataCache, tFile, dataDocumentFlagsKey)
		return !tlDataDocumentFlags ? false : tlDataDocumentFlags.includes(ignoreIndexedDbStoreFlag)
	}

	static showResolverModal(
		view: TldrawView,
		tFile: TFile,
		documentStore: TLDataDocumentStore
	): Promise<StoreSnapshot<TLRecord> | undefined> {
		return new Promise((res, rej) => {
			new TldrawStoreExistsIndexedDBModal(view, tFile, documentStore, res, rej).open()
		})
	}

	constructor(
		private readonly view: TldrawView,
		private readonly tFile: TFile,
		private readonly documentStore: TLDataDocumentStore,
		private readonly res: (snapshot?: StoreSnapshot<TLRecord>) => void,
		private readonly rej: (reason?: unknown) => void
	) {
		super(view.fileView.app)

		view.registerOnUnloadFile(() => {
			this.close()
			rej(new TldrawStoreConflictResolveFileUnloaded())
		})

		this.modalEl.addClass('ptl-compare-modal')

		this.setTitle(`Conflict resolver - ${tFile.path}`)

		this.contentEl.addClass('ptl-compare-modal-content')

		this.contentEl.createEl('p', {
			cls: 'ptl-conflict-reason',
			text: "Why are you seeing this? Previous versions of this plugin stored the tldraw document in the markdown file and in Obsidian's IndexedDB. We no longer store drawings in the IndexedDB, so here are a few options:",
		})

		this.contentEl.createDiv(
			{
				cls: 'ptl-conflict-options',
			},
			(div) => {
				new Setting(div)
					.setName('Ignore pop-up')
					.setDesc(
						`Don't show this pop-up again for this file. It adds a "${ignoreIndexedDbStoreFlag}" flag in the property "${dataDocumentFlagsKey}", so removing that flag shows this pop-up again.`
					)
					.addToggle((toggle) => {
						const ignoreIndexedDbStore = TldrawStoreExistsIndexedDBModal.ignoreIndexedDBStoreModal(
							this.app.metadataCache,
							tFile
						)
						toggle.setValue(ignoreIndexedDbStore)
						toggle.onChange((ignoreIndexedDbStore) => {
							this.app.fileManager.processFrontMatter(tFile, (frontMatter) => {
								const tlDataDocumentFlags = frontMatter[dataDocumentFlagsKey]
								if (Array.isArray(tlDataDocumentFlags)) {
									if (!ignoreIndexedDbStore) {
										tlDataDocumentFlags.remove(ignoreIndexedDbStoreFlag)
									} else {
										!tlDataDocumentFlags.includes(ignoreIndexedDbStoreFlag) &&
											tlDataDocumentFlags.push(ignoreIndexedDbStoreFlag)
									}
									frontMatter[dataDocumentFlagsKey] = tlDataDocumentFlags
								} else if (ignoreIndexedDbStore) {
									frontMatter[dataDocumentFlagsKey] = [ignoreIndexedDbStoreFlag]
								}
							})
						})
					})
				new Setting(div)
					.setName('Edit markdown version')
					.setDesc('Uses the tldraw data stored in the markdown file and opens the editor.')
					.addButton((button) =>
						button.setButtonText('Edit').onClick(() => {
							res()
							this.close()
						})
					)
				new Setting(div)
					.setName('Restore IndexedDB version')
					.setDesc(
						'Replaces the data in the markdown file with the data in the IndexedDB and opens the editor.'
					)
					.addButton(
						(button) =>
							(this.replaceButton = button.setButtonText('Loading snapshot').setDisabled(true))
					)
			}
		)

		const conflictBodyEl = this.contentEl.createDiv({ cls: 'ptl-conflict-body' })

		const compareEl = conflictBodyEl.createDiv({
			cls: 'ptl-compare-tldraw-container',
		})

		compareEl.createDiv(
			{
				cls: 'ptl-compare-tldraw',
			},
			(div) => {
				div.createEl('b', { text: `Markdown file store` })
				new TextComponent(div).setValue(tFile.path).inputEl.readOnly = true

				this.markdownStorePreview = div.createDiv({
					cls: 'ptl-compare-preview',
				})
			}
		)

		compareEl.createDiv(
			{
				cls: 'ptl-compare-tldraw',
			},
			(div) => {
				div.createEl('b', { text: `IndexedDB Store` })
				new TextComponent(div).setValue(
					tldrawStoreIndexedDBName(documentStore.meta.uuid)
				).inputEl.readOnly = true

				this.indexedDBStorePreview = div.createDiv({
					cls: 'ptl-compare-preview',
				})
			}
		)
	}

	reset() {
		this.markdownTldrawRoot?.unmount()
		this.markdownTldrawRoot = undefined
		this.indexedDBTldrawRoot?.unmount()
		this.indexedDBTldrawRoot = undefined
	}

	onOpen(): void {
		super.onOpen()
		this.reset()

		const sharedAppProps = {
			focusOnMount: false,
			isReadonly: true,
			selectNone: true,
			initialTool: 'hand',
			onEditorMount: (editor) => editor.zoomToFit(),
		} satisfies TldrawAppProps['options']

		this.markdownTldrawRoot = createRootAndRenderTldrawApp(
			this.markdownStorePreview,
			this.view.plugin,
			{
				store: { plugin: this.documentStore },
				app: sharedAppProps,
			}
		)
		this.indexedDBTldrawRoot = createRootAndRenderTldrawApp(
			this.indexedDBStorePreview,
			this.view.plugin,
			{
				store: {
					tldraw: {
						persistenceKey: this.documentStore.meta.uuid,
						// We use share the same asset store since some assets may have been stored in the markdown.
						assets: this.documentStore.store.props.assets,
					},
				},
				app: {
					...sharedAppProps,
					onInitialSnapshot: (snapshot) => {
						this.replaceButton
							?.setButtonText('Restore')
							.onClick(() => {
								this.res(snapshot)
								this.close()
							})
							.setDisabled(false)
						// this.replaceAndDeleteButton?.setButtonText('Replace with this version and DELETE this version').onClick(async () => {
						//     // TODO: Check if any assets are stored in the snapshot or indexed db, and ask the user if they want to transfer those as vault files well.
						//     this.res(snapshot);
						//     try {
						//         // await TldrawStoreViewIndexedDB.delete(this.documentStore.meta.uuid);
						//         this.close();
						//     } catch (e) {
						//         new Notice('Unable to delete indexed db (see developer console for more details)');
						//         console.error(e);
						//     }
						// }).setDisabled(false);
					},
				},
			}
		)
	}

	onClose(): void {
		this.reset()
		this.rej(new TldrawStoreConflictResolveCanceled(this.view, this.tFile, this.documentStore))
		super.onClose()
	}
}
