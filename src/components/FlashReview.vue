<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  words: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['exit'])

const REVIEW_TIME = 5 * 60

const shuffledWords = ref([])
const currentIndex = ref(0)
const isRevealed = ref(false)
const timeLeft = ref(REVIEW_TIME)
const reviewedCount = ref(0)
const timer = ref(null)
const isFinished = ref(false)
const skippedWords = ref([])
const currentRound = ref(1)

const shuffleArray = (array) => {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

const currentWord = computed(() => {
  if (currentRound.value > 1) {
    return skippedWords.value[currentIndex.value] || {}
  }
  return shuffledWords.value[currentIndex.value] || {}
})

const progress = computed(() => {
  if (shuffledWords.value.length === 0) return '0/0'
  if (currentRound.value > 1) {
    return `${currentIndex.value + 1}/${skippedWords.value.length} (第${currentRound.value}轮)`
  }
  return `${currentIndex.value + 1}/${shuffledWords.value.length}`
})

const timeDisplay = computed(() => {
  const minutes = Math.floor(timeLeft.value / 60)
  const seconds = timeLeft.value % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
})

const remainingDisplay = computed(() => {
  if (currentRound.value > 1) {
    const remaining = skippedWords.value.length - currentIndex.value - 1
    return remaining > 0 ? `本轮剩余 ${remaining} 个` : ''
  }
  const remaining = shuffledWords.value.length - reviewedCount.value - skippedWords.value.length
  return remaining > 0 ? `跳过 ${remaining} 个待复习` : ''
})

const startTimer = () => {
  timer.value = setInterval(() => {
    timeLeft.value--
    if (timeLeft.value <= 0) {
      finishReview()
    }
  }, 1000)
}

const stopTimer = () => {
  if (timer.value) {
    clearInterval(timer.value)
    timer.value = null
  }
}

const reveal = () => {
  isRevealed.value = true
}

const next = () => {
  reviewedCount.value++
  if (currentRound.value > 1) {
    const currentWordData = currentWord.value
    const index = skippedWords.value.findIndex(w => w.word === currentWordData.word)
    if (index !== -1) {
      skippedWords.value.splice(index, 1)
    }
    if (skippedWords.value.length > 0) {
      if (currentIndex.value >= skippedWords.value.length) {
        currentIndex.value = 0
      }
      isRevealed.value = false
    } else {
      finishReview()
    }
  } else {
    moveToNext()
  }
}

const moveToNext = () => {
  const isSecondRound = currentRound.value > 1
  const currentList = isSecondRound ? skippedWords.value : shuffledWords.value

  if (currentIndex.value < currentList.length - 1) {
    currentIndex.value++
    isRevealed.value = false
  } else if (skippedWords.value.length > 0) {
    currentRound.value++
    currentIndex.value = 0
    isRevealed.value = false
  } else {
    finishReview()
  }
}

const skip = () => {
  if (currentRound.value === 1) {
    const currentWordData = currentWord.value
    if (currentWordData.word) {
      if (!skippedWords.value.find(w => w.word === currentWordData.word)) {
        skippedWords.value.push(currentWordData)
      }
    }
  }
  moveToNext()
}

const finishReview = () => {
  stopTimer()
  isFinished.value = true
}

const exit = () => {
  stopTimer()
  emit('exit')
}

const finishEarly = () => {
  stopTimer()
  isFinished.value = true
}

onMounted(() => {
  shuffledWords.value = shuffleArray(props.words)
  startTimer()
})

onUnmounted(() => {
  stopTimer()
})
</script>

<template>
  <div class="flash-review">
    <div class="flash-header">
      <h2>⚡ 5分钟快闪复习</h2>
      <div class="flash-progress">
        <span class="progress-text">{{ progress }}</span>
        <span class="remaining-text">{{ remainingDisplay }}</span>
      </div>
    </div>

    <div class="phase-info">
      <div class="phase-title">{{ isFinished ? '复习完成' : (currentRound > 1 ? `第${currentRound}轮复习` : '快速默念') }}</div>
      <div class="phase-desc">{{ isFinished ? '恭喜完成今日复习！' : '遮住中文，看音标想意思' }}</div>
    </div>

    <div class="flash-content" v-if="!isFinished">
      <div class="word-display">
        <h1 class="main-word">{{ currentWord.word }}</h1>
        <p class="phonetic">{{ currentWord.phonetic }}</p>
      </div>

      <div class="reveal-card" @click="reveal" v-if="!isRevealed">
        <span class="reveal-hint">点击显示核心义</span>
      </div>

      <div class="meaning-card" v-else>
        <p class="core-meaning">{{ currentWord.core }}</p>
      </div>
    </div>

    <div class="flash-content finish-section" v-else>
      <div class="finish-icon">🎉</div>
      <div class="finish-title">复习完成！</div>
      <div class="finish-stats">
        <div class="stat-item">
          <span class="stat-value">{{ reviewedCount }}</span>
          <span class="stat-label">复习单词数</span>
        </div>
        <div class="stat-item">
          <span class="stat-value round">{{ currentRound }}</span>
          <span class="stat-label">复习轮数</span>
        </div>
      </div>

      <div class="unlearned-section" v-if="skippedWords.length > 0">
        <div class="unlearned-title">📝 未掌握单词（{{ skippedWords.length }}个）</div>
        <div class="unlearned-list">
          <div class="unlearned-item" v-for="word in skippedWords" :key="word.word">
            <span class="unlearned-word">{{ word.word }}</span>
            <span class="unlearned-phonetic">{{ word.phonetic }}</span>
            <span class="unlearned-core">{{ word.core }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="flash-footer">
      <div class="timer-display">
        <span class="timer-icon">⏱️</span>
        <span class="timer-value">{{ timeDisplay }}</span>
      </div>
      <div class="action-buttons" v-if="!isFinished">
        <button class="btn-next" @click="next">认识 ✓</button>
        <button class="btn-skip" @click="skip">跳过</button>
        <button class="btn-finish" @click="finishEarly">结束复习</button>
        <button class="btn-exit" @click="exit">退出</button>
      </div>
      <div class="action-buttons" v-else>
        <button class="btn-exit big" @click="exit">返回主页</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.flash-review {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 20px;
  display: flex;
  flex-direction: column;
  z-index: 1000;
  overflow-y: auto;
}

.flash-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.flash-header h2 {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
}

.flash-progress {
  display: flex;
  align-items: center;
  gap: 12px;
}

.progress-text {
  font-size: 16px;
  font-weight: 600;
}

.remaining-text {
  font-size: 14px;
  opacity: 0.8;
  background: rgba(255, 255, 255, 0.15);
  padding: 4px 10px;
  border-radius: 12px;
}

.phase-info {
  text-align: center;
  margin-bottom: 24px;
}

.phase-title {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 8px;
}

.phase-desc {
  font-size: 14px;
  opacity: 0.9;
}

.flash-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.word-display {
  text-align: center;
  margin-bottom: 24px;
}

.main-word {
  font-size: 48px;
  font-weight: 700;
  margin: 0 0 12px 0;
}

.phonetic {
  font-size: 20px;
  opacity: 0.9;
  margin: 0;
}

.reveal-card {
  background: rgba(255, 255, 255, 0.15);
  border: 2px dashed rgba(255, 255, 255, 0.5);
  border-radius: 16px;
  padding: 32px 50px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.reveal-card:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: scale(1.02);
}

.reveal-hint {
  font-size: 18px;
  opacity: 0.9;
}

.meaning-card {
  background: white;
  color: #2c3e50;
  border-radius: 16px;
  padding: 20px 28px;
  max-width: 400px;
  text-align: center;
}

.core-meaning {
  font-size: 18px;
  margin: 0;
  line-height: 1.6;
}

.finish-section {
  text-align: center;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.finish-icon {
  font-size: 80px;
  margin-bottom: 24px;
}

.finish-title {
  font-size: 32px;
  font-weight: 700;
  margin-bottom: 32px;
}

.finish-stats {
  display: flex;
  gap: 40px;
  justify-content: center;
  margin-bottom: 32px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-value {
  font-size: 48px;
  font-weight: 700;
}

.stat-value.skip {
  color: #ffd93d;
}

.stat-value.round {
  color: #ffd93d;
}

.stat-label {
  font-size: 14px;
  opacity: 0.8;
  margin-top: 4px;
}

.unlearned-section {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 20px;
  width: 100%;
  max-width: 500px;
  margin-top: 20px;
}

.unlearned-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
  text-align: center;
}

.unlearned-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.unlearned-item {
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 10px 15px;
}

.unlearned-word {
  font-size: 18px;
  font-weight: 600;
  min-width: 100px;
}

.unlearned-phonetic {
  font-size: 14px;
  opacity: 0.8;
  min-width: 120px;
}

.unlearned-core {
  font-size: 14px;
  flex: 1;
  text-align: left;
}

.flash-footer {
  margin-top: auto;
  padding-bottom: 20px;
}

.timer-display {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 16px;
}

.timer-icon {
  font-size: 18px;
}

.timer-value {
  font-size: 20px;
  font-weight: 600;
}

.action-buttons {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}

.action-buttons button {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-next {
  background: #4CAF50;
  color: white;
  font-weight: 600;
}

.btn-next:hover {
  background: #45a049;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.btn-skip {
  background: rgba(255, 255, 255, 0.2);
  color: white;
}

.btn-skip:hover {
  background: rgba(255, 255, 255, 0.3);
}

.btn-finish {
  background: #ff9800;
  color: white;
  font-weight: 600;
}

.btn-finish:hover {
  background: #f57c00;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.btn-exit {
  background: rgba(255, 255, 255, 0.2);
  color: white;
}

.btn-exit:hover {
  background: rgba(255, 255, 255, 0.3);
}

.btn-exit.big {
  padding: 16px 48px;
  font-size: 18px;
}
</style>