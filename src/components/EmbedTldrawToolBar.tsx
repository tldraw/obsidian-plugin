import * as React from 'react'
import BoundsSelectorTool from 'src/tldraw/tools/bounds-selector-tool'
import {
	DefaultToolbar,
	DefaultToolbarContent,
	TldrawUiMenuItem,
	useIsToolSelected,
	useTools,
} from 'tldraw'

export default function EmbedTldrawToolBar() {
	const tools = useTools()
	const boundsSelectorTool = tools[BoundsSelectorTool.id]
	const isBoundsSelectorSelected = useIsToolSelected(boundsSelectorTool)
	return (
		<DefaultToolbar>
			<TldrawUiMenuItem isSelected={isBoundsSelectorSelected} {...boundsSelectorTool} />
			<DefaultToolbarContent />
		</DefaultToolbar>
	)
}
