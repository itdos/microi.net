import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import { createMicroiV8 } from '../src/utils/microi.v8.js'

// 执行实际组件方法与 SDK，网络边界由可计数适配器替换，避免修改业务记录。
function component(file, globals = {}) {
  const source = fs.readFileSync(new URL(file, import.meta.url), 'utf8')
  const script = source.match(/<script>([\s\S]*?)<\/script>/)[1]
    .replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"]\s*/g, '')
    .replace('export default', 'globalThis.component =')
  const sandbox = { ...globals }
  vm.runInNewContext(script, sandbox)
  return sandbox.component
}

const context = { formEngineKey: 'partners', formDataId: 'row', fieldId: 'photo', sysMenuId: 'menu', private: false }
const path = '/tenant/img/photo.jpg'

test('单图控件遵循嵌套 Multiple 与 MaxCount 配置', () => {
  const field = component('../src/components/mci-native-field/mci-native-field.vue')
  const count = config => field.computed.mediaMaxCount.call({ isAvatar: false, isImage: true, isFile: false, field: { config } })
  assert.equal(count({ ImgUpload: { Multiple: false, MaxCount: 10 } }), 1)
  assert.equal(count({ ImgUpload: { Multiple: 'true', MaxCount: 4 } }), 4)
  assert.equal(count({ ImgUpload: { Multiple: 1, MaxCount: 2 } }), 2)
})

test('平台历史公有单图直接取 CDN，不误签私有地址', async () => {
  let requests = 0
  const client = createMicroiV8({ fileServer: 'https://cdn.example.test', requestAdapter: async () => { requests++; return { data: { Code: 0 } } } })
  assert.equal(await client.resolveFileUrl({ Path: path, State: 1 }, context), `https://cdn.example.test${path}`)
  assert.equal(requests, 0)
})

test('字段取址上下文包含真实公私策略和记录授权信息', () => {
  const field = component('../src/components/mci-native-field/mci-native-field.vue', { parseJson: (raw, fallback) => { try { return JSON.parse(raw) } catch { return fallback } } })
  const access = config => field.computed.fileAccessContext.call({
    field: { Id: 'photo', config }, isImage: true, modelValue: '', tableName: 'partners',
    formDataId: 'row', menuId: 'menu', formData: {}
  })
  assert.equal(access({ ImgUpload: { Limit: false } }).private, false)
  assert.equal(access({ ImgUpload: { Limit: '1' } }).private, true)
  assert.equal(access({ ImgUpload: { Limit: false, EnableRolePermission: 'false' } }).private, false)
  assert.equal(access({ ImgUpload: { Limit: false, EnableRolePermission: true } }).private, true)
  assert.equal(access({}).private, undefined)
  assert.equal(access({ ImgUpload: { Limit: false } }).sysMenuId, 'menu')
  assert.equal(access({ ImgUpload: { Limit: false } }).formDataId, 'row')
})

test('历史私有照片优先于公有字段配置，签发失败不降级公有', async () => {
  let requests = 0
  const client = createMicroiV8({ apiBase: 'https://api.example.test', fileServer: 'https://cdn.example.test', requestAdapter: async () => { requests++; return { data: { Code: 0 } } } })
  assert.equal(await client.resolveFileUrl({ Path: path, Limit: true }, context), '')
  assert.equal(requests, 1)
  assert.equal(await client.resolveFileUrl({ Path: path, Limit: '1' }, { private: false }), '')
  assert.equal(requests, 1, '缺少记录上下文不能发起签名')
})

test('私有字段不能因照片公有标记跳过鉴权', async () => {
  const client = createMicroiV8({ fileServer: 'https://cdn.example.test' })
  assert.equal(await client.resolveFileUrl({ Path: path, Limit: false }, { private: true }), '')
})

test('上传透传字段公有策略，保存单图对象与实际 Limit，剔除临时 URL', async () => {
  let uploadOptions
  const uploader = component('../src/components/mci-media-uploader/mci-media-uploader.vue', {
    V8: { uploadFiles: async (batch, options) => {
      uploadOptions = options
      options.onItemChange({ Index: 0, Status: 'passed', Result: { Data: { Path: path, Id: 'file', Limit: false, Url: 'https://temporary.example.test/signed' } } })
      return [{ Code: 1 }]
    } }, uni: { showToast() {} }
  })
  const events = []
  const instance = { ...uploader.data(), maxCount: 1, mediaType: 'image', uploadPath: 'img', effectiveUploadContext: context, $emit: (name, value) => events.push({ name, value }) }
  Object.entries(uploader.methods).forEach(([name, fn]) => { instance[name] = fn.bind(instance) })
  await instance.uploadFiles([{ tempFilePath: 'wxfile://local.jpg' }])
  assert.equal(uploadOptions.limit, false)
  assert.equal(uploadOptions.multiple, false)
  assert.equal(uploadOptions.formFieldContext, context)
  const saved = JSON.parse(events.filter(e => e.name === 'update:modelValue').at(-1).value)
  assert.equal(Array.isArray(saved), false)
  assert.equal(saved.Path, path)
  assert.equal(saved.Limit, false)
  assert.equal(saved.Url, undefined)
  assert.equal(saved.localPath, undefined)
})
