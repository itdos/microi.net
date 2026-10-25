import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { translationConfig } from '../scripts/translation-config.mjs'

test('translation rejects incomplete credentials before a network client can be created', () => {
  for (const env of [{}, { ALIBABA_CLOUD_ACCESS_KEY_ID: 'fixture-id' }, { ALIBABA_CLOUD_ACCESS_KEY_SECRET: 'fixture-secret' }]) {
    assert.throws(() => translationConfig(env), error => /翻译凭据未配置/.test(error.message) && !/fixture-/.test(error.message))
  }
})

test('translation accepts injected permanent or temporary credentials without changing endpoint', () => {
  const env = { ALIBABA_CLOUD_ACCESS_KEY_ID: ' fixture-id ', ALIBABA_CLOUD_ACCESS_KEY_SECRET: ' fixture-secret ' }
  assert.deepEqual(translationConfig(env), { accessKeyId: 'fixture-id', accessKeySecret: 'fixture-secret', endpoint: 'mt.aliyuncs.com' })
  assert.equal(translationConfig({ ...env, ALIBABA_CLOUD_SECURITY_TOKEN: ' fixture-session ' }).securityToken, 'fixture-session')
})

test('the actual translation entry cannot reintroduce embedded credentials', () => {
  const source = readFileSync(new URL('../translate.mjs', import.meta.url), 'utf8')
  // 失败诊断也不能把待检源码（可能含凭据）整体输出。
  assert.equal(/accessKey(?:Id|Secret)\s*:\s*["'][^"']+["']/.test(source), false, '翻译入口不得内嵌凭据')
  assert.match(source, /aliyun:\s*translationConfig\(\)/)
})
