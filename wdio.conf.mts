/// <reference types="wdio-obsidian-service" />
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import * as path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = __dirname

// For testing multiple Obsidian versions or parallel instances, see
// https://github.com/jesse-r-s-hines/wdio-obsidian-service-sample-plugin/blob/main/wdio.conf.mts
// (parseObsidianVersions, OBSIDIAN_VERSIONS, WDIO_MAX_INSTANCES).

export const config: WebdriverIO.Config = {
	rootDir: projectRoot,
	runner: 'local',
	framework: 'mocha',
	specs: ['./test/specs/**/*.e2e.ts'],
	maxInstances: 1,
	capabilities: [
		{
			browserName: 'obsidian',
			browserVersion: 'latest',
			'wdio:obsidianOptions': {
				installerVersion: 'earliest',
				plugins: [getTldrawPlugin()],
				vault: path.join(projectRoot, 'test', 'vaults', 'default'),
			},
		},
	],
	services: ['obsidian'],
	reporters: ['obsidian'],
	cacheDir: path.join(projectRoot, '.wdio'),
	mochaOpts: {
		ui: 'bdd',
		timeout: 60000,
	},
	logLevel: 'warn',
}

function getTldrawPlugin() {
	const version = process.env.TLDRAW_PLUGIN_VERSION
	if (version) {
		return {
			id: 'tldraw',
			version,
		}
	}

	const pluginDir = process.env.TLDRAW_PLUGIN_DIR ?? path.join(projectRoot, 'dist', 'production')

	if (!existsSync(pluginDir)) {
		console.error(`Plugin not found at "${pluginDir}".`)
		console.error('Please do one of the following:')
		console.error(`- Run 'npm run build' to generate the production plugin.`)
		console.error(
			'- Set the TLDRAW_PLUGIN_VERSION environment variable to the version of the plugin you want to test.'
		)
		console.error(
			'- Set the TLDRAW_PLUGIN_DIR environment variable to the directory of the plugin you want to test.'
		)
		process.exit(1)
	}

	return pluginDir
}
