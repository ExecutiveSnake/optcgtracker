export const API_BASE = 'https://optcgapi.com'
export const CONDITIONS = ['NM', 'LP', 'MP', 'HP', 'DMG']
export const DECK_TAGS = ['Meta', 'Casual', 'Work In Progress', 'Tournament', 'Retired']
export const BLOCK1 = ['OP01', 'ST01', 'ST02', 'ST03', 'ST04']

export const COLOR_MAP = {
  red: '#ef4444', blue: '#3b82f6', green: '#22c55e',
  purple: '#a855f7', black: '#9ca3af', yellow: '#eab308'
}

export const getColorHex = (color) => {
  if (!color) return '#6b7280'
  const c = color.toLowerCase()
  for (const [k, v] of Object.entries(COLOR_MAP)) { if (c.includes(k)) return v }
  if (c.includes('/') || c.includes('multi')) return '#f97316'
  return '#6b7280'
}

export const normalizeCard = (raw) => {
  const cardNum = (raw.card_number || raw.cardNumber || '').trim()
  const setId = (raw.set_id || raw.set || '').trim()
  const rawId = (raw.card_id || raw.id || '').toString().trim()
  const id = (rawId && rawId !== '0' && rawId !== 'undefined')
    ? rawId
    : (setId && cardNum) ? `${setId}-${cardNum}`
    : cardNum || rawId || Math.random().toString(36).slice(2)
  return {
    id,
    name: raw.name || raw.card_name || '',
    cardNumber: cardNum,
    set: setId,
    color: (raw.color || raw.colors || '').toLowerCase(),
    type: raw.card_type || raw.type || '',
    cost: raw.cost != null ? Number(raw.cost) : null,
    power: raw.power != null ? Number(raw.power) : null,
    counter: raw.counter != null ? raw.counter : null,
    affiliation: raw.attribute || raw.affiliation || raw.group_tag || raw.tag || '',
    effect: raw.effect || raw.card_effect || raw.text || '',
    imageUrl: raw.image_url || raw.card_image || raw.image || null,
    rarity: raw.rarity || '',
    life: raw.life != null ? raw.life : null,
  }
}

export const colorsMatch = (leaderColor, cardColor) => {
  if (!leaderColor || !cardColor) return true
  const lc = leaderColor.toLowerCase().split(/[\/,\s]+/).filter(Boolean)
  const cc = cardColor.toLowerCase().split(/[\/,\s]+/).filter(Boolean)
  return cc.some(c => lc.includes(c))
}

export const isBlock1Card = (card) =>
  BLOCK1.some(s => (card.cardNumber || '').startsWith(s) || (card.set || '').startsWith(s))

export const fetchAllPages = async (endpoint, onProgress) => {
  let url = API_BASE + endpoint
  let all = []
  while (url) {
    const res = await fetch(url)
    if (!res.ok) break
    const data = await res.json()
    if (Array.isArray(data)) { all = [...all, ...data]; break }
    const results = data.results || data.cards || []
    all = [...all, ...results]
    if (onProgress) onProgress(all.length, data.count || null)
    url = data.next || null
  }
  return all
}

// Levenshtein distance for fuzzy OCR matching
export const levenshtein = (a, b) => {
  const m = a.length, n = b.length
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0))
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1])
  return dp[m][n]
}

export const fuzzyScore = (ocr, target) => {
  if (!ocr || !target) return 999
  const o = ocr.toLowerCase().trim()
  const t = target.toLowerCase().trim()
  if (o.includes(t) || t.includes(o)) return 0
  const wlen = t.length
  let best = levenshtein(o, t)
  for (let i = 0; i <= o.length - wlen; i++) {
    const dist = levenshtein(o.slice(i, i + wlen), t)
    if (dist < best) best = dist
  }
  return best
}

// Shared styles
export const inputStyle = {
  width: '100%', background: '#1e293b', border: '1px solid #334155',
  borderRadius: 10, color: '#fff', padding: '12px 14px', fontSize: 14, outline: 'none'
}
export const btnPrimary = {
  background: 'linear-gradient(135deg,#f1c40f,#e67e22)', color: '#0f172a',
  border: 'none', borderRadius: 10, padding: '14px', fontSize: 15,
  fontWeight: 700, cursor: 'pointer', minHeight: 44, width: '100%'
}
export const btnSecondary = {
  background: '#1e293b', border: '1px solid #334155', borderRadius: 10,
  color: '#9ca3af', padding: '10px 14px', fontSize: 13, cursor: 'pointer', minHeight: 44
}
