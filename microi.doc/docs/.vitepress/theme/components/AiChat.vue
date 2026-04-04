<template>
  <ClientOnly>
    <div v-if="isHomePage" class="ai-chat-section">
      <!-- 标题区 -->
      <div class="section-divider">
        <div class="divider-line"></div>
        <div class="divider-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="url(#ai-grad)" opacity="0.2"/>
            <path d="M9 9h6M9 12h4M9 15h5" stroke="url(#ai-grad)" stroke-width="1.5" stroke-linecap="round"/>
            <defs>
              <linearGradient id="ai-grad" x1="2" y1="2" x2="22" y2="22">
                <stop offset="0%" stop-color="#8a2be2"/>
                <stop offset="100%" stop-color="#00bfff"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        <h2 class="section-title">AI 智能助手</h2>
        <div class="divider-line"></div>
      </div>
      <p class="section-subtitle">体验 Microi吾码 AI 能力，在线对话智能助手</p>

      <!-- 对话窗 -->
      <div class="chat-window">
        <div class="chat-glow"></div>
        <div class="chat-inner">
          <!-- 消息区域 -->
          <div ref="msgArea" class="msg-area">
            <div 
              v-for="(msg, idx) in messages" 
              :key="idx" 
              class="msg-row"
              :class="msg.role"
            >
              <div class="msg-avatar">
                <div v-if="msg.role === 'ai'" class="ai-avatar">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
                  </svg>
                </div>
                <div v-else class="user-avatar">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                </div>
              </div>
              <div class="msg-bubble" :class="msg.role">
                <div v-if="msg.typing" class="typing-indicator">
                  <span></span><span></span><span></span>
                </div>
                <div v-else v-html="msg.content" class="msg-text"></div>
              </div>
            </div>
          </div>

          <!-- 快捷问题 -->
          <div v-if="messages.length <= 1" class="quick-questions">
            <button 
              v-for="q in quickQuestions" 
              :key="q"
              class="quick-btn"
              @click="askQuestion(q)"
            >
              {{ q }}
            </button>
          </div>

          <!-- 输入区 -->
          <div class="chat-input-area">
            <input 
              v-model="inputText"
              type="text"
              placeholder="输入你想了解的问题..."
              class="chat-input"
              :disabled="isThinking"
              @keyup.enter="sendMessage"
            />
            <button 
              class="send-btn" 
              :disabled="!inputText.trim() || isThinking"
              @click="sendMessage"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <p class="powered-tip">Powered by Microi AI Engine · <a href="/doc/index">了解更多</a></p>
    </div>
  </ClientOnly>
</template>

<script setup>
import { ref, watch, onMounted, nextTick } from 'vue'
import { useRoute } from 'vitepress'

const route = useRoute()
const isHomePage = ref(false)
const inputText = ref('')
const isThinking = ref(false)
const msgArea = ref(null)

const checkHomePage = () => {
  if (typeof window === 'undefined') return false
  const path = route.path || window.location.pathname
  return path === '/' || path === '/index.html' || path === '/index'
}

watch(() => route.path, () => {
  isHomePage.value = checkHomePage()
}, { immediate: true })

onMounted(() => {
  isHomePage.value = checkHomePage()
})

const quickQuestions = [
  'Microi吾码是什么？',
  '支持哪些数据库？',
  'AI引擎有什么能力？',
  '如何快速开始？'
]

// 预设的AI知识库回复
const knowledgeBase = {
  '是什么': `<strong>Microi吾码</strong> 是一个开源 AI 低代码平台，始于2014年（基于Avalon.js），2018年使用 Vue 重构，2025年正式开源。<br/><br/>基于 <strong>.NET10 + Vue3 + Element-Plus + Redis</strong>，提供表单引擎、API接口引擎、AI引擎、工作流引擎、3D引擎等 <strong>20+ 引擎</strong>，支持分布式部署、跨数据库、跨平台，不限用户数、表单数、数据量。`,
  '数据库': `Microi吾码支持多种主流数据库：<br/><br/>• <strong>MySQL</strong> 5.5+<br/>• <strong>SQL Server</strong> 2000+<br/>• <strong>Oracle</strong> 11g+<br/><br/>还支持 <strong>分库分表、读写分离、多主同步</strong> 等高级特性，通过数据源引擎可灵活切换和管理多个数据库实例。`,
  'AI': `Microi吾码 AI 引擎具备以下核心能力：<br/><br/>• 🤖 <strong>AI 数据分析</strong> — 自然语言转SQL，智能报表<br/>• 💻 <strong>AI 在线编程</strong> — 在线AI编写后端V8代码<br/>• 🧠 <strong>向量数据库</strong> — 自动差量同步，更精准的AI结果<br/>• 🔗 <strong>多模型支持</strong> — 接入 DeepSeek / OpenAI / 本地模型<br/>• 🦞 <strong>OpenClaw 小龙虾</strong> — 远程AI集群管理<br/>• 🎯 <strong>AI训练与微调</strong> — 支持提示词管理和模型定制`,
  '开始': `快速开始使用 Microi吾码：<br/><br/>1️⃣ 访问 <a href="https://web.microi.net" target="_blank" rel="noopener">web.microi.net</a> 在线体验<br/>2️⃣ 查阅 <a href="/doc/index">官方文档</a> 了解详情<br/>3️⃣ 前往 <a href="https://gitee.com/ITdos/microi.net" target="_blank" rel="noopener">Gitee 仓库</a> 获取源码<br/>4️⃣ 使用 Docker 一键部署到本地<br/><br/>提供前后端源代码，支持 Vue / React / Angular 二次开发。`,
  'default': `感谢您的提问！关于这个问题，建议您：<br/><br/>• 📖 查阅 <a href="/doc/index">官方文档</a> 获取详细信息<br/>• 💬 <a href="/contact/">联系我们</a> 获得专业技术支持<br/>• 🌐 访问 <a href="https://web.microi.net" target="_blank" rel="noopener">在线演示</a> 亲身体验<br/><br/>Microi吾码团队随时为您服务！`
}

const messages = ref([
  {
    role: 'ai',
    content: '👋 你好！我是 Microi 智能助手，有关平台功能、技术架构、部署方案等问题，都可以问我。',
    typing: false
  }
])

function matchAnswer(text) {
  const lower = text.toLowerCase()
  if (lower.includes('是什么') || lower.includes('介绍') || lower.includes('what')) return knowledgeBase['是什么']
  if (lower.includes('数据库') || lower.includes('mysql') || lower.includes('sql') || lower.includes('oracle') || lower.includes('database')) return knowledgeBase['数据库']
  if (lower.includes('ai') || lower.includes('智能') || lower.includes('人工') || lower.includes('模型') || lower.includes('deepseek')) return knowledgeBase['AI']
  if (lower.includes('开始') || lower.includes('使用') || lower.includes('部署') || lower.includes('安装') || lower.includes('start') || lower.includes('试用') || lower.includes('体验')) return knowledgeBase['开始']
  return knowledgeBase['default']
}

function scrollToBottom() {
  nextTick(() => {
    if (msgArea.value) {
      msgArea.value.scrollTop = msgArea.value.scrollHeight
    }
  })
}

function askQuestion(q) {
  inputText.value = q
  sendMessage()
}

function sendMessage() {
  const text = inputText.value.trim()
  if (!text || isThinking.value) return
  
  messages.value.push({ role: 'user', content: text, typing: false })
  inputText.value = ''
  scrollToBottom()

  // AI 思考中
  isThinking.value = true
  messages.value.push({ role: 'ai', content: '', typing: true })
  scrollToBottom()

  // 模拟打字效果
  const delay = 600 + Math.random() * 800
  setTimeout(() => {
    const answer = matchAnswer(text)
    messages.value[messages.value.length - 1] = { role: 'ai', content: answer, typing: false }
    isThinking.value = false
    scrollToBottom()
  }, delay)
}
</script>

<style scoped>
.ai-chat-section {
  max-width: 800px;
  margin: 60px auto 40px;
  padding: 0 24px;
  position: relative;
  z-index: 10;
}

/* 标题区 复用 ProductShowcase 的样式 */
.section-divider {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 8px;
}
.divider-line {
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(138,43,226,0.3), transparent);
}
.divider-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.section-title {
  font-size: 22px;
  font-weight: 700;
  color: #fff !important;
  margin: 0;
  white-space: nowrap;
  background: linear-gradient(135deg, #8a2be2, #00bfff);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.section-subtitle {
  text-align: center;
  font-size: 14px;
  color: rgba(180,180,200,0.6) !important;
  margin: 0 0 28px;
}

/* 对话窗 */
.chat-window {
  position: relative;
  border-radius: 20px;
  overflow: hidden;
}
.chat-glow {
  position: absolute;
  top: -1px;
  left: 10%;
  right: 10%;
  height: 2px;
  background: linear-gradient(90deg, transparent, #8a2be2, #00bfff, transparent);
  border-radius: 2px;
  z-index: 2;
}
.chat-inner {
  background: rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(16px) saturate(160%);
  -webkit-backdrop-filter: blur(16px) saturate(160%);
  border: 1px solid rgba(255, 255, 255, 0.10);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  padding: 20px;
  display: flex;
  flex-direction: column;
}

/* 消息区 */
.msg-area {
  max-height: 360px;
  overflow-y: auto;
  padding-right: 4px;
  margin-bottom: 16px;
}
.msg-area::-webkit-scrollbar {
  width: 4px;
}
.msg-area::-webkit-scrollbar-thumb {
  background: rgba(138,43,226,0.3);
  border-radius: 4px;
}

.msg-row {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
  animation: msgFadeIn 0.3s ease;
}
.msg-row.user {
  flex-direction: row-reverse;
}
@keyframes msgFadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.msg-avatar {
  flex-shrink: 0;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ai-avatar {
  background: linear-gradient(135deg, rgba(138,43,226,0.2), rgba(0,191,255,0.15));
  border: 1px solid rgba(138,43,226,0.2);
  border-radius: 10px;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #b388ff;
}
.user-avatar {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(200,200,220,0.6);
}

.msg-bubble {
  max-width: 80%;
  padding: 12px 16px;
  border-radius: 14px;
  font-size: 14px;
  line-height: 1.7;
}
.msg-bubble.ai {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.06);
  color: rgba(220,220,240,0.9);
}
.msg-bubble.user {
  background: linear-gradient(135deg, rgba(138,43,226,0.2), rgba(0,191,255,0.12));
  border: 1px solid rgba(138,43,226,0.2);
  color: #e0e0e0;
}
.msg-text :deep(a) {
  color: #b388ff;
  text-decoration: none;
}
.msg-text :deep(a:hover) {
  text-decoration: underline;
}
.msg-text :deep(strong) {
  color: #fff;
}

/* 打字指示器 */
.typing-indicator {
  display: flex;
  gap: 4px;
  padding: 4px 0;
}
.typing-indicator span {
  width: 6px;
  height: 6px;
  background: rgba(138,43,226,0.5);
  border-radius: 50%;
  animation: typingBounce 1.2s ease-in-out infinite;
}
.typing-indicator span:nth-child(2) { animation-delay: 0.15s; }
.typing-indicator span:nth-child(3) { animation-delay: 0.3s; }
@keyframes typingBounce {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
}

/* 快捷问题 */
.quick-questions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}
.quick-btn {
  padding: 7px 14px;
  border: 1px solid rgba(138,43,226,0.2);
  background: rgba(138,43,226,0.06);
  color: rgba(200,200,220,0.8);
  font-size: 12px;
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.25s;
  white-space: nowrap;
}
.quick-btn:hover {
  background: rgba(138,43,226,0.15);
  border-color: rgba(138,43,226,0.4);
  color: #fff;
  box-shadow: 0 0 14px rgba(138,43,226,0.15);
}

/* 输入区 */
.chat-input-area {
  display: flex;
  gap: 8px;
  align-items: center;
}
.chat-input {
  flex: 1;
  padding: 12px 16px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  color: #e0e0e0;
  font-size: 14px;
  outline: none;
  transition: all 0.3s;
}
.chat-input:focus {
  border-color: rgba(138,43,226,0.4);
  box-shadow: 0 0 16px rgba(138,43,226,0.1);
  background: rgba(255,255,255,0.06);
}
.chat-input::placeholder {
  color: rgba(140,140,160,0.4);
}
.chat-input:disabled {
  opacity: 0.5;
}
.send-btn {
  flex-shrink: 0;
  width: 42px;
  height: 42px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, #8a2be2, #6a1fd0);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.25s;
}
.send-btn:hover:not(:disabled) {
  box-shadow: 0 0 20px rgba(138,43,226,0.4);
  transform: scale(1.05);
}
.send-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.powered-tip {
  text-align: center;
  font-size: 12px;
  color: rgba(140,140,160,0.35) !important;
  margin: 16px 0 0;
}
.powered-tip a {
  color: rgba(138,43,226,0.5);
  text-decoration: none;
}
.powered-tip a:hover {
  color: #8a2be2;
}

@media (max-width: 640px) {
  .ai-chat-section {
    padding: 0 16px;
  }
  .msg-bubble {
    max-width: 90%;
  }
  .quick-questions {
    gap: 6px;
  }
}
</style>
