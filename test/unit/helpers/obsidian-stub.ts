/**
 * Minimal runtime stub for the `obsidian` package, which ships type
 * declarations only (the implementation lives inside the Obsidian app).
 *
 * Only the values used *at runtime* by modules under unit test need to exist
 * here; type-only imports are erased by the TS transform.
 */

export function normalizePath(path: string): string {
	// Approximates Obsidian's normalizePath: forward slashes, collapse
	// duplicate separators, strip leading/trailing slashes.
	let result = path.replace(/\\/g, '/').replace(/\/+/g, '/')
	result = result.replace(/^\//, '').replace(/\/$/, '')
	return result === '' ? '/' : result
}

export class Notice {
	static lastMessage: unknown
	constructor(
		public message?: unknown,
		public duration?: number
	) {
		Notice.lastMessage = message
	}
	setMessage(message: unknown) {
		this.message = message
		return this
	}
	hide() {}
}

export class TAbstractFile {
	path = ''
	name = ''
	parent: TFolder | null = null
}

export class TFile extends TAbstractFile {
	basename = ''
	extension = ''
	stat = { ctime: 0, mtime: 0, size: 0 }
}

export class TFolder extends TAbstractFile {
	children: TAbstractFile[] = []
	isRoot() {
		return this.path === '/'
	}
}

export const Platform = {
	isMobile: false,
	isDesktop: true,
}

export function debounce<TArgs extends unknown[]>(
	fn: (...args: TArgs) => unknown,
	timeout = 0,
	resetTimer = false
) {
	let timer: ReturnType<typeof setTimeout> | undefined
	const debounced = (...args: TArgs) => {
		if (resetTimer && timer !== undefined) clearTimeout(timer)
		if (!resetTimer && timer !== undefined) return debounced
		timer = setTimeout(() => {
			timer = undefined
			fn(...args)
		}, timeout)
		return debounced
	}
	debounced.cancel = () => {
		if (timer !== undefined) clearTimeout(timer)
		timer = undefined
		return debounced
	}
	return debounced
}

export class Modal {
	modalEl = document.createElement('div')
	contentEl = document.createElement('div')
	isOpen = false
	private closeCallback?: () => void
	constructor(public app?: unknown) {}
	setCloseCallback(callback: () => void) {
		this.closeCallback = callback
		return this
	}
	open() {
		this.isOpen = true
	}
	close() {
		if (!this.isOpen) return
		this.isOpen = false
		this.closeCallback?.()
	}
}
