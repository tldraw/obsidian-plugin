import { App, TFile } from 'obsidian'
import React, { useCallback, useRef } from 'react'
import { useTldrawPlugin } from 'src/contexts/plugin'
import { useDocumentAudit } from 'src/hooks/useDocumentAudit'
import TldrawViewComponent from 'src/obsidian/components/tldraw-view-component'
import { navigateToBlockCache } from 'src/obsidian/file/navigate'
import { TldrawDocument } from 'src/obsidian/plugin/document'
import { AssetEntry } from 'src/obsidian/plugin/instance'

export function AuditLayout({
	slots,
	className,
}: {
	className?: string
	slots?: {
		header?: {
			children: React.ReactNode
			className?: string
		}
		footer?: {
			children: React.ReactNode
			className?: string
		}
		main?: {
			className?: string
			children: React.ReactNode
		}
	}
}) {
	return (
		<div className={`ptl-audit-container ${className ?? ''}`}>
			{slots?.header && (
				<header className={`ptl-audit-header ${slots.header.className ?? ''}`}>
					{slots.header.children}
				</header>
			)}
			{slots?.main && (
				<main className={`ptl-audit-main ${slots.main.className ?? ''}`}>
					{slots.main.children}
				</main>
			)}
			{slots?.footer && (
				<footer className={`ptl-audit-footer ${slots.footer.className ?? ''}`}>
					{slots.footer.children}
				</footer>
			)}
		</div>
	)
}

export function ErrorMessage({ error }: { error: unknown }) {
	const [showStack, setShowStack] = React.useState(false)

	if (error instanceof Error) {
		return (
			<div className="ptl-error-details">
				<div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{error.message}</div>
				{error.stack && (
					<div>
						<button
							onClick={() => setShowStack(!showStack)}
							style={{ fontSize: 'var(--font-smallest)', padding: '2px 4px', height: 'auto' }}
						>
							{showStack ? 'Hide Stack Trace' : 'Show Stack Trace'}
						</button>
						{showStack && (
							<pre style={{ marginTop: '8px', overflowX: 'auto' }}>
								<code>{error.stack}</code>
							</pre>
						)}
					</div>
				)}
			</div>
		)
	}

	if (typeof error === 'string') {
		return <div>{error}</div>
	}

	return <pre>{JSON.stringify(error, null, 2)}</pre>
}

export function AssetListItem({
	asset,
	document,
	app,
}: {
	asset: AssetEntry
	document: TldrawDocument
	app: App
}) {
	const plugin = useTldrawPlugin()
	const [showContent, setShowContent] = React.useState(false)
	const [content, setContent] = React.useState<string | null>(null)
	const [assetData, setAssetData] = React.useState<{
		url?: string
		mimeType?: string
		error?: string
		isLoading: boolean
	} | null>(null)

	const loadAsset = async () => {
		if (assetData && (assetData.url || assetData.error)) return
		setAssetData({ isLoading: true })
		try {
			const cache = document.getCachedMetadata() || {}

			// Look for links or embeds in the same position as the block
			const blockStart = asset.blockCache.position.start.offset
			const ref =
				cache.links?.find((l) => l.position.start.offset === blockStart) ||
				cache.embeds?.find((e) => e.position.start.offset === blockStart)

			if (!ref) throw new Error('No link or embed found in block')

			const assetFile = app.metadataCache.getFirstLinkpathDest(ref.link, document.path)
			if (!assetFile) throw new Error(`Asset file not found for link: ${ref.link}`)

			const url = app.vault.adapter.getResourcePath(assetFile.path)

			// Fetch it to get mime type
			const response = await fetch(url)
			if (!response.ok) throw new Error(`Failed to fetch asset: ${response.statusText}`)

			const mimeType = response.headers.get('content-type') || undefined
			setAssetData({ url, mimeType, isLoading: false })
		} catch (e) {
			console.error(e)
			setAssetData({ error: e instanceof Error ? e.message : 'Unknown error', isLoading: false })
		}
	}

	const toggleView = async () => {
		if (!showContent) {
			if (!content) {
				const instance = await document.getInstance()
				const fullText = instance.getData()
				const pos = asset.blockCache.position
				const snippet = fullText.substring(pos.start.offset, pos.end.offset)
				setContent(snippet)
			}
			loadAsset()
		}
		setShowContent(!showContent)
	}

	const { handlePrune: prune } = useDocumentAudit(plugin.instance)

	const handlePrune = async () => {
		try {
			await prune(document, [asset.blockCache])
		} catch (e) {
			console.error(e)
			setAssetData({
				error: `Pruning failed: ${e instanceof Error ? e.message : 'Unknown error'}`,
				isLoading: false,
			})
		}
	}

	const handleOpenInFile = async () => {
		const file = app.vault.getAbstractFileByPath(document.path)
		if (file instanceof TFile) {
			navigateToBlockCache(plugin, file, asset.blockCache)
		}
	}

	return (
		<li className="ptl-audit-item">
			<div className="ptl-audit-item-header">
				<div className="ptl-audit-item-info">
					<strong className="ptl-audit-item-id">ID: {asset.blockCache.id}</strong>
					<span className="ptl-audit-item-line">
						Line: {asset.blockCache.position.start.line + 1}
					</span>
				</div>
				<div className="ptl-audit-item-actions" style={{ display: 'flex', gap: '4px' }}>
					<button onClick={toggleView} className="ptl-audit-item-view-btn">
						{showContent ? 'Hide Details' : 'View Details'}
					</button>
					<button
						onClick={handlePrune}
						className="mod-warning"
						title="Remove block reference from file and prune from store"
					>
						Prune
					</button>
					<button
						className="mod-cta"
						onClick={handleOpenInFile}
						title="Navigate to block in the markdown file"
					>
						Go to location
					</button>
				</div>
			</div>
			{showContent && (
				<div className="ptl-audit-item-content">
					<pre>
						<code>{content}</code>
					</pre>

					<div className="ptl-audit-item-asset-preview">
						{assetData?.isLoading && <div className="ptl-audit-loading">Loading asset...</div>}
						{assetData?.error && (
							<div className="ptl-audit-error">Error loading asset: {assetData.error}</div>
						)}
						{assetData?.url &&
							(assetData.mimeType?.startsWith('image/') ? (
								<div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--size-4-1)' }}>
									<div className="ptl-audit-asset-mime">Type: {assetData.mimeType}</div>
									<img src={assetData.url} alt="Asset preview" className="ptl-audit-asset-image" />
								</div>
							) : (
								<div className="ptl-audit-asset-mime">Type: {assetData.mimeType || 'unknown'}</div>
							))}
					</div>
				</div>
			)}
		</li>
	)
}

export function TldrawDocumentView({ document }: { document: TldrawDocument }) {
	const componentRef = useRef<TldrawViewComponent | null>(null)
	const plugin = useTldrawPlugin()

	const ref = useCallback(
		(node: HTMLDivElement | null) => {
			if (!node) {
				// Unmounting
				if (componentRef.current) {
					setTimeout(() => {
						componentRef.current?.unload()
						componentRef.current = null
					})
				}
				return
			}

			// Mounting
			if (!componentRef.current) {
				const comp = new TldrawViewComponent(node)
				componentRef.current = comp
				comp.load()

				setTimeout(async () => {
					const instance = await document.getInstance()
					if (componentRef.current) {
						componentRef.current.renderInteractive({
							plugin,
							store: {
								plugin: instance.getDocumentStore(),
							},
							targetDocument: node.ownerDocument,
							options: {
								isReadonly: true,
								autoFocus: false,
							},
						})
					}
				})
			}
		},
		[document, plugin]
	)

	return <div ref={ref} style={{ width: '100%', height: '100%' }} />
}
