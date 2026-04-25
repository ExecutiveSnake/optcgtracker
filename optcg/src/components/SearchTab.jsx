import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import db from '../db'
import { getColorHex, fuzzyScore, inputStyle, btnSecondary } from '../utils'
import { CardImg, ColorDots, CardDetailModal, toast } from './Shared'

const PAGE_SIZE = 60

export default function SearchTab({ cards }) {
  const [q, setQ] = useState('')
  const [filters, setFilters] = useState({ color: '', type: '', set: '', affiliation: '', minCost: '', maxCost: '', minPower: '', maxPower: '' })
  const [showF, setShowF] = useState(false)
  const [results, setResults] = useState([])
  const [totalMatches, setTotalMatches] = useState(0)
  const [page, setPage] = useState(1)
  const [searching, setSearching] = useState(false)
  const [debugInfo, setDebugInfo] = useState('')
  const [sel, setSel] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [scanMatches, setScanMatches] = useState([])
  const [scanStatus, setScanStatus] = useState('')
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const timerRef = useRef(null)

  const affiliations = useMemo(() => {
    const s = new Set()
    cards.forEach(c => { if (c.affiliation) c.affiliation.split(/[\/,;]+/).forEach(a => { const t = a.trim(); if (t) s.add(t) }) })
    return [...s].sort()
  }, [cards])

  const sets = useMemo(() => [...new Set(cards.map(c => c.set).filter(Boolean))].sort(), [cards])

  // ── Core search — queries IndexedDB directly ──────────────
  const runSearch = useCallback(async (query, filts, pageNum) => {
    setSearching(true)
    try {
      const count = await db.cards.count()
      const lq = (query || '').toLowerCase().trim()
      setDebugInfo(`DB: ${count} cards | Searching: "${lq}"`)

      if (count === 0) {
        setDebugInfo('❌ DB empty — go to Settings → Clear Cache & Re-sync')
        setSearching(false)
        return
      }

      let collection
      if (lq) {
        collection = await db.cards.filter(c =>
          (c.name && c.name.toLowerCase().includes(lq)) ||
          (c.cardNumber && c.cardNumber.toLowerCase().includes(lq)) ||
          (c.effect && c.effect.toLowerCase().includes(lq))
        ).toArray()
      } else {
        collection = await db.cards.toArray()
      }

      if (filts.color) collection = collection.filter(c => c.color?.toLowerCase().includes(filts.color.toLowerCase()))
      if (filts.type) collection = collection.filter(c => c.type?.toLowerCase().includes(filts.type.toLowerCase()))
      if (filts.set) collection = collection.filter(c => c.set === filts.set)
      if (filts.affiliation) collection = collection.filter(c => c.affiliation?.toLowerCase().includes(filts.affiliation.toLowerCase()))
      if (filts.minCost !== '') collection = collection.filter(c => c.cost != null && c.cost >= Number(filts.minCost))
      if (filts.maxCost !== '') collection = collection.filter(c => c.cost != null && c.cost <= Number(filts.maxCost))
      if (filts.minPower !== '') collection = collection.filter(c => c.power != null && c.power >= Number(filts.minPower))
      if (filts.maxPower !== '') collection = collection.filter(c => c.power != null && c.power <= Number(filts.maxPower))

      setDebugInfo(`DB: ${count} cards | Found: ${collection.length} | Query: "${lq}"`)
      setTotalMatches(collection.length)
      setResults(collection.slice(0, pageNum * PAGE_SIZE))
    } catch (e) {
      setDebugInfo('❌ Error: ' + e.message)
      toast('Search error: ' + e.message, 'error')
    }
    setSearching(false)
  }, [])

  // Debounced auto-search
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => { setPage(1); runSearch(q, filters, 1) }, 350)
    return () => clearTimeout(timerRef.current)
  }, [q, filters, runSearch])

  const doSearch = () => { setPage(1); runSearch(q, filters, 1) }
  const loadMore = () => { const next = page + 1; setPage(next); runSearch(q, filters, next) }

  // ── Camera scan ───────────────────────────────────────────
  const startScan = async () => {
    setScanMatches([]); setScanStatus('Opening camera...')
    setScanning(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', aspectRatio: { ideal: 0.75 }, width: { ideal: 720 }, height: { ideal: 960 } } })
      streamRef.current = stream
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play() }
      setScanStatus('Point at card and tap Capture')
    } catch { toast('Camera unavailable', 'error'); setScanning(false); setScanStatus('') }
  }

  const stopScan = () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null }
    setScanning(false); setScanStatus('')
  }

  const capture = async () => {
    if (!videoRef.current) { toast('Camera not ready', 'error'); return }
    const vw = videoRef.current.videoWidth, vh = videoRef.current.videoHeight
    if (!vw || !vh) { setScanStatus('Camera not ready — wait a moment'); return }
    setScanStatus('Capturing...')
    const canvas = document.createElement('canvas')
    canvas.width = vw; canvas.height = vh
    const ctx = canvas.getContext('2d')
    ctx.drawImage(videoRef.current, 0, 0)
    // Preprocess: grayscale + contrast
    const img = ctx.getImageData(0, 0, vw, vh)
    for (let i = 0; i < img.data.length; i += 4) {
      const g = Math.min(255, Math.max(0, (0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2] - 128) * 1.5 + 128))
      img.data[i] = img.data[i + 1] = img.data[i + 2] = g
    }
    ctx.putImageData(img, 0, 0)
    stopScan()
    setScanStatus('Running OCR...')
    try {
      const { createWorker } = await import('tesseract.js')
      const worker = await createWorker('eng')
      await worker.setParameters({ tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-. ' })
      const { data: { text, confidence } } = await worker.recognize(canvas)
      await worker.terminate()
      if (!text?.trim()) { setScanStatus('No text detected — try better lighting'); return }
      const ocrText = text.toLowerCase()
      setScanStatus(`OCR done (${Math.round(confidence || 0)}% confidence) — matching...`)
      const allCards = await db.cards.toArray()
      const scored = allCards.map(c => ({ card: c, score: Math.min(c.name ? fuzzyScore(ocrText, c.name) : 999, c.cardNumber ? fuzzyScore(ocrText, c.cardNumber) : 999) }))
      scored.sort((a, b) => a.score - b.score)
      const threshold = Math.max(4, Math.floor((text.length || 10) * 0.3))
      const matches = scored.filter(s => s.score <= threshold).slice(0, 5).map(s => s.card)
      const display = matches.length ? matches : scored.slice(0, 3).map(s => s.card)
      setScanMatches(display)
      setScanStatus(matches.length ? `Found ${matches.length} match(es)` : `Low confidence — showing closest ${display.length} guesses`)
      toast(matches.length ? `${matches.length} card(s) matched` : 'Low confidence — verify result', matches.length ? 'success' : 'warning')
    } catch (e) { setScanStatus('OCR failed — try card number search'); toast('Scan failed', 'error') }
  }

  const sf = { ...inputStyle }

  return (
    <div style={{ padding: '16px 16px 0' }}>
      {/* Search bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          placeholder="Name, card number (e.g. OP01-001), effect..."
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && doSearch()}
          style={{ ...inputStyle, flex: 1 }}
        />
        <button onClick={doSearch} style={{ background: '#f1c40f', color: '#0f172a', border: 'none', borderRadius: 10, padding: '0 16px', fontWeight: 700, cursor: 'pointer', minHeight: 44, fontSize: 14 }}>Go</button>
        <button onClick={() => setShowF(!showF)} style={{ ...btnSecondary, padding: '0 10px', background: showF ? '#334155' : '#1e293b' }}>⚙️</button>
        <button onClick={scanning ? stopScan : startScan} style={{ ...btnSecondary, padding: '0 10px', fontSize: 20, color: '#f1c40f' }}>📷</button>
      </div>

      {/* Camera */}
      {scanning && (
        <div style={{ marginBottom: 14, borderRadius: 14, overflow: 'hidden', border: '2px solid #f1c40f', position: 'relative' }}>
          <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', display: 'block', aspectRatio: '3/4', objectFit: 'cover' }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.75)', padding: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ color: '#f1c40f', fontSize: 12, flex: 1 }}>{scanStatus}</span>
            <button onClick={capture} style={{ background: '#f1c40f', color: '#0f172a', border: 'none', borderRadius: 8, padding: '10px 18px', fontWeight: 700, cursor: 'pointer', minHeight: 44 }}>Capture</button>
            <button onClick={stopScan} style={{ background: '#374151', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 14px', cursor: 'pointer', minHeight: 44 }}>✕</button>
          </div>
        </div>
      )}

      {scanStatus && !scanning && <div style={{ background: '#1e293b', borderRadius: 10, padding: '8px 12px', marginBottom: 12, fontSize: 12, color: '#9ca3af' }}>{scanStatus}</div>}

      {scanMatches.length > 0 && (
        <div style={{ background: '#1e293b', borderRadius: 12, padding: 12, marginBottom: 14 }}>
          <div style={{ color: '#f1c40f', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Scan Matches</div>
          {scanMatches.map(c => (
            <div key={c.id} onClick={() => { setSel(c); setScanMatches([]); setScanStatus('') }} style={{ display: 'flex', gap: 10, padding: 10, borderRadius: 8, background: '#0f172a', marginBottom: 6, cursor: 'pointer', border: '1px solid #334155', alignItems: 'center' }}>
              <CardImg card={c} size={36} />
              <div><div style={{ color: '#fff', fontSize: 13 }}>{c.name}</div><div style={{ color: '#9ca3af', fontSize: 11 }}>{c.cardNumber}</div></div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      {showF && (
        <div style={{ background: '#1e293b', borderRadius: 12, padding: 14, marginBottom: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[['color', ['Red', 'Blue', 'Green', 'Purple', 'Black', 'Yellow'], 'Color'], ['type', ['Leader', 'Character', 'Event', 'Stage', 'DON!!'], 'Type']].map(([key, opts, label]) => (
            <select key={key} value={filters[key]} onChange={e => setFilters(f => ({ ...f, [key]: e.target.value }))} style={{ ...sf }}>
              <option value="">All {label}s</option>
              {opts.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          ))}
          <select value={filters.set} onChange={e => setFilters(f => ({ ...f, set: e.target.value }))} style={{ ...sf }}>
            <option value="">All Sets</option>{sets.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filters.affiliation} onChange={e => setFilters(f => ({ ...f, affiliation: e.target.value }))} style={{ ...sf }}>
            <option value="">All Affiliations</option>{affiliations.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <input placeholder="Min Cost" type="number" value={filters.minCost} onChange={e => setFilters(f => ({ ...f, minCost: e.target.value }))} style={{ ...sf }} />
          <input placeholder="Max Cost" type="number" value={filters.maxCost} onChange={e => setFilters(f => ({ ...f, maxCost: e.target.value }))} style={{ ...sf }} />
          <input placeholder="Min Power" type="number" value={filters.minPower} onChange={e => setFilters(f => ({ ...f, minPower: e.target.value }))} style={{ ...sf }} />
          <input placeholder="Max Power" type="number" value={filters.maxPower} onChange={e => setFilters(f => ({ ...f, maxPower: e.target.value }))} style={{ ...sf }} />
          <button onClick={() => setFilters({ color: '', type: '', set: '', affiliation: '', minCost: '', maxCost: '', minPower: '', maxPower: '' })} style={{ gridColumn: '1/-1', ...btnSecondary, width: '100%', textAlign: 'center' }}>Clear Filters</button>
        </div>
      )}

      {/* Debug bar */}
      {debugInfo && (
        <div style={{ background: '#0a1628', border: '1px solid #1e3a5f', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 11, color: '#60a5fa', fontFamily: 'monospace' }}>
          🔍 {debugInfo}
        </div>
      )}

      <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>Showing {results.length} of {totalMatches} card{totalMatches !== 1 ? 's' : ''}</span>
        {searching && <span style={{ color: '#f1c40f', fontSize: 11 }} className="pulse">Searching...</span>}
      </div>

      {/* Results grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, paddingBottom: 16 }}>
        {results.map(card => (
          <div key={card.id} onClick={() => setSel(card)} style={{ background: '#1e293b', borderRadius: 12, overflow: 'hidden', cursor: 'pointer', border: `1px solid ${getColorHex(card.color)}44` }}>
            <div style={{ display: 'flex', justifyContent: 'center', background: '#0a1628', padding: '10px 10px 6px' }}>
              <CardImg card={card} size={70} />
            </div>
            <div style={{ padding: '8px 10px' }}>
              <div style={{ color: '#fff', fontSize: 12, fontWeight: 600, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.name}</div>
              <div style={{ color: '#9ca3af', fontSize: 10, marginBottom: 4 }}>{card.cardNumber}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <ColorDots color={card.color} size={8} />
                <div style={{ display: 'flex', gap: 5 }}>
                  {card.cost != null && <span style={{ color: '#60a5fa', fontSize: 10 }}>💎{card.cost}</span>}
                  {card.power != null && <span style={{ color: '#f87171', fontSize: 10 }}>⚔️{(card.power / 1000).toFixed(0)}k</span>}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {results.length < totalMatches && (
        <button onClick={loadMore} style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: 12, color: '#f1c40f', padding: '14px', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 16, minHeight: 44 }}>
          Load More ({totalMatches - results.length} remaining)
        </button>
      )}

      {results.length === 0 && !searching && totalMatches === 0 && q && (
        <div style={{ textAlign: 'center', color: '#6b7280', padding: 40 }}>No cards found for "{q}"</div>
      )}

      <CardDetailModal card={sel} open={!!sel} onClose={() => setSel(null)} db={db} onAction={doSearch} />
    </div>
  )
}
