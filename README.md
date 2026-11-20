# ReciteEP 通用背单词

一个基于 Vue 3 + Vite 的纯前端通用英语背单词应用。可导入任意英语词库（四六级、考研、雅思、托福、自建词表等），支持多种记忆模式和 5 分钟快闪复习，导入的词库保存在浏览器本地，无需后端服务。

## 功能特性

### 学习模式

| 模式 | 说明 | 交互 |
| --- | --- | --- |
| `0` 读准音标，尝试联系 | 显示音标、单词与例句，释义/用法/线索默认折叠 | 点击卡片显示内容 |
| `4` 遮蔽回忆，手动输入 | 例句中的目标单词被挖空 | 手动输入答案，点击显示结果 |
| `3` 语境填空，选择答案 | 例句挖空并给出候选项 | 选择答案后显示对错，可设置 1/2/3/5 秒自动跳转下一词 |

没有例句的词库会自动禁用模式 `3` / `4`，避免出现空白题。

### 词库与其他功能

- 启动自带示例词库，可导入 JSON / Excel (xlsx / xls) / CSV 词库，支持多个词库切换
- 导入的词库保存在浏览器 localStorage，刷新页面不丢失，并记住上次使用的词库
- 同名再次导入会覆盖原词库，不重复堆叠；导入的词库可在侧边栏删除
- 兼容常见字段别名（`meaning`、`definition`、`exam_point` 等），导入时自动去重、跳过无效词条
- 点击单词旁的 🔊 按钮朗读发音（浏览器语音合成，无需音频文件）
- 打乱当前单词顺序（保留当前词在首位）
- 5 分钟倒计时快闪复习：认识 / 跳过，跳过的单词进入第二轮，结束时显示复习统计与未掌握列表
- 响应式布局，移动端侧边栏自动收为抽屉

## 技术栈

- Vue 3（`<script setup>` 单文件组件）
- Vite 8 + `@vitejs/plugin-vue`
- 原生 CSS（组件内 `scoped` 样式）
- 无路由、无状态管理库、无 UI 组件库

## 目录结构

```text
project0515/
├─ .github/workflows/static.yml   # GitHub Pages 自动部署
├─ public/                        # favicon
├─ src/
│  ├─ App.vue                     # 主界面：词库、模式、导航、导入/删除、快闪入口
│  ├─ main.js                     # 应用入口
│  ├─ style.css                   # 基础全局样式
│  ├─ components/
│  │  ├─ VocabCard.vue            # 单词卡片（普通 / 填空 / 选择题）
│  │  └─ FlashReview.vue          # 5 分钟快闪复习
│  ├─ data/vocabulary.json        # 内置示例词库
│  └─ utils/
│     ├─ normalize.js             # 词库字段标准化
│     ├─ parser.js                # JSON / CSV / XLSX 统一解析
│     ├─ speech.js                # 浏览器语音合成封装
│     └─ storage.js               # localStorage 词库存储
├─ index.html
├─ vite.config.js                 # base: '/ReciteEP/'
└─ package.json
```

## 快速开始

环境要求：Node.js `^20.19.0` 或 `>=22.12.0`（Vite 8 要求）。

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 生产构建，产物输出到 dist/
npm run build

# 本地预览构建产物
npm run preview
```

## 数据格式

支持三种格式：**JSON**（结构化）、**Excel (xlsx / xls)**（工作簿）、**CSV**（逗号分隔）。

### JSON 格式

顶层可以是 `{ "words": [...] }`，也可以直接是单词数组。可选 `name` 字段作为词库名，未提供时使用文件名。

```json
{
  "name": "我的词库",
  "words": [
    {
      "word": "academic",
      "phonetic": "/ˌækəˈdemɪk/",
      "core": "学术的；学者",
      "usage": "常搭配 academic research / study",
      "clue": "🎓 academy + ic → 学院的、学术的",
      "example": {
        "en": "She has a strong academic background.",
        "cn": "她有扎实的学术背景。",
        "cloze": "academic",
        "distractors": ["athletic", "automatic", "authentic"]
      }
    }
  ]
}
```

### 表格格式（Excel / CSV）

第一行是**列名**，每一行是一个单词。Excel 默认读第一个 sheet；CSV 使用 UTF-8 编码（含 BOM 也能识别）。

| word | phonetic | meaning | usage | clue | example_en | example_cn |
| --- | --- | --- | --- | --- | --- | --- |
| academic | /ˌækəˈdemɪk/ | 学术的；学者 | academic research | 🎓 academy + ic | She has a strong academic background. | 她有扎实的学术背景。 |
| ability | /əˈbɪləti/ | 能力 | be able to do | 💪 able + -ity | He has the ability to lead. | 他有领导能力。 |

列名写法与 JSON 字段别名一致（见下表）：

| 目标字段 | 可用列名（取第一个有值的） |
| --- | --- |
| `word` | `word`、`term`、`spelling`、`单词` |
| `phonetic` | `phonetic`、`ipa`、`pronunciation`、`音标` |
| `core`（释义） | `core`、`meaning`、`definition`、`translation`、`释义`、`中文释义` |
| `usage`（用法） | `usage`、`exam_point`、`cet4`、`note`、`考点`、`用法` |
| `clue`（线索） | `clue`、`memory`、`tip`、`记忆`、`记忆线索` |
| 英文例句 | `example_en`、`sentence`、`例句英文` |
| 中文例句 | `example_cn`、`例句中文` |

字段说明（JSON 与表格通用）：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `word` | 是 | 单词 |
| `phonetic` | 否 | 音标 |
| `core` | 否 | 核心释义 |
| `usage` | 否 | 用法 / 考点说明 |
| `clue` | 否 | 记忆线索 |
| 例句 | 否 | JSON 用 `example: { en, cn, cloze, distractors }`；表格拆成 `example_en` / `example_cn` 两列即可 |

自动处理：
- 例句的挖空答案 `cloze` 缺省用单词本身；干扰项缺失时自动从同词库其他单词补齐（最多 3 个）。
- 导入时会跳过没有 `word` 的条目，并按单词（不区分大小写）去重。

## 本地存储

- 用户导入的词库保存在浏览器 localStorage（键 `reciteep:decks:v1`），刷新或重开页面仍然存在。
- 上次选择的词库保存在 `reciteep:lastDeckId`，下次打开自动恢复。
- 内置示例词库不写入存储，也不能删除。
- 清除浏览器网站数据、换浏览器或换设备后，导入的词库需要重新导入。

## 使用流程

1. 启动后默认加载「示例词库」，点击「导入文件」可追加自己的词库（JSON / Excel / CSV）。
2. 在顶部分组按钮间切换词库；导入的词库可在左侧边栏「删除当前词库」移除。
3. 通过底部数字按钮切换模式 `0` / `4` / `3`。
4. 使用「上一个 / 下一个」浏览单词，点击标题旁 🔊 可朗读当前单词，或点击「🔀 打乱顺序」。
5. 点击「⚡ 5分钟快闪复习」进入计时复习。

## 部署

### GitHub Pages

`vite.config.js` 中设置了 `base: '/ReciteEP/'`，对应仓库 `GF77777/ReciteEP`。推送到 `main` 分支后，[static.yml](.github/workflows/static.yml) 会自动安装依赖、构建并部署 `dist/` 到 GitHub Pages。

### Vercel

项目为纯静态站点，可直接部署。若部署在根路径而非 `/ReciteEP/`，需相应调整 `vite.config.js` 的 `base`。

## 当前状态与已知限制

- 支持 JSON / Excel (xlsx / xls) / CSV 三种格式；仅面向英语单词。
- Excel 只读第一个 sheet；CSV 需使用 UTF-8 编码（GBK 编码的 CSV 建议另存为 UTF-8）。
- 暂不做学习进度、掌握标记、间隔重复与统计；重新打开后从当前词库第一个词开始。
- 模式 3 的干扰项在缺失时会自动从同词库补齐，数量可能少于 3 个。
- 发音音色由浏览器/系统决定；不支持语音合成的浏览器会隐藏发音按钮。
- 清除浏览器数据会删除所有导入的词库。

## License

项目未声明开源许可证。
