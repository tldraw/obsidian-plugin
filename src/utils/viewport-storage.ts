const PREFIX = 'tldraw-viewport'

function storageKey(vaultName: string, filePath: string): string {
	return `${PREFIX}:${vaultName}:${filePath}`
}

export function saveViewport(vaultName: string, filePath: string, deepLinkString: string): void {
	try {
		localStorage.setItem(storageKey(vaultName, filePath), deepLinkString)
	} catch {
		// localStorage may be full or unavailable
	}
}

export function getViewport(vaultName: string, filePath: string): string | null {
	try {
		return localStorage.getItem(storageKey(vaultName, filePath))
	} catch {
		return null
	}
}

export function removeViewport(vaultName: string, filePath: string): void {
	try {
		localStorage.removeItem(storageKey(vaultName, filePath))
	} catch {
		// ignore
	}
}
