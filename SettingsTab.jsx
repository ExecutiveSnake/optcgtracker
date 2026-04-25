import { useState, useEffect, useRef, useCallback } from 'react'
import db from '../db'
import { fetchAllPages, normalizeCard, btnPrimary } from '../utils'
import { Modal, toast } from './Shared'

export default function SettingsTab({ onSyncDone }) {
  const [syncing, setSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState('')
  const [lastSync, setLastSync] = useState(null)
  const [cardCount, setCardCount] = useState(0)
  const [tournMode, setTournMode] = useState(false)
  const [importConfirm, setImportConfirm] = useState(false)
  const [clearConfirm, setClearConfirm] = useState(false)
  const fileRef = useRef(null)

  const refreshCount = useCallback(() => { db.cards.count().then(setCardCount) }, [])

  useEffect(() => {
    db.settings.get('lastSync').then(r => { if (r) setLastSync(new Date(r.value)) })
    db.settings.get('tournamentMode').then(r => { if (r) setTournMode(r.value) })
    refreshCount()
  }, [refreshCount])

  const sync = async (clearFirst = false) => {
    setSyncing(true); setSyncStatus('Starting...')
    try {
      if (clearFirst) { setSyncStatus('Clearing cache...'); await db.cards.clear(); setCardCount(0) }
      const eps = ['/api/allSetCards/', '/api/allSTCards/', '/api/allPromoCards/', '/api/allDonCards/']
      let total = 0
      for (const ep of eps) {
        try {
          const epName = ep.replace('/api/', '').replace('/', '')
          setSyncStatus(`Fetching ${epName}...`)
          const raw = await fetchAllPages(ep, (loaded, count) => {
            setSyncStatus(`${epName}: ${loaded}${count ? '/' + count : ''} cards...`)
          })
          console.log(`[OPTCG] ${epName} — ${raw.length} cards, sample:`, raw[0])
          const norm = raw.map(normalizeCard)
          console.log(`[OPTCG] ${epName} normalized sample:`, norm[0])
          await db.cards.bulkPut(norm)
          total += norm.length
          setSyncStatus(`Loaded ${total} total so far...`)
        } catch (e) { console.error('Endpoint error:', ep, e) }
      }
      const actual = await db.cards.count()
      console.log(`[OPTCG] Sync done. Attempted: ${total} | In DB: ${actual}`)
      await db.settings.put({ key: 'lastSync', value: Date.now() })
      setLastSync(new Date())
      setCardCount(actual)
      setSyncStatus('')
      toast(`Synced! ${actual} cards in database.`)
      onSyncDone && onSyncDone()
    } catch (e) { toast('Sync failed: ' + e.message, 'error'); setSyncStatus('') }
    setSyncing(false)
  }

  const exportData = async () => {
    const data = {
      exportedAt: new Date().toISOString(),
      catalog: await db.catalog.toArray(),
      decks: await db.decks.toArray(),
      deckCards: await db.deckCards.toArray(),
      vaults: await db.vaults.toArray(),
      vaultCards: await db.vaultCards.toArray()
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `optcg-backup-${Date.now()}.json`; a.click()
    toast('Data exported!')
  }

  const importData = async (file) => {
    try {
      const data = JSON.parse(await file.text())
      if (data.catalog) await db.catalog.bulkPut(data.catalog)
      if (data.decks) await db.decks.bulkPut(data.decks)
      if (data.deckCards) await db.deckCards.bulkPut(data.deckCards)
      if (data.vaults) await db.vaults.bulkPut(data.vaults)
      if (data.vaultCards) await db.vaultCards.bulkPut(data.vaultCards)
      toast('Data imported!'); setImportConfirm(false)
    } catch { toast('Import failed', 'error') }
  }

  const row = { background: '#1e293b', borderRadius: 12, padding: 16, marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }

  return (
    <div style={{ padding: '16px 16px 0' }}>
      <div style={{ color: '#f1c40f', fontSize: 18, fontWeight: 700, marginBottom: 18, fontFamily: "'Cinzel',serif" }}>Settings</div>

      <div style={{ background: '#0a1628', borderRadius: 12, padding: 14, marginBottom: 10, border: '1px solid #1e3a5f', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ color: '#9ca3af', fontSize: 13 }}>Cards in database</div>
        <div style={{ color: '#f1c40f', fontSize: 18, fontWeight: 700 }}>{cardCount.toLocaleString()}</div>
      </div>

      {syncing && syncStatus && (
        <div style={{ background: '#1e3a5f', borderRadius: 10, padding: 12, marginBottom: 10, fontSize: 13, color: '#93c5fd' }} className="pulse">{syncStatus}</div>
      )}

      <div style={row}>
        <div>
          <div style={{ color: '#fff', fontSize: 15, fontWeight: 600 }}>Sync Card Database</div>
          <div style={{ color: '#9ca3af', fontSize: 12, marginTop: 2 }}>{lastSync ? `Last: ${lastSync.toLocaleDateString()}` : 'Never synced'}</div>
        </div>
        <button onClick={() => sync(false)} disabled={syncing} style={{ background: syncing ? '#374151' : 'linear-gradient(135deg,#f1c40f,#e67e22)', color: '#0f172a', border: 'none', borderRadius: 10, padding: '10px 16px', fontWeight: 700, cursor: syncing ? 'default' : 'pointer', fontSize: 13, minHeight: 44 }}>
          {syncing ? 'Syncing...' : 'Sync Now'}
        </button>
      </div>

      <div style={row}>
        <div>
          <div style={{ color: '#fff', fontSize: 15, fontWeight: 600 }}>Clear Cache & Re-sync</div>
          <div style={{ color: '#9ca3af', fontSize: 12, marginTop: 2 }}>Fix if card count looks wrong</div>
        </div>
        <button onClick={() => setClearConfirm(true)} disabled={syncing} style={{ background: '#450a0a', border: '1px solid #ef4444', color: '#fca5a5', borderRadius: 10, padding: '10px 14px', fontWeight: 700, cursor: syncing ? 'default' : 'pointer', fontSize: 13, minHeight: 44 }}>
          Clear & Re-sync
        </button>
      </div>

      <div style={row}>
        <div>
          <div style={{ color: '#fff', fontSize: 15, fontWeight: 600 }}>Tournament Mode</div>
          <div style={{ color: '#9ca3af', fontSize: 12, marginTop: 2 }}>Enforce Block 1 ban list</div>
        </div>
        <div onClick={() => { const v = !tournMode; setTournMode(v); db.settings.put({ key: 'tournamentMode', value: v }) }} style={{ width: 52, height: 30, borderRadius: 15, background: tournMode ? '#f1c40f' : '#374151', position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}>
          <div style={{ position: 'absolute', top: 3, left: tournMode ? 24 : 3, width: 24, height: 24, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
        </div>
      </div>

      <div style={row}>
        <div>
          <div style={{ color: '#fff', fontSize: 15, fontWeight: 600 }}>Export Data</div>
          <div style={{ color: '#9ca3af', fontSize: 12, marginTop: 2 }}>Save catalog, decks & vaults</div>
        </div>
        <button onClick={exportData} style={{ background: '#1e3a5f', border: '1px solid #3b82f6', color: '#60a5fa', borderRadius: 10, padding: '10px 16px', fontWeight: 700, cursor: 'pointer', fontSize: 13, minHeight: 44 }}>Export</button>
      </div>

      <div style={row}>
        <div>
          <div style={{ color: '#fff', fontSize: 15, fontWeight: 600 }}>Import Data</div>
          <div style={{ color: '#9ca3af', fontSize: 12, marginTop: 2 }}>Restore from backup file</div>
        </div>
        <button onClick={() => setImportConfirm(true)} style={{ background: '#1e293b', border: '1px solid #6b7280', color: '#9ca3af', borderRadius: 10, padding: '10px 16px', fontWeight: 700, cursor: 'pointer', fontSize: 13, minHeight: 44 }}>Import</button>
      </div>

      <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={e => { if (e.target.files[0]) importData(e.target.files[0]) }} />

      <Modal open={clearConfirm} onClose={() => setClearConfirm(false)} title="Clear Card Cache">
        <div style={{ color: '#fca5a5', fontSize: 14, marginBottom: 16, lineHeight: 1.6 }}>⚠️ This deletes all cached card data and re-fetches from the API. Your catalog, decks, and vaults are NOT affected.</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => setClearConfirm(false)} style={{ flex: 1, background: '#374151', border: 'none', borderRadius: 10, color: '#fff', padding: '12px', fontSize: 14, cursor: 'pointer', minHeight: 44 }}>Cancel</button>
          <button onClick={() => { setClearConfirm(false); sync(true) }} style={{ flex: 1, background: '#ef4444', border: 'none', borderRadius: 10, color: '#fff', padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer', minHeight: 44 }}>Clear & Re-sync</button>
        </div>
      </Modal>

      <Modal open={importConfirm} onClose={() => setImportConfirm(false)} title="Import Data">
        <div style={{ color: '#fca5a5', fontSize: 14, marginBottom: 16, lineHeight: 1.6 }}>⚠️ This will merge imported data into your current catalog, decks, and vaults. Continue?</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => setImportConfirm(false)} style={{ flex: 1, background: '#374151', border: 'none', borderRadius: 10, color: '#fff', padding: '12px', fontSize: 14, cursor: 'pointer', minHeight: 44 }}>Cancel</button>
          <button onClick={() => fileRef.current?.click()} style={{ flex: 1, background: '#ef4444', border: 'none', borderRadius: 10, color: '#fff', padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer', minHeight: 44 }}>Choose File</button>
        </div>
      </Modal>

      <div style={{ background: '#1e293b', borderRadius: 12, padding: 16, marginTop: 8, border: '1px solid #1e3a5f', textAlign: 'center' }}>
        <div style={{ color: '#f1c40f', fontSize: 14, fontWeight: 700, fontFamily: "'Cinzel',serif", marginBottom: 4 }}>OPTCG Manager</div>
        <div style={{ color: '#6b7280', fontSize: 11, lineHeight: 1.6 }}>Card data from optcgapi.com<br />One Piece TCG © Bandai · Data stored locally</div>
      </div>
    </div>
  )
}
