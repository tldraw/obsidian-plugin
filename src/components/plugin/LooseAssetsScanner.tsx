import { App } from 'obsidian'
import React, { useCallback, useState } from 'react'
import { useTldrawInObsdianPlugin, useTldrawPlugin } from 'src/contexts/plugin'
import { useDocumentAudit } from 'src/hooks/useDocumentAudit'
import { TldrawDocument } from 'src/obsidian/plugin/document'
import { ModalWrapper } from 'src/obsidian/react-components/modal'
import { ObsidianMarkdownFileTLAssetStoreProxy } from 'src/tldraw/asset-store'
import { TLAsset, TLImageAsset, TLImageShape, TLUnknownShape } from 'tldraw'
import { AssetListItem, AuditLayout, ErrorMessage, TldrawDocumentView } from './AuditCommon'

function isShapeOfType<T extends TLUnknownShape>(
	shape: TLUnknownShape,
	type: T['type']
): shape is T {
	return shape.type === type
}

function isAssetOfType<T extends TLAsset>(asset: TLAsset, type: T['type']): asset is T {
	return asset.type === type
}

export function LooseAssetsScanner({
	app,
	documents,
	onNavigateToResults,
}: {
	app: App
	documents?: TldrawDocument[]
	onNavigateToResults?: () => void
}) {
	const instance = useTldrawInObsdianPlugin()
	const plugin = useTldrawPlugin()
	const manager = instance.auditSessionManager

	type Parser = NonNullable<(typeof manager)['parser']>
	type RefFinder = NonNullable<(typeof manager)['refFinder']>

	const getDocuments = useCallback(() => {
		if (documents) return documents
		return app.vault
			.getMarkdownFiles()
			.filter((file) => {
				return plugin.isTldrawFile(file)
			})
			.map((file) => new TldrawDocument(plugin, file))
	}, [app, documents, plugin])

	const parser: Parser = async (document) => ({
		entries: Object.values(document.getBlockCache() || {}).map((block) => ({
			blockCache: block,
		})),
		content: await document.getInstance(),
		name: document.path,
	})

	const refFinder: RefFinder = (content) => {
		const store = content.getStore()

		const shapes = store.query
			.records('shape')
			.get()
			.filter((e) => isShapeOfType<TLImageShape>(e, 'image'))

		const assets = store.query
			.records('asset')
			.get()
			.filter((e) => isAssetOfType<TLImageAsset>(e, 'image'))
			.map(
				(asset) => [asset.props.src ? (asset.props.src.split(':').at(1) ?? '') : '', asset] as const
			)
			.map(([src, asset]) =>
				ObsidianMarkdownFileTLAssetStoreProxy.isBlockRefId(src)
					? ({
							blockRefId: src,
							asset,
						} as const)
					: null
			)
			.filter((p) => p !== null)

		const mappedAssets = assets.map((asset) => {
			const mappedShapes = shapes.filter((shape) => asset.asset.id === shape.props.assetId)
			return {
				asset,
				mappedShapes,
			}
		})
		return {
			includesEntry: (entry) => {
				return mappedAssets.some(({ asset, mappedShapes }) => {
					const assetHasShapes = mappedShapes.length > 0
					const assetReferencesEntry =
						entry.blockCache.id ===
						ObsidianMarkdownFileTLAssetStoreProxy.getBlockIdFromBlockRefId(asset.blockRefId)
					return assetHasShapes && assetReferencesEntry
				})
			},
		}
	}

	const {
		current,
		canGoBack,
		canGoForward,
		handleNext,
		handleBack,
		handleRefresh,
		handleAuditAll,
		handleStop,
		handlePrune,
		progress,
		isActive,
		isDone,
		isAuditingAll,
	} = useDocumentAudit(instance)

	const handlePruneAll = async () => {
		if (!current?.data?.looseEntries.length) return
		try {
			await handlePrune(
				current.document,
				current.data.looseEntries.map((e) => e.blockCache)
			)
		} catch (e) {
			console.error('Failed to prune all assets:', e)
		}
	}

	const [showTldraw, setShowTldraw] = useState(false)

	if (!isActive && !current) {
		return (
			<AuditLayout
				slots={{
					header: {
						children: <h3>Loose Assets Scanner</h3>,
					},
					footer: {
						children: (
							<button
								className="mod-cta"
								onClick={() => manager.start(getDocuments(), parser, refFinder)}
							>
								Start audit
							</button>
						),
					},
					main: {
						className: 'ptl-audit-empty',
						children: <p>No active scan.</p>,
					},
				}}
			/>
		)
	}

	if (!current && !canGoForward) {
		return (
			<AuditLayout
				slots={{
					header: {
						children: <h3>Loose Assets Scanner</h3>,
					},
					footer: {
						children: (
							<button
								className="mod-cta"
								onClick={() => manager.start(getDocuments(), parser, refFinder)}
							>
								Try again
							</button>
						),
					},
					main: {
						className: 'ptl-audit-empty',
						children: <p>No files to process.</p>,
					},
				}}
			/>
		)
	}

	return (
		<AuditLayout
			slots={{
				header: {
					children: <h3>Scanner</h3>,
				},
				main: {
					children: (
						<>
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
										<button
											className="mod-warning"
											style={{ marginTop: 'var(--size-4-4)' }}
											onClick={handleStop}
										>
											Cancel Audit
										</button>
									</div>
								</div>
							) : current && current.data ? (
								<div>
									{current.data.looseEntries.length > 0 ? (
										<>
											<div
												style={{
													display: 'flex',
													justifyContent: 'flex-end',
													marginBottom: 'var(--size-4-2)',
												}}
											>
												<button
													className="mod-warning"
													onClick={handlePruneAll}
													disabled={isAuditingAll}
													title="Prune all loose assets in this file"
												>
													Prune All ({current.data.looseEntries.length})
												</button>
											</div>
											<ul className="ptl-audit-list">
												{current.data.looseEntries.map((item) => (
													<AssetListItem
														key={item.blockCache.id}
														asset={item}
														document={current.document}
														app={app}
													/>
												))}
											</ul>
										</>
									) : (
										<p className="ptl-audit-status">No unreferenced assets found in this file.</p>
									)}
								</div>
							) : (
								<div className="ptl-audit-status-container">
									{current?.error ? (
										<div className="ptl-audit-error">
											<p>Error auditing file:</p>
											<ErrorMessage error={current.error} />
										</div>
									) : isDone ? (
										<p>Audit complete. No loose entries found in remaining files.</p>
									) : (
										<p>Press "Next File" or "Audit All" to begin scanning.</p>
									)}
								</div>
							)}
						</>
					),
				},
				footer: {
					children: (
						<>
							<div className="ptl-audit-file-info">
								<div>
									<h4 style={{ margin: 0 }}>File: {current?.document.path || 'Ready'}</h4>
									<span className="ptl-audit-progress-text">{progress}</span>
								</div>
								{current && (
									<>
										<button onClick={() => setShowTldraw(true)}>Show tldraw editor</button>
										<ModalWrapper
											className="ptl-modal-tldraw-editor"
											modalProps={plugin}
											open={showTldraw}
											onClose={() => setShowTldraw(false)}
										>
											<TldrawDocumentView document={current.document} />
										</ModalWrapper>
									</>
								)}
							</div>
							<div className="ptl-audit-footer-bottom">
								<div className="ptl-audit-footer-actions">
									<button onClick={handleBack} disabled={!canGoBack || isAuditingAll}>
										Back
									</button>
									<button onClick={handleNext} disabled={!canGoForward || isAuditingAll}>
										Next File
									</button>
									{!isDone && (
										<button
											onClick={async () => handleAuditAll().then(onNavigateToResults)}
											disabled={isAuditingAll || !canGoForward}
										>
											Audit All
										</button>
									)}
									<button className="mod-warning" onClick={handleStop} disabled={isAuditingAll}>
										Cancel Audit
									</button>
								</div>
								<button
									onClick={handleRefresh}
									disabled={!current || isAuditingAll}
									className="mod-cta"
								>
									Refresh
								</button>
							</div>
						</>
					),
				},
			}}
		/>
	)
}
