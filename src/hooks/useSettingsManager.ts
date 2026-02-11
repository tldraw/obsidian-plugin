import { useContext } from 'react'
import { SettingsManagerContext } from 'src/contexts/setting-manager-context'

export default function useSettingsManager() {
	const settingsManager = useContext(SettingsManagerContext)
	if (!settingsManager) {
		throw new Error('There is no settings manager context.')
	}
	return settingsManager
}
