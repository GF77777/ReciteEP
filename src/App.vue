<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import VocabCard from './components/VocabCard.vue'
import FlashReview from './components/FlashReview.vue'
import SettingsPage from './components/SettingsPage.vue'
import { speak, isSpeechSupported } from './utils/speech'
import { normalizeDeck } from './utils/normalize'
import { parseFile } from './utils/parser'
import {
  loadDecks, saveDecks, loadLastDeckId, saveLastDeckId,
  loadAutoSpeak, saveAutoSpeak,
  loadFlashAutoSpeak, saveFlashAutoSpeak,
  loadFlashBg,
  loadBatchSizes, saveBatchSizes
} from './utils/storage'
import vocabulary from './data/vocabulary.json'

const groups = ref([])
const currentGroupId = ref('')
const currentIndex = ref(0)
const deckWords = ref([])              // 整个词库的全部单词
const currentMode = ref(0)
const currentBatchIndex = ref(0)       // 当前组，0 起
const batchSizeMap = ref(loadBatchSizes())

// 组号栏拖拽灵敏度：数值越大，同样的鼠标位移滚动越多（建议 1.0 - 2.5）
const DRAG_SENSITIVITY = 1.5

const DEFAULT_BATCH_SIZE = 10
const MAX_BATCH_SIZE = 200

// 当前词库的每组单词数
const batchSize = computed(() => {
  const size = Number(batchSizeMap.value[currentGroupId.value])
  if (!Number.isFinite(size) || size <= 0) return DEFAULT_BATCH_SIZE
  return Math.min(MAX_BATCH_SIZE, Math.floor(size))
})

const batchCount = computed(() =>
  Math.max(1, Math.ceil(deckWords.value.length / batchSize.value))
)

// 当前组单词：words 的语义从「整库」变为「当前组」
const words = computed(() => {
  const start = currentBatchIndex.value * batchSize.value
  return deckWords.value.slice(start, start + batchSize.value)
})

// 当前词库是否有可用于填空/选择的例句
const hasExamples = computed(() => deckWords.value.some(word => word.example?.en))

const modeTips = {
  0: '读准音标，尝试联系',
  4: '遮蔽回忆，手动输入',
  3: '语境填空，选择答案'
}

const currentWord = computed(() => words.value[currentIndex.value] || {})
const fileInput = ref(null)
const autoJumpDelay = ref(1)
const isFlashReview = ref(false)
const isSidebarOpen = ref(false)
const speechSupported = isSpeechSupported()
const view = ref('study')               // 'study' | 'settings'
const autoSpeak = ref(loadAutoSpeak())
const flashAutoSpeak = ref(loadFlashAutoSpeak())
const flashBg = ref(loadFlashBg())
const statusMessage = ref('')
let statusTimer = null

watch(autoSpeak, (val) => saveAutoSpeak(val))
watch(flashAutoSpeak, (val) => saveFlashAutoSpeak(val))

// 组数或组大小变化时，防止下标越界
watch([batchSize, batchCount], () => {
  if (currentBatchIndex.value >= batchCount.value) {
    currentBatchIndex.value = batchCount.value - 1
  }
  if (currentIndex.value >= words.value.length) {
    currentIndex.value = Math.max(0, words.value.length - 1)
  }
})

// 只要当前单词出现就自动发音（进入页面、切组、上一个/下一个、答题跳转）
watch(currentWord, (word) => {
  if (autoSpeak.value && speechSupported && word.word) speak(word.word)
}, { immediate: true })

const showStatus = (message) => {
  statusMessage.value = message
  clearTimeout(statusTimer)
  statusTimer = setTimeout(() => {
    statusMessage.value = ''
  }, 3000)
}

const pronounceCurrent = () => speak(currentWord.value.word)

const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value
}

const loadGroups = () => {
  const sampleDeck = normalizeDeck(vocabulary, '示例词库').deck
  const savedGroups = loadDecks().map(deck => ({
    id: deck.id,
    name: deck.name || '导入词库',
    data: { name: deck.name || '导入词库', words: deck.words }
  }))
  groups.value = [{ id: 'sample', name: sampleDeck.name, data: sampleDeck }, ...savedGroups]

  const lastId = loadLastDeckId()
  const targetId = groups.value.some(group => group.id === lastId) ? lastId : 'sample'
  selectGroup(targetId)
}

const selectGroup = (groupId) => {
  const group = groups.value.find(g => g.id === groupId)
  if (!group) return

  currentGroupId.value = groupId
  deckWords.value = group.data.words
  currentBatchIndex.value = 0
  currentIndex.value = 0

  // 没有例句的词库不能停留在填空类模式
  if (!hasExamples.value && (currentMode.value === 3 || currentMode.value === 4)) {
    currentMode.value = 0
  }
  saveLastDeckId(groupId)
}

// 切换到某一组
const selectBatch = (index) => {
  if (index < 0 || index >= batchCount.value) return
  currentBatchIndex.value = index
  currentIndex.value = 0
}

// 修改当前词库的每组单词数
const handleBatchSizeChange = (event) => {
  const raw = Number(event.target.value)
  const next = Number.isFinite(raw) && raw > 0
    ? Math.min(MAX_BATCH_SIZE, Math.floor(raw))
    : DEFAULT_BATCH_SIZE
  batchSizeMap.value = { ...batchSizeMap.value, [currentGroupId.value]: next }
  saveBatchSizes(batchSizeMap.value)
  currentBatchIndex.value = 0
  currentIndex.value = 0
  event.target.value = next
  showStatus(`每组 ${next} 个单词`)
}

// 鼠标拖拽滑动组号栏
let isDragging = false
let startX = 0
let scrollLeftStart = 0

const handleDragStart = (event) => {
  isDragging = true
  startX = event.pageX - event.currentTarget.offsetLeft
  scrollLeftStart = event.currentTarget.scrollLeft
  event.currentTarget.style.cursor = 'grabbing'
}

const handleDragMove = (event) => {
  if (!isDragging) return
  event.preventDefault()
  const x = event.pageX - event.currentTarget.offsetLeft
  const walk = (x - startX) * DRAG_SENSITIVITY
  event.currentTarget.scrollLeft = scrollLeftStart - walk
}

const handleDragEnd = (event) => {
  isDragging = false
  event.currentTarget.style.cursor = 'grab'
}

// 只持久化导入的词库，内置示例始终由代码提供
const persistGroups = () => {
  const decks = groups.value
    .filter(group => group.id !== 'sample')
    .map(group => ({ id: group.id, name: group.name, words: group.data.words }))
  return saveDecks(decks)
}

const deleteCurrentGroup = () => {
  const group = groups.value.find(g => g.id === currentGroupId.value)
  if (!group || group.id === 'sample') return
  if (!window.confirm(`确定删除词库「${group.name}」吗？`)) return

  groups.value = groups.value.filter(g => g.id !== group.id)

  // 同步清理该词库的组大小记录
  const nextBatchSizes = { ...batchSizeMap.value }
  delete nextBatchSizes[group.id]
  batchSizeMap.value = nextBatchSizes
  saveBatchSizes(nextBatchSizes)

  if (persistGroups()) {
    showStatus(`已删除词库「${group.name}」`)
  } else {
    showStatus('已删除，但浏览器存储更新失败')
  }
  selectGroup('sample')
}

const goNext = () => {
  if (currentIndex.value < words.value.length - 1) {
    currentIndex.value++
  }
}

const goPrev = () => {
  if (currentIndex.value > 0) {
    currentIndex.value--
  }
}

const setMode = (mode) => {
  if ((mode === 3 || mode === 4) && !hasExamples.value) return
  currentMode.value = mode
}

const startFlashReview = () => {
  isFlashReview.value = true
}

const exitFlashReview = () => {
  isFlashReview.value = false
}

// 只打乱当前组，写回整库对应位置
const shuffleWords = () => {
  const start = currentBatchIndex.value * batchSize.value
  const group = [...words.value]
  for (let i = group.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [group[i], group[j]] = [group[j], group[i]]
  }
  // 用新数组替换，避免改动词库原始数据（打乱仅在本次会话生效）
  const nextDeckWords = [...deckWords.value]
  nextDeckWords.splice(start, group.length, ...group)
  deckWords.value = nextDeckWords
  currentIndex.value = 0
  showStatus('已打乱当前组')
}

const handleAnswer = (isCorrect) => {
  if (currentIndex.value < words.value.length - 1) {
    goNext()
  }
}

const triggerFileInput = () => {
  fileInput.value?.click()
}

const handleFileSelect = async (event) => {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return

  let data, fallbackName
  try {
    const result = await parseFile(file)
    data = result.data
    fallbackName = result.name
  } catch (err) {
    alert(err.message)
    return
  }

  const { deck, skipped, duplicates } = normalizeDeck(data, fallbackName)
  if (deck.words.length === 0) {
    alert('导入失败：没有找到有效单词')
    return
  }

  // 同名词库直接覆盖，避免重复堆叠
  const existing = groups.value.find(group => group.id !== 'sample' && group.name === deck.name)
  let targetId
  if (existing) {
    existing.data = deck
    targetId = existing.id
  } else {
    const newGroup = { id: 'imported-' + Date.now(), name: deck.name, data: deck }
    groups.value.push(newGroup)
    targetId = newGroup.id
  }

  const savedOk = persistGroups()
  selectGroup(targetId)

  const details = []
  if (skipped) details.push(`跳过 ${skipped} 个无效`)
  if (duplicates) details.push(`去重 ${duplicates} 个`)
  const summary = details.length ? `（${details.join('，')}）` : ''
  const storageTip = savedOk ? '' : '；保存到浏览器失败，刷新后会丢失'
  showStatus(`${existing ? '已更新' : '已导入'} ${deck.words.length} 个单词${summary}${storageTip}`)
}

onMounted(() => {
  loadGroups()
})
</script>

<template>
  <!-- 顶部导航栏 -->
  <nav class="top-nav">
    <div class="nav-title">ReciteEP</div>
    <div class="nav-tabs">
      <button :class="{ active: view === 'study' }" @click="view = 'study'">📖 背单词</button>
      <button :class="{ active: view === 'settings' }" @click="view = 'settings'">⚙ 设置</button>
    </div>
  </nav>

  <!-- 背单词页 -->
  <div class="main-layout" v-if="view === 'study'">
    <button class="menu-toggle" @click="toggleSidebar">☰</button>
    <div class="sidebar-overlay" :class="{ show: isSidebarOpen }" @click="toggleSidebar"></div>
    <div class="sidebar" :class="{ open: isSidebarOpen }">
      <h3>操作说明</h3>
      <div class="instruction-item active">
        <span class="mode-number">{{ currentMode }}</span>
        <span>{{ modeTips[currentMode] }}</span>
      </div>
      
      <h3>操作</h3>
      <div class="action-item">
        <button class="shuffle-btn" @click="shuffleWords" v-if="words.length > 1">
          🔀 打乱顺序
        </button>
      </div>
      <div class="action-item">
        <button class="flash-btn" @click="startFlashReview" v-if="words.length > 0">
          ⚡ 5分钟快闪复习
        </button>
      </div>
      <div class="action-item" v-if="currentGroupId !== 'sample'">
        <button class="delete-btn" @click="deleteCurrentGroup">🗑 删除当前词库</button>
      </div>
    </div>
    <div class="container">
      <div class="group-selector">
        <button
          v-for="group in groups"
          :key="group.id"
          :class="{ active: currentGroupId === group.id }"
          @click="selectGroup(group.id)"
        >
          {{ group.name }}
        </button>
        <button class="import-btn" @click="triggerFileInput">导入文件</button>
        <input type="file" ref="fileInput" accept=".json,.csv,.xlsx,.xls" style="display:none" @change="handleFileSelect" />
      </div>

      <!-- 组号栏：每组数量 + 切换组 -->
      <div class="batch-bar" v-if="words.length > 0">
        <div class="batch-size">
          <span>每组</span>
          <input
            class="batch-size-input"
            type="number"
            min="1"
            max="200"
            :value="batchSize"
            @change="handleBatchSizeChange"
          />
          <span>个</span>
        </div>
        <div
          class="batch-chips"
          @mousedown="handleDragStart"
          @mousemove="handleDragMove"
          @mouseup="handleDragEnd"
          @mouseleave="handleDragEnd"
        >
          <button
            v-for="n in batchCount"
            :key="n"
            :class="{ active: currentBatchIndex === n - 1 }"
            @click="selectBatch(n - 1)"
          >
            第{{ n }}组
          </button>
        </div>
      </div>

      <p class="import-status" v-if="statusMessage">{{ statusMessage }}</p>
      <div v-if="words.length === 0" class="empty-state">
        <div class="empty-icon">📚</div>
        <h2>暂无单词数据</h2>
        <p>请点击上方「导入文件」按钮导入单词数据</p>
        <p class="format-hint">支持 JSON / Excel (xlsx) / CSV，表格第一行是列名</p>
      </div>
      
      <template v-else>
        <div class="header">
          <div class="word-line">
            <h1 class="word-title">{{ currentWord.word }}</h1>
            <button class="speak-btn" v-if="speechSupported" @click="pronounceCurrent" title="播放发音" aria-label="播放发音">🔊</button>
          </div>
          <div class="counter">第{{ currentBatchIndex + 1 }}组 · {{ currentIndex + 1 }} / {{ words.length }}</div>
        </div>

        <VocabCard v-if="currentWord.phonetic" label="音标" :content="currentWord.phonetic" :default-visible="true" :mode-key="currentMode" />
        <VocabCard v-if="currentWord.core" label="核心义" :content="currentWord.core" :default-visible="currentMode === 0" :mode-key="currentMode" />
        <VocabCard v-if="currentWord.usage" label="用法 / 考点" :content="currentWord.usage" :default-visible="currentMode === 0" :mode-key="currentMode" />
        <VocabCard v-if="currentWord.clue" label="线索" :content="currentWord.clue" :default-visible="currentMode === 0" :mode-key="currentMode" />
        <VocabCard v-if="currentWord.example" label="例句" :example="currentWord.example" :default-visible="true" :mode-key="currentMode" :cloze-word="currentWord.word" :is-cloze-mode="currentMode === 4" :is-quiz-mode="currentMode === 3" :auto-jump-delay="autoJumpDelay" @answer="handleAnswer" />

    <div class="mode-buttons">
      <button
        v-for="n in [0, 4, 3]"
        :key="n"
        :class="{ active: currentMode === n }"
        :title="n !== 0 && !hasExamples ? '当前词库没有例句' : modeTips[n]"
        :aria-label="n !== 0 && !hasExamples ? '当前词库没有例句' : modeTips[n]"
        :disabled="n !== 0 && !hasExamples"
        @click="setMode(n)"
      >
        {{ n }}
      </button>
    </div>
    <p class="mode-tip">{{ modeTips[currentMode] }}</p>
    
    <div class="auto-jump-setting" v-if="currentMode === 3">
      <span class="setting-label">自动跳转：</span>
      <select v-model="autoJumpDelay" class="delay-select">
        <option :value="0">关闭</option>
        <option :value="1">1秒</option>
        <option :value="2">2秒</option>
        <option :value="3">3秒</option>
        <option :value="5">5秒</option>
      </select>
    </div>

    <div class="nav-buttons">
      <button @click="goPrev" :disabled="currentIndex === 0">上一个</button>
      <button @click="goNext" :disabled="currentIndex === words.length - 1">下一个</button>
    </div>
      </template>
    </div>
  </div>

  <!-- 设置页 -->
  <SettingsPage
    v-else
    :speech-supported="speechSupported"
    @update:flash-bg="flashBg = $event"
  />

  <!-- 快闪复习弹层（在两页之外） -->
  <FlashReview
    v-if="isFlashReview"
    :words="words"
    :flash-auto-speak="flashAutoSpeak"
    :flash-bg="flashBg"
    @exit="exitFlashReview"
  />
</template>

<style scoped>
.main-layout {
  display: flex;
  min-height: 100vh;
  position: relative;
}

.sidebar {
  width: 260px;
  padding: 40px 20px;
  background: #f8f9fa;
  border-right: 1px solid #e9ecef;
  flex-shrink: 0;
}

.menu-toggle {
  display: none;
  position: fixed;
  top: 12px;
  left: 12px;
  z-index: 100;
  width: 44px;
  height: 44px;
  padding: 0;
  border: none;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  font-size: 22px;
  cursor: pointer;
  touch-action: manipulation;
}

.sidebar-overlay {
  display: none;
}

@media (max-width: 768px) {
  .menu-toggle {
    display: block;
  }

  .sidebar {
    position: fixed;
    left: -280px;
    top: 0;
    bottom: 0;
    width: 260px;
    z-index: 101;
    padding: 70px 20px 40px;
    transition: left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 2px 0 20px rgba(0, 0, 0, 0.15);
    overflow-y: auto;
  }

  .sidebar.open {
    left: 0;
  }

  .sidebar-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 100;
    display: none;
  }

  .sidebar-overlay.show {
    display: block;
  }

  .container {
    padding: 16px;
    padding-top: 60px;
    max-width: 100%;
  }

  .word-title {
    font-size: 26px;
  }

  .speak-btn {
    width: 32px;
    height: 32px;
    font-size: 18px;
  }

  .counter {
    font-size: 13px;
  }

  .group-selector {
    flex-wrap: wrap;
    gap: 6px;
  }

  .group-selector button {
    padding: 8px 14px;
    font-size: 13px;
    min-width: 70px;
  }

  .batch-bar {
    gap: 8px;
  }

  .batch-chips {
    padding: 2px 0;
  }

  .batch-chips button {
    padding: 6px 12px;
    font-size: 12px;
  }

  .vocab-card {
    padding: 14px 16px;
    margin-bottom: 10px;
  }

  .card-label {
    font-size: 11px;
  }

  .card-content {
    font-size: 15px;
    line-height: 1.5;
  }

  .mode-buttons button {
    width: 40px;
    height: 40px;
    font-size: 15px;
  }

  .nav-buttons {
    gap: 12px;
    margin-top: 16px;
  }

  .nav-buttons button {
    padding: 14px 16px;
    font-size: 15px;
    border-radius: 10px;
  }

  .empty-state {
    padding: 40px 16px;
  }

  .empty-icon {
    font-size: 56px;
  }

  .empty-state h2 {
    font-size: 20px;
  }

  .empty-state p {
    font-size: 14px;
  }
}

.sidebar h3 {
  color: #2c3e50;
  margin-bottom: 20px;
  font-size: 16px;
  font-weight: 600;
}

.instruction-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  margin: 4px 0;
  color: #666;
  font-size: 14px;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.instruction-item.active {
  background: #2c3e50;
  color: #fff;
}

.shuffle-btn {
  width: 100%;
  padding: 12px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.shuffle-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.flash-btn {
  width: 100%;
  padding: 12px;
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.flash-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(245, 87, 108, 0.4);
}

.delete-btn {
  width: 100%;
  padding: 12px;
  background: #fff;
  color: #c0392b;
  border: 1px solid #e6b8b7;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.delete-btn:hover {
  background: #fdf2f2;
}

.shuffle-btn:active {
  transform: translateY(0);
}

.instruction-item.active .mode-number {
  background: #fff;
  color: #2c3e50;
}

.mode-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: #2c3e50;
  color: #fff;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
}

.container {
  flex: 1;
  max-width: 500px;
  margin: 0 auto;
  padding: 40px 20px;
  position: relative;
}

.group-selector {
  display: flex;
  gap: 8px;
  justify-content: center;
  margin-bottom: 20px;
}

.group-selector button {
  padding: 8px 16px;
  border: 2px solid #ddd;
  border-radius: 8px;
  background: #fff;
  color: #666;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.group-selector button.active {
  background: #2c3e50;
  border-color: #2c3e50;
  color: #fff;
}

.group-selector button:hover {
  border-color: #2c3e50;
}

.group-selector .import-btn {
  background: #4CAF50;
  border-color: #4CAF50;
  color: #fff;
}

.group-selector .import-btn:hover {
  background: #45a049;
  border-color: #45a049;
}

/* 组号栏：上下两行，上为每组数量，下为组号滚动条 */
.batch-bar {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}

.batch-size {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: #666;
  flex-shrink: 0;
}

.batch-size-input {
  width: 56px;
  padding: 6px 4px;
  text-align: center;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 13px;
  color: #2c3e50;
  outline: none;
}

.batch-size-input:focus {
  border-color: #2c3e50;
}

.batch-chips {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  overflow-y: hidden;
  flex-wrap: nowrap;
  max-width: 100%;
  padding: 2px 0;
  scrollbar-width: none;
  cursor: grab;
  user-select: none;
}

.batch-chips::-webkit-scrollbar {
  display: none;
}

.batch-chips button {
  flex-shrink: 0;
  padding: 6px 14px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: #fff;
  color: #666;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.batch-chips button:hover {
  border-color: #2c3e50;
}

.batch-chips button.active {
  background: #2c3e50;
  border-color: #2c3e50;
  color: #fff;
}

.import-status {
  text-align: center;
  color: #4CAF50;
  font-size: 13px;
  margin: -10px 0 16px;
}

.header {
  margin-bottom: 20px;
  position: relative;
}

.word-title {
  text-align: center;
  font-size: 36px;
  color: #2c3e50;
  font-weight: 700;
  margin: 0;
}

.counter {
  position: absolute;
  top: 0;
  right: 0;
  color: #999;
  font-size: 14px;
  white-space: nowrap;
}

/* 顶部导航栏 */
.top-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
  padding: 0 24px;
  background: #fff;
  border-bottom: 1px solid #e9ecef;
  position: sticky;
  top: 0;
  z-index: 50;
}

.nav-title {
  font-size: 16px;
  font-weight: 700;
  color: #2c3e50;
}

.nav-tabs {
  display: flex;
  gap: 8px;
}

.nav-tabs button {
  padding: 8px 16px;
  border: 2px solid transparent;
  border-radius: 8px;
  background: #fff;
  color: #666;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.nav-tabs button:hover {
  border-color: #ddd;
}

.nav-tabs button.active {
  background: #2c3e50;
  border-color: #2c3e50;
  color: #fff;
}

.mode-buttons {
  display: flex;
  gap: 8px;
  justify-content: center;
  margin-bottom: 20px;
}

.mode-buttons button {
  width: 40px;
  height: 40px;
  border: 2px solid #ddd;
  border-radius: 8px;
  background: #fff;
  color: #666;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.mode-buttons button.active {
  background: #2c3e50;
  border-color: #2c3e50;
  color: #fff;
}

.mode-buttons button:hover {
  border-color: #2c3e50;
}

.mode-buttons button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  border-color: #ddd;
}

.mode-tip {
  color: #999;
  font-size: 13px;
  text-align: center;
  margin: -8px 0 16px;
}

.auto-jump-setting {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: center;
  margin-bottom: 20px;
}

.setting-label {
  font-size: 14px;
  color: #666;
}

.auto-jump-setting .delay-select {
  padding: 8px 12px;
  border: 2px solid #ddd;
  border-radius: 8px;
  background: #fff;
  font-size: 14px;
  cursor: pointer;
  outline: none;
}

.auto-jump-setting .delay-select:focus {
  border-color: #2c3e50;
}

.nav-buttons {
  display: flex;
  gap: 16px;
  margin-top: 20px;
}

.nav-buttons button {
  flex: 1;
  padding: 12px 20px;
  border: none;
  border-radius: 8px;
  background: #2c3e50;
  color: #fff;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.nav-buttons button:hover:not(:disabled) {
  background: #34495e;
}

.nav-buttons button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 20px;
}

.empty-state h2 {
  color: #2c3e50;
  font-size: 24px;
  margin-bottom: 12px;
}

.empty-state p {
  color: #666;
  font-size: 14px;
  margin-bottom: 8px;
}

.empty-state .format-hint {
  font-size: 12px;
  color: #999;
  background: #f8f9fa;
  padding: 8px 16px;
  border-radius: 8px;
  display: inline-block;
}

.word-line {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.speak-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 50%;
  background: transparent;
  font-size: 20px;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.2s ease, transform 0.1s ease;
}

.speak-btn:hover {
  background: #f0f0f0;
}

.speak-btn:active {
  transform: scale(0.92);
}
</style>
