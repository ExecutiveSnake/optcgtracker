export const API_BASE = 'https://apitcg.com'
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
  // apitcg.com format: id/code = "OP03-070", family = affiliation, ability = effect
  const cardNum = (raw.code || raw.id || raw.card_number || raw.cardNumber || '').trim()
  const setName = raw.set?.name || raw.set_id || raw.set || ''
  // Extract set ID from card number prefix e.g. "OP03" from "OP03-070"
  const setId = cardNum.includes('-') ? cardNum.split('-')[0] : setName

  return {
    id: cardNum || Math.random().toString(36).slice(2),
    name: raw.name || raw.card_name || '',
    cardNumber: cardNum,
    set: setId,
    setName: setName,
    color: (raw.color || raw.colors || '').toLowerCase(),
    type: raw.type || raw.card_type || '',
    cost: raw.cost != null ? Number(raw.cost) : null,
    power: raw.power != null ? Number(raw.power) : null,
    counter: (raw.counter && raw.counter !== '-') ? raw.counter : null,
    affiliation: raw.family || raw.attribute || raw.affiliation || raw.group_tag || '',
    effect: raw.ability || raw.effect || raw.card_effect || '',
    trigger: raw.trigger || '',
    imageUrl: raw.images?.large || raw.images?.small || raw.image_url || null,
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

// Fetch all pages from apitcg.com paginated API
export const fetchAllPages = async (endpoint, onProgress) => {
  let page = 1
  let all = []
  let totalPages = 1

  while (page <= totalPages) {
    const url = `${API_BASE}${endpoint}&page=${page}&limit=100`
    const res = await fetch(url)
    if (!res.ok) break
    const data = await res.json()

    const results = data.data || data.results || []
    all = [...all, ...results]

    // apitcg uses totalPages field
    if (page === 1) {
      totalPages = data.totalPages || Math.ceil((data.total || results.length) / 100) || 1
    }

    if (onProgress) onProgress(all.length, data.total || null)
    page++
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
