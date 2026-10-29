import { readFileSync } from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vitest/config'

/**
 * Mirror the build-time defines from scripts/build.mts so modules relying on
 * them (e.g. src/utils/document.ts) can run under vitest.
 */
const TLDRAW_VERSION = (() => {
	const tldrawPackageJsonPath = path.join(
		import.meta.dirname,
		'node_modules',
		'tldraw',
		'package.json'
	)
	const json = JSON.parse(readFileSync(tldrawPackageJsonPath, 'utf8'))
	return json.version as string
})()

export default defineConfig({
	define: {
		TLDRAW_VERSION: JSON.stringify(TLDRAW_VERSION),
	},
	resolve: {
		alias: {
			// The real `obsidian` package is types-only (the runtime is provided by the
			// Obsidian app), so unit tests substitute a minimal stub.
			obsidian: path.join(import.meta.dirname, 'test', 'unit', 'helpers', 'obsidian-stub.ts'),
			src: path.join(import.meta.dirname, 'src'),
		},
	},
	test: {
		environment: 'jsdom',
		include: ['test/unit/**/*.test.ts'],
	},
})
