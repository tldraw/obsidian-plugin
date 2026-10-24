import { beforeEach, describe, expect, it } from 'vitest'
import { getViewport, removeViewport, saveViewport } from 'src/utils/viewport-storage'

describe('viewport-storage', () => {
	beforeEach(() => {
		localStorage.clear()
	})

	it('round-trips a viewport deep link per vault+file', () => {
		saveViewport('VaultA', 'notes/drawing.md', 'v123.456.7.8')
		expect(getViewport('VaultA', 'notes/drawing.md')).toBe('v123.456.7.8')
	})

	it('uses the documented storage key format', () => {
		saveViewport('VaultA', 'a.md', 'deep')
		expect(localStorage.getItem('tldraw-viewport:VaultA:a.md')).toBe('deep')
	})

	it('isolates entries between vaults and files', () => {
		saveViewport('VaultA', 'a.md', 'one')
		saveViewport('VaultB', 'a.md', 'two')
		saveViewport('VaultA', 'b.md', 'three')
		expect(getViewport('VaultA', 'a.md')).toBe('one')
		expect(getViewport('VaultB', 'a.md')).toBe('two')
		expect(getViewport('VaultA', 'b.md')).toBe('three')
	})

	it('returns null for missing entries and removes cleanly', () => {
		expect(getViewport('VaultA', 'missing.md')).toBeNull()
		saveViewport('VaultA', 'x.md', 'v')
		removeViewport('VaultA', 'x.md')
		expect(getViewport('VaultA', 'x.md')).toBeNull()
	})
})
