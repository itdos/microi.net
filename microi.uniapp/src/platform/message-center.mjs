const normalize = (value) => String(value || '').trim().toLowerCase()

export const MESSAGE_CHANNELS = Object.freeze([
  { key: 'mentions', title: '@我的', tone: 'blue' },
  { key: 'comments', title: '评论', tone: 'indigo' },
  { key: 'likes', title: '点赞', tone: 'orange' },
  { key: 'system', title: '系统通知', tone: 'cyan' }
])

export function buildMessageCacheKey({ profileId, apiBase, osClient, identity } = {}) {
  return [
    'message:v2',
    normalize(profileId) || 'default',
    normalize(apiBase) || 'unknown-api',
    normalize(osClient) || 'unknown-tenant',
    normalize(identity) || 'anonymous'
  ].join(':')
}

export function messageSearchText(item = {}) {
  return normalize([
    item.ContactUserName,
    item.LastMessage,
    item.Title,
    item.Type,
    item.MessageType
  ].filter(Boolean).join(' '))
}

export function messageMatchesChannel(item, channelKey, currentUserName = '') {
  if (!channelKey) return true
  const text = messageSearchText(item)
  if (!text) return false
  if (channelKey === 'mentions') {
    const userName = normalize(currentUserName)
    return text.includes('@') || text.includes('提到你') || text.includes('提醒你') || (userName && text.includes(`@${userName}`))
  }
  if (channelKey === 'comments') return ['评论', '回复', 'comment', 'reply'].some((word) => text.includes(word))
  if (channelKey === 'likes') return ['点赞', '赞了', 'like'].some((word) => text.includes(word))
  if (channelKey === 'system') return ['系统', '通知', '公告', '审批', '任务', '提醒', 'system', 'notice'].some((word) => text.includes(word))
  return true
}

export function filterMessageItems(items, options = {}) {
  const query = normalize(options.query)
  const aiEnabled = options.aiEnabled !== false
  return (Array.isArray(items) ? items : []).filter((item) => {
    const identity = normalize(item && (item.ContactUserId || item.Id))
    if (!aiEnabled && identity === 'ai') return false
    if (!messageMatchesChannel(item, options.channel, options.currentUserName)) return false
    return !query || messageSearchText(item).includes(query)
  })
}

export function buildMessageChannelItems(items, currentUserName = '') {
  return MESSAGE_CHANNELS.map((channel) => ({
    ...channel,
    count: filterMessageItems(items, { channel: channel.key, currentUserName }).length
  }))
}
