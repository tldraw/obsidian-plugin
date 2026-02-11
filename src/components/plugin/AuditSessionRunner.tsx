import React, { useState, useSyncExternalStore } from 'react'
import { useTldrawInObsdianPlugin, useTldrawPlugin } from 'src/contexts/plugin'
import { ModalWrapper } from 'src/obsidian/react-components/modal'
import { AuditResultsSummary } from './AuditResultsSummary'
import { LooseAssetsScanner } from './LooseAssetsScanner'

type AuditScreen = 'scanner' | 'results'

export default function AuditSessionRunner() {
	const instance = useTldrawInObsdianPlugin()
	const plugin = useTldrawPlugin()
	const manager = instance.auditSessionManager
	const state = useSyncExternalStore(manager.store.addListener, manager.store.getState)
	const [activeScreen, setActiveScreen] = useState<AuditScreen>('scanner')

	const renderScreen = () => {
		switch (activeScreen) {
			case 'scanner':
				return (
					<LooseAssetsScanner
						app={plugin.app}
						onNavigateToResults={() => setActiveScreen('results')}
					/>
				)
			case 'results':
				return <AuditResultsSummary onNavigateToScanner={() => setActiveScreen('scanner')} />
			default:
				return null
		}
	}

	return (
		<ModalWrapper
			className="ptl-audit-modal"
			modalProps={plugin}
			open={state.isOpen}
			onClose={() => manager.closeModal()}
		>
			<div className="ptl-audit-modal-inner">
				<div className="ptl-audit-screen-container">{renderScreen()}</div>
				<AuditNavbar activeScreen={activeScreen} onScreenChange={setActiveScreen} />
			</div>
		</ModalWrapper>
	)
}

function AuditNavbar({
	activeScreen,
	onScreenChange,
}: {
	activeScreen: AuditScreen
	onScreenChange: (screen: AuditScreen) => void
}) {
	return (
		<nav className="ptl-audit-navbar">
			<button
				className={`ptl-audit-nav-item ${activeScreen === 'scanner' ? 'is-active' : ''}`}
				onClick={() => onScreenChange('scanner')}
			>
				Scanner
			</button>
			<button
				className={`ptl-audit-nav-item ${activeScreen === 'results' ? 'is-active' : ''}`}
				onClick={() => onScreenChange('results')}
			>
				Summary Report
			</button>
		</nav>
	)
}
