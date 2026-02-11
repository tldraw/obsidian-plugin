import { App } from 'obsidian'
import { createStore, Store } from 'src/lib/stores'
import { TldrawDocument } from './document'

export interface BaseEntry {}

type Content = Awaited<ReturnType<TldrawDocument['getInstance']>>

export interface ParseResult<T extends BaseEntry> {
	entries: T[]
	content: Content
	name: string
}

export interface AuditResult<T extends BaseEntry> {
	document: TldrawDocument
	error?: unknown
	data?: {
		looseEntries: T[]
		stats: {
			total: number
			looseEntryCount: number
		}
	}
}

export interface AuditSessionState<T extends BaseEntry> {
	current: AuditResult<T> | null
	canGoBack: boolean
	canGoForward: boolean
	progress: string
	isDone: boolean
	isActive: boolean
	isOpen: boolean
	isAuditingAll: boolean
	resultsWithLooseEntries: {
		document: TldrawDocument
		count: number
		index: number
		entries: T[]
	}[]
}

export interface RefCollection<T extends BaseEntry> {
	includesEntry(entry: T): boolean
}

export interface AuditCallbacks<T extends BaseEntry> {
	parse(document: TldrawDocument): Promise<ParseResult<T>>
	findReferences(content: Content): RefCollection<T>
}

export type AuditSessionStartParams<T extends BaseEntry> = [
	documents: TldrawDocument[],
	parser: AuditCallbacks<T>['parse'],
	refFinder: AuditCallbacks<T>['findReferences'],
]

export class AuditSessionManager<T extends BaseEntry> {
	public readonly store: Store<AuditSessionState<T>>
	private history: AuditResult<T>[] = []
	private index = -1
	private iterator: AsyncGenerator<AuditResult<T>> | null = null
	private documents: TldrawDocument[] = []
	private parser: AuditCallbacks<T>['parse'] | null = null
	private refFinder: AuditCallbacks<T>['findReferences'] | null = null

	constructor(private app: App) {
		this.store = createStore<AuditSessionState<T>>({
			current: null,
			canGoBack: false,
			canGoForward: false,
			progress: '0 / 0',
			isDone: false,
			isActive: false,
			isOpen: false,
			isAuditingAll: false,
			resultsWithLooseEntries: [],
		})
	}

	start(...[documents, parser, refFinder]: AuditSessionStartParams<T>) {
		this.documents = documents
		this.parser = parser
		this.refFinder = refFinder
		this.history = []
		this.index = -1
		this.iterator = this.entryAuditGenerator(documents, parser, refFinder)

		this.store.setState({
			current: null,
			canGoBack: false,
			canGoForward: true,
			progress: `0 / ${documents.length}`,
			isDone: false,
			isActive: true,
			isOpen: true,
			resultsWithLooseEntries: [],
		})

		// Auto-load first item
		this.stepForward()
	}

	stop() {
		this.iterator = null
		this.documents = []
		this.history = []
		this.index = -1
		this.store.setState({
			current: null,
			canGoBack: false,
			canGoForward: false,
			progress: '0 / 0',
			isDone: false,
			isActive: false,
			isOpen: false,
			resultsWithLooseEntries: [],
		})
	}

	openModal() {
		this.store.setState({ isOpen: true })
	}

	closeModal() {
		this.store.setState({ isOpen: false })
	}

	async stepForward(): Promise<AuditResult<T> | null> {
		if (!this.iterator) return null

		if (this.index < this.history.length - 1) {
			this.index++
			const current = this.history[this.index]
			this.updateState()
			return current
		}

		const { value, done } = await this.iterator.next()
		if (done) {
			this.store.setState({ isDone: true, canGoForward: false })
			return null
		}

		this.history.push(value)
		this.index = this.history.length - 1
		this.updateState()
		return value
	}

	stepBackward(): AuditResult<T> | null {
		if (this.index <= 0) {
			if (this.history.length > 0) return this.history[0]
			return null
		}
		this.index--
		this.updateState()
		return this.history[this.index]
	}

	async auditAll() {
		if (!this.iterator || this.store.getState().isAuditingAll) return

		this.store.setState({ isAuditingAll: true })

		try {
			while (!this.store.getState().isDone && this.store.getState().isActive) {
				const res = await this.stepForward()
				if (!res) break
			}
		} finally {
			this.store.setState({ isAuditingAll: false })
		}
	}

	setIndex(index: number) {
		if (index < 0 || index >= this.history.length) return
		this.index = index
		this.updateState()
	}

	async refreshCurrent(): Promise<AuditResult<T> | null> {
		if (this.index < 0 || this.index >= this.history.length || !this.parser || !this.refFinder)
			return null
		const document = this.documents[this.index]
		try {
			const { entries, content } = await this.parser(document)
			const foundReferences = this.refFinder(content)
			const looseEntries = entries.filter((entry) => !foundReferences.includesEntry(entry))
			const value: AuditResult<T> = {
				document,
				data: {
					looseEntries,
					stats: {
						total: entries.length,
						looseEntryCount: looseEntries.length,
					},
				},
			}
			this.history[this.index] = value
			this.updateState(value) // Force update with new reference
			return value
		} catch (error) {
			const value = { document, error }
			this.history[this.index] = value
			this.updateState(value)
			return value
		}
	}

	private updateState(currentOverride?: AuditResult<T>) {
		const current = currentOverride || this.history[this.index]
		const resultsWithLooseEntries = this.history
			.map((result, index) => ({
				document: result.document,
				count: result.data?.stats.looseEntryCount || 0,
				index,
				entries: result.data?.looseEntries || [],
			}))
			.filter((res) => res.count > 0)

		this.store.setState({
			current,
			canGoBack: this.index > 0,
			canGoForward:
				this.index < this.history.length - 1 || this.history.length < this.documents.length,
			progress: `${this.index + 1} / ${this.documents.length}`,
			resultsWithLooseEntries,
		})
	}

	private async *entryAuditGenerator(
		documents: TldrawDocument[],
		parser: AuditCallbacks<T>['parse'],
		refFinder: AuditCallbacks<T>['findReferences']
	): AsyncGenerator<AuditResult<T>> {
		for (const document of documents) {
			try {
				const { entries, content } = await parser(document)
				const foundReferences = refFinder(content)
				const looseEntries = entries.filter((entry) => !foundReferences.includesEntry(entry))
				yield {
					document,
					data: {
						looseEntries,
						stats: {
							total: entries.length,
							looseEntryCount: looseEntries.length,
						},
					},
				}
			} catch (error) {
				yield { document, error }
			}
		}
	}
}
