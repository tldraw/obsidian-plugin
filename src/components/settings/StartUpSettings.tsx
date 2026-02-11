import React, { useCallback } from 'react'
import useSettingsManager from 'src/hooks/useSettingsManager'
import useUserPluginSettings from 'src/hooks/useUserPluginSettings'
import { ThemePreference } from 'src/obsidian/TldrawSettingsTab'
import { themePreferenceRecord } from 'src/obsidian/settings/constants'
import { Setting, Group } from '@obsidian-plugin-toolkit/react/components/setting/group'
import { Dropdown, Toggle } from '@obsidian-plugin-toolkit/react/components'

function StartUpSettingsGroup() {
	const settingsManager = useSettingsManager()
	const settings = useUserPluginSettings(settingsManager)
	const updateSettings = useCallback(
		() => settingsManager.updateSettings(settingsManager.settings),
		[settingsManager]
	)

	const onThemePreferenceChange = useCallback(
		async (value: string) => {
			settingsManager.settings.themeMode = value as ThemePreference
			await updateSettings()
		},
		[settingsManager, updateSettings]
	)

	const onDefaultToolChange = useCallback(
		async (value: string) => {
			settingsManager.settings.toolSelected = value
			await updateSettings()
		},
		[settingsManager, updateSettings]
	)

	const onGridModeChange = useCallback(
		async (value: boolean) => {
			settingsManager.settings.gridMode = value
			await updateSettings()
		},
		[settingsManager, updateSettings]
	)

	const onSnapModeChange = useCallback(
		async (value: boolean) => {
			settingsManager.settings.snapMode = value
			await updateSettings()
		},
		[settingsManager, updateSettings]
	)

	const onFocusModeChange = useCallback(
		async (value: boolean) => {
			settingsManager.settings.focusMode = value
			await updateSettings()
		},
		[settingsManager, updateSettings]
	)

	const onDebugModeChange = useCallback(
		async (value: boolean) => {
			settingsManager.settings.debugMode = value
			await updateSettings()
		},
		[settingsManager, updateSettings]
	)

	return (
		<>
			<Setting
				slots={{
					name: 'Theme',
					desc: 'When opening a tldraw file, this setting decides what theme should be applied.',
					control: (
						<>
							<Dropdown
								options={themePreferenceRecord}
								value={settings.themeMode}
								onChange={onThemePreferenceChange}
							/>
						</>
					),
				}}
			/>
			<Setting
				slots={{
					name: 'Default tool',
					desc: 'When opening a tldraw file, this setting decides which tool should be selected.',
					control: (
						<>
							<Dropdown
								options={{
									select: 'Select',
									hand: 'Hand',
									draw: 'Draw',
									text: 'Text',
									eraser: 'Eraser',
									highlight: 'Highlight',
									rectangle: 'Rectangle',
									ellipse: 'Ellipse',
								}}
								value={settings.toolSelected}
								onChange={onDefaultToolChange}
							/>
						</>
					),
				}}
			/>
			<Setting
				slots={{
					name: 'Grid mode',
					desc: 'When opening tldraw files, this setting determines whether grid mode is enabled. Keep in mind that enabling grid mode will both show a grid and enforce snap-to-grid functionality.',
					control: (
						<>
							<Toggle value={settings.gridMode} onChange={onGridModeChange} />
						</>
					),
				}}
			/>
			<Setting
				slots={{
					name: 'Snap mode',
					desc: 'When opening tldraw files, this setting determines whether snap mode is enabled. Snap mode is a feature that places guides on shapes as you move them, ensuring they align with specific points or positions for precise placement.',
					control: (
						<>
							<Toggle value={settings.snapMode} onChange={onSnapModeChange} />
						</>
					),
				}}
			/>
			<Setting
				slots={{
					name: 'Focus mode',
					desc: 'When opening tldraw files, this setting determines whether to launch tldraw in focus mode. Great if you like to use tldraw to quickly jot something down.',
					control: (
						<>
							<Toggle value={settings.focusMode} onChange={onFocusModeChange} />
						</>
					),
				}}
			/>
			<Setting
				slots={{
					name: 'Debug mode',
					desc: 'When opening tldraw files, this setting toggles the tldraw debug mode. Debug mode is useful for the developer.',
					control: (
						<>
							<Toggle value={settings.debugMode} onChange={onDebugModeChange} />
						</>
					),
				}}
			/>
		</>
	)
}

export default function StartUpSettings() {
	return (
		<>
			<Group heading='Start up'>
				<StartUpSettingsGroup />
			</Group>
		</>
	)
}
