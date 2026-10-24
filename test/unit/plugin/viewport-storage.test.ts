import type { App } from 'obsidian'
import { describe, expect, it } from 'vitest'
import { getViewport, removeViewport, saveViewport } from 'src/plugin/viewport-storage'

/**
 * Stands in for `App#saveLocalStorage`/`loadLocalStorage`, which keep entries per vault. Passing
 * `null` removes the entry, and a missing entry loads as `null`.
 */
function createApp() {
	const storage = new Map<string, unknown>()
	const app = {
		saveLocalStorage: (key: string, data: unknown | null) => {
			if (data === null) storage.delete(key)
			else storage.set(key, data)
		},
		loadLocalStorage: (key: string) => storage.get(key) ?? null,
	} as unknown as App
	return { app, storage }
}

describe('viewport-storage', () => {
	it('round-trips a viewport deep link per file', () => {
		const { app } = createApp()
		saveViewport(app, 'notes/drawing.md', 'v123.456.7.8')
		expect(getViewport(app, 'notes/drawing.md')).toBe('v123.456.7.8')
	})

	it('uses the documented storage key format', () => {
		const { app, storage } = createApp()
		saveViewport(app, 'a.md', 'deep')
		expect(storage.get('tldraw-viewport:a.md')).toBe('deep')
	})

	it('isolates entries between files and between apps', () => {
		const vaultA = createApp().app
		const vaultB = createApp().app
		saveViewport(vaultA, 'a.md', 'one')
		saveViewport(vaultB, 'a.md', 'two')
		saveViewport(vaultA, 'b.md', 'three')
		expect(getViewport(vaultA, 'a.md')).toBe('one')
		expect(getViewport(vaultB, 'a.md')).toBe('two')
		expect(getViewport(vaultA, 'b.md')).toBe('three')
	})

	it('returns null for missing entries and removes cleanly', () => {
		const { app } = createApp()
		expect(getViewport(app, 'missing.md')).toBeNull()
		saveViewport(app, 'x.md', 'v')
		removeViewport(app, 'x.md')
		expect(getViewport(app, 'x.md')).toBeNull()
	})

	it('returns null instead of throwing when storage is unavailable', () => {
		const app = {
			saveLocalStorage: () => {
				throw new Error('unavailable')
			},
			loadLocalStorage: () => {
				throw new Error('unavailable')
			},
		} as unknown as App
		expect(() => saveViewport(app, 'a.md', 'v')).not.toThrow()
		expect(getViewport(app, 'a.md')).toBeNull()
	})
})
