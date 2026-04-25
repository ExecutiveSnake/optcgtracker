import { useState, useEffect, useMemo } from 'react'
import db from '../db'
import { getColorHex, colorsMatch, isBlock1Card, DECK_TAGS, inputStyle, btnPrimary, btnSecondary } from '../utils'
import { CardImg, ColorDots, Modal, toast } from './Shared'

// ── Deck Card (list item) ─────────────────────────────────────
function DeckCard({ deck, cardMap, onClick }) {
  const [count, setCount] = useState(0)
  const leader = cardMap[deck.leaderId]
  useEffect(() => { db.deckCards.where('deckId').equals(deck.id).toArray().then(rows => setCount(rows.reduce((s, r) => s + r.quantity, 0))) }, [deck.id])
  return (
    <div onClick={onClick} style={{ background: '#1e293b', borderRadius: 14, overflow: 'hidden', cursor: 'pointer', border: `1px solid ${getColorHex(leader?.color)}44`, display: 'flex' }}>
      <div style={{ width: 70, background: '#0a1628', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8, flexShrink: 0 }}>
        <CardImg card={leader} size={54} />
      </div>
      <div style={{ flex: 1, padding: '12px 14px', minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 3 }}>
          <div style={{ color: '#fff', fontSize: 15, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{deck.name}</div>
          <span style={{ background: count === 50 ? '#14532d' : '#7f1d1d', color: count === 50 ? '#22c55e' : '#ef4444', fontSize: 10, padding: '3px 8px', borderRadius: 20, flexShrink: 0, marginLeft: 8 }}>{count === 50 ? 'Legal' : `${count}/50`}</span>
        </div>
        <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{leader?.name || 'No Leader'}</div>
        <ColorDots color={leader?.color} size={10} />
        {deck.tags?.length > 0 && <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>{deck.tags.map(t => <span key={t} style={{ background: '#374151', color: '#9ca3af', fontSize: 10, padding: '2px 6px', borderRadius: 20 }}>{t}</span>)}</div>}
      </div>
    </div>
  )
}

// ── Deck Builder ──────────────────────────────────────────────
function DeckBuilder({ cardMap, catalog, deck, onDone }) {
  const [name, setName] = useState(deck?.name || '')
  const [leaderId, setLeaderId] = useState(deck?.leaderId || null)
  const [deckCards, setDeckCards] = useState({})
  const [tags, setTags] = useState(deck?.tags || [])
  const [notes, setNotes] = useState(deck?.notes || '')
  const [search, setSearch] = useState('')
  const [warnings, setWarnings] = useState([])
  const [tournMode, setTournMode] = useState(false)

  const leader = leaderId ? cardMap[leaderId] : null
  const allCards = useMemo(() => Object.values(cardMap), [cardMap])
  const leaders = useMemo(() => allCards.filter(c => c.type?.toLowerCase().includes('leader')), [allCards])

  useEffect(() => {
    if (!deck) return
    db.deckCards.where('deckId').equals(deck.id).toArray().then(rows => { const m = {}; rows.forEach(r => m[r.cardId] = r.quantity); setDeckCards(m) })
    db.settings.get('tournamentMode').then(r => { if (r) setTournMode(r.value) })
  }, [deck])

  const available = useMemo(() => {
    const m = {}
    catalog.forEach(e => {
      if (!m[e.cardId]) m[e.cardId] = { free: 0, vault: 0 }
      if (e.location === 'unassigned') m[e.cardId].free++
      else if (e.location === 'vault') m[e.cardId].vault++
      else if (e.location === 'deck' && e.locationId === deck?.id) m[e.cardId].free++ // already in this deck
    })
    const avail = {}
    Object.entries(m).forEach(([id, { free, vault }]) => { if (free + vault > 0) avail[id] = free + vault })
    return avail
  }, [catalog, deck])

  useEffect(() => {
    const w = []
    const total = Object.values(deckCards).reduce((s, v) => s + v, 0)
    if (total !== 50) w.push(`${total}/50 cards`)
    Object.entries(deckCards).forEach(([id, qty]) => {
      const c = cardMap[id]
      if (qty > 4) w.push(`${c?.name || id}: exceeds 4-copy limit`)
      if (c && leader && !colorsMatch(leader.color, c.color)) w.push(`${c.name}: color mismatch`)
      if (tournMode && c && isBlock1Card(c)) w.push(`${c.name}: Block 1 illegal`)
    })
    setWarnings(w)
  }, [deckCards, leader, cardMap, tournMode])

  const pool = useMemo(() => {
    let p = allCards.filter(c => !c.type?.toLowerCase().includes('leader') && available[c.id])
    if (search) { const lq = search.toLowerCase(); p = p.filter(c => c.name?.toLowerCase().includes(lq) || c.cardNumber?.toLowerCase().includes(lq)) }
    if (leader) p = p.filter(c => colorsMatch(leader.color, c.color))
    return p.slice(0, 500)
  }, [allCards, available, search, leader])

  const total = Object.values(deckCards).reduce((s, v) => s + v, 0)

  const adj = (id, delta) => setDeckCards(prev => {
    const cur = prev[id] || 0; const avail = available[id] || 0
    const nv = Math.max(0, Math.min(cur + delta, avail, 4))
    if (nv === 0) { const n = { ...prev }; delete n[id]; return n }
    return { ...prev, [id]: nv }
  })

  const save = async () => {
    if (!name.trim()) { toast('Enter a deck name', 'error'); return }
    if (!leaderId) { toast('Select a leader', 'error'); return }
    let deckId = deck?.id
    if (deckId) {
      await db.decks.update(deckId, { name, leaderId, tags, notes, updatedAt: Date.now() })
      await db.deckCards.where('deckId').equals(deckId).delete()
    } else {
      deckId = await db.decks.add({ name, leaderId, tags, notes, createdAt: Date.now(), updatedAt: Date.now() })
    }
    await db.catalog.where('locationId').equals(deckId).and(e => e.location === 'deck').modify({ location: 'unassigned', locationId: null, locationName: null })
    for (const [cardId, qty] of Object.entries(deckCards)) {
      await db.deckCards.add({ deckId, cardId, quantity: qty })
      const entries = await db.catalog.where('cardId').equals(cardId).and(e => e.location === 'unassigned' || e.location === 'vault').toArray()
      let rem = qty
      for (const e of entries) { if (rem <= 0) break; await db.catalog.update(e.id, { location: 'deck', locationId: deckId, locationName: name }); rem-- }
    }
    toast('Deck saved!'); onDone()
  }

  return (
    <div style={{ padding: '16px 16px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={onDone} style={{ background: 'none', border: 'none', color: '#f1c40f', fontSize: 24, cursor: 'pointer', minWidth: 44, minHeight: 44 }}>←</button>
        <div style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>{deck ? 'Edit Deck' : 'New Deck'}</div>
      </div>
      <input placeholder="Deck Name" value={name} onChange={e => setName(e.target.value)} style={{ ...inputStyle, marginBottom: 12, fontSize: 15 }} />
      <div style={{ marginBottom: 12 }}>
        <label style={{ color: '#9ca3af', fontSize: 12, display: 'block', marginBottom: 5 }}>Leader</label>
        <select value={leaderId || ''} onChange={e => setLeaderId(e.target.value || null)} style={{ ...inputStyle, color: leaderId ? '#fff' : '#9ca3af' }}>
          <option value="">Select Leader...</option>
          {leaders.map(l => <option key={l.id} value={l.id}>{l.name} ({l.cardNumber})</option>)}
        </select>
      </div>
      {warnings.length > 0 && (
        <div style={{ background: '#450a0a', borderRadius: 10, padding: 12, marginBottom: 12, border: '1px solid #ef4444' }}>
          <div style={{ color: '#fca5a5', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>⚠️ Warnings</div>
          {warnings.map((w, i) => <div key={i} style={{ color: '#fca5a5', fontSize: 12, marginBottom: 2 }}>• {w}</div>)}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ color: '#f1c40f', fontSize: 15, fontWeight: 700 }}>{total}/50 Cards</div>
        <div style={{ color: '#9ca3af', fontSize: 12 }}>{Object.keys(deckCards).length} unique</div>
      </div>
      {Object.keys(deckCards).length > 0 && (
        <div style={{ background: '#1e293b', borderRadius: 12, padding: 12, marginBottom: 12 }}>
          <div style={{ color: '#f1c40f', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>In Deck</div>
          {Object.entries(deckCards).map(([id, qty]) => {
            const c = cardMap[id]; if (!c) return null
            return (
              <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <div style={{ flex: 1, color: '#fff', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button onClick={() => adj(id, -1)} style={{ background: '#374151', border: 'none', color: '#fff', borderRadius: 6, width: 30, height: 30, cursor: 'pointer', fontSize: 16 }}>−</button>
                  <span style={{ color: '#f1c40f', fontWeight: 700, minWidth: 18, textAlign: 'center' }}>{qty}</span>
                  <button onClick={() => adj(id, 1)} style={{ background: '#374151', border: 'none', color: '#fff', borderRadius: 6, width: 30, height: 30, cursor: 'pointer', fontSize: 16 }}>+</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
      <input placeholder="Search available cards..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputStyle, marginBottom: 10 }} />
      <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 8 }}>Available ({pool.length}){leader ? ` · ${leader.color} colors` : ''}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
        {pool.map(card => {
          const qty = deckCards[card.id] || 0; const avail = available[card.id] || 0; const maxed = qty >= avail || qty >= 4
          return (
            <div key={card.id} style={{ background: '#1e293b', borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, border: `1px solid ${getColorHex(card.color)}33` }}>
              <CardImg card={card} size={36} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: '#fff', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.name}</div>
                <div style={{ color: '#9ca3af', fontSize: 11 }}>{card.cardNumber} · Avail: {avail}</div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button onClick={() => adj(card.id, -1)} disabled={qty === 0} style={{ background: qty > 0 ? '#374151' : '#1f2937', border: 'none', color: qty > 0 ? '#fff' : '#374151', borderRadius: 6, width: 32, height: 32, cursor: qty > 0 ? 'pointer' : 'default', fontSize: 16 }}>−</button>
                <span style={{ color: '#f1c40f', fontWeight: 700, minWidth: 20, textAlign: 'center' }}>{qty}</span>
                <button onClick={() => adj(card.id, 1)} disabled={maxed} style={{ background: !maxed ? '#374151' : '#1f2937', border: 'none', color: !maxed ? '#fff' : '#374151', borderRadius: 6, width: 32, height: 32, cursor: !maxed ? 'pointer' : 'default', fontSize: 16 }}>+</button>
              </div>
            </div>
          )
        })}
        {pool.length === 0 && <div style={{ textAlign: 'center', color: '#6b7280', padding: 24, fontSize: 13 }}>{leader ? `No owned cards match ${leader.color} colors.` : 'Select a leader to see available cards.'}</div>}
      </div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 6 }}>Tags</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {DECK_TAGS.map(t => <button key={t} onClick={() => setTags(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t])} style={{ background: tags.includes(t) ? '#f1c40f' : '#1e293b', color: tags.includes(t) ? '#0f172a' : '#9ca3af', border: '1px solid #334155', borderRadius: 20, padding: '6px 12px', fontSize: 12, cursor: 'pointer', minHeight: 36 }}>{t}</button>)}
        </div>
      </div>
      <textarea placeholder="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} style={{ ...inputStyle, minHeight: 70, resize: 'vertical', marginBottom: 16 }} />
      <button onClick={save} style={{ ...btnPrimary, marginBottom: 24, fontSize: 16, padding: '16px' }}>Save Deck</button>
    </div>
  )
}

// ── Deck Detail ───────────────────────────────────────────────
function DeckDetail({ deck, cardMap, vaults, onBack, onEdit }) {
  const [deckCards, setDeckCards] = useState([])
  const [refresh, setRefresh] = useState(0)
  const [moveModal, setMoveModal] = useState(null)

  useEffect(() => { db.deckCards.where('deckId').equals(deck.id).toArray().then(setDeckCards) }, [deck, refresh])

  const grouped = useMemo(() => {
    const g = { Leader: [], Character: [], Event: [], Stage: [], 'DON!!': [], Other: [] }
    const lead = cardMap[deck.leaderId]
    if (lead) g.Leader.push({ card: lead, quantity: 1 })
    deckCards.forEach(dc => {
      const c = cardMap[dc.cardId]; if (!c) return
      const t = Object.keys(g).find(k => c.type?.toLowerCase().includes(k.toLowerCase())) || 'Other'
      g[t].push({ card: c, quantity: dc.quantity })
    })
    return g
  }, [deckCards, cardMap, deck])

  const allAffil = useMemo(() => {
    const s = new Set()
    deckCards.forEach(dc => { const c = cardMap[dc.cardId]; if (c?.affiliation) c.affiliation.split(/[\/,;]+/).forEach(a => { const t = a.trim(); if (t) s.add(t) }) })
    return [...s].sort()
  }, [deckCards, cardMap])

  const total = deckCards.reduce((s, dc) => s + dc.quantity, 0)

  const exportDeck = () => {
    const lines = [`Deck: ${deck.name}`, `Leader: ${cardMap[deck.leaderId]?.name || '?'}`, `Affiliations: ${allAffil.join(', ') || 'None'}`, '']
    Object.entries(grouped).forEach(([type, entries]) => {
      if (!entries.length) return
      lines.push(`=== ${type} (${entries.reduce((s, e) => s + e.quantity, 0)}) ===`)
      entries.forEach(({ card, quantity }) => lines.push(`${quantity}x ${card.cardNumber} ${card.name}${card.affiliation ? ` [${card.affiliation}]` : ''}`))
      lines.push('')
    })
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `${deck.name}.txt`; a.click()
    toast('Deck exported!')
  }

  const moveToVault = async (cardId, vaultId) => {
    const vault = vaults.find(v => v.id === vaultId)
    const entry = await db.catalog.where('cardId').equals(cardId).and(e => e.location === 'deck' && e.locationId === deck.id).first()
    if (!entry) { toast('Entry not found', 'error'); return }
    await db.catalog.update(entry.id, { location: 'vault', locationId: vaultId, locationName: vault?.name })
    const dc = await db.deckCards.where('deckId').equals(deck.id).and(d => d.cardId === cardId).first()
    if (dc) { if (dc.quantity <= 1) await db.deckCards.delete(dc.id); else await db.deckCards.update(dc.id, { quantity: dc.quantity - 1 }) }
    const ex = await db.vaultCards.where('vaultId').equals(vaultId).and(vc => vc.cardId === cardId).first()
    if (ex) await db.vaultCards.update(ex.id, { quantity: ex.quantity + 1 })
    else await db.vaultCards.add({ vaultId, cardId, quantity: 1 })
    toast(`Moved to ${vault?.name}`); setMoveModal(null); setRefresh(r => r + 1)
  }

  return (
    <div style={{ padding: '16px 16px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#f1c40f', fontSize: 24, cursor: 'pointer', minWidth: 44, minHeight: 44 }}>←</button>
        <div style={{ flex: 1, color: '#fff', fontSize: 17, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{deck.name}</div>
        <button onClick={onEdit} style={{ ...btnSecondary, padding: '8px 12px', color: '#f1c40f', fontSize: 13 }}>Edit</button>
        <button onClick={exportDeck} style={{ ...btnSecondary, padding: '8px 12px', fontSize: 18 }}>📤</button>
      </div>
      <div style={{ background: '#1e293b', borderRadius: 12, padding: 12, marginBottom: 12 }}>
        <div style={{ color: '#9ca3af', fontSize: 11, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Affiliations</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {allAffil.length > 0 ? allAffil.map(a => <span key={a} style={{ background: '#0f172a', color: '#d1d5db', fontSize: 11, padding: '3px 10px', borderRadius: 20, border: '1px solid #334155' }}>{a}</span>) : <span style={{ color: '#6b7280', fontSize: 12 }}>No affiliations</span>}
        </div>
      </div>
      <div style={{ color: '#f1c40f', fontSize: 14, fontWeight: 600, marginBottom: 14 }}>{total}/50 Cards</div>
      {Object.entries(grouped).map(([type, entries]) => {
        if (!entries.length) return null
        return (
          <div key={type} style={{ marginBottom: 16 }}>
            <div style={{ color: '#9ca3af', fontSize: 11, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>{type} ({entries.reduce((s, e) => s + e.quantity, 0)})</div>
            {entries.map(({ card, quantity }) => (
              <div key={card.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, background: '#1e293b', borderRadius: 10, padding: '10px 12px', border: `1px solid ${getColorHex(card.color)}33` }}>
                <CardImg card={card} size={40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#fff', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.name}</div>
                  <div style={{ color: '#9ca3af', fontSize: 11 }}>{card.cardNumber}</div>
                  {card.affiliation && <div style={{ color: '#a78bfa', fontSize: 11 }}>{card.affiliation}</div>}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ color: '#f1c40f', fontWeight: 700, fontSize: 14 }}>×{quantity}</span>
                  {type !== 'Leader' && vaults.length > 0 && <button onClick={() => setMoveModal(card.id)} style={{ background: '#1e293b', border: '1px solid #4c1d95', color: '#a78bfa', borderRadius: 6, padding: '5px 8px', fontSize: 11, cursor: 'pointer', minHeight: 30 }}>→Vault</button>}
                </div>
              </div>
            ))}
          </div>
        )
      })}
      <div style={{ height: 24 }} />
      <Modal open={!!moveModal} onClose={() => setMoveModal(null)} title="Move to Vault">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {vaults.map(v => <button key={v.id} onClick={() => moveToVault(moveModal, v.id)} style={{ background: '#1e293b', border: '1px solid #4c1d95', borderRadius: 10, color: '#fff', padding: '14px 16px', fontSize: 14, cursor: 'pointer', textAlign: 'left', minHeight: 44 }}>📦 {v.name}</button>)}
        </div>
      </Modal>
    </div>
  )
}

// ── Decks Tab ─────────────────────────────────────────────────
export default function DecksTab({ cards, refreshKey }) {
  const [decks, setDecks] = useState([])
  const [view, setView] = useState('list')
  const [selDeck, setSelDeck] = useState(null)
  const [catalog, setCatalog] = useState([])
  const [vaults, setVaults] = useState([])
  const [refresh, setRefresh] = useState(0)

  const cardMap = useMemo(() => { const m = {}; cards.forEach(c => m[c.id] = c); return m }, [cards])

  useEffect(() => {
    db.decks.toArray().then(setDecks)
    db.catalog.toArray().then(setCatalog)
    db.vaults.toArray().then(setVaults)
  }, [refresh, refreshKey])

  const done = () => { setView('list'); setRefresh(r => r + 1) }

  if (view === 'builder') return <DeckBuilder cardMap={cardMap} catalog={catalog} deck={selDeck} onDone={done} />
  if (view === 'detail' && selDeck) return <DeckDetail deck={selDeck} cardMap={cardMap} vaults={vaults} onBack={done} onEdit={() => setView('builder')} />

  return (
    <div style={{ padding: '16px 16px 0' }}>
      <button onClick={() => { setSelDeck(null); setView('builder') }} style={{ ...btnPrimary, marginBottom: 16 }}>+ Create New Deck</button>
      {decks.length === 0 && <div style={{ textAlign: 'center', color: '#6b7280', padding: 40 }}>No decks yet. Create your first deck!</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 16 }}>
        {decks.map(deck => <DeckCard key={deck.id} deck={deck} cardMap={cardMap} onClick={() => { setSelDeck(deck); setView('detail') }} />)}
      </div>
    </div>
  )
}
