import assert from 'node:assert/strict'
import {
  buildMessageCacheKey,
  buildMessageChannelItems,
  filterMessageItems
} from '../src/platform/message-center.mjs'

const messages = [
  { ContactUserId: 'u-1', ContactUserName: '项目通知', LastMessage: '@李明 任务审批已更新' },
  { ContactUserId: 'u-2', ContactUserName: '协作动态', LastMessage: '王工回复了你的评论' },
  { ContactUserId: 'u-3', ContactUserName: '团队动态', LastMessage: '同事点赞了你的工作汇报' },
  { ContactUserId: 'AI', ContactUserName: 'AI助手', LastMessage: '有什么可以帮您？' }
]

assert.equal(filterMessageItems(messages, { channel: 'mentions', currentUserName: '李明' }).length, 1)
assert.equal(filterMessageItems(messages, { channel: 'comments' }).length, 1)
assert.equal(filterMessageItems(messages, { channel: 'likes' }).length, 1)
assert.equal(filterMessageItems(messages, { channel: 'system' }).length, 1)
assert.equal(filterMessageItems(messages, { query: '工作汇报' }).length, 1)
assert.equal(filterMessageItems(messages, { aiEnabled: false }).some((item) => item.ContactUserId === 'AI'), false)

const channels = buildMessageChannelItems(messages, '李明')
assert.deepEqual(channels.map((item) => item.title), ['@我的', '评论', '点赞', '系统通知'])
assert.deepEqual(channels.map((item) => item.count), [1, 1, 1, 1])

const firstScope = buildMessageCacheKey({ profileId: 'microi', apiBase: 'https://api-a.example', osClient: 'tenant-a', identity: 'user-1' })
const secondTenant = buildMessageCacheKey({ profileId: 'microi', apiBase: 'https://api-a.example', osClient: 'tenant-b', identity: 'user-1' })
const secondEndpoint = buildMessageCacheKey({ profileId: 'microi', apiBase: 'https://api-b.example', osClient: 'tenant-a', identity: 'user-1' })
assert.notEqual(firstScope, secondTenant)
assert.notEqual(firstScope, secondEndpoint)

console.log('[message-center] PASS: real message filters and endpoint-scoped cache')
