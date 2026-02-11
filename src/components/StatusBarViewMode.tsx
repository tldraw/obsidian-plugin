import * as React from 'react'
import { createRoot } from 'react-dom/client'
import {
	VIEW_TYPE_MARKDOWN,
	VIEW_TYPE_TLDRAW,
	VIEW_TYPE_TLDRAW_READ_ONLY,
} from '../utils/constants'
import { useStatusBarState } from '../utils/stores'

const StatusBarViewMode = () => {
	const view = useStatusBarState((state) => state.view)
	const setViewMode = useStatusBarState((state) => state.updateViewMode)

	const viewMode = view.mode

	const a = viewMode === VIEW_TYPE_TLDRAW ? 'ptl-viewmode-active' : ''
	const b = viewMode === VIEW_TYPE_MARKDOWN ? 'ptl-viewmode-active' : ''
	const c = viewMode === VIEW_TYPE_TLDRAW_READ_ONLY ? 'ptl-viewmode-active' : ''

	const setTldrawView = () => setViewMode(VIEW_TYPE_TLDRAW, 'react')
	const setMarkdownView = () => setViewMode(VIEW_TYPE_MARKDOWN, 'react')
	const setTldrawReadOnly = () => setViewMode(VIEW_TYPE_TLDRAW_READ_ONLY, 'react')

	return (
		<div className="ptl-statusbar-viewmode-box">
			<div className="ptl-statusbar-viewmode-btn-box">
				<button
					type="button"
					title="View as tldraw"
					className={`ptl-viewmode-btn ${a}`}
					onClick={setTldrawView}
				>
					TL
				</button>
				<button
					type="button"
					title="View as markdown"
					className={`ptl-viewmode-btn ${b}`}
					onClick={setMarkdownView}
				>
					MD
				</button>
				<button
					type="button"
					title="View as read only"
					className={`ptl-viewmode-btn ${c}`}
					onClick={setTldrawReadOnly}
				>
					RO
				</button>
			</div>
		</div>
	)
}

export const createReactStatusBarViewMode = (htmlElement: HTMLElement) => {
	const root = createRoot(htmlElement)

	root.render(
		<React.StrictMode>
			<StatusBarViewMode />
		</React.StrictMode>
	)

	return root
}

export default StatusBarViewMode
