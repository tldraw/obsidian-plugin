import { use } from 'react'
import { SettingsManagerContext } from 'src/plugin/app/contexts/setting-manager-context'

export default function useSettingsManager() {
	const settingsManager = use(SettingsManagerContext)
	if (!settingsManager) {
		throw new Error('There is no settings manager context.')
	}
	return settingsManager
}
