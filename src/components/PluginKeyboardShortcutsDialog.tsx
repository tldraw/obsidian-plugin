import React from 'react'
import { PLUGIN_ACTION_TOGGLE_ZOOM_LOCK } from 'src/tldraw/ui-overrides'
import {
	DefaultKeyboardShortcutsDialog,
	DefaultKeyboardShortcutsDialogContent,
	TldrawUiMenuActionItem,
	TldrawUiMenuGroup,
	TLUiKeyboardShortcutsDialogProps,
} from 'tldraw'

export default function PluginKeyboardShortcutsDialog(props: TLUiKeyboardShortcutsDialogProps) {
	return (
		<DefaultKeyboardShortcutsDialog {...props}>
			<DefaultKeyboardShortcutsDialogContent />
			<TldrawUiMenuGroup
				id="other"
				label={{
					default: 'Other',
				}}
			>
				<TldrawUiMenuActionItem actionId={PLUGIN_ACTION_TOGGLE_ZOOM_LOCK} />
			</TldrawUiMenuGroup>
		</DefaultKeyboardShortcutsDialog>
	)
}
