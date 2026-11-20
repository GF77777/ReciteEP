// 把用户上传的文件统一解析成「词库数据 + 词库名」
// 支持 JSON / CSV / XLSX / XLS 四种格式，解析层只管产出行对象数组

import * as XLSX from 'xlsx'

// 读取文本（自动去掉 UTF-8 BOM）
const readText = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = (e) => {
    let text = e.target?.result || ''
    if (typeof text === 'string' && text.charCodeAt(0) === 0xFEFF) text = text.slice(1)
    resolve(text)
  }
  reader.onerror = () => reject(new Error('读取文件失败'))
  reader.readAsText(file)
})

// 读取 ArrayBuffer（用于 xlsx）
const readBuffer = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = (e) => resolve(e.target?.result)
  reader.onerror = () => reject(new Error('读取文件失败'))
  reader.readAsArrayBuffer(file)
})

// JSON：直接 parse
const parseJson = async (file) => {
  const text = await readText(file)
  try {
    return JSON.parse(text)
  } catch (err) {
    throw new Error('文件不是合法 JSON，请检查格式后重试')
  }
}

// CSV：手写解析，处理双引号、引号内的逗号和换行
const parseCsv = async (file) => {
  const text = await readText(file)
  if (!text.trim()) throw new Error('文件内容为空')

  const rows = []
  let field = ''
  let row = []
  let inQuotes = false

  // 统一换行
  const src = text.replace(/\r\n?/g, '\n')
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++ } // 转义双引号
        else inQuotes = false
      } else {
        field += ch
      }
    } else {
      if (ch === '"') inQuotes = true
      else if (ch === ',') { row.push(field); field = '' }
      else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = '' }
      else field += ch
    }
  }
  // 末尾没有换行的情况
  if (field || row.length) { row.push(field); rows.push(row) }

  // 去掉空行
  const nonEmptyRows = rows.filter(r => r.some(cell => cell.trim() !== ''))
  if (nonEmptyRows.length === 0) throw new Error('CSV 文件没有数据行')

  const headers = nonEmptyRows[0].map(h => h.trim())
  return nonEmptyRows.slice(1).map(row => {
    const obj = {}
    headers.forEach((h, i) => {
      if (h) obj[h] = row[i]?.trim() ?? ''
    })
    return obj
  })
}

// XLSX / XLS：SheetJS 只读第一个 sheet
const parseXlsx = async (file) => {
  const buffer = await readBuffer(file)
  try {
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) throw new Error('Excel 文件没有工作表')
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false })
    if (!Array.isArray(rows) || rows.length === 0) throw new Error('Excel 文件没有数据行')
    return rows
  } catch (err) {
    if (err && err.message) throw err
    throw new Error('Excel 解析失败，可能是文件已损坏')
  }
}

export const parseFile = async (file) => {
  if (!file) throw new Error('没有选择文件')

  const ext = file.name.split('.').pop().toLowerCase()
  const fallbackName = file.name.replace(/\.(json|csv|xlsx|xls)$/i, '')

  let data
  try {
    switch (ext) {
      case 'json': data = await parseJson(file); break
      case 'csv':  data = await parseCsv(file); break
      case 'xlsx':
      case 'xls':  data = await parseXlsx(file); break
      default:
        throw new Error(`不支持的文件格式「.${ext}」，请使用 JSON / CSV / XLSX`)
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    // 我们主动抛出的错误消息已经足够清晰，直接上抛
    if (msg.includes('不支持') || msg.includes('不是合法 JSON') || msg.includes('解析失败') || msg.includes('没有数据') || msg.includes('没有工作表') || msg.includes('内容为空')) {
      throw new Error(msg)
    }
    throw new Error(`${ext.toUpperCase()} 解析失败：${msg}`)
  }

  return { data, name: fallbackName }
}
