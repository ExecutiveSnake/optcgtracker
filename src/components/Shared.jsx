import { useState, useEffect } from 'react'
import { getColorHex, CONDITIONS, inputStyle, btnPrimary } from '../utils'

// ── Toast ─────────────────────────────────────────────────────
let _setToasts = null
let _tid = 0
export const toast = (msg, type = 'success') => {
  if (_setToasts) _setToasts(p => [...p, { id: ++_tid, msg, type }])
}

export function Toasts() {
  const [toasts, setToasts] = useState([])
  _setToasts = setToasts
  useEffect(() => {
    if (!toasts.length) return
    const t = setTimeout(() => setToasts(p => p.slice(1)), 3000)
    return () => clearTimeout(t)
  }, [toasts])
  const colors = { success: '#14532d', error: '#7f1d1d', warning: '#78350f', info: '#1e3a5f' }
  const borders = { success: '#22c55e', error: '#ef4444', warning: '#f59e0b', info: '#3b82f6' }
  return (
    <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, width: '90vw', maxWidth: 360, pointerEvents: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {toasts.map(t => (
        <div key={t.id} style={{ background: colors[t.type] || colors.success, color: '#fff', padding: '12px 16px', borderRadius: 12, fontSize: 14, border: `1px solid ${borders[t.type] || borders.success}`, boxShadow: '0 4px 20px rgba(0,0,0,0.5)', animation: 'slideIn 0.3s ease' }}>
          {t.msg}
        </div>
      ))}
    </div>
  )
}

// ── CardImg ───────────────────────────────────────────────────
export function CardImg({ card, size = 80, style = {} }) {
  const [err, setErr] = useState(false)
  const hex = getColorHex(card?.color)
  if (!card?.imageUrl || err) return (
    <div style={{ width: size, height: size * 1.4, borderRadius: 8, background: `linear-gradient(135deg,${hex}33,${hex}11)`, border: `2px solid ${hex}66`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0, ...style }}>
      <div style={{ fontSize: size * 0.28 }}>🃏</div>
      <div style={{ fontSize: 9, color: '#9ca3af', textAlign: 'center', marginTop: 2, padding: '0 2px', wordBreak: 'break-all' }}>{card?.cardNumber || '?'}</div>
    </div>
  )
  return <img src={card.imageUrl} alt={card.name} onError={() => setErr(true)} style={{ width: size, height: size * 1.4, objectFit: 'cover', borderRadius: 8, border: `2px solid ${hex}66`, flexShrink: 0, ...style }} />
}

// ── ColorDots ─────────────────────────────────────────────────
export function ColorDots({ color, size = 10 }) {
  if (!color) return null
  const colors = color.toLowerCase().split(/[\/,\s]+/).filter(Boolean)
  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
      {colors.map((c, i) => <div key={i} style={{ width: size, height: size, borderRadius: '50%', background: getColorHex(c), border: '1px solid rgba(255,255,255,0.3)', flexShrink: 0 }} />)}
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children }) {
  if (!open) return null
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#0f172a', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, maxHeight: '92vh', overflow: 'auto', border: '1px solid #1e3a5f', borderBottom: 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #1e293b', position: 'sticky', top: 0, background: '#0f172a', zIndex: 10 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#f1c40f', fontFamily: "'Cinzel',serif" }}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: 22, cursor: 'pointer', minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  )
}

// ── CardDetailModal ───────────────────────────────────────────
export function CardDetailModal({ card, open, onClose, db, onAction }) {
  const [owned, setOwned] = useState(0)
  const [qty, setQty] = useState(1)
  const [cond, setCond] = useState('NM')

  useEffect(() => {
    if (!card || !db || !open) return
    db.catalog.where('cardId').equals(card.id).count().then(setOwned)
  }, [card, db, open])

  if (!card) return null
  const hex = getColorHex(card.color)

  const addToCatalog = async () => {
    for (let i = 0; i < qty; i++) await db.catalog.add({ cardId: card.id, condition: cond, location: 'unassigned', locationId: null, locationName: null })
    toast(`Added ${qty}× ${card.name} to catalog`)
    onAction && onAction()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={card.name}>
      <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
        <CardImg card={card} size={90} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 6 }}>{card.cardNumber} · {card.set}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}><ColorDots color={card.color} size={11} /><span style={{ color: '#d1d5db', fontSize: 12 }}>{card.color}</span></div>
          <div style={{ color: '#d1d5db', fontSize: 13, marginBottom: 3 }}><span style={{ color: '#9ca3af' }}>Type: </span>{card.type}</div>
          {card.affiliation && <div style={{ color: '#d1d5db', fontSize: 13, marginBottom: 3 }}><span style={{ color: '#9ca3af' }}>Affil: </span>{card.affiliation}</div>}
          {card.cost != null && <div style={{ color: '#d1d5db', fontSize: 13, marginBottom: 3 }}><span style={{ color: '#9ca3af' }}>Cost: </span>{card.cost}</div>}
          {card.power != null && <div style={{ color: '#d1d5db', fontSize: 13, marginBottom: 3 }}><span style={{ color: '#9ca3af' }}>Power: </span>{card.power.toLocaleString()}</div>}
          {card.counter != null && <div style={{ color: '#d1d5db', fontSize: 13, marginBottom: 3 }}><span style={{ color: '#9ca3af' }}>Counter: </span>{card.counter}</div>}
          {card.life != null && <div style={{ color: '#d1d5db', fontSize: 13 }}><span style={{ color: '#9ca3af' }}>Life: </span>{card.life}</div>}
        </div>
      </div>
      {card.effect && <div style={{ background: '#1e293b', borderRadius: 10, padding: 12, marginBottom: 14, fontSize: 13, color: '#d1d5db', lineHeight: 1.6, border: `1px solid ${hex}33` }}>{card.effect}</div>}
      <div style={{ color: '#9ca3af', fontSize: 13, marginBottom: 14 }}>Owned: <span style={{ color: '#f1c40f', fontWeight: 700 }}>{owned}</span></div>
      <div style={{ background: '#1e293b', borderRadius: 12, padding: 14 }}>
        <div style={{ color: '#f1c40f', fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Add to Catalog</div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={{ color: '#9ca3af', fontSize: 11, display: 'block', marginBottom: 5 }}>Qty</label>
            <input type="number" min={1} max={20} value={qty} onChange={e => setQty(Math.max(1, parseInt(e.target.value) || 1))} style={{ ...inputStyle }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ color: '#9ca3af', fontSize: 11, display: 'block', marginBottom: 5 }}>Condition</label>
            <select value={cond} onChange={e => setCond(e.target.value)} style={{ ...inputStyle }}>{CONDITIONS.map(c => <option key={c}>{c}</option>)}</select>
          </div>
        </div>
        <button onClick={addToCatalog} style={{ ...btnPrimary }}>+ Add to Catalog</button>
      </div>
    </Modal>
  )
}
