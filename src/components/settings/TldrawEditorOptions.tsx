import React, { useCallback } from 'react'
import useSettingsManager from 'src/hooks/useSettingsManager'
import useUserPluginSettings from 'src/hooks/useUserPluginSettings'
import { defaultTldrawOptions } from 'tldraw'
import CameraOptionsSettings from './CameraOptionsSettings'
import { Group, Setting } from '@obsidian-plugin-toolkit/react/components/setting/group'
import { Text, ExtraButton, Toggle } from '@obsidian-plugin-toolkit/react/components'

function TldrawEditorOptionsGroup() {
	const settingsManager = useSettingsManager()
	const settings = useUserPluginSettings(settingsManager)

	const onLaserDelayMsChange = useCallback(
		async (value: string) => {
			const parsedValue = parseInt(value)
			if (Number.isNaN(parsedValue)) return
			await settingsManager.updateLaserDelayMs(parsedValue)
		},
		[settingsManager]
	)

	const resetLaserDelayMs = useCallback(async () => {
		await settingsManager.updateLaserDelayMs(undefined)
	}, [settingsManager])

	const onLaserKeepDelay = useCallback(
		async (value: boolean) => {
			await settingsManager.updateLaserKeepDelayAfterStop(value)
		},
		[settingsManager]
	)

	const resetLaserKeepDelay = useCallback(async () => {
		await settingsManager.updateLaserKeepDelayAfterStop(undefined)
	}, [settingsManager])

	return (
		<>
			<Setting
				slots={{
					name: 'Laser delay',
					desc: 'The delay for the laser tool in milliseconds.',
					control: (
						<>
							<Text
								value={`${settings.tldrawOptions?.laserDelayMs ?? ''}`}
								placeholder={`${defaultTldrawOptions.laserDelayMs}`}
								onChange={onLaserDelayMsChange}
							/>
							<ExtraButton icon={'reset'} tooltip={'reset'} onClick={resetLaserDelayMs} />
						</>
					),
				}}
			/>
			<Setting
				slots={{
					name: 'Laser keep delay after stop',
					desc: 'Keep the laser delay lingering after stopping the laser tool.',
					control: (
						<>
							<Toggle
								value={!!settings.tldrawOptions?.laserKeepDelayAfterStop}
								onChange={onLaserKeepDelay}
							/>
							<ExtraButton icon={'reset'} tooltip={'reset'} onClick={resetLaserKeepDelay} />
						</>
					),
				}}
			/>
		</>
	)
}

function ClipboardOptionsGroup() {
	const settingsManager = useSettingsManager()
	const settings = useUserPluginSettings(settingsManager)
	const onPasteAtCursor = useCallback(
		async (value: boolean) => {
			await settingsManager.updatePasteAtCursor(value)
		},
		[settingsManager]
	)

	const resetPasteAtCursor = useCallback(async () => {
		await settingsManager.updatePasteAtCursor(undefined)
	}, [settingsManager])
	return (
		<>
			<Setting
				slots={{
					name: 'Paste at cursor',
					desc: (
						<>
							This can be accessed in the editor by navigating the menu:
							<br />
							<code>{'Menu > Preferences > Paste at cursor'}</code>
						</>
					),
					control: (
						<>
							<Toggle
								value={!!settings.clipboard?.pasteAtCursor}
								onChange={onPasteAtCursor}
							/>
							<ExtraButton icon={'reset'} tooltip={'reset'} onClick={resetPasteAtCursor} />
						</>
					),
				}}
			/>
		</>
	)
}

export default function TldrawEditorOptions() {
	return (
		<>
			<Group heading='Clipboard options'>
				<ClipboardOptionsGroup />
			</Group>
			<Group heading='Pointer options'>
				<TldrawEditorOptionsGroup />
			</Group>
			<Group heading='Camera options'>
				<CameraOptionsSettings />
			</Group>
		</>
	)
}
