import { callApiEngine } from '@/platform/business-runtime.js'

export const MCI_AI_ENGINE_KEY = 'mci_ai_data_assistant'

let bootstrapCache = null
let bootstrapPromise = null
const BOOTSTRAP_TTL = 5 * 60 * 1000

export function unwrapAiResult(result) {
  let current = result
  for (let index = 0; index < 4; index += 1) {
    if (current && Number(current.Code) === 1 && current.Data && typeof current.Data === 'object' && current.Data.Code !== undefined) {
      current = current.Data
    } else {
      break
    }
  }
  return current || {}
}

async function runAi(action, payload = {}) {
  const result = unwrapAiResult(await callApiEngine(MCI_AI_ENGINE_KEY, { Action: action, ...payload }))
  if (!result || Number(result.Code) !== 1) throw new Error((result && result.Msg) || 'AI 服务暂时不可用')
  return result.Data || {}
}

export async function loadAiBootstrap(userId, force = false) {
  const key = String(userId || '')
  const now = Date.now()
  if (!force && bootstrapCache && bootstrapCache.userId === key && now - bootstrapCache.time < BOOTSTRAP_TTL) {
    return bootstrapCache.data
  }
  if (!bootstrapPromise || bootstrapPromise.userId !== key || force) {
    const promise = runAi('Bootstrap').then((data) => {
      bootstrapCache = { userId: key, time: Date.now(), data }
      return data
    })
    bootstrapPromise = { userId: key, promise }
  }
  const active = bootstrapPromise
  try {
    return await active.promise
  } finally {
    if (bootstrapPromise === active) bootstrapPromise = null
  }
}

export function loadAiHistory() {
  return runAi('History')
}

export function loadAiConversation(conversationId) {
  return runAi('Conversation', { ConversationId: conversationId })
}

export function sendAiQuestion(payload) {
  return runAi('Chat', payload)
}

export function renameAiConversation(conversationId, title) {
  return runAi('Rename', { ConversationId: conversationId, Title: title })
}

export function setAiConversationArchived(conversationId, archived) {
  return runAi(archived ? 'Archive' : 'Restore', { ConversationId: conversationId })
}

export function makeAiId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

export function isRelayStation(model) {
  if (!model) return false
  if (model.IsRelayStation === true || Number(model.IsRelayStation || 0) === 1) return true
  return /Microi(?:吾码)?\.?(?:AI)?中转站/i.test(`${model.Name || ''} ${model.AiModel || ''}`)
}

export function modelSupportsReasoning(model, runtimeModel = '') {
  if (model && (model.SupportReasoning === true || Number(model.SupportReasoning || 0) === 1)) return true
  const text = [model && model.Name, model && model.AiModel, model && model.ModelType, model && model.Provider, runtimeModel]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return /(^|[^a-z0-9])(o1|o3|o4)([^a-z0-9]|$)|gpt[-_. ]?5|reason|thinking|deepseek[-_. ]?r1|qwen[-_. ]?3/.test(text)
}

export function formatAiModelName(model) {
  if (!model) return '暂无可用模型'
  const name = model.Name || model.AiModel || 'AI'
  return model.AiModel ? `${name} (${model.AiModel})` : name
}

export function formatRelayModelName(model) {
  if (!model) return '请选择运行模型'
  const label = model.DisplayName || model.Name || model.Id
  return label && label !== model.Id ? `${model.Id} · ${label}` : String(model.Id || label || '')
}
