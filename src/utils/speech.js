// 封装浏览器语音合成，供各组件复用

import { loadSpeechRate, loadSpeechAccent } from './storage'

let voices = []
let voicesBound = false

// 读取系统音色，并兼容异步加载音色的浏览器
const loadVoices = () => {
  if (!('speechSynthesis' in window)) return
  voices = window.speechSynthesis.getVoices()
  if (!voicesBound) {
    voicesBound = true
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices)
  }
}

// 优先匹配目标口音，其次任意英文音色
const pickEnglishVoice = (accent) => {
  const lang = accent === 'UK' ? 'en-GB' : 'en-US'
  return voices.find(v => v.lang === lang)
    || voices.find(v => v.lang.replace('_', '-') === lang)
    || voices.find(v => v.lang.startsWith('en'))
    || null
}

export const isSpeechSupported = () => 'speechSynthesis' in window

export const speak = (text, { rate, pitch = 1, accent } = {}) => {
  if (!text || !isSpeechSupported()) return false
  loadVoices()

  const finalRate = rate ?? loadSpeechRate()
  const finalAccent = accent ?? loadSpeechAccent()
  const synth = window.speechSynthesis
  synth.cancel() // 连续点击时只播放最新一次

  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = finalAccent === 'UK' ? 'en-GB' : 'en-US'
  utterance.rate = finalRate
  utterance.pitch = pitch
  const voice = pickEnglishVoice(finalAccent)
  if (voice) utterance.voice = voice

  synth.speak(utterance)
  return true
}
