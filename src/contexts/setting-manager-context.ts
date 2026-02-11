import { createContext } from 'react'
import UserSettingsManager from 'src/obsidian/settings/UserSettingsManager'

export const SettingsManagerContext = createContext<UserSettingsManager | undefined>(undefined)
