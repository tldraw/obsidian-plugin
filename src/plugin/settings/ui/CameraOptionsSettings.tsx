import React, { useCallback, useMemo } from 'react'
import useSettingsManager from 'src/plugin/app/hooks/useSettingsManager'
import useUserPluginSettings from 'src/plugin/app/hooks/useUserPluginSettings'
import { Setting } from '@obsidian-plugin-toolkit/react/components/setting/group'
import { Dropdown } from '@obsidian-plugin-toolkit/react/components'
import { ErrorHandler } from 'src/plugin/error-handler'

export default function CameraOptionsSettings() {
	const settingsManager = useSettingsManager()
	const settings = useUserPluginSettings(settingsManager)

	const wheelBehaviorOptions = useMemo(
		() => ({
			none: 'None',
			pan: 'Pan',
			zoom: 'Zoom',
		}),
		[]
	)

	const onWheelBehaviorChange = useCallback(
		(value: string) => {
			if (value !== 'none' && value !== 'pan' && value !== 'zoom') {
				console.error('Unable to updated wheelBehavior, invalid value:', { value })
				return
			}
			settingsManager.updateEditorWheelBehavior(value).catch(ErrorHandler.notice)
		},
		[settingsManager]
	)

	return (
		<>
			<Setting
				slots={{
					name: <>Pan speed</>,
					desc: 'Note: This setting is not yet implemented.',
				}}
			/>
			<Setting
				slots={{
					name: <>Zoom speed</>,
					desc: 'Note: This setting is not yet implemented.',
				}}
			/>
			<Setting
				slots={{
					name: <>Zoom steps</>,
					desc: 'Note: This setting is not yet implemented.',
				}}
			/>
			<Setting
				slots={{
					name: <>Scrolling behavior</>,
					desc: (
						<>
							How the scrolling input from the mouse wheel or the touchpad gesture should control
							the editor camera.
						</>
					),
					control: (
						<>
							<Dropdown
								options={wheelBehaviorOptions}
								value={settings.cameraOptions?.wheelBehavior ?? 'pan'}
								onChange={onWheelBehaviorChange}
							/>
						</>
					),
				}}
			/>
		</>
	)
}
