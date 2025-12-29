import * as React from 'react'
import { GeoShapeGeoStyle, useEditor, useValue } from '@tldraw/editor'
import { TLUiToolItem, useTools, TldrawUiMenuToolItem } from 'tldraw'

/** @public */
export function useIsToolSelected(tool: TLUiToolItem | undefined) {
	const editor = useEditor()
	const geo = tool?.meta?.geo
	return useValue(
		'is tool selected',
		() => {
			if (!tool) return false
			const activeToolId = editor.getCurrentToolId()
			if (activeToolId === 'geo') {
				return geo === editor.getSharedStyles().getAsKnownValue(GeoShapeGeoStyle)
			} else {
				return activeToolId === tool.id
			}
		},
		[editor, tool?.id, geo]
	)
}

/** @public */
export interface ToolbarItemProps {
	tool: string
}

/** @public @react */
export function ToolbarItem({ tool }: ToolbarItemProps) {
	const tools = useTools()
	const isSelected = useIsToolSelected(tools[tool])
	return <TldrawUiMenuToolItem toolId={tool} isSelected={isSelected} />
}

/** @public @react */
export function SelectToolbarItem() {
	return <ToolbarItem tool="select" />
}

/** @public @react */
export function HandToolbarItem() {
	return <ToolbarItem tool="hand" />
}

/** @public @react */
export function DrawToolbarItem() {
	return <ToolbarItem tool="draw" />
}

/** @public @react */
export function EraserToolbarItem() {
	return <ToolbarItem tool="eraser" />
}

/** @public @react */
export function HighlightToolbarItem() {
	return <ToolbarItem tool="highlight" />
}

/** @public @react */
export function LaserToolbarItem() {
	return <ToolbarItem tool="laser" />
}

/** @public @react */
export function LassoToolbarItem() {
	return <ToolbarItem tool="lasso-select" />
}

export function CustomToolbarContent() {
	return (
		<>
			<SelectToolbarItem />
			<HandToolbarItem />
			<DrawToolbarItem />
			<EraserToolbarItem />
			<HighlightToolbarItem />
			<LaserToolbarItem />
			<LassoToolbarItem />
		</>
	)
}
