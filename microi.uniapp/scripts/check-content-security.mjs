import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sdk = readFileSync(resolve(root, 'src/utils/microi.v8.js'), 'utf8')
const adapter = readFileSync(resolve(root, 'src/platform/form-record-adapter.js'), 'utf8')
const uploader = readFileSync(resolve(root, 'src/components/mci-media-uploader/mci-media-uploader.vue'), 'utf8')

assert.match(sdk, /#ifdef MP-WEIXIN[\s\S]*ContentSecurityLoginCode/)
assert.match(sdk, /\/api\/WeChatContentSecurity\/Status/)
assert.match(sdk, /status === 'Passed'/)
assert.match(sdk, /status === 'Rejected'[\s\S]*你发布的内容含违规信息/)
assert.ok(
  sdk.indexOf('await waitForContentSecurity(data.ContentSecurityReviewId') <
    sdk.indexOf('return { ...body, Data: data }'),
  'uploadFile must wait for a passed review before returning data to callers'
)
assert.match(adapter, /await attachWeChatContentSecurityLoginCode\(payload\)/)
assert.ok(
  adapter.indexOf('await attachWeChatContentSecurityLoginCode(payload)') <
    adapter.indexOf("await post('/api/SysUser/UptSysUser'"),
  'profile text check login code must be attached before the save request'
)
assert.ok(
  uploader.indexOf('await V8.uploadFile') < uploader.indexOf('this.items.push(uploaded)'),
  'the uploader must not publish an item before the centralized upload promise finishes'
)

console.log('Microi UniApp WeChat content security checks passed.')
