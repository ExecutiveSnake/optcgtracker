import { useState, useEffect, useCallback } from 'react'
import db from './db'
import { normalizeCard, fetchAllPages } from './utils'
import { Toasts } from './components/Shared'
import SearchTab from './components/SearchTab'
import CatalogTab from './components/CatalogTab'
import DecksTab from './components/DecksTab'
import VaultsTab from './components/VaultsTab'
import SettingsTab from './components/SettingsTab'

const TABS = [
  { id: 'search', label: 'Search', icon: '🔍' },
  { id: 'catalog', label: 'Catalog', icon: '📚' },
  { id: 'decks', label: 'Decks', icon: '🗂' },
  { id: 'vaults', label: 'Vaults', icon: '📦' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
]

export default function App() {
  const [tab, setTab] = useState('search')
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadMsg, setLoadMsg] = useState('Initializing...')
  const [syncKey, setSyncKey] = useState(0)

  useEffect(() => {
    const init = async () => {
      // Check cache first
      const cached = await db.cards.toArray()
      if (cached.length > 0) {
        setCards(cached)
        setLoading(false)
        return
      }
      // Fresh fetch
      setLoadMsg('Fetching card database from apitcg.com...')
      const eps = ['/api/one-piece/cards?']
      let all = []
      for (const ep of eps) {
        try {
          setLoadMsg('Loading One Piece cards...')
          const raw = await fetchAllPages(ep, (loaded, count) => {
            setLoadMsg(`Loading: ${loaded}${count ? '/' + count : ''} cards...`)
          })
          console.log(`[OPTCG] apitcg raw sample:`, raw[0])
          all = [...all, ...raw.map(normalizeCard)]
          setLoadMsg(`Loaded ${all.length} cards...`)
        } catch (e) { console.error('Load error:', ep, e) }
      }
      if (all.length > 0) {
        await db.cards.bulkPut(all)
        await db.settings.put({ key: 'lastSync', value: Date.now() })
        console.log(`[OPTCG] Initial load complete: ${all.length} cards`)
      }
      setCards(await db.cards.toArray())
      setLoading(false)
    }
    init()
  }, [])

  const handleSyncDone = useCallback(async () => {
    const all = await db.cards.toArray()
    console.log(`[OPTCG] Post-sync reload: ${all.length} cards`)
    setCards(all)
    setSyncKey(k => k + 1)
  }, [])

  return (
    <div style={{ background: '#020c1b', minHeight: '100dvh', display: 'flex', flexDirection: 'column', maxWidth: 480, margin: '0 auto', position: 'relative' }}>
      <Toasts />

      {/* Header */}
      <div style={{ background: 'linear-gradient(180deg,#0a1628,#0f172a)', padding: 'calc(env(safe-area-inset-top) + 12px) 20px 12px', borderBottom: '1px solid #1e3a5f', position: 'sticky', top: 0, zIndex: 100, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 26 }}>☠️</div>
        <div style={{ flex: 1 }}>
          <div style={{ color: '#f1c40f', fontSize: 18, fontWeight: 900, fontFamily: "'Cinzel',serif", letterSpacing: 1 }}>OPTCG Manager</div>
          <div style={{ color: '#4a7fa5', fontSize: 11 }}>{loading ? loadMsg : `${cards.length.toLocaleString()} cards loaded`}</div>
        </div>
        {loading && <div style={{ color: '#f1c40f', fontSize: 18 }} className="spin">⚙️</div>}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 80 }}>
        {loading && cards.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '70vh', gap: 16, padding: 24 }}>
            <div style={{ fontSize: 56 }} className="pulse">🏴‍☠️</div>
            <div style={{ color: '#f1c40f', fontSize: 20, fontWeight: 700, fontFamily: "'Cinzel',serif", textAlign: 'center' }}>Loading Card Database</div>
            <div style={{ color: '#4a7fa5', fontSize: 13, textAlign: 'center' }}>{loadMsg}</div>
            <div style={{ color: '#6b7280', fontSize: 12, textAlign: 'center', lineHeight: 1.6 }}>First load fetches all cards from OPTCG API.<br />Cached locally after — future loads are instant.</div>
          </div>
        ) : (
          <>
            {tab === 'search' && <SearchTab cards={cards} />}
            {tab === 'catalog' && <CatalogTab cards={cards} refreshKey={syncKey} />}
            {tab === 'decks' && <DecksTab cards={cards} refreshKey={syncKey} />}
            {tab === 'vaults' && <VaultsTab cards={cards} refreshKey={syncKey} />}
            {tab === 'settings' && <SettingsTab onSyncDone={handleSyncDone} />}
          </>
        )}
      </div>

      {/* Bottom nav */}
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, background: '#0a1628', borderTop: '1px solid #1e3a5f', display: 'flex', zIndex: 200, paddingBottom: 'env(safe-area-inset-bottom,0px)' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, background: 'none', border: 'none', padding: '10px 4px 8px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minHeight: 56 }}>
            <div style={{ fontSize: 20 }}>{t.icon}</div>
            <div style={{ fontSize: 10, color: tab === t.id ? '#f1c40f' : '#4a7fa5', fontWeight: tab === t.id ? 700 : 400, transition: 'color 0.15s' }}>{t.label}</div>
            {tab === t.id && <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#f1c40f' }} />}
          </button>
        ))}
      </div>
    </div>
  )
}
