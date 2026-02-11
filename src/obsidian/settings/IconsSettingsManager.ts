import { Notice } from 'obsidian'
import TldrawPlugin from 'src/main'
import { IconNames } from 'src/types/tldraw'
import { DownloadInfo } from 'src/utils/fetch/download'
import { updateIconOverrides } from '../plugin/settings'
import { iconTypes } from './constants'

export default class IconsSettingsManager {
	static readonly ICON_DOWNLOAD_BASE_URL = `https://raw.githubusercontent.com/tldraw/tldraw/refs/tags/v${TLDRAW_VERSION}/assets/icons/icon`
	private onChangedCallbacks = new Map<IconNames, () => void>()

	constructor(public readonly plugin: TldrawPlugin) {}

	static getIconUrl(icon: IconNames) {
		return `${IconsSettingsManager.ICON_DOWNLOAD_BASE_URL}/${icon}.svg` as const
	}

	getDownloadConfig(icon: IconNames): DownloadInfo {
		return {
			url: IconsSettingsManager.getIconUrl(icon),
			destination: `${this.plugin.settings.fileDestinations.assetsFolder}/icons/${icon}.svg`,
		}
	}

	getAllDownloadConfigs() {
		return new Map<IconNames, DownloadInfo>(
			iconTypes.map((e) => [e, this.getDownloadConfig(e)] as const)
		)
	}

	get overrides() {
		return this.plugin.settings.icons?.overrides ?? {}
	}

	onChanged(icon: IconNames, callback: () => void) {
		this.onChangedCallbacks.set(icon, callback)
		return () => {
			if (this.onChangedCallbacks.get(icon) === callback) {
				this.onChangedCallbacks.delete(icon)
			}
		}
	}

	async saveIconSettings(
		updates:
			| {
					[iconName in IconNames]?: string | null
			  }
			| null
	) {
		this.plugin.settings.icons =
			updates === null
				? undefined
				: {
						overrides: updateIconOverrides(this.plugin.settings.icons?.overrides, updates),
					}
		await this.plugin.saveSettings()

		if (updates === null) {
			for (const callback of this.onChangedCallbacks.values()) {
				callback()
			}
		} else {
			for (const iconType of Object.keys(updates)) {
				this.onChangedCallbacks.get(iconType as IconNames)?.()
			}
		}
	}

	async setIconPath(icon: IconNames, iconFile: string | null): Promise<void> {
		if (iconFile !== null && iconFile.length === 0) {
			iconFile = null
		}
		await this.saveIconSettings({ [icon]: iconFile })
		if (iconFile) {
			new Notice(`Updated icon override for "${icon}" to "${iconFile}"`)
		} else {
			new Notice(`Reset icon "${icon}" to default.`)
		}
	}
}
