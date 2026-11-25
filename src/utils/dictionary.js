// 在线词典：补全缺失音标 + 真人发音音频，结果写入 localStorage 缓存

const CACHE_KEY = 'reciteep:dictCache:v1'
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

// 统一成 /.../ 形式
const normalizePhonetic = (text) => {
  const bare = String(text || '')
    .trim()
    .replace(/^[\/\[]+/, '')
    .replace(/[\/\]]+$/, '')
  return bare ? `/${bare}/` : ''
}

const parseEntry = (entry) => {
  if (!entry) return null
  const list = Array.isArray(entry.phonetics) ? entry.phonetics : []
  const phonetic = entry.phonetic || list.find(item => item.text)?.text || ''
  const audioUS = list.find(item => item.audio && item.audio.includes('-us.'))?.audio || ''
  const audioUK = list.find(item => item.audio && item.audio.includes('-uk.'))?.audio || ''
  if (!phonetic && !audioUS && !audioUK) return null
  return { phonetic: normalizePhonetic(phonetic), audioUS, audioUK, t: Date.now() }
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
