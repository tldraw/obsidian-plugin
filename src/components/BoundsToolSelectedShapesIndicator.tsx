/**
 * https://tldraw.dev/examples/editor-api/indicators-logic
 */
import * as React from 'react'
import BoundsSelectorTool, {
	BOUNDS_SELECTED_SHAPES,
	BoundsDraggingState,
} from 'src/tldraw/tools/bounds-selector-tool'
import { useEditor, useEditorComponents, useValue } from 'tldraw'

export default function BoundsToolSelectedShapeIndicator() {
	const editor = useEditor()

	const boundsSelectedShapes = useValue(BOUNDS_SELECTED_SHAPES, () => {
		if (editor.getPath() !== BoundsSelectorTool.draggingStatePath) return null

		const draggingState = editor.getStateDescendant<BoundsDraggingState>(
			BoundsSelectorTool.draggingStatePath
		)!
		return draggingState.selectedShapes.get()
	}, [editor])

	const { ShapeIndicator } = useEditorComponents()
	if (!ShapeIndicator || !boundsSelectedShapes || !boundsSelectedShapes.length) return null

	return (
		<div style={{ position: 'absolute', top: 0, left: 0, zIndex: 9999 }}>
			{boundsSelectedShapes.map(({ id }) => (
				<ShapeIndicator key={id + '_indicator'} shapeId={id} />
			))}
		</div>
	)
}
