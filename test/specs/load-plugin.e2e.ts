import { browser, expect } from '@wdio/globals'

declare module 'obsidian' {
    // Don't worry, this exists in the obsidian API but is not typed
    interface App {
        plugins: {
            plugins: Record<string, {
                manifest: {
                    version: string
                }
            }>
        }
    }
}

describe('Load Plugin', () => {
    before(async () => {
        await browser.reloadObsidian({
            plugins: ['tldraw'],
        })
    })

    it('Should appear in the plugin list', async () => {
        const result = await browser.executeObsidian(({app}) => {
            return Object.keys(app.plugins.plugins)
        })

        expect(result).toContain('tldraw')
    })
})
