import { useState, useEffect, useMemo } from 'react'
import db from '../db'
import { getColorHex, inputStyle, btnPrimary, btnSecondary } from '../utils'
import { CardImg, Modal, toast } from './Shared'

function VaultCard({ vault, onClick }) {
  const [count, setCount] = useState(0)
  useEffect(() => { db.vaultCards.where('vaultId').equals(vault.id).toArray().then(rows => setCount(rows.reduce((s, r) => s + r.quantity, 0))) }, [vault.id])
  return (
    <div onClick={onClick} style={{ background: '#1e293b', borderRadius: 14, padding: 16, cursor: 'pointer', border: '1px solid #7c3aed44', display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg,#a855f7,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>📦</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: '#fff', fontSize: 15, fontWeight: 700, marginBottom: 2 }}>{vault.name}</div>
        {vault.description && <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{vault.description}</div>}
        <div style={{ color: '#a78bfa', fontSize: 13 }}>{count} card{count !== 1 ? 's' : ''}</div>
      </div>
      <div style={{ color: '#6b7280', fontSize: 20 }}>›</div>
    </div>
  )
}

function VaultDetail({ vault, cardMap, onBack }) {
  const [vaultCards, setVaultCards] = useState([])
  const [decks, setDecks] = useState([])
  const [catalog, setCatalog] = useState([])
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [addId, setAddId] = useState('')
  const [addQty, setAddQty] = useState(1)
  const [moveModal, setMoveModal] = useState(null)
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    db.vaultCards.where('vaultId').equals(vault.id).toArray().then(setVaultCards)
    db.decks.toArray().then(setDecks)
    db.catalog.toArray().then(setCatalog)
  }, [vault.id, refresh])

  const freeMap = useMemo(() => {
    const m = {}
    catalog.forEach(e => { if (e.location === 'unassigned') m[e.cardId] = (m[e.cardId] || 0) + 1 })
    return m
  }, [catalog])

  const filtered = vaultCards.filter(vc => {
    const c = cardMap[vc.cardId]
    return !search || c?.name?.toLowerCase().includes(search.toLowerCase()) || c?.cardNumber?.toLowerCase().includes(search.toLowerCase())
  })

  const addToVault = async () => {
    if (!addId) { toast('Select a card', 'error'); return }
    const avail = freeMap[addId] || 0
    const qty = Math.min(addQty, avail)
    if (qty <= 0) { toast('No free copies available', 'error'); return }
    const entries = await db.catalog.where('cardId').equals(addId).and(e => e.location === 'unassigned').toArray()
    for (let i = 0; i < qty; i++) { if (entries[i]) await db.catalog.update(entries[i].id, { location: 'vault', locationId: vault.id, locationName: vault.name }) }
    const ex = await db.vaultCards.where('vaultId').equals(vault.id).and(vc => vc.cardId === addId).first()
    if (ex) await db.vaultCards.update(ex.id, { quantity: ex.quantity + qty })
    else await db.vaultCards.add({ vaultId: vault.id, cardId: addId, quantity: qty })
    toast(`Added ${qty}× ${cardMap[addId]?.name} to vault`)
    setShowAdd(false); setAddId(''); setAddQty(1); setRefresh(r => r + 1)
  }

  const moveToDeck = async (vc, deckId) => {
    const deck = decks.find(d => d.id === deckId)
    const entry = await db.catalog.where('cardId').equals(vc.cardId).and(e => e.location === 'vault' && e.locationId === vault.id).first()
    if (!entry) { toast('Entry not found', 'error'); return }
    await db.catalog.update(entry.id, { location: 'deck', locationId: deckId, locationName: deck?.name })
    const ex = await db.deckCards.where('deckId').equals(deckId).and(d => d.cardId === vc.cardId).first()
    if (ex) await db.deckCards.update(ex.id, { quantity: ex.quantity + 1 })
    else await db.deckCards.add({ deckId, cardId: vc.cardId, quantity: 1 })
    if (vc.quantity <= 1) await db.vaultCards.delete(vc.id)
    else await db.vaultCards.update(vc.id, { quantity: vc.quantity - 1 })
    toast(`Moved to ${deck?.name}`); setMoveModal(null); setRefresh(r => r + 1)
  }

  return (
    <div style={{ padding: '16px 16px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#f1c40f', fontSize: 24, cursor: 'pointer', minWidth: 44, minHeight: 44 }}>←</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: '#fff', fontSize: 17, fontWeight: 700 }}>{vault.name}</div>
          {vault.description && <div style={{ color: '#9ca3af', fontSize: 12 }}>{vault.description}</div>}
        </div>
        <button onClick={() => setShowAdd(!showAdd)} style={{ background: '#7c3aed', border: 'none', borderRadius: 8, color: '#fff', padding: '8px 14px', fontSize: 13, cursor: 'pointer', minHeight: 44 }}>+ Add</button>
      </div>
      {showAdd && (
        <div style={{ background: '#1e293b', borderRadius: 12, padding: 14, marginBottom: 14, border: '1px solid #7c3aed44' }}>
          <select value={addId} onChange={e => setAddId(e.target.value)} style={{ ...inputStyle, marginBottom: 10, color: addId ? '#fff' : '#9ca3af' }}>
            <option value="">Select card...</option>
            {Object.keys(freeMap).map(id => { const c = cardMap[id]; if (!c) return null; return <option key={id} value={id}>{c.name} ({c.cardNumber}) — {freeMap[id]} free</option> })}
          </select>
          <div style={{ display: 'flex', gap: 10 }}>
            <input type="number" min={1} max={20} value={addQty} onChange={e => setAddQty(Math.max(1, parseInt(e.target.value) || 1))} style={{ ...inputStyle, flex: 1 }} />
            <button onClick={addToVault} style={{ background: '#7c3aed', border: 'none', borderRadius: 10, color: '#fff', padding: '12px 20px', fontWeight: 700, cursor: 'pointer', minHeight: 44 }}>Add</button>
          </div>
        </div>
      )}
      <input placeholder="Search vault..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputStyle, marginBottom: 12 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 16 }}>
        {filtered.map(vc => {
          const c = cardMap[vc.cardId]; if (!c) return null
          return (
            <div key={vc.id} style={{ background: '#1e293b', borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, border: `1px solid ${getColorHex(c.color)}33` }}>
              <CardImg card={c} size={40} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: '#fff', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                <div style={{ color: '#9ca3af', fontSize: 11 }}>{c.cardNumber} · ×{vc.quantity}</div>
              </div>
              {decks.length > 0 && <button onClick={() => setMoveModal(vc)} style={{ background: '#1e293b', border: '1px solid #1e3a8a', color: '#93c5fd', borderRadius: 6, padding: '5px 8px', fontSize: 11, cursor: 'pointer', minHeight: 30, whiteSpace: 'nowrap' }}>→Deck</button>}
            </div>
          )
        })}
        {filtered.length === 0 && <div style={{ textAlign: 'center', color: '#6b7280', padding: 32 }}>No cards in this vault</div>}
      </div>
      <Modal open={!!moveModal} onClose={() => setMoveModal(null)} title="Move to Deck">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {decks.map(d => <button key={d.id} onClick={() => moveToDeck(moveModal, d.id)} style={{ background: '#1e293b', border: '1px solid #1e3a8a', borderRadius: 10, color: '#fff', padding: '14px 16px', fontSize: 14, cursor: 'pointer', textAlign: 'left', minHeight: 44 }}>🗂 {d.name}</button>)}
        </div>
      </Modal>
    </div>
  )
}

export default function VaultsTab({ cards, refreshKey }) {
  const [vaults, setVaults] = useState([])
  const [selVault, setSelVault] = useState(null)
  const [view, setView] = useState('list')
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [refresh, setRefresh] = useState(0)

  const cardMap = useMemo(() => { const m = {}; cards.forEach(c => m[c.id] = c); return m }, [cards])

  useEffect(() => { db.vaults.toArray().then(setVaults) }, [refresh, refreshKey])

  const create = async () => {
    if (!newName.trim()) { toast('Enter a vault name', 'error'); return }
    await db.vaults.add({ name: newName, description: newDesc, createdAt: Date.now() })
    setNewName(''); setNewDesc(''); setShowCreate(false); setRefresh(r => r + 1)
    toast('Vault created!')
  }

  if (view === 'detail' && selVault) return <VaultDetail vault={selVault} cardMap={cardMap} onBack={() => { setView('list'); setRefresh(r => r + 1) }} />

  return (
    <div style={{ padding: '16px 16px 0' }}>
      <button onClick={() => setShowCreate(!showCreate)} style={{ ...btnPrimary, background: 'linear-gradient(135deg,#a855f7,#7c3aed)', color: '#fff', marginBottom: 14 }}>+ Create New Vault</button>
      {showCreate && (
        <div style={{ background: '#1e293b', borderRadius: 12, padding: 16, marginBottom: 14, border: '1px solid #7c3aed44' }}>
          <input placeholder="Vault Name (e.g. Red Box)" value={newName} onChange={e => setNewName(e.target.value)} style={{ ...inputStyle, marginBottom: 10 }} />
          <input placeholder="Physical Location (e.g. Shelf 2)" value={newDesc} onChange={e => setNewDesc(e.target.value)} style={{ ...inputStyle, marginBottom: 12 }} />
          <button onClick={create} style={{ ...btnPrimary, background: '#a855f7', color: '#fff' }}>Create Vault</button>
        </div>
      )}
      {vaults.length === 0 && <div style={{ textAlign: 'center', color: '#6b7280', padding: 40 }}>No vaults yet. Create one to organize your physical cards!</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 16 }}>
        {vaults.map(v => <VaultCard key={v.id} vault={v} onClick={() => { setSelVault(v); setView('detail') }} />)}
      </div>
    </div>
  )
}
