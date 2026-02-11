import { Notice } from 'obsidian'
import TldrawPlugin from 'src/main'
import { FontTypes } from 'src/types/tldraw'
import { DownloadInfo } from 'src/utils/fetch/download'
import { updateFontOverrides } from '../plugin/settings'
import { defaultFonts } from './constants'

export default class FontsSettingsManager {
	static readonly FONT_DOWNLOAD_BASE_URL = `https://raw.githubusercontent.com/tldraw/tldraw/refs/tags/v${TLDRAW_VERSION}/assets/fonts`
	private onChangedCallbacks = new Map<FontTypes, () => void>()

	constructor(public readonly plugin: TldrawPlugin) {}

	static getFontUrl(font: FontTypes) {
		const fontName = defaultFonts[font]
		return `${FontsSettingsManager.FONT_DOWNLOAD_BASE_URL}/${fontName}`
	}

	get overrides() {
		return this.plugin.settings.fonts?.overrides ?? {}
	}

	onChanged(font: FontTypes, callback: () => void) {
		this.onChangedCallbacks.set(font, callback)
		return () => {
			if (this.onChangedCallbacks.get(font) === callback) {
				this.onChangedCallbacks.delete(font)
			}
		}
	}

	getDownloadConfig(font: FontTypes): DownloadInfo {
		return {
			url: FontsSettingsManager.getFontUrl(font),
			destination: `${this.plugin.settings.fileDestinations.assetsFolder}/fonts/${defaultFonts[font]}`,
		}
	}

	getAllAssetsConfigs() {
		return new Map<keyof typeof defaultFonts, DownloadInfo>(
			Object.keys(defaultFonts).map(
				(e) =>
					[
						e as keyof typeof defaultFonts,
						this.getDownloadConfig(e as keyof typeof defaultFonts),
					] as const
			)
		)
	}

	async saveFontSettings(
		updates:
			| {
					[fontType in FontTypes]?: string | null
			  }
			| null
	) {
		this.plugin.settings.fonts =
			updates === null
				? undefined
				: {
						overrides: updateFontOverrides(this.plugin.settings.fonts?.overrides, updates),
					}
		await this.plugin.saveSettings()

		if (updates === null) {
			for (const callback of this.onChangedCallbacks.values()) {
				callback()
			}
		} else {
			for (const fontType of Object.keys(updates)) {
				this.onChangedCallbacks.get(fontType as FontTypes)?.()
			}
		}
	}

	async setFontPath(font: FontTypes, fontFile: string | null): Promise<void> {
		if (fontFile !== null && fontFile.length === 0) {
			fontFile = null
		}
		await this.saveFontSettings({ [font]: fontFile })
		if (fontFile) {
			new Notice(`Updated font override for "${font}" to "${fontFile}"`)
		} else {
			new Notice(`Reset font "${font}" to default.`)
		}
	}
}
