// @ts-check
// Runs the rules from the Obsidian community directory's automated review. It is separate from
// eslint.config.mjs so the two rule sets can be adopted independently: `npm run lint:obsidian`.
import { defineConfig } from 'eslint/config'
import obsidianmd from 'eslint-plugin-obsidianmd'

export default defineConfig([
	...obsidianmd.configs.recommended,
	{
		files: ['**/*.ts', '**/*.tsx'],
		languageOptions: {
			parserOptions: {
				projectService: {
					allowDefaultProject: ['eslint.*.config.mjs'],
				},
				tsconfigRootDir: import.meta.dirname,
			},
		},
		rules: {
			// TypeScript already reports undefined names, including the globals injected at build time.
			'no-undef': 'off',
		},
	},
])
