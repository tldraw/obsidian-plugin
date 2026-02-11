import React, {
	ComponentProps,
	ContextType,
	createContext,
	CSSProperties,
	ReactNode,
	useMemo,
	useSyncExternalStore,
} from 'react'
import { ImageViewModeOptions } from 'src/obsidian/helpers/TldrawAppEmbedViewController'
import { logFn } from 'src/utils/logging'
import { Box, TldrawImage } from 'tldraw'

export type TldrawImageSnapshot = ComponentProps<typeof TldrawImage>['snapshot']
export type TldrawImageProps = Omit<ComponentProps<typeof TldrawImage>, 'snapshot'>

const TldrawImageContext = createContext<
	| undefined
	| {
			props: Omit<ComponentProps<typeof TldrawImage>, 'snapshot'>
	  }
>(undefined)

const defaultNoSnapshotFallback = <>No tldraw data to display</>
const PluginTldrawImageContext = createContext<
	| undefined
	| {
			/**
			 * What to display when the snapshot is undefined.
			 */
			fallback?: ReactNode
			props?: {
				style?: CSSProperties
			}
	  }
>({
	fallback: defaultNoSnapshotFallback,
})

function PluginTldrawImage({
	props,
	snapshot,
}: {
	snapshot: TldrawImageSnapshot
	props?: {
		style?: CSSProperties
	}
}) {
	return (
		<div className="ptl-tldraw-image" {...{ ...props }}>
			<TldrawImageContext.Consumer>
				{(value) => (!value ? <></> : <TldrawImage snapshot={snapshot} {...value.props} />)}
			</TldrawImageContext.Consumer>
		</div>
	)
}

function PluginTldrawImageContainer({
	snapshot,
	props,
	imagePlaceHolderStore,
}: {
	snapshot?: ComponentProps<typeof TldrawImage>['snapshot']
	/**
	 * The place holder to show in place of the tldraw image component.
	 */
	imagePlaceHolderStore: SnapshotImagePlaceHolderSyncStore
	props?: {
		style?: CSSProperties
	}
}) {
	const placeHolder = useSyncExternalStore(
		imagePlaceHolderStore.syncPlaceHolder,
		imagePlaceHolderStore.getPlaceHolder
	)
	return (
		<div className="ptl-tldraw-image-container" {...{ ...props }}>
			<PluginTldrawImageContext.Consumer>
				{(value) =>
					!placeHolder ? (
						!snapshot ? (
							value?.fallback
						) : (
							<PluginTldrawImage snapshot={snapshot} props={value?.props} />
						)
					) : (
						<div
							className="ptl-tldraw-image ptl-tldraw-image-placeholder"
							{...value?.props}
							ref={(ref) => {
								ref?.appendChild(placeHolder)
							}}
						/>
					)
				}
			</PluginTldrawImageContext.Consumer>
		</div>
	)
}

function TldrawImageContextProviders({
	children,
	previewStore,
}: {
	children: ReactNode
	previewStore: SnapshotPreviewSyncStore
}) {
	const previewSize = useSyncExternalStore(previewStore.onPreviewSize, previewStore.getPreviewSize)
	const previewOptions = useSyncExternalStore(
		previewStore.onPreviewOptions,
		previewStore.getPreviewOptions
	)
	const ptlTldrawImageContextValue = useMemo(
		(): ContextType<typeof PluginTldrawImageContext> => ({
			fallback: defaultNoSnapshotFallback,
			props: {
				style:
					previewSize === undefined
						? undefined
						: {
								width: previewSize.width || undefined,
								height: previewSize.height || undefined,
							},
			},
		}),
		[previewSize]
	)

	const tldrawImageContextValue = useMemo((): ContextType<typeof TldrawImageContext> => {
		const { bounds, padding, ...rest } = previewOptions
		TLDRAW_COMPONENT_LOGGING &&
			logFn(TldrawImageContextProviders, {
				bounds,
				box: !bounds ? undefined : Box.From(bounds),
				padding,
			})
		return {
			props: {
				bounds: bounds === undefined ? undefined : Box.From(bounds),
				// If bounds are specified, then make the padding zero since it will interfere with the preview bounds
				padding: bounds ? 0 : padding,
				...rest,
			},
		}
	}, [previewOptions])

	return (
		<PluginTldrawImageContext.Provider value={ptlTldrawImageContextValue}>
			<TldrawImageContext.Provider
				key={tldrawImageContextValue?.props.pageId}
				value={tldrawImageContextValue}
			>
				{children}
			</TldrawImageContext.Provider>
		</PluginTldrawImageContext.Provider>
	)
}

type SnapshotSyncStore = {
	getSnapshot(): undefined | TldrawImageSnapshot
	onSnapshot(cb: () => void): () => void
}

type SnapshotImagePreviewOptionsSyncStore = {
	getPreviewSize(): undefined | { width: number; height: number }
	onPreviewSize(cb: () => void): () => void
}

type SnapshotImagePreviewSizeSyncStore = {
	getPreviewOptions(): ImageViewModeOptions
	onPreviewOptions(cb: () => void): () => void
}

type SnapshotImagePlaceHolderSyncStore = {
	getPlaceHolder(): HTMLElement | undefined
	syncPlaceHolder(cb: () => void): () => void
}

export interface SnapshotPreviewSyncStore
	extends
		SnapshotSyncStore,
		SnapshotImagePreviewSizeSyncStore,
		SnapshotImagePreviewOptionsSyncStore,
		SnapshotImagePlaceHolderSyncStore {}

export function TldrawImageSnapshotView({
	previewStore,
}: {
	previewStore: SnapshotPreviewSyncStore
}) {
	const snapshot = useSyncExternalStore(previewStore.onSnapshot, previewStore.getSnapshot)
	return (
		<TldrawImageContextProviders previewStore={previewStore}>
			<PluginTldrawImageContainer
				snapshot={snapshot}
				imagePlaceHolderStore={previewStore}
				props={{
					style: {
						width: '100%',
						height: '100%',
					},
				}}
			/>
		</TldrawImageContextProviders>
	)
}
