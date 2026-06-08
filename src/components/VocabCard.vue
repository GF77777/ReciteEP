<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  label: {
    type: String,
    required: true
  },
  content: {
    type: String,
    default: ''
  },
  example: {
    type: Object,
    default: null
  },
  forceHide: {
    type: Boolean,
    default: false
  },
  hideEnglish: {
    type: Boolean,
    default: false
  },
  hideChinese: {
    type: Boolean,
    default: false
  },
  defaultVisible: {
    type: Boolean,
    default: true
  },
  modeKey: {
    type: Number,
    default: 0
  },
  clozeWord: {
    type: String,
    default: ''
  },
  isClozeMode: {
    type: Boolean,
    default: false
  },
  showInput: {
    type: Boolean,
    default: false
  },
  isQuizMode: {
    type: Boolean,
    default: false
  },
  autoJumpDelay: {
    type: Number,
    default: 1
  }
})

const isEnVisible = ref(true)
const isCnVisible = ref(true)
const isContentVisible = ref(props.defaultVisible)
const isClozeRevealed = ref(false)
const userInput = ref('')
const selectedAnswer = ref('')
const localDelay = ref(props.autoJumpDelay)
const isCorrect = ref(false)
const showResult = ref(false)

const emit = defineEmits(['answer'])

const clozeSentence = computed(() => {
  if (!props.example || !props.example.en || !props.isClozeMode && !props.isQuizMode) {
    return props.example?.en || ''
  }
  const wordToCloze = props.example.cloze || props.clozeWord
  if (!wordToCloze) {
    return props.example.en
  }
  const regex = new RegExp(`\\b${wordToCloze}\\b`, 'gi')
  return props.example.en.replace(regex, '________')
})

const clozeWordDisplay = computed(() => {
  return props.example?.cloze || props.clozeWord || ''
})

const quizOptions = ref([])

const shuffleOptions = () => {
  if (!props.isQuizMode || !props.example) {
    quizOptions.value = []
    return
  }
  const correctAnswer = props.example.cloze || props.clozeWord
  const distractors = props.example.distractors || []
  const allOptions = [correctAnswer, ...distractors]
  quizOptions.value = allOptions.sort(() => Math.random() - 0.5)
}

const selectAnswer = (answer) => {
  if (showResult.value) return
  selectedAnswer.value = answer
  isCorrect.value = answer === (props.example.cloze || props.clozeWord)
  showResult.value = true
  if (localDelay.value > 0) {
    setTimeout(() => {
      emit('answer', isCorrect.value)
    }, localDelay.value * 1000)
  }
}

watch(() => props.modeKey, () => {
  isEnVisible.value = !props.hideEnglish
  isCnVisible.value = !props.hideChinese
  isContentVisible.value = props.defaultVisible
  isClozeRevealed.value = false
  userInput.value = ''
  selectedAnswer.value = ''
  isCorrect.value = false
  showResult.value = false
})

watch(() => props.defaultVisible, (newVal) => {
  isContentVisible.value = newVal
})

watch(() => props.hideEnglish, (newVal) => {
  isEnVisible.value = !newVal
})

watch(() => props.autoJumpDelay, (newVal) => {
  if (!showResult.value) {
    localDelay.value = newVal
  }
})

watch(() => props.hideChinese, (newVal) => {
  isCnVisible.value = !newVal
})

watch(() => props.isClozeMode, (newVal) => {
  if (newVal) {
    isClozeRevealed.value = false
    userInput.value = ''
  }
})

watch(() => props.isQuizMode, (newVal) => {
  if (newVal) {
    shuffleOptions()
  }
})

watch(() => props.example, () => {
  selectedAnswer.value = ''
  isCorrect.value = false
  showResult.value = false
  isClozeRevealed.value = false
  userInput.value = ''
  shuffleOptions()
}, { deep: true })

const toggleEn = () => {
  isEnVisible.value = !isEnVisible.value
}

const toggleCn = () => {
  isCnVisible.value = !isCnVisible.value
}

const toggleContent = () => {
  isContentVisible.value = !isContentVisible.value
}

const toggleCloze = () => {
  isClozeRevealed.value = !isClozeRevealed.value
}

const resetQuiz = () => {
  selectedAnswer.value = ''
  isCorrect.value = false
  showResult.value = false
  shuffleOptions()
}
</script>

<template>
  <div class="vocab-card clickable" @click="example ? null : toggleContent()">
    <div class="card-label">{{ label }}</div>
    <div class="card-content" v-if="example">
      <div v-if="isQuizMode" class="quiz-container">
        <p class="example-en cloze">{{ clozeSentence }}</p>
        <div class="example-item" @click="toggleCn">
          <span class="hint" v-if="!isCnVisible">点击显示中文</span>
          <p class="example-cn" v-else>{{ example.cn }}</p>
        </div>
        <div class="quiz-options">
          <button
            v-for="option in quizOptions"
            :key="option"
            :class="{ 
              'quiz-option': true,
              'selected': selectedAnswer === option,
              'correct': showResult && option === (example.cloze || clozeWord),
              'wrong': showResult && selectedAnswer === option && !isCorrect
            }"
            @click="selectAnswer(option)"
            :disabled="showResult"
          >
            {{ option }}
          </button>
        </div>
        <div class="quiz-result" v-if="showResult">
          <span class="result-icon" :class="{ 'correct': isCorrect, 'wrong': !isCorrect }">
            {{ isCorrect ? '✅' : '❌' }}
          </span>
          <span class="result-text">{{ isCorrect ? '正确答案！' : `正确答案：${example.cloze || clozeWord}` }}</span>
        </div>
        <div class="quiz-actions" v-if="showResult">
          <button class="retry-btn" @click.stop="resetQuiz">🔁 再练一次</button>
        </div>
      </div>
      <div v-else-if="isClozeMode" class="cloze-container">
        <div class="cloze-item" @click="toggleCloze">
          <span class="hint" v-if="!isClozeRevealed">点击显示答案</span>
          <p class="example-en" v-else>{{ example.en }}</p>
          <p class="example-en cloze" v-if="!isClozeRevealed">{{ clozeSentence }}</p>
        </div>
        <div class="input-container">
          <input 
            v-model="userInput" 
            type="text" 
            class="user-input" 
            placeholder="输入答案..."
            autocomplete="off"
          />
        </div>
        <div class="example-item" @click="toggleCn">
          <span class="hint" v-if="!isCnVisible">点击显示中文</span>
          <p class="example-cn" v-else>{{ example.cn }}</p>
        </div>
      </div>
      <div v-else>
        <div class="example-item" @click="toggleEn">
          <span class="hint" v-if="!isEnVisible">点击显示英文</span>
          <p class="example-en" v-else>{{ example.en }}</p>
        </div>
        <div class="example-item" @click="toggleCn">
          <span class="hint" v-if="!isCnVisible">点击显示中文</span>
          <p class="example-cn" v-else>{{ example.cn }}</p>
        </div>
        <div class="input-container" v-if="showInput">
          <input 
            v-model="userInput" 
            type="text" 
            class="user-input" 
            placeholder="输入答案..."
            autocomplete="off"
          />
        </div>
      </div>
    </div>
    <div class="card-content" v-else>
      <span class="hint" v-if="!isContentVisible">点击显示</span>
      <template v-else>{{ content }}</template>
    </div>
  </div>
</template>

<style scoped>
.vocab-card {
  background: #fff;
  border-radius: 12px;
  padding: 16px 20px;
  margin-bottom: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.vocab-card.clickable {
  cursor: pointer;
  transition: all 0.3s ease;
}

.vocab-card.clickable:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  transform: translateY(-2px);
}

.card-label {
  font-size: 12px;
  color: #999;
  margin-bottom: 8px;
  font-weight: 500;
}

.card-content {
  color: #333;
  line-height: 1.6;
}

.example-item {
  cursor: pointer;
  padding: 4px 0;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.example-item:hover {
  background: #f8f8f8;
}

.example-en {
  color: #333;
  margin-bottom: 8px;
}

.example-cn {
  color: #666;
  font-size: 14px;
}

.hint {
  color: #bbb;
  font-size: 14px;
  font-style: italic;
}

.cloze-container {
  padding: 8px 0;
}

.cloze-item {
  cursor: pointer;
  padding: 4px 0;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.cloze-item:hover {
  background: #f8f8f8;
}

.example-en.cloze {
  color: #333;
  margin-bottom: 12px;
  font-weight: 500;
}

.cloze-answer {
  color: #2c3e50;
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 8px;
}

.input-container {
  margin: 12px 0;
}

.user-input {
  width: 100%;
  padding: 10px 14px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 16px;
  font-family: inherit;
  background: #fafafa;
  transition: all 0.2s ease;
  box-sizing: border-box;
}

.user-input:focus {
  outline: none;
  border-color: #2c3e50;
  background: #fff;
}

.user-input::placeholder {
  color: #ccc;
}

.quiz-container {
  padding: 8px 0;
}

.quiz-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 12px 0;
}

.quiz-option {
  padding: 12px 16px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  background: #fff;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
}

.quiz-option:hover:not(:disabled) {
  border-color: #2c3e50;
  background: #f8f9fa;
}

.quiz-option.selected {
  border-color: #2c3e50;
  background: #e8f4f8;
}

.quiz-option.correct {
  border-color: #27ae60;
  background: #d4edda;
  color: #155724;
}

.quiz-option.wrong {
  border-color: #e74c3c;
  background: #f8d7da;
  color: #721c24;
}

.quiz-option:disabled {
  cursor: default;
}

.quiz-result {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-radius: 8px;
  margin-top: 12px;
  background: #f8f9fa;
}

.result-icon {
  font-size: 20px;
}

.result-text {
  font-weight: 500;
  color: #333;
}

.quiz-actions {
  margin-top: 12px;
}

.retry-btn {
  padding: 10px 20px;
  border: 2px solid #2c3e50;
  border-radius: 8px;
  background: #fff;
  color: #2c3e50;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.retry-btn:hover {
  background: #2c3e50;
  color: #fff;
}

.delay-selector {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #eee;
}

.delay-label {
  font-size: 14px;
  color: #666;
}

.delay-select {
  padding: 6px 12px;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  background: #fff;
  font-size: 14px;
  cursor: pointer;
  outline: none;
}

.delay-select:focus {
  border-color: #2c3e50;
}
</style>
