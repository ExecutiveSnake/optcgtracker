import { useState, useEffect, useMemo } from 'react'
import db from '../db'
import { getColorHex, inputStyle } from '../utils'
import { CardImg, CardDetailModal } from './Shared'

export default function CatalogTab({ cards, refreshKey }) {
  const [catalog, setCatalog] = useState([])
  const [search, setSearch] = useState('')
  const [ownedOnly, setOwnedOnly] = useState(true)
  const [sel, setSel] = useState(null)
  const [refresh, setRefresh] = useState(0)

  useEffect(() => { db.catalog.toArray().then(setCatalog) }, [refresh, refreshKey])

  const cardMap = useMemo(() => { const m = {}; cards.forEach(c => m[c.id] = c); return m }, [cards])

  const grouped = useMemo(() => {
    const g = {}
    catalog.forEach(e => { if (!g[e.cardId]) g[e.cardId] = []; g[e.cardId].push(e) })
    return g
  }, [catalog])

  const display = useMemo(() => {
    let list = ownedOnly ? Object.keys(grouped).map(id => cardMap[id]).filter(Boolean) : cards
    if (search) { const lq = search.toLowerCase(); list = list.filter(c => c?.name?.toLowerCase().includes(lq) || c?.cardNumber?.toLowerCase().includes(lq)) }
    return list.slice(0, 500)
  }, [cards, grouped, search, ownedOnly, cardMap])

  const badge = (e) => {
    const bg = e.location === 'deck' ? '#1e3a8a' : e.location === 'vault' ? '#4c1d95' : '#374151'
    const col = e.location === 'deck' ? '#93c5fd' : e.location === 'vault' ? '#c4b5fd' : '#9ca3af'
    return <span key={e.id} style={{ background: bg, color: col, fontSize: 10, padding: '2px 8px', borderRadius: 20, margin: '2px 2px 0 0', display: 'inline-block' }}>{e.location === 'unassigned' ? 'Free' : e.locationName || e.location}</span>
  }

  return (
    <div style={{ padding: '16px 16px 0' }}>
      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        <input placeholder="Search catalog..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
        <button onClick={() => setOwnedOnly(!ownedOnly)} style={{ background: ownedOnly ? '#f1c40f' : '#1e293b', border: '1px solid #334155', borderRadius: 10, color: ownedOnly ? '#0f172a' : '#9ca3af', padding: '0 14px', minHeight: 44, cursor: 'pointer', whiteSpace: 'nowrap', fontSize: 13 }}>
          {ownedOnly ? 'Owned' : 'All'}
        </button>
      </div>
      <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 10 }}>{display.length} card{display.length !== 1 ? 's' : ''}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 16 }}>
        {display.map(card => {
          if (!card) return null
          const entries = grouped[card.id] || []
          return (
            <div key={card.id} onClick={() => setSel(card)} style={{ background: '#1e293b', borderRadius: 12, padding: 12, display: 'flex', gap: 12, cursor: 'pointer', border: `1px solid ${getColorHex(card.color)}33` }}>
              <CardImg card={card} size={56} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: '#fff', fontSize: 14, fontWeight: 600, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.name}</div>
                <div style={{ color: '#9ca3af', fontSize: 11, marginBottom: 3 }}>{card.cardNumber} · {card.type}</div>
                <div style={{ color: '#f1c40f', fontSize: 12, marginBottom: 4 }}>Owned: {entries.length}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap' }}>{entries.length > 0 ? entries.map(badge) : <span style={{ color: '#6b7280', fontSize: 11 }}>Not owned</span>}</div>
              </div>
            </div>
          )
        })}
        {display.length === 0 && <div style={{ textAlign: 'center', color: '#6b7280', padding: 40 }}>{ownedOnly ? 'No owned cards yet. Add cards via Search!' : 'No cards found.'}</div>}
      </div>
      <CardDetailModal card={sel} open={!!sel} onClose={() => setSel(null)} db={db} onAction={() => setRefresh(r => r + 1)} />
    </div>
  )
}
