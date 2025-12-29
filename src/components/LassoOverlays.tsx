import * as React from 'react'
import { TldrawOverlays, useEditor, useValue } from 'tldraw'
import { LassoSelectTool, LassoingState } from 'src/tldraw/tools/lasso-select-tool'

export default function LassoOverlays() {
  const editor = useEditor()

  const lassoPoints = useValue(
    'lasso points',
    () => {
      if (editor.isIn('lasso-select.lassoing')) {
        const lassoing = editor.getStateDescendant('lasso-select.lassoing') as LassoingState
        return lassoing.points.get()
      }
      return []
    },
    [editor]
  )

  const svgPath = React.useMemo(() => {
    if (lassoPoints.length === 0) return ''
    const [first, ...rest] = lassoPoints
    const move = `M ${first.x} ${first.y}`
    const lines = rest.map((p) => `L ${p.x} ${p.y}`).join(' ')
    return `${move} ${lines} Z`
  }, [lassoPoints])

  return (
    <>
      <TldrawOverlays />
      {lassoPoints.length > 0 && (
        <svg className="tl-overlays__item" aria-hidden="true">
          <path
            d={svgPath}
            fill="var(--color-selection-fill)"
            opacity={0.5}
            stroke="var(--color-selection-stroke)"
            strokeWidth="calc(2px / var(--tl-zoom))"
          />
        </svg>
      )}
    </>
  )
}
