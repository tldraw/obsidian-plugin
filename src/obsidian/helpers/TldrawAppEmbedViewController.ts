import { BoxLike, TldrawImageProps } from 'tldraw'

export type ViewMode = 'image' | 'interactive'

export type OnChangeViewMode = (mode: ViewMode) => void

/**
 * The options when {@link ViewMode} is 'image'.
 */
export type ImageViewModeOptions = {
	bounds?: BoxLike
} & Omit<TldrawImageProps, 'bounds' | 'snapshot'>

export type TldrawAppViewModeController = {
	getViewMode: () => ViewMode
	getViewOptions: () => ImageViewModeOptions
	setShowBackground: (showBg: boolean) => void
	setViewMode: (viewMode: ViewMode) => void
	setImageBounds: (bounds?: BoxLike) => void
	setImageSize: (size?: { width: number; height: number }) => void
	toggleBackground: () => void
	toggleInteractive: () => void
}
