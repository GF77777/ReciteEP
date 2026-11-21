// 封装浏览器语音合成，供各组件复用
// 系统语音不可用或未真正播放时，自动改用在线发音兜底

import { loadSpeechRate, loadSpeechAccent } from './storage'

let voices = []
let voicesBound = false
let onlineAudio = null

// 系统语音是否可用（仅内部判断，不再决定按钮显隐）
export const isSpeechSupported = () =>
  typeof window !== 'undefined' &&
  !!window.speechSynthesis &&
  typeof window.speechSynthesis.getVoices === 'function' &&
  typeof window.SpeechSynthesisUtterance === 'function'

// 读取系统音色，并兼容异步加载音色的浏览器
const loadVoices = () => {
  if (!isSpeechSupported()) return
  voices = window.speechSynthesis.getVoices()
  if (!voicesBound) {
    voicesBound = true
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices)
  }
}

// 供组件挂载时预载音色
export const preloadVoices = () => loadVoices()

// 优先匹配目标口音，其次任意英文音色
const pickEnglishVoice = (accent) => {
  const lang = accent === 'UK' ? 'en-GB' : 'en-US'
  return voices.find(v => v.lang === lang)
    || voices.find(v => v.lang.replace('_', '-') === lang)
    || voices.find(v => v.lang.startsWith('en'))
    || null
}

// 在线发音兜底：有道词典音频（type 1 英音 / 2 美音）
const playOnline = (text, accent) => {
  try {
    const type = accent === 'UK' ? 1 : 2
    const url = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&type=${type}`
    if (!onlineAudio) onlineAudio = new Audio()
    onlineAudio.src = url
    onlineAudio.play().catch(() => {})
    return true
  } catch {
    return false
  }
}

export const speak = (text, { rate, pitch = 1, accent } = {}) => {
  if (!text) return false

  const finalRate = rate ?? loadSpeechRate()
  const finalAccent = accent ?? loadSpeechAccent()

  if (!isSpeechSupported()) return playOnline(text, finalAccent)

  const synth = window.speechSynthesis
  loadVoices()

  // 没有任何音色说明设备缺少语音引擎，直接走在线发音
  if (voices.length === 0) {
    setTimeout(() => {
      loadVoices()
      if (voices.length === 0) playOnline(text, finalAccent)
      else speakWithSystem(text, finalRate, finalAccent, pitch, synth)
    }, 150)
    return true
  }

  return speakWithSystem(text, finalRate, finalAccent, pitch, synth)
}

const speakWithSystem = (text, rate, accent, pitch, synth) => {
  try {
    synth.cancel() // 连续点击时只播放最新一次
    if (synth.paused) synth.resume()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = accent === 'UK' ? 'en-GB' : 'en-US'
    utterance.rate = rate
    utterance.pitch = pitch
    const voice = pickEnglishVoice(accent)
    if (voice) utterance.voice = voice

    let started = false
    let usedOnline = false
    const fallback = () => {
      if (usedOnline) return
      usedOnline = true
      playOnline(text, accent)
    }

    utterance.onstart = () => { started = true }
    utterance.onerror = fallback

    // 延迟 speak，避免 Chrome / iOS 上 cancel 紧跟 speak 时吞音
    setTimeout(() => synth.speak(utterance), 40)

    // 系统引擎静默（无语音包 / 无 TTS 引擎）时自动兜底
    setTimeout(() => {
      if (!started && !synth.speaking) fallback()
    }, 800)

    return true
  } catch {
    return playOnline(text, accent)
  }
}
