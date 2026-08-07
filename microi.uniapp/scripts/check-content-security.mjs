import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sdk = readFileSync(resolve(root, 'src/utils/microi.v8.js'), 'utf8')
const adapter = readFileSync(resolve(root, 'src/platform/form-record-adapter.js'), 'utf8')
const uploader = readFileSync(resolve(root, 'src/components/mci-media-uploader/mci-media-uploader.vue'), 'utf8')
const nativeField = readFileSync(resolve(root, 'src/components/mci-native-field/mci-native-field.vue'), 'utf8')
const nativeForm = readFileSync(resolve(root, 'src/pages/native-form/index.vue'), 'utf8')

assert.match(sdk, /#ifdef MP-WEIXIN[\s\S]*ContentSecurityLoginCode/)
assert.match(sdk, /\/api\/WeChatContentSecurity\/Status/)
assert.match(sdk, /mci-wechat-content-status-batch/)
assert.match(sdk, /status === 'Passed'/)
assert.match(sdk, /status === 'Rejected'[\s\S]*你发布的内容含违规信息/)
assert.ok(
  sdk.indexOf("if (!deferContentSecurity && data.ContentSecurityStatus !== 'Passed')") <
    sdk.indexOf('return { ...body, Data: data }'),
  'the public single-file contract must still wait for a passed review'
)
assert.match(sdk, /async function uploadFiles\(files, options = \{\}\)/)
assert.match(sdk, /Math\.min\(3, Math\.max\(1,/)
assert.match(sdk, /waitForContentSecurityBatch/)
assert.match(sdk, /contentSecurityPollAttempts \|\| 8/)
assert.match(sdk, /contentSecurityTimeout \|\| 25000/)
assert.match(sdk, /contentSecurityBatchAvailable = false/)
assert.match(adapter, /await attachWeChatContentSecurityLoginCode\(payload\)/)
assert.ok(
  adapter.indexOf('await attachWeChatContentSecurityLoginCode(payload)') <
    adapter.indexOf("await post('/api/SysUser/UptSysUser'"),
  'profile text check login code must be attached before the save request'
)
assert.match(uploader, /await V8\.uploadFiles\(batch,/)
assert.match(uploader, /concurrency: 3/)
assert.ok(
  uploader.indexOf("uploadState: 'queued'") < uploader.indexOf('await V8.uploadFiles(batch,'),
  'all local previews must be published before the bounded upload pool starts'
)
assert.match(uploader, /item && item\.Path && item\.uploadState !== 'checking'/)
assert.match(uploader, /\$emit\('upload-state'/)
assert.match(nativeField, /@upload-state="\$emit\('upload-state', \$event\)"/)
assert.match(nativeForm, /@upload-state="handleUploadState\(field, \$event\)"/)
assert.match(nativeForm, /pendingUploadCount > 0 \|\| failedUploadCount > 0/)

console.log('Microi UniApp WeChat content security checks passed.')
