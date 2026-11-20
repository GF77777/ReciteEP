// 词库标准化：把不同来源的 JSON 统一成内部字段

const WORD_KEYS = ['word', 'term', 'spelling', '单词']
const PHONETIC_KEYS = ['phonetic', 'ipa', 'pronunciation', '音标']
const CORE_KEYS = ['core', 'meaning', 'definition', 'translation', '释义', '中文释义']
const USAGE_KEYS = ['usage', 'exam_point', 'cet4', 'note', '考点', '用法']
const CLUE_KEYS = ['clue', 'memory', 'tip', '记忆', '记忆线索']

// 按别名取第一个非空值，数组用「；」拼接
const pickText = (source, keys) => {
  if (!source || typeof source !== 'object') return ''
  for (const key of keys) {
    const value = source[key]
    if (value === undefined || value === null) continue
    const text = Array.isArray(value)
      ? value.map(v => String(v).trim()).filter(Boolean).join('；')
      : String(value).trim()
    if (text) return text
  }
  return ''
}

const toDistractors = (value) => {
  if (!Array.isArray(value)) return []
  return value.map(v => String(v).trim()).filter(Boolean).slice(0, 3)
}

// 兼容对象、扁平字段和纯字符串三种例句写法
const normalizeExample = (item, word) => {
  const raw = item.example
  let en = ''
  let cn = ''
  let cloze = ''
  let distractors = []

  if (typeof raw === 'string') {
    en = raw.trim()
  } else if (raw && typeof raw === 'object') {
    en = pickText(raw, ['en', 'sentence', '英文例句'])
    cn = pickText(raw, ['cn', 'translation', '中文翻译'])
    cloze = pickText(raw, ['cloze', 'answer', '填空答案'])
    distractors = toDistractors(raw.distractors)
  }

  if (!en) en = pickText(item, ['example_en', 'example_sentence', 'sentence'])
  if (!cn) cn = pickText(item, ['example_cn', 'example_translation'])
  if (!en) return null

  const example = {
    en,
    cloze: cloze || word,
    distractors
  }
  if (cn) example.cn = cn
  return example
}

export const normalizeDeck = (raw, fallbackName = '未命名词库') => {
  const list = Array.isArray(raw) ? raw : Array.isArray(raw?.words) ? raw.words : []
  const name = pickText(raw, ['name', 'title', '词库名']) || fallbackName

  const words = []
  const seen = new Set()
  let skipped = 0
  let duplicates = 0

  list.forEach((item) => {
    if (!item || typeof item !== 'object') {
      skipped++
      return
    }

    const word = pickText(item, WORD_KEYS)
    if (!word) {
      skipped++
      return
    }

    const key = word.toLowerCase()
    if (seen.has(key)) {
      duplicates++
      return
    }
    seen.add(key)

    const entry = { word }
    const phonetic = pickText(item, PHONETIC_KEYS)
    const core = pickText(item, CORE_KEYS)
    const usage = pickText(item, USAGE_KEYS)
    const clue = pickText(item, CLUE_KEYS)
    const example = normalizeExample(item, word)

    if (phonetic) entry.phonetic = phonetic
    if (core) entry.core = core
    if (usage) entry.usage = usage
    if (clue) entry.clue = clue
    if (example) entry.example = example

    words.push(entry)
  })

  // 没有干扰项时，从同词库其他单词里补，保证模式 3 可出题
  const pool = words.map(entry => entry.word)
  words.forEach((entry) => {
    if (!entry.example || entry.example.distractors.length > 0) return
    entry.example.distractors = pool
      .filter(word => word.toLowerCase() !== entry.word.toLowerCase())
      .slice(0, 3)
  })

  return {
    deck: { name, words },
    skipped,
    duplicates
  }
}
