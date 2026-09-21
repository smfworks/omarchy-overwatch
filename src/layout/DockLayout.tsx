import type { CSSProperties, ReactNode } from 'react'
import { useRef } from 'react'
import { useOverwatch } from '../state/context'
import type { LayoutState, PanelId } from '../layout/storage'
import { docksForDensity } from '../hud/density'

function Handle({
  axis,
  attr,
}: {
  axis: 'x' | 'y'
  attr: keyof Pick<LayoutState, 'leftWidth' | 'rightWidth' | 'topHeight' | 'bottomHeight'>
}) {
  const { layout, setLayout } = useOverwatch()
  const start = useRef({ pointer: 0, size: 0 })
  const invert = attr === 'rightWidth' || attr === 'bottomHeight'

  return (
    <div
      className={axis === 'x' ? 'resize-x' : 'resize-y'}
      style={
        attr === 'leftWidth'
          ? { right: 0 }
          : attr === 'rightWidth'
            ? { left: 0 }
            : attr === 'topHeight'
              ? { bottom: 0 }
              : { top: 0 }
      }
      onPointerDown={(e) => {
        e.preventDefault()
        start.current = {
          pointer: axis === 'x' ? e.clientX : e.clientY,
          size: layout[attr],
        }
        const move = (ev: PointerEvent) => {
          const now = axis === 'x' ? ev.clientX : ev.clientY
          const raw = now - start.current.pointer
          const next = start.current.size + (invert ? -raw : raw)
          setLayout((prev) => ({ ...prev, [attr]: next }))
        }
        const up = () => {
          window.removeEventListener('pointermove', move)
          window.removeEventListener('pointerup', up)
        }
        window.addEventListener('pointermove', move)
        window.addEventListener('pointerup', up)
      }}
    />
  )
}

export function DockLayout({
  top,
  left,
  right,
  bottom,
  center,
}: {
  top: ReactNode
  left: ReactNode
  right: ReactNode
  bottom: ReactNode
  center: ReactNode
}) {
  const { layout, setLayout, hudDensity } = useOverwatch()
  const shown = docksForDensity(hudDensity, layout)

  const style: CSSProperties = {
    gridTemplateColumns: `${shown.left ? layout.leftWidth : 0}px 1fr ${shown.right ? layout.rightWidth : 0}px`,
    gridTemplateRows: `${shown.top ? layout.topHeight : 0}px 1fr ${shown.bottom ? layout.bottomHeight : 0}px`,
  }

  const hide = (id: PanelId) => setLayout((p) => ({ ...p, [id]: false }))

  return (
    <div className={`hud-grid density-${hudDensity}`} style={style}>
      <div style={{ gridColumn: '1 / 4', gridRow: 1, minHeight: 0, overflow: 'hidden' }}>
        {shown.top ? <div className="panel panel-top" style={{ height: '100%' }}>{top}</div> : null}
      </div>
      <div style={{ gridColumn: 1, gridRow: 2, minWidth: 0, position: 'relative', overflow: 'hidden' }}>
        {shown.left ? (
          <div className="panel panel-left" style={{ height: '100%' }}>
            <Handle axis="x" attr="leftWidth" />
            <button className="icon-btn panel-close" onClick={() => hide('left')} title="Hide catalog">
              ×
            </button>
            {left}
          </div>
        ) : null}
      </div>
      <div style={{ gridColumn: 2, gridRow: 2, minWidth: 0, minHeight: 0, height: '100%' }}>{center}</div>
      <div style={{ gridColumn: 3, gridRow: 2, minWidth: 0, position: 'relative', overflow: 'hidden' }}>
        {shown.right ? (
          <div className="panel panel-right" style={{ height: '100%' }}>
            <Handle axis="x" attr="rightWidth" />
            <button className="icon-btn panel-close" onClick={() => hide('right')} title="Hide dossier">
              ×
            </button>
            {right}
          </div>
        ) : null}
      </div>
      <div style={{ gridColumn: '1 / 4', gridRow: 3, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
        {shown.bottom ? (
          <div className="panel panel-bottom" style={{ height: '100%' }}>
            <Handle axis="y" attr="bottomHeight" />
            {bottom}
          </div>
        ) : null}
      </div>
    </div>
  )
}
