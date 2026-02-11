import { Container } from '@obsidian-plugin-toolkit/react'
import { Button, Modal, Text } from '@obsidian-plugin-toolkit/react/components'
import { Group, Setting } from '@obsidian-plugin-toolkit/react/components/setting/group'
import React, { useMemo, useState } from 'react'
import { SettingsManagerContext } from 'src/contexts/setting-manager-context'
import UserSettingsManager from 'src/obsidian/settings/UserSettingsManager'
import AssetsSettings from './AssetsSettings'
import EmbedsSettings from './EmbedsSettings'
import FileSettings from './FileSettings'
import StartUpSettings from './StartUpSettings'
import TldrawEditorOptions from './TldrawEditorOptions'
import VaultSettings from './VaultSettings'
import WorkspaceSettings from './WorkspaceSettings'

const TABS = {
	file: {
		label: 'File',
		Component: FileSettings,
	},
	workspace: {
		label: 'Workspace',
		Component: WorkspaceSettings,
	},
	vault: {
		label: 'Vault',
		Component: VaultSettings,
	},
	'start-up': {
		label: 'Start up',
		Component: StartUpSettings,
	},
	'tldraw-editor-options': {
		label: 'Tldraw editor',
		Component: TldrawEditorOptions,
	},
	embeds: {
		label: 'Embeds',
		Component: EmbedsSettings,
	},
	assets: {
		label: 'Assets',
		Component: AssetsSettings,
	},
} satisfies Record<
	string,
	{
		label: string
		Component: () => React.JSX.Element
	}
>

export default function TldrawSettingsTabView({
	settingsManager,
}: {
	settingsManager: UserSettingsManager
}) {
	const tabs = useMemo(() => Object.entries(TABS), [])
	const [[activeTabKey, activeTab], setActiveTab] = useState(tabs[0])
	const [isOpen, setIsOpen] = useState(false)
	return (
		<>
			<div className="ptl-settings-tab-header" style={{ marginBottom: '8px' }}>
				<div className="ptl-settings-tab-container">
					{tabs.map(([key, tab]) => (
						<div
							key={key}
							className="ptl-settings-tab-item"
							data-is-active={key === activeTabKey}
							onClick={() => setActiveTab([key, tab])}
						>
							{tab.label}
						</div>
					))}
				</div>
			</div>
			<Container key={activeTabKey} className="ptl-setting-tab-content">
				<SettingsManagerContext.Provider value={settingsManager}>
					<activeTab.Component />
				</SettingsManagerContext.Provider>
			</Container>
			<Container className="ptl-settings-footer" style={{ marginTop: '16px' }}>
				<Group heading="Plugin information">
					<Setting
						slots={{
							info: 'See the details of the plugin and the tldraw package.',
							control: <Button onClick={() => setIsOpen(true)}>See details</Button>,
						}}
					/>
					<Modal modalProps={settingsManager.plugin} open={isOpen} onClose={() => setIsOpen(false)}>
						<Group heading="tldraw package information">
							<Setting
								slots={{
									name: 'tldraw version',
									desc: 'The version of tldraw that is bundled with the plugin.',
									control: <Text readonly value={TLDRAW_VERSION} />,
								}}
							/>
						</Group>
						<Group heading="Plugin information">
							{Object.entries(settingsManager.plugin.manifest).map(([key, value]) => (
								<Setting
									key={key}
									slots={{
										name: key,
										control: <Text readonly value={value} />,
									}}
								/>
							))}
						</Group>
					</Modal>
				</Group>
			</Container>
		</>
	)
}
