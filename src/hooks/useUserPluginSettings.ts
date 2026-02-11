import { useSyncExternalStore } from 'react'
import UserSettingsManager from 'src/obsidian/settings/UserSettingsManager'

export default function useUserPluginSettings(settingsManager: UserSettingsManager) {
	const settings = useSyncExternalStore(settingsManager.store.subscribe, settingsManager.store.get)
	return settings
}
