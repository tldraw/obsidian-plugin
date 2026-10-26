/**
 * Followed example from https://tldraw.dev/examples/shapes/tools/screenshot-tool
 */
import {
	atom,
	Box,
	BoxLike,
	ShapeIndicatorOverlayUtil,
	StateNode,
	TLPageId,
	TLShape,
	TLShapeIndicatorOverlay,
	TLStateNodeConstructor,
} from 'tldraw'

class IdleBoundsState extends StateNode {
	static override id = 'bounds-idle'

	override onPointerDown(): void {
		this.parent.transition(PointingBoundsState.id)
	}
}

class PointingBoundsState extends StateNode {
	static override id = 'bounds-pointing'

	override onPointerMove(): void {
		if (this.editor.inputs.isDragging) {
			this.parent.transition(BoundsDraggingState.id)
		}
	}

	override onPointerUp(): void {
		this.complete()
	}

	override onCancel(): void {
		this.complete()
	}

	private complete() {
		this.parent.transition(IdleBoundsState.id)
	}
}

/**
 * The {@linkcode atom} name for {@linkcode BoundsDraggingState.boundsBox}
 */
export const BOUNDS_BOX = 'bounds box'
export const BOUNDS_USING_ASPECT_RATIO = 'bounds using aspect ratio'
export const BOUNDS_SHAPES_BOX = 'bounds shapes box'
export const BOUNDS_SELECTED_SHAPES = 'bounds selected shapes'

export class BoundsDraggingState extends StateNode {
	static override readonly id = 'bounds-dragging'

	boundsBox = atom(BOUNDS_BOX, new Box())
	shapesBox = atom<Box | null>(BOUNDS_BOX, new Box())
	boundsUsingAspectRatio = atom(BOUNDS_USING_ASPECT_RATIO, false)
	selectedShapes = atom<TLShape[]>(BOUNDS_SELECTED_SHAPES, [])

	private get _parent(): BoundsSelectorTool {
		return this.parent as BoundsSelectorTool
	}

	override onEnter() {
		const parent = this.parent
		if (!(parent instanceof BoundsSelectorTool)) {
			console.error(`${parent.id} is not a ${BoundsSelectorTool.name}`)
			this.complete()
			return
		}
		this.update()
	}

	override onPointerMove() {
		this.update()
	}

	override onKeyDown() {
		if (this.editor.inputs.getAltKey()) {
			this._parent.cycleAspectRatio()
		}
		this.update()
	}

	override onKeyUp() {
		this.update()
	}

	override onPointerUp() {
		const { editor } = this
		const box = this.boundsBox.get()
		const shapesBox = this.shapesBox.get()

		if (editor.inputs.getCtrlKey() && shapesBox) {
			this._parent.onBounds(this.editor.getCurrentPageId(), shapesBox)
		} else {
			this._parent.onBounds(this.editor.getCurrentPageId(), box)
		}

		this.complete()
	}

	override onCancel() {
		this.complete()
	}

	private update() {
		const { inputs } = this.editor
		const ctrlKey = inputs.getCtrlKey()
		const shiftKey = inputs.getShiftKey()
		const originPagePoint = inputs.getOriginPagePoint()
		const currentPagePoint = inputs.getCurrentPagePoint()

		const box = Box.FromPoints([originPagePoint, currentPagePoint])

		if (shiftKey) {
			this.boundsUsingAspectRatio.set(true)
			const { w, h } = this._parent.aspectRatio.get()
			if (!isNaN(w) && !isNaN(h)) {
				if (box.w > box.h * (w / h)) {
					box.h = box.w * (h / w)
				} else {
					box.w = box.h * (w / h)
				}
			}

			if (currentPagePoint.x < originPagePoint.x) {
				box.x = originPagePoint.x - box.w
			}

			if (currentPagePoint.y < originPagePoint.y) {
				box.y = originPagePoint.y - box.h
			}
		} else {
			this.boundsUsingAspectRatio.set(false)
		}

		this.boundsBox.set(box)

		if (ctrlKey) {
			const selectedShapes = this.editor.getCurrentPageShapes().filter((s) => {
				const pageBounds = this.editor.getShapeMaskedPageBounds(s)
				if (!pageBounds) return false
				return box.includes(pageBounds)
			})
			this.shapesBox.set(Box.Common(selectedShapes.map((s) => this.editor.getShapePageBounds(s)!)))
			this.selectedShapes.set(selectedShapes)
		} else {
			this.shapesBox.set(null)
			this.selectedShapes.set([])
		}
	}

	private complete() {
		this.editor.selectNone()
		this.parent.transition(IdleBoundsState.id)
	}
}

type AspectRatio = {
	/**
	 * Aspect ratio width.
	 */
	w: number
	/**
	 * Aspect ratio height
	 */
	h: number
}

type PageBounds = {
	/**
	 * If this is undefined, then the bounds should be applied to all pages.
	 */
	pageId?: TLPageId
	bounds: Box
}

export const BOUNDS_ASPECT_RATIO = 'bounds aspect ratio'
export const BOUNDS_CURRENT_BOX = 'bounds current box'
export const BOUNDS_CURRENT_PAGE_BOUNDS = 'bounds current page bounds'
export const BOUNDS_SELECTOR_INITIALIZED = 'bounds selector initialized'

export default class BoundsSelectorTool extends StateNode {
	static override readonly id = 'bounds-selector-tool'
	static override initial = IdleBoundsState.id
	static readonly draggingStatePath = `${BoundsSelectorTool.id}.${BoundsDraggingState.id}` as const

	private static readonly aspectRatios = [
		{ w: 1, h: 1 },
		{ w: 3, h: 2 },
		{ w: 16, h: 10 },
		{ w: 16, h: 9 },
		{ w: 21, h: 9 },
	] as const satisfies AspectRatio[]

	static override children() {
		return [IdleBoundsState, PointingBoundsState, BoundsDraggingState]
	}

	static create({
		getInitialBounds,
		callback,
	}: {
		callback: (pageId: TLPageId, bounds?: Box) => void
		getInitialBounds?: (pageId: TLPageId) =>
			| {
					/**
					 * Is the bounds specific to the provided page.
					 *
					 * `true` if the bounds is for the provided page
					 *
					 * `false` if the bounds is not for a specific page, i.e. it is default for all pages.
					 */
					isSpecific: boolean
					bounds: BoxLike
			  }
			| undefined
	}): TLStateNodeConstructor {
		class _BoundsSelectorTool extends BoundsSelectorTool {
			override init() {
				const pageId = this.editor.getCurrentPageId()
				const bounds = getInitialBounds?.(pageId)
				if (!bounds) {
					this.currentPageBounds.set(undefined)
				} else {
					this.currentPageBounds.set({
						pageId: !bounds.isSpecific ? undefined : pageId,
						bounds: Box.From(bounds.bounds),
					})
				}
				super.init()
			}

			override onBounds(pageId: TLPageId, bounds?: Box) {
				super.onBounds(pageId, bounds)
				callback(pageId, bounds)
			}
		}
		return _BoundsSelectorTool
	}

	private aspectRatioIndex = 0

	aspectRatio = atom<AspectRatio>(BOUNDS_ASPECT_RATIO, BoundsSelectorTool.aspectRatios[0])
	currentPageBounds = atom<PageBounds | undefined>(BOUNDS_CURRENT_PAGE_BOUNDS, undefined)
	boundsSelectorInitialized = atom<boolean>(BOUNDS_SELECTOR_INITIALIZED, false)

	override onEnter() {
		this.editor.setCursor({ type: 'cross', rotation: 0 })
	}

	override onExit() {
		this.editor.setCursor({ type: 'default', rotation: 0 })
	}

	onBounds(pageId: TLPageId, bounds?: Box) {
		this.currentPageBounds.set(!bounds ? undefined : { pageId, bounds })
	}

	/**
	 * Cycles through {@linkcode aspectRatios} ands sets {@linkcode aspectRatio}
	 */
	cycleAspectRatio() {
		this.aspectRatioIndex++
		this.aspectRatio.set(
			BoundsSelectorTool.aspectRatios[
				this.aspectRatioIndex % BoundsSelectorTool.aspectRatios.length
			]
		)
	}

	init() {
		this.boundsSelectorInitialized.set(true)
	}

	zoomToBounds() {
		const bounds = this.currentPageBounds.get()?.bounds
		if (bounds) {
			this.editor.zoomToBounds(bounds)
		} else {
			this.editor.zoomToFit()
		}
	}
}

/**
 * Draws indicators for shapes currently enclosed by an in-progress {@linkcode BoundsDraggingState}
 * drag, in addition to tldraw's normal selection/hover indicators.
 *
 * tldraw removed the old `useEditorComponents().ShapeIndicator` React-component slot in favor of
 * this canvas-based overlay system. Keeps `ShapeIndicatorOverlayUtil`'s own `static type` (so it
 * replaces, rather than duplicates, the built-in shape-indicator overlay when passed via
 * `overlayUtils`) and only extends `getOverlays()`, merging in the drag-selected shape ids so the
 * default selection/hover indicators keep working unchanged.
 */
export class BoundsSelectorIndicatorOverlayUtil extends ShapeIndicatorOverlayUtil {
	private getDraggedSelectedShapeIds() {
		if (this.editor.getPath() !== BoundsSelectorTool.draggingStatePath) return []
		const draggingState = this.editor.getStateDescendant<BoundsDraggingState>(
			BoundsSelectorTool.draggingStatePath
		)
		return draggingState?.selectedShapes.get().map((shape) => shape.id) ?? []
	}

	override isActive(): boolean {
		return super.isActive() || this.getDraggedSelectedShapeIds().length > 0
	}

	override getOverlays(): TLShapeIndicatorOverlay[] {
		const base = super.getOverlays()
		const draggedSelectedShapeIds = this.getDraggedSelectedShapeIds()
		if (!draggedSelectedShapeIds.length) return base

		const [primary, ...rest] = base
		if (!primary) {
			return [
				{
					id: BoundsSelectorIndicatorOverlayUtil.type,
					type: BoundsSelectorIndicatorOverlayUtil.type,
					props: { idsToDisplay: draggedSelectedShapeIds, hintingShapeIds: [] },
				},
			]
		}

		return [
			{
				...primary,
				props: {
					...primary.props,
					idsToDisplay: [
						...new Set([...primary.props.idsToDisplay, ...draggedSelectedShapeIds]),
					],
				},
			},
			...rest,
		]
	}
}
