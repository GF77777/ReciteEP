<script setup>
import { ref, onMounted } from 'vue'
import VocabCard from './components/VocabCard.vue'
import FlashReview from './components/FlashReview.vue'

const groups = ref([])
const currentGroupId = ref('')
const currentGroup = ref({ name: '', words: [] })
const currentIndex = ref(0)
const words = ref([])
const currentMode = ref(0)

const currentWord = ref({})
const fileInput = ref(null)
const autoJumpDelay = ref(1)
const isFlashReview = ref(false)
const isSidebarOpen = ref(false)

const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value
}

const loadGroups = async () => {
  groups.value = []
}

const selectGroup = (groupId) => {
  currentGroupId.value = groupId
  const group = groups.value.find(g => g.id === groupId)
  if (group) {
    currentGroup.value = group.data
    words.value = group.data.words
    currentIndex.value = 0
    currentWord.value = words.value[0] || {}
  }
}

const goNext = () => {
  if (currentIndex.value < words.value.length - 1) {
    currentIndex.value++
    currentWord.value = words.value[currentIndex.value]
  }
}

const goPrev = () => {
  if (currentIndex.value > 0) {
    currentIndex.value--
    currentWord.value = words.value[currentIndex.value]
  }
}

const setMode = (mode) => {
  currentMode.value = mode
}

const startFlashReview = () => {
  isFlashReview.value = true
}

const exitFlashReview = () => {
  isFlashReview.value = false
}

const shuffleWords = () => {
  const currentWordData = currentWord.value
  const otherWords = words.value.filter(w => w.word !== currentWordData.word)
  for (let i = otherWords.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [otherWords[i], otherWords[j]] = [otherWords[j], otherWords[i]]
  }
  words.value = [currentWordData, ...otherWords]
  currentIndex.value = 0
  currentWord.value = words.value[0]
}

const handleAnswer = (isCorrect) => {
  if (currentIndex.value < words.value.length - 1) {
    goNext()
  }
}

const triggerFileInput = () => {
  fileInput.value?.click()
}

const handleFileSelect = (event) => {
  const file = event.target.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const content = e.target?.result
      const data = typeof content === 'string' ? JSON.parse(content) : null
      if (data && data.words && Array.isArray(data.words)) {
        const fileName = file.name.replace('.json', '')
        const newGroup = {
          id: 'imported-' + Date.now(),
          name: data.name || fileName,
          data
        }
        groups.value.push(newGroup)
        selectGroup(newGroup.id)
      } else {
        alert('无效的文件格式，请确保JSON包含words数组')
      }
    } catch (error) {
      alert('读取文件失败: ' + error.message)
    }
  }
  reader.readAsText(file)
  event.target.value = ''
}

onMounted(() => {
  loadGroups()
})
</script>

<template>
  <div class="main-layout">
    <button class="menu-toggle" @click="toggleSidebar">☰</button>
    <div class="sidebar-overlay" :class="{ show: isSidebarOpen }" @click="toggleSidebar"></div>
    <div class="sidebar" :class="{ open: isSidebarOpen }">
      <h3>操作说明</h3>
      <div class="instruction-item" v-if="currentMode === 0">
        <span class="mode-number">0</span>
        <span>读准音标，尝试联系</span>
      </div>
      <div class="instruction-item" v-if="currentMode === 4">
        <span class="mode-number">4</span>
        <span>遮蔽回忆，手动输入</span>
      </div>
      <div class="instruction-item" v-if="currentMode === 3">
        <span class="mode-number">3</span>
        <span>语境填空，选择答案</span>
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
        <input type="file" ref="fileInput" accept=".json" style="display:none" @change="handleFileSelect" />
      </div>
      <div v-if="words.length === 0" class="empty-state">
        <div class="empty-icon">📚</div>
        <h2>暂无单词数据</h2>
        <p>请点击上方「导入文件」按钮导入单词数据</p>
        <p class="format-hint">支持格式：JSON 文件，包含 words 数组</p>
      </div>
      
      <template v-else>
        <div class="header">
          <h1 class="word-title">{{ currentWord.word }}</h1>
          <div class="counter">{{ currentIndex + 1 }} / {{ words.length }}</div>
        </div>

        <VocabCard label="音标" :content="currentWord.phonetic" :default-visible="true" :mode-key="currentMode" />
        <VocabCard label="核心义" :content="currentWord.core" :default-visible="currentMode !== 1 && currentMode !== 2 && currentMode !== 3 && currentMode !== 4" :force-hide="currentMode === 1 || currentMode === 2 || currentMode === 3 || currentMode === 4" :mode-key="currentMode" />
        <VocabCard label="四级义" :content="currentWord.cet4" :default-visible="currentMode !== 1 && currentMode !== 2 && currentMode !== 3 && currentMode !== 4" :force-hide="currentMode === 1 || currentMode === 2 || currentMode === 3 || currentMode === 4" :mode-key="currentMode" />
    <VocabCard label="线索" :content="currentWord.clue" :default-visible="currentMode !== 1 && currentMode !== 2 && currentMode !== 3 && currentMode !== 4" :force-hide="currentMode === 1 || currentMode === 2 || currentMode === 3 || currentMode === 4" :mode-key="currentMode" />
    <VocabCard label="例句" :example="currentWord.example" :default-visible="true" :hide-chinese="currentMode === 2" :mode-key="currentMode" :cloze-word="currentWord.word" :is-cloze-mode="currentMode === 4" :is-quiz-mode="currentMode === 3" :auto-jump-delay="autoJumpDelay" @answer="handleAnswer" />

    <div class="mode-buttons">
      <button
        v-for="n in [0, 4, 3]"
        :key="n"
        :class="{ active: currentMode === n }"
        @click="setMode(n)"
      >
        {{ n }}
      </button>
    </div>
    
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

    <FlashReview v-if="isFlashReview" :words="words" @exit="exitFlashReview" />
  </div>
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

  .counter {
    font-size: 13px;
    top: 16px;
    right: 16px;
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

.header {
  margin-bottom: 20px;
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
  top: 20px;
  right: 20px;
  color: #999;
  font-size: 14px;
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
</style>
