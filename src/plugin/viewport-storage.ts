import type { App } from 'obsidian'

const PREFIX = 'tldraw-viewport'

/**
 * `App#saveLocalStorage` keeps entries per vault, so the key only needs the file path.
 */
function storageKey(filePath: string): string {
	return `${PREFIX}:${filePath}`
}

export function saveViewport(app: App, filePath: string, deepLinkString: string): void {
	try {
		app.saveLocalStorage(storageKey(filePath), deepLinkString)
	} catch {
		// Local storage may be full or unavailable
	}
}

export function getViewport(app: App, filePath: string): string | null {
	try {
		const value: unknown = app.loadLocalStorage(storageKey(filePath))
		return typeof value === 'string' ? value : null
	} catch {
		return null
	}
}

export function removeViewport(app: App, filePath: string): void {
	try {
		app.saveLocalStorage(storageKey(filePath), null)
	} catch {
		// ignore
	}
}
