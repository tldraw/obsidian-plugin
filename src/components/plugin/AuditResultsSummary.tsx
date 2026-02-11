import React from 'react'
import { useTldrawInObsdianPlugin } from 'src/contexts/plugin'
import { useDocumentAudit } from 'src/hooks/useDocumentAudit'
import { AuditSessionState } from 'src/obsidian/plugin/AuditSessionManager'
import { AssetEntry } from 'src/obsidian/plugin/instance'
import { AuditLayout } from './AuditCommon'

export function AuditResultsSummary({ onNavigateToScanner }: { onNavigateToScanner: () => void }) {
	const instance = useTldrawInObsdianPlugin()
	const { resultsWithLooseEntries, handleSetIndex, isAuditingAll, progress } =
		useDocumentAudit(instance)

	return (
		<AuditLayout
			slots={{
				header: {
					children: <h3>Audit Summary</h3>,
				},
				main: {
					children: (
						<div className="ptl-audit-summary-screen">
							{isAuditingAll ? (
								<div className="ptl-audit-status-container">
									<div className="ptl-audit-status-content">
										<p>Auditing all files... Please wait.</p>
										<div className="ptl-audit-progress-wrapper">
											<div className="ptl-audit-progress-bar">
												<div
													className="ptl-audit-progress-fill"
													style={{
														width: (() => {
															const [curr, total] = progress.split(' / ').map(Number)
															return total > 0 ? `${(curr / total) * 100}%` : '0%'
														})(),
													}}
												/>
											</div>
											<span className="ptl-audit-progress-text">{progress}</span>
										</div>
									</div>
								</div>
							) : resultsWithLooseEntries.length > 0 ? (
								<div className="ptl-audit-report">
									<h4>{resultsWithLooseEntries.length} files found with loose entries</h4>
									<ul className="ptl-audit-list">
										{resultsWithLooseEntries.map((res) => (
											<SummaryReportItem
												key={res.document.path}
												result={res}
												onSelect={(index) => {
													handleSetIndex(index)
													onNavigateToScanner()
												}}
											/>
										))}
									</ul>
								</div>
							) : (
								<div className="ptl-audit-empty">
									<p>No loose entries found or audit not yet run.</p>
								</div>
							)}
						</div>
					),
				},
			}}
		/>
	)
}

function SummaryReportItem({
	result,
	onSelect,
}: {
	result: AuditSessionState<AssetEntry>['resultsWithLooseEntries'][0]
	onSelect: (index: number) => void
}) {
	const instance = useTldrawInObsdianPlugin()
	const { handlePrune } = useDocumentAudit(instance)

	const handlePruneAll = async (e: React.MouseEvent) => {
		e.stopPropagation()
		try {
			await handlePrune(
				result.document,
				result.entries.map((e) => e.blockCache)
			)
		} catch (e) {
			console.error(e)
		}
	}

	return (
		<li className="ptl-audit-report-item">
			<div className="ptl-audit-report-item-info">
				<span className="ptl-audit-report-item-path">{result.document.path}</span>
				<span className="ptl-audit-report-item-count">{result.count} items</span>
			</div>
			<div className="ptl-audit-report-item-actions">
				<button
					className="mod-warning"
					onClick={handlePruneAll}
					title="Prune all loose assets in this file"
				>
					Prune All
				</button>
				<button
					className="mod-cta"
					onClick={(e) => {
						e.stopPropagation()
						onSelect(result.index)
					}}
				>
					Go to file
				</button>
			</div>
		</li>
	)
}
