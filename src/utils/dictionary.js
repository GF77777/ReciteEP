// 在线词典：补全缺失音标 + 真人发音音频，结果写入 localStorage 缓存

const CACHE_KEY = 'reciteep:dictCache:v2'
const CACHE_LIMIT = 500
const TIMEOUT = 6000
const API = 'https://api.dictionaryapi.dev/api/v2/entries/en/'

const readCache = () => {
  try {
    const value = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  } catch {
    return {}
  }
}

let cache = readCache()
const pending = new Map()

const saveCache = () => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch {
    // 忽略：缓存写入失败不影响功能
  }
}

// 超出上限时按查询时间淘汰最旧记录
const trimCache = () => {
  const keys = Object.keys(cache)
  if (keys.length <= CACHE_LIMIT) return
  keys
    .sort((a, b) => (cache[a].t || 0) - (cache[b].t || 0))
    .slice(0, keys.length - CACHE_LIMIT)
    .forEach(key => { delete cache[key] })
}

// 规范化为教材式音标：去音节分隔、统一符号、成音节改写
const SYMBOL_MAP = {
  'ɹ': 'r',
  'ɛ': 'e',
  'ɐ': 'ʌ',
  'ɚ': 'ə',
  'ɝ': 'ɜː',
  'ɫ': 'l',
  'ɡ': 'g'
}

// 成音节辅音：l̩ → (ə)l 等
const SYLLABIC_MAP = {
  'l': '(ə)l',
  'n': '(ə)n',
  'm': '(ə)m',
  'ŋ': '(ə)ŋ'
}

const normalizePhonetic = (text) => {
  let bare = String(text || '')
    .trim()
    .replace(/^[\/\[]+/, '')
    .replace(/[\/\]]+$/, '')
    // 去音节分隔符
    .replace(/[.‿]/g, '')
    // 成音节标记（U+0329）转成 (ə)X
    .replace(/([lnmŋ])\u0329/g, (_, c) => SYLLABIC_MAP[c] || c)
    // 组合符残留
    .replace(/\u0329/g, '')
    .trim()

  bare = bare
    .split('')
    .map(ch => SYMBOL_MAP[ch] || ch)
    .join('')
    .replace(/\s+/g, '')
    // 教材音标通常不标词中次重音：保留词首 ˌ，去掉其余
    .replace(/(.)ˌ/g, '$1')

  // 重音符号若在词首且紧跟空格，去掉多余空格（上面已去空格）
  return bare ? `/${bare}/` : ''
}

// 按音频标注区分英/美版本
const regionOf = (audio) => {
  if (!audio) return ''
  if (audio.includes('-us.')) return 'US'
  if (audio.includes('-uk.')) return 'UK'
  return ''
}

const parseEntry = (entry) => {
  if (!entry) return null
  const list = Array.isArray(entry.phonetics) ? entry.phonetics : []

  let phoneticUS = ''
  let phoneticUK = ''
  const audioUS = list.find(item => item.audio && item.audio.includes('-us.'))?.audio || ''
  const audioUK = list.find(item => item.audio && item.audio.includes('-uk.'))?.audio || ''
  const fallback = entry.phonetic || list.find(item => item.text)?.text || ''

  list.forEach((item) => {
    if (!item.text) return
    const region = regionOf(item.audio)
    if (region === 'US' && !phoneticUS) phoneticUS = normalizePhonetic(item.text)
    if (region === 'UK' && !phoneticUK) phoneticUK = normalizePhonetic(item.text)
  })

  const phonetic = normalizePhonetic(fallback) || phoneticUS || phoneticUK
  if (!phonetic && !audioUS && !audioUK) return null
  return { phonetic, phoneticUS, phoneticUK, audioUS, audioUK, t: Date.now() }
}

// 按设置的口音取对应版本的音标
export const pickPhonetic = (info, accent) => {
  if (!info) return ''
  return accent === 'UK'
    ? (info.phoneticUK || info.phoneticUS || info.phonetic)
    : (info.phoneticUS || info.phoneticUK || info.phonetic)
}

export const getCachedWordInfo = (word) =>
  cache[String(word || '').trim().toLowerCase()] || null

export const fetchWordInfo = (word) => {
  const key = String(word || '').trim().toLowerCase()
  if (!key) return Promise.resolve(null)
  if (cache[key]) return Promise.resolve(cache[key])
  if (pending.has(key)) return pending.get(key)

  const task = (async () => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT)
    try {
      const response = await fetch(API + encodeURIComponent(key), { signal: controller.signal })
      if (!response.ok) return null
      const data = await response.json()
      const info = parseEntry(Array.isArray(data) ? data[0] : null)
      if (!info) return null
      cache[key] = info
      trimCache()
      saveCache()
      return info
    } catch {
      return null // 超时 / 断网 / 无该词：静默失败
    } finally {
      clearTimeout(timer)
      pending.delete(key)
    }
  })()

  pending.set(key, task)
  return task
}
