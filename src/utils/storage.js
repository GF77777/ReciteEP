// 词库本地存储：只保存用户导入的词库，内置示例不写入

const DECKS_KEY = 'reciteep:decks:v1'
const LAST_DECK_KEY = 'reciteep:lastDeckId'
const AUTO_SPEAK_KEY = 'reciteep:autoSpeak:v1'
const FLASH_AUTO_SPEAK_KEY = 'reciteep:flashAutoSpeak:v1'
const FLASH_BG_KEY = 'reciteep:flashBg:v1'
const BATCH_SIZES_KEY = 'reciteep:batchSizes:v1'
const SPEECH_RATE_KEY = 'reciteep:speechRate:v1'
const SPEECH_ACCENT_KEY = 'reciteep:speechAccent:v1'
const SIDEBAR_WIDTH_KEY = 'reciteep:sidebarWidth:v1'
const DEFAULT_SPEECH_RATE = 0.9
const DEFAULT_SPEECH_ACCENT = 'US'
// 侧栏宽度范围（像素）
const SIDEBAR_MIN = 180
const SIDEBAR_MAX = 420

const read = (key, fallback) => {
  try {
    const value = localStorage.getItem(key)
    return value ? JSON.parse(value) : fallback
  } catch {
    return fallback
  }
}

export const loadDecks = () => {
  const decks = read(DECKS_KEY, [])
  if (!Array.isArray(decks)) return []
  // 过滤掉损坏或字段缺失的记录
  return decks.filter(deck => deck && deck.id && Array.isArray(deck.words))
}

export const saveDecks = (decks) => {
  try {
    localStorage.setItem(DECKS_KEY, JSON.stringify(decks))
    return true
  } catch {
    return false
  }
}

export const loadLastDeckId = () => {
  const raw = localStorage.getItem(LAST_DECK_KEY)
  if (!raw) return ''
  try {
    const value = JSON.parse(raw)
    return typeof value === 'string' ? value : ''
  } catch {
    // 兼容旧版本写入的纯字符串
    return raw
  }
}

export const saveLastDeckId = (id) => {
  try {
    localStorage.setItem(LAST_DECK_KEY, JSON.stringify(id))
  } catch {
    // 忽略：仅影响下次默认分组
  }
}

export const loadAutoSpeak = () => read(AUTO_SPEAK_KEY, false) === true

export const saveAutoSpeak = (value) => {
  try {
    localStorage.setItem(AUTO_SPEAK_KEY, JSON.stringify(!!value))
  } catch {
    // 忽略
  }
}

export const loadFlashAutoSpeak = () => read(FLASH_AUTO_SPEAK_KEY, false) === true

export const saveFlashAutoSpeak = (value) => {
  try {
    localStorage.setItem(FLASH_AUTO_SPEAK_KEY, JSON.stringify(!!value))
  } catch {
    // 忽略
  }
}

export const loadFlashBg = () => read(FLASH_BG_KEY, '')

export const saveFlashBg = (base64) => {
  try {
    localStorage.setItem(FLASH_BG_KEY, JSON.stringify(base64 || ''))
    return true
  } catch {
    return false
  }
}

// 每个词库各自的「每组单词数」，key 为词库 id
export const loadBatchSizes = () => {
  const map = read(BATCH_SIZES_KEY, {})
  return map && typeof map === 'object' && !Array.isArray(map) ? map : {}
}

export const saveBatchSizes = (map) => {
  try {
    localStorage.setItem(BATCH_SIZES_KEY, JSON.stringify(map || {}))
    return true
  } catch {
    return false
  }
}

// 语音设置：语速（0.5-1.5）与口音（US / UK）
export const loadSpeechRate = () => {
  const rate = Number(read(SPEECH_RATE_KEY, DEFAULT_SPEECH_RATE))
  if (!Number.isFinite(rate)) return DEFAULT_SPEECH_RATE
  return Math.min(1.5, Math.max(0.5, rate))
}

export const saveSpeechRate = (rate) => {
  const value = Math.min(1.5, Math.max(0.5, Number(rate) || DEFAULT_SPEECH_RATE))
  try {
    localStorage.setItem(SPEECH_RATE_KEY, JSON.stringify(value))
  } catch {
    // 忽略
  }
}

export const loadSpeechAccent = () => {
  const accent = read(SPEECH_ACCENT_KEY, DEFAULT_SPEECH_ACCENT)
  return accent === 'UK' ? 'UK' : 'US'
}

export const saveSpeechAccent = (accent) => {
  try {
    localStorage.setItem(SPEECH_ACCENT_KEY, JSON.stringify(accent === 'UK' ? 'UK' : 'US'))
  } catch {
    // 忽略
  }
}

// 侧栏宽度：拖动分隔条后持久化
export const loadSidebarWidth = () => {
  const width = Number(read(SIDEBAR_WIDTH_KEY, 0))
  if (!Number.isFinite(width) || width <= 0) return 260
  return Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, Math.round(width)))
}

export const saveSidebarWidth = (width) => {
  try {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, JSON.stringify(Math.round(width)))
  } catch {
    // 忽略：仅影响下次打开时的侧栏宽度
  }
}
