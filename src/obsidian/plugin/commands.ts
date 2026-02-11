import { Editor, EditorPosition, Notice, TFile } from 'obsidian'
import TldrawPlugin from 'src/main'
import { TldrawDocument } from 'src/obsidian/plugin/document'
import {
	FILE_EXTENSION,
	PANE_TARGETS,
	PaneTarget,
	VIEW_TYPE_MARKDOWN,
	VIEW_TYPE_TLDRAW,
} from 'src/utils/constants'
import { importTldrawFile } from 'src/utils/file'
import { TLDRAW_FILE_EXTENSION } from 'tldraw'

async function createTldrawFile(
	plugin: TldrawPlugin,
	{
		attachTo,
		inMarkdown,
	}: {
		inMarkdown: boolean
		attachTo?: TFile
	}
) {
	try {
		return await TldrawDocument.create(plugin, { inMarkdown, attachTo })
	} catch (e) {
		new Notice(
			e instanceof Error
				? e.message
				: (() => {
					console.error(e)
					return 'An unknown error occurred while creating a new tldraw file.'
				})()
		)
	}
}

function editorInsert(
	tldrawDocument: TldrawDocument,
	editor: Editor,
	from: EditorPosition,
	to: EditorPosition
) {
	editor.replaceRange(`![[${tldrawDocument.path}]]`, from, to)
}

const paneTargetNameRecord = {
	'current-tab': 'Current tab',
	'new-tab': 'New tab',
	'new-window': 'New window',
	'split-tab': 'Split tab',
} satisfies Record<PaneTarget, string>

type CreateOptions = {
	inMarkdown: boolean
	pane?: PaneTarget
}

function createCommandId(inMarkdown: boolean, pane?: PaneTarget) {
	return (
		`new-tldraw-file-` +
		(inMarkdown ? FILE_EXTENSION : TLDRAW_FILE_EXTENSION) +
		(!pane ? '' : `-${pane}`)
	)
}

function addCreateNewDrawingCommand(plugin: TldrawPlugin, options: CreateOptions) {
	const { inMarkdown, pane } = options
	const extension = inMarkdown ? FILE_EXTENSION : TLDRAW_FILE_EXTENSION
	plugin.addCommand({
		id: createCommandId(inMarkdown, pane),
		name:
			`Create a new drawing (${extension})` +
			(!pane ? '' : `, then open in ${paneTargetNameRecord[pane]}`),
		callback: () =>
			createTldrawFile(plugin, {
				inMarkdown,
				attachTo: plugin.app.workspace.activeEditor?.file || undefined,
			}).then((tldrawDoc) => pane && tldrawDoc?.open(pane)),
	})
}

function addCreateNewDrawingAndEmbedCommand(plugin: TldrawPlugin, options: CreateOptions) {
	const { inMarkdown, pane } = options
	const extension = inMarkdown ? FILE_EXTENSION : TLDRAW_FILE_EXTENSION
	plugin.addCommand({
		id: `embed-${createCommandId(inMarkdown, pane)}`,
		name:
			`Embed a new drawing (${extension}) in current document` +
			(!pane ? '' : `, then open in ${paneTargetNameRecord[pane]}`),
		editorCallback: async (editor, ctx) => {
			const { file } = ctx
			if (file === null) {
				throw new Error('ctx.file was null')
			}
			const from = editor.getCursor('from')
			const to = editor.getCursor('to')

			const newFile = await createTldrawFile(plugin, {
				inMarkdown,
				attachTo: file,
			})

			if (!newFile) return

			// Insert the link to the new file into the editor before opening it in case the current editor is closed as a result of opening the new file.
			editorInsert(newFile, editor, from, to)

			if (pane) {
				await newFile.open(pane)
			}
		},
	})
}

export function registerCommands(plugin: TldrawPlugin) {
	plugin.addCommand({
		id: 'toggle-view-mode',
		name: 'Toggle view mode',
		checkCallback: (checking) => {
			const file = plugin.app.workspace.getActiveFile()
			if (!file) return false

			const fileIsTldraw = plugin.isTldrawFile(file)
			if (checking) return fileIsTldraw

			const leaf = plugin.app.workspace.getLeaf(false)
			const currentViewMode = plugin.getLeafFileViewMode(leaf, file)
			const oppositeViewMode =
				currentViewMode === VIEW_TYPE_MARKDOWN ? VIEW_TYPE_TLDRAW : VIEW_TYPE_MARKDOWN
			plugin.updateViewMode(oppositeViewMode, leaf)
		},
	})

	for (const pane of PANE_TARGETS) {
		addCreateNewDrawingCommand(plugin, {
			pane,
			inMarkdown: true,
		})
		addCreateNewDrawingAndEmbedCommand(plugin, {
			pane,
			inMarkdown: true,
		})
	}

	addCreateNewDrawingCommand(plugin, {
		inMarkdown: false,
		pane: 'new-tab',
	})

	plugin.addCommand({
		id: 'import-new-tldraw-file-new-tab',
		name: 'Import file as new document and open in a new tab',
		callback: async () => {
			const tFile = await importTldrawFile(plugin)
			await plugin.openTldrFile(tFile, 'new-tab')
		},
	})

	plugin.addCommand({
		id: 'import-new-tldraw-file-embed',
		name: 'Import file as new document and embed as attachment',
		editorCallback: async (editor, ctx) => {
			const { file } = ctx
			if (file === null) {
				console.log(ctx)
				throw new Error('ctx.file was null')
			}
			const from = editor.getCursor('from')
			const to = editor.getCursor('to')
			const tFile = await importTldrawFile(plugin, file)
			editorInsert(new TldrawDocument(plugin, tFile), editor, from, to)
		},
	})

	plugin.addCommand({
		id: 'open-vault-audit-modal',
		name: '[Vault] Scan for loose assets',
		checkCallback: (checking: boolean) => {
			if (checking) {
				return true
			}
			plugin.instance.auditSessionManager.openModal()
		},
	})
}
