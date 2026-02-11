import { Button } from '@obsidian-plugin-toolkit/react/components'
import { Group, Setting } from '@obsidian-plugin-toolkit/react/components/setting/group'
import React, { useSyncExternalStore } from 'react'
import useSettingsManager from 'src/hooks/useSettingsManager'

export default function VaultSettings() {
	const settingsManager = useSettingsManager()
	const plugin = settingsManager.plugin
	const manager = plugin.instance.auditSessionManager
	const state = useSyncExternalStore(manager.store.addListener, manager.store.getState)

	return (
		<>
			<Group heading="Vault">
				<Setting
					slots={{
						name: 'Scan for unused assets',
						desc: 'Scan the vault for unused assets in markdown files.',
						control: (
							<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
								{state.isActive && (
									<span style={{ fontSize: 'var(--font-smallest)', color: 'var(--text-muted)' }}>
										{state.isDone ? 'Scan Complete' : `Scanning: ${state.progress}`}
									</span>
								)}
								<Button onClick={() => manager.openModal()}>
									{state.isActive ? 'Open Scan' : 'Start Scan'}
								</Button>
							</div>
						),
					}}
				/>
			</Group>
		</>
	)
}
