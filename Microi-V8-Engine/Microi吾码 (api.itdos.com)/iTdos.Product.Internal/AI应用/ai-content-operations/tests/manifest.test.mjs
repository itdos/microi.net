import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import test from 'node:test'

const root = resolve(import.meta.dirname, '..')
const manifest = JSON.parse(await readFile(resolve(root, 'system.manifest.json'), 'utf8'))
const policies = JSON.parse(await readFile(resolve(root, 'resource-policies.json'), 'utf8'))
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const workspaceRoot = resolve(root, '..', '..', '..', '..', '..')

test('内部应用以官方租户 AI应用目录为唯一事实源', () => {
  assert.equal(existsSync(resolve(workspaceRoot, 'microi.apps')), false)
  assert.match(root.replaceAll('\\', '/'), /iTdos\.Product\.Internal\/AI应用\/ai-content-operations$/)
})

test('资源数量、mci前缀与业务键稳定', () => {
  assert.equal(manifest.tables.length, 6)
  assert.equal(manifest.modules.length, 6)
  assert.equal(manifest.engines.length, 13)
  assert.equal(manifest.jobs.length, 3)
  assert.ok(manifest.tables.every((item) => item.name.startsWith('mci_')))
  assert.equal(new Set(manifest.tables.map((item) => item.name)).size, 6)
  assert.equal(new Set(manifest.engines.map((item) => item.apiEngineKey)).size, 13)
})

test('所有接口都有显式应用所有权策略', () => {
  for (const engine of manifest.engines) {
    const policy = policies.ApiEngines[engine.apiEngineKey]
    assert.ok(policy, engine.apiEngineKey)
    if (engine.apiEngineKey.endsWith('-extension')) {
      assert.equal(policy.Ownership, 'Tenant')
      assert.equal(policy.UpgradePolicy, 'CreateIfMissing')
    } else {
      assert.equal(policy.Ownership, 'Application')
      assert.equal(policy.UpgradePolicy, 'Managed')
    }
  }
})

test('全部V8接口脚本可被异步JavaScript引擎解析', () => {
  for (const engine of manifest.engines) {
    assert.doesNotThrow(() => new AsyncFunction('V8', 'DateNow', 'DateAdd', 'System', engine.code), engine.apiEngineKey)
  }
})

test('任务时间、时区和英文稳定Key符合约束', () => {
  assert.deepEqual(manifest.jobs.slice(0, 2).map((item) => item.CronExpression), ['0 30 8 * * ?', '0 30 16 * * ?'])
  for (const job of manifest.jobs) {
    assert.match(job.JobName, /^[A-Za-z]+$/)
    assert.equal(job.TimeZoneId, 'Asia/Shanghai')
    if (job.JobName === 'MciAiMusicWorker') {
      assert.equal(job.CronExpression, '0 0/1 * * * ?')
      assert.equal(job.ApiEngineKey, 'mci-ai-music-generate')
    } else {
      assert.equal(JSON.parse(job.JobParam).Timezone, 'Asia/Shanghai')
      assert.equal(job.ApiEngineKey, 'mci-ai-content-dispatch')
    }
  }
})

test('管理后台提供显式安全的定时任务启用入口', () => {
  const plan = manifest.modules.find((item) => item.table === 'mci_ai_content_plan')
  const button = plan.moreBtns.find((item) => item.Name === '启用/校准定时发布')
  assert.ok(button)
  assert.match(button.V8Code, /mci-ai-scheduler-reconcile/)
  const source = manifest.engines.find((item) => item.apiEngineKey === 'mci-ai-scheduler-reconcile').code
  assert.match(source, /\/api\/Job\/AddJob/)
  assert.match(source, /job已存在/)
  assert.match(source, /already exists with this identification/)
  assert.match(source, /TimeZoneId/)
})

test('发布队列具有幂等键、租约、栅栏和结果尝试唯一键', () => {
  const table = Object.fromEntries(manifest.tables.map((item) => [item.name, item]))
  const publishFields = new Set(table.mci_ai_publish_task.fields.map((item) => item.name))
  for (const name of ['IdempotencyKey', 'LeaseOwner', 'LeaseUntil', 'FencingToken', 'AttemptCount']) assert.ok(publishFields.has(name), name)
  assert.ok(table.mci_ai_publish_task.indexes.some((item) => item.unique && item.columns.includes('IdempotencyKey')))
  assert.ok(table.mci_ai_publish_attempt.indexes.some((item) => item.unique && item.columns.includes('AttemptKey')))
  const claim = manifest.engines.find((item) => item.apiEngineKey === 'mci-ai-publish-claim').code
  const complete = manifest.engines.find((item) => item.apiEngineKey === 'mci-ai-publish-complete').code
  assert.match(claim, /DateNow\(/)
  assert.match(claim, /DateAdd\(/)
  assert.match(complete, /DateNow\(/)
  assert.match(complete, /DateAdd\(/)
  assert.doesNotMatch(`${claim}\n${complete}`, /System\.DateTime\.Now/)
})

test('抖音快手质量阻断不可被全部帐号语义绕过', () => {
  const source = manifest.engines.map((item) => item.code).join('\n')
  assert.match(source, /BlockedQuality/)
  assert.match(source, /Douyin|douyin/)
  assert.match(source, /Kuaishou|kuaishou/)
  assert.match(source, /approvedCards\.length\s*>=\s*6/)
  assert.doesNotMatch(source, /blockedQuality[^\n]*Succeeded/i)
})

test('视频必须是唯一带音轨成片且标题不得泄漏平台标记', () => {
  const source = manifest.engines.map((item) => item.code).join('\n')
  const assets = manifest.tables.find((item) => item.name === 'mci_ai_content_asset')
  const fieldNames = new Set(assets.fields.map((item) => item.name))
  for (const name of ['HasAudio', 'ArtifactHash', 'MediaInfoJson']) assert.ok(fieldNames.has(name), name)
  assert.match(source, /VideoMaster/)
  assert.match(source, /VideoClip/)
  assert.match(source, /AudioStreamCount/)
  assert.match(source, /GenerateMiniMaxSpeech/)
  assert.ok(assets.fields.find((item) => item.name === 'Speaker'))
  assert.match(source, /IntegratedLoudnessLufs/)
  assert.match(source, /<topic/)
  assert.match(source, /一个帐号一个成片/)
  assert.match(source, /artifactIdentity/)
  assert.doesNotMatch(source, /setTimeout\s*\(/)
  assert.ok(manifest.jobs.some((item) => item.JobName === 'MciAiMusicWorker'))
})

test('商城公开资源不包含第三方发布凭据或本机命令执行', async () => {
  const text = [
    await readFile(resolve(root, 'README.md'), 'utf8'),
    await readFile(resolve(root, 'MCI-DESIGN.md'), 'utf8'),
    JSON.stringify(manifest)
  ].join('\n')
  assert.doesNotMatch(text, /65d9a35b|206d625f|microi\*#2026/)
  assert.doesNotMatch(text, /Process\.Start|powershell\.exe|cmd\.exe|child_process/)
  assert.doesNotMatch(text, /AESDecrypt|DESDecode/)
})
