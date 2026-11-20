<script setup>
import { ref, onMounted } from 'vue'
import {
  loadAutoSpeak, saveAutoSpeak,
  loadFlashAutoSpeak, saveFlashAutoSpeak,
  loadFlashBg, saveFlashBg,
  loadSpeechRate, saveSpeechRate,
  loadSpeechAccent, saveSpeechAccent
} from '../utils/storage'

const props = defineProps({
  speechSupported: { type: Boolean, default: true }
})

const emit = defineEmits(['update:flashBg'])

// 读一次就好，用 watch 写回
const autoSpeak = ref(loadAutoSpeak())
const flashAutoSpeak = ref(loadFlashAutoSpeak())
const flashBg = ref(loadFlashBg())
const speechRate = ref(loadSpeechRate())
const speechAccent = ref(loadSpeechAccent())

// 缩略图状态
const bgPreview = ref('')
const uploading = ref(false)
const bgMessage = ref('')
const bgFileInput = ref(null)

const saveImage = async (file) => {
  uploading.value = true
  bgMessage.value = ''
  try {
    // 读成 base64
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = () => reject(new Error('读取图片失败'))
      reader.readAsDataURL(file)
    })

    // 压缩：canvas 限宽 1280，JPEG 0.8
    const compressed = await new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const maxWidth = 1280
        const scale = Math.min(1, maxWidth / img.width)
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', 0.8))
      }
      img.onerror = () => reject(new Error('图片解码失败'))
      img.src = dataUrl
    })

    const saved = saveFlashBg(compressed)
    if (!saved) {
      bgMessage.value = '图片太大，保存失败。试试更小的图'
      uploading.value = false
      return
    }
    flashBg.value = compressed
    bgPreview.value = compressed
    emit('update:flashBg', compressed)
    // 如果原始文件较大，提示已压缩
    if (file.size > 500 * 1024) {
      bgMessage.value = '已自动压缩图片并保存'
    } else {
      bgMessage.value = '已保存'
    }
  } catch (err) {
    bgMessage.value = err.message || '处理图片失败'
  } finally {
    uploading.value = false
    if (bgFileInput.value) bgFileInput.value.value = ''
  }
}

const handleBgSelect = (event) => {
  const file = event.target.files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) {
    bgMessage.value = '请选择图片文件'
    event.target.value = ''
    return
  }
  saveImage(file)
}

const clearBg = () => {
  saveFlashBg('')
  flashBg.value = ''
  bgPreview.value = ''
  emit('update:flashBg', '')
  bgMessage.value = '已清除，恢复默认背景'
}

// 保存语速（范围由存储层夹紧）
const handleRateChange = () => {
  saveSpeechRate(speechRate.value)
  speechRate.value = loadSpeechRate()
}

// 保存口音
const setAccent = (accent) => {
  speechAccent.value = accent
  saveSpeechAccent(accent)
}

onMounted(() => {
  bgPreview.value = flashBg.value
})
</script>

<template>
  <div class="settings-page">
    <div class="container">
      <section class="settings-section">
        <h2 class="section-title">📖 背单词模块</h2>
        <div class="setting-row">
          <div class="setting-text">
            <span class="setting-label">出现单词时自动读音</span>
            <span class="setting-desc">进入页面、切换单词、答题答对跳下一个时，每个单词一出现就自动播放发音</span>
          </div>
          <label class="switch">
            <input type="checkbox" :checked="autoSpeak" @change="(e) => { autoSpeak = e.target.checked; saveAutoSpeak(autoSpeak) }" />
            <span class="slider"></span>
          </label>
        </div>

        <div class="setting-row speech-row">
          <div class="setting-text">
            <span class="setting-label">发音语速</span>
            <span class="setting-desc">0.5 最慢，1.5 最快，默认 0.9</span>
          </div>
          <div class="rate-control">
            <input
              class="rate-slider"
              type="range"
              min="0.5"
              max="1.5"
              step="0.05"
              v-model.number="speechRate"
              @change="handleRateChange"
            />
            <span class="rate-value">{{ speechRate.toFixed(2) }}</span>
          </div>
        </div>

        <div class="setting-row">
          <div class="setting-text">
            <span class="setting-label">发音口音</span>
            <span class="setting-desc">优先使用系统对应的音色，没有则自动回退英文音色</span>
          </div>
          <div class="accent-toggle">
            <button :class="{ active: speechAccent === 'US' }" @click="setAccent('US')">美式</button>
            <button :class="{ active: speechAccent === 'UK' }" @click="setAccent('UK')">英式</button>
          </div>
        </div>
      </section>

      <section class="settings-section">
        <h2 class="section-title">⚡ 快闪记忆模块</h2>
        <div class="setting-row">
          <div class="setting-text">
            <span class="setting-label">出现单词时自动读音</span>
            <span class="setting-desc">首次进入快闪、点「认识」、点「跳过」，每个单词一出现就自动播放发音</span>
          </div>
          <label class="switch">
            <input type="checkbox" :checked="flashAutoSpeak" @change="(e) => { flashAutoSpeak = e.target.checked; saveFlashAutoSpeak(flashAutoSpeak) }" />
            <span class="slider"></span>
          </label>
        </div>

        <div class="bg-block">
          <div class="bg-header">
            <div class="setting-text">
              <span class="setting-label">自定义背景图</span>
              <span class="setting-desc">仅在快闪记忆模块生效</span>
            </div>
          </div>
          <div class="bg-actions">
            <button class="primary-btn" @click="bgFileInput?.click()" :disabled="uploading">
              {{ uploading ? '处理中...' : '选择图片' }}
            </button>
            <button v-if="bgPreview" class="ghost-btn" @click="clearBg">清除</button>
            <input type="file" ref="bgFileInput" accept="image/*" style="display:none" @change="handleBgSelect" />
          </div>
          <div v-if="bgPreview" class="bg-preview">
            <img :src="bgPreview" alt="背景预览" />
          </div>
          <div v-if="bgMessage" class="bg-message">{{ bgMessage }}</div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.settings-page {
  min-height: calc(100vh - 56px);
  background: #f5f5f5;
  padding: 32px 20px;
}

.container {
  max-width: 560px;
  margin: 0 auto;
}

.settings-section {
  background: #fff;
  border-radius: 12px;
  padding: 20px 24px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.section-title {
  font-size: 16px;
  color: #2c3e50;
  font-weight: 600;
  margin: 0 0 16px;
}

.setting-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 8px 0;
}

.setting-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.setting-label {
  font-size: 15px;
  color: #333;
  font-weight: 500;
}

.setting-desc {
  font-size: 12px;
  color: #999;
}

/* 语速滑块 */
.speech-row {
  flex-direction: column;
  align-items: stretch;
}

.rate-control {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  margin-top: 8px;
}

.rate-slider {
  flex: 1;
  accent-color: #4CAF50;
  cursor: pointer;
}

.rate-value {
  min-width: 42px;
  text-align: right;
  font-size: 13px;
  color: #2c3e50;
  font-variant-numeric: tabular-nums;
}

/* 口音切换 */
.accent-toggle {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.accent-toggle button {
  padding: 8px 16px;
  border: 2px solid #ddd;
  border-radius: 8px;
  background: #fff;
  color: #666;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.accent-toggle button:hover {
  border-color: #2c3e50;
}

.accent-toggle button.active {
  background: #2c3e50;
  border-color: #2c3e50;
  color: #fff;
}

/* iOS 风格开关 */
.switch {
  position: relative;
  display: inline-block;
  width: 48px;
  height: 28px;
  flex-shrink: 0;
  margin-top: 2px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.switch .slider {
  position: absolute;
  cursor: pointer;
  inset: 0;
  background: #ddd;
  transition: 0.2s;
  border-radius: 28px;
}

.switch .slider::before {
  position: absolute;
  content: '';
  height: 22px;
  width: 22px;
  left: 3px;
  bottom: 3px;
  background: #fff;
  transition: 0.2s;
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
}

.switch input:checked + .slider {
  background: #4CAF50;
}

.switch input:checked + .slider::before {
  transform: translateX(20px);
}

/* 背景图区块 */
.bg-block {
  border-top: 1px solid #f0f0f0;
  padding-top: 16px;
  margin-top: 16px;
}

.bg-header {
  margin-bottom: 12px;
}

.bg-actions {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}

.primary-btn {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  background: #2c3e50;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}

.primary-btn:hover:not(:disabled) {
  background: #34495e;
}

.primary-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.ghost-btn {
  padding: 10px 20px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  background: #fff;
  color: #666;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.ghost-btn:hover {
  border-color: #c0392b;
  color: #c0392b;
}

.bg-preview {
  margin-top: 8px;
  border-radius: 8px;
  overflow: hidden;
  max-width: 100%;
  max-height: 200px;
  background: #eee;
}

.bg-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.bg-message {
  margin-top: 8px;
  font-size: 12px;
  color: #4CAF50;
}

.bg-message:empty {
  display: none;
}
</style>
