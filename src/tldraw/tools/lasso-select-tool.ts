import { atom, StateNode, TLPointerEventInfo, TLShape, VecModel, pointInPolygon, polygonsIntersect } from 'tldraw'

export class LassoSelectTool extends StateNode {
  static override id = 'lasso-select'
  static override children() {
    return [IdleState, LassoingState]
  }
  static override initial = 'idle'

  override onEnter() {
    this.editor.setCursor({ type: 'cross', rotation: 0 })
  }

  override onExit() {
    this.editor.setCursor({ type: 'default', rotation: 0 })
  }
}

export class IdleState extends StateNode {
  static override id = 'idle'

  override onPointerDown(info: TLPointerEventInfo) {
    const { editor } = this
    editor.selectNone()
    this.parent.transition('lassoing', info)
  }
}

export class LassoingState extends StateNode {
  static override id = 'lassoing'

  info = {} as TLPointerEventInfo

  markId: null | string = null

  points = atom<VecModel[]>('lasso points', [])

  override onEnter(info: TLPointerEventInfo) {
    this.points.set([])
    this.markId = null
    this.info = info
    this.startLasso()
  }

  private startLasso() {
    this.markId = this.editor.markHistoryStoppingPoint('lasso start')
  }

  override onPointerMove(): void {
    this.addPointToLasso()
  }

  private addPointToLasso() {
    const { inputs } = this.editor
    const { x, y, z } = inputs.currentPagePoint.toFixed()
    const newPoint = { x, y, z }
    this.points.set([...this.points.get(), newPoint])
  }

  private getShapesInLasso() {
    const { editor } = this
    const shapes = editor.getCurrentPageRenderingShapesSorted()
    const lassoPoints = this.points.get()
    const shapesInLasso = shapes.filter((shape) => {
      return this.doesLassoFullyContainShape(lassoPoints, shape)
    })
    return shapesInLasso
  }

  private doesLassoFullyContainShape(lassoPoints: VecModel[], shape: TLShape): boolean {
    const { editor } = this
    const geometry = editor.getShapeGeometry(shape)
    const pageTransform = editor.getShapePageTransform(shape)
    const shapeVertices = pageTransform.applyToPoints(geometry.vertices)
    const allVerticesInside = shapeVertices.every((vertex) => {
      return pointInPolygon(vertex, lassoPoints)
    })
    if (!allVerticesInside) {
      return false
    }
    if (geometry.isClosed) {
      if (polygonsIntersect(shapeVertices, lassoPoints)) {
        return false
      }
    }
    return true
  }

  override onPointerUp(): void {
    this.complete()
  }

  override onComplete() {
    this.complete()
  }

  private complete() {
    const { editor } = this
    const shapesInLasso = this.getShapesInLasso()
    editor.setSelectedShapes(shapesInLasso)
    editor.setCurrentTool('select')
    // editor.setCurrentTool('select')
  }
}

