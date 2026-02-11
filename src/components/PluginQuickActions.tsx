import React from 'react'
import { PLUGIN_ACTION_TOGGLE_ZOOM_LOCK } from 'src/tldraw/ui-overrides'
import {
	DefaultQuickActions,
	DefaultQuickActionsContent,
	TldrawUiMenuActionItem,
	track,
	useEditor,
} from 'tldraw'

const LockZoomButton = track(() => {
	const editor = useEditor()
	const cameraOptions = editor.getCameraOptions()
	const isActive = cameraOptions.zoomSteps.length === 1
	return (
		<div className="ptl-quick-action-button-wrapper" data-selected={isActive}>
			<TldrawUiMenuActionItem actionId={PLUGIN_ACTION_TOGGLE_ZOOM_LOCK} isSelected={isActive} />
		</div>
	)
})

export default function PluginQuickActions() {
	return (
		<DefaultQuickActions>
			<DefaultQuickActionsContent />
			<LockZoomButton />
		</DefaultQuickActions>
	)
}
