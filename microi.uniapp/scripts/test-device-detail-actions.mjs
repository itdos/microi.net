import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  canGenerateDeviceQrCode,
  createDeviceQrCodeAdapters,
  generateDeviceQrCode,
  resolveDeviceProductId,
  withDeviceActionTimeout
} from '../src/tenants/xjy/device-detail-actions.mjs'
import {
  extractQrCodePath,
  extractQrCodeValue,
  materializeQrCodeImageSource,
  resolveQrCodeImageSource
} from '../src/platform/qrcode-value.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const detailSource = fs.readFileSync(path.join(root, 'src/pages/business/detail.vue'), 'utf8')
const formExtensionSource = fs.readFileSync(path.join(root, 'src/tenants/xjy/form.js'), 'utf8')
const nativeFormSource = fs.readFileSync(path.join(root, 'src/pages/native-form/index.vue'), 'utf8')
const nativeFieldSource = fs.readFileSync(path.join(root, 'src/components/mci-native-field/mci-native-field.vue'), 'utf8')
const mediaUploaderSource = fs.readFileSync(path.join(root, 'src/components/mci-media-uploader/mci-media-uploader.vue'), 'utf8')
const rowActionsSource = fs.readFileSync(path.join(root, 'src/pages/business/utils/xjy-row-actions.js'), 'utf8')

test('设备已有商品Id时直接打开商品，不重复查询订单商品', async () => {
  let calls = 0
  const productId = await resolveDeviceProductId({ ShangpinID: 'product-1' }, async () => {
    calls += 1
    return { Code: 1, Data: { ShangpinID: 'unexpected' } }
  })
  assert.equal(productId, 'product-1')
  assert.equal(calls, 0)
})

test('设备通过订单商品关联解析商品详情Id', async () => {
  const productId = await resolveDeviceProductId({ DingdanSPID: 'order-product-1' }, async (id) => {
    assert.equal(id, 'order-product-1')
    return { Code: 1, Data: { ShangpinID: 'product-2' } }
  })
  assert.equal(productId, 'product-2')
})

test('设备商品关联缺失或失效时给出可读错误', async () => {
  await assert.rejects(() => resolveDeviceProductId({}), /未关联订单商品/)
  await assert.rejects(
    () => resolveDeviceProductId({ DingdanSPID: 'missing' }, async () => ({ Code: 2, Msg: '订单商品不存在' })),
    /订单商品不存在/
  )
  await assert.rejects(
    () => resolveDeviceProductId({ DingdanSPID: 'empty-product' }, async () => ({ Code: 1, Data: {} })),
    /未配置商品/
  )
})

test('二维码入口沿用设备列表表单的新增和编辑权限', () => {
  const menuId = 'device-menu'
  const editUser = { _RoleLimits: [{ FkId: menuId, Permission: [{ Name: 'Edit' }] }] }
  const addUser = { _RoleLimits: [{ FkId: menuId, Permission: [{ Name: 'Add' }] }] }
  assert.equal(canGenerateDeviceQrCode(menuId, { Level: 999 }, 'Edit'), false)
  assert.equal(canGenerateDeviceQrCode(menuId, { Level: 9999 }, 'Edit'), true)
  assert.equal(canGenerateDeviceQrCode(menuId, editUser, 'Edit'), true)
  assert.equal(canGenerateDeviceQrCode(menuId, editUser, 'Add'), false)
  assert.equal(canGenerateDeviceQrCode(menuId, addUser, 'Add'), true)
  assert.equal(canGenerateDeviceQrCode(menuId, addUser, 'Edit'), false)
})

test('兼容平台接口返回设备对象或历史二维码字符串', () => {
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB'
  const path = 'xjy/device-qrcode/device-1.png'
  assert.equal(extractQrCodeValue({ Code: 1, Data: { Id: 'device-1', ShebeiEWM: png } }), png)
  assert.equal(extractQrCodePath({ Code: 1, Data: { ShebeiEWMPath: path } }), path)
  assert.equal(extractQrCodeValue({ Code: 1, Data: png }), png)
  assert.equal(resolveQrCodeImageSource(png), `data:image/png;base64,${png}`)
  assert.equal(resolveQrCodeImageSource(`data:image/png;base64,${png}`), `data:image/png;base64,${png}`)
})

test('小程序二维码把 Base64 物化为本地图片路径，不把 data URL 交给 image', async () => {
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB'
  let written = null
  const source = await materializeQrCodeImageSource(`data:image/png;base64,${png}`, {
    writeBase64File: async (base64, mimeType) => {
      written = { base64, mimeType }
      return 'wxfile://usr/microi-qrcode-test.png'
    }
  })
  assert.deepEqual(written, { base64: png, mimeType: 'image/png' })
  assert.equal(source, 'wxfile://usr/microi-qrcode-test.png')
})

test('新版接口返回设备对象时直接使用已落库字段，不重复更新触发客户端事件', async () => {
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB'
  const path = 'xjy/device-qrcode/device-1.png'
  let updateCalls = 0
  const value = await generateDeviceQrCode('device-1', {
    callApiEngine: async (key, params) => {
      assert.equal(key, 'AddSBCode')
      assert.deepEqual(params, { Id: 'device-1' })
      return { Code: 1, Data: { Id: 'device-1', ShebeiEWM: png, ShebeiEWMPath: path } }
    },
    updateFormData: async () => {
      updateCalls += 1
      return { Code: 1 }
    }
  })
  assert.deepEqual(value, { ShebeiEWM: png, ShebeiEWMPath: path })
  assert.equal(updateCalls, 0)
})

test('接口直接返回 Base64 时由服务端落库，客户端不再重复更新', async () => {
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB'
  let updateCalls = 0
  const value = await generateDeviceQrCode('device-1', {
    callApiEngine: async () => ({ Code: 1, Data: png }),
    updateFormData: async () => {
      updateCalls += 1
      return { Code: 1 }
    }
  })
  assert.deepEqual(value, { ShebeiEWM: png, ShebeiEWMPath: '' })
  assert.equal(updateCalls, 0)
})

test('接口异步落库时有界回读二维码字段', async () => {
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB'
  let reads = 0
  const waits = []
  const value = await generateDeviceQrCode('device-1', {
    callApiEngine: async () => ({ Code: 1, Data: { Id: 'device-1' } }),
    getFormData: async () => {
      reads += 1
      return { Code: 1, Data: reads === 3 ? { ShebeiEWM: png } : { ShebeiEWM: '' } }
    },
    wait: async (duration) => waits.push(duration)
  })
  assert.deepEqual(value, { ShebeiEWM: png, ShebeiEWMPath: '' })
  assert.equal(reads, 3)
  assert.deepEqual(waits, [250, 700])
})

test('设备二维码严格复用旧平台 ApiEngineKey 协议并为每个请求设置超时', async () => {
  const calls = []
  const client = {
    ApiEngine: {
      RunLegacy: async (...args) => {
        calls.push(['legacy', ...args])
        return { Code: 1, Data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB' }
      }
    },
    FormEngine: {
      Request: async (...args) => {
        calls.push(['request', ...args])
        return { Code: 1, Data: { ShebeiEWM: 'qr' } }
      }
    }
  }
  const adapters = createDeviceQrCodeAdapters(client, { menuId: 'device-menu', isAdd: true })
  await adapters.callApiEngine('AddSBCode', { Id: 'device-1' })
  await adapters.getFormData('Diy_KehuSB', { Id: 'device-1', _SelectFields: ['Id', 'ShebeiEWM', 'ShebeiEWMPath'] })
  assert.equal(calls[0][0], 'legacy')
  assert.equal(calls[0][1], 'AddSBCode')
  assert.deepEqual(calls[0][2], { Id: 'device-1', SysMenuId: 'device-menu', IsAdd: true })
  assert.equal(calls[0][3].timeout, 10000)
  assert.deepEqual(calls[1].slice(0, 4), ['request', 'getformdata', 'Diy_KehuSB', { Id: 'device-1', _SelectFields: ['Id', 'ShebeiEWM', 'ShebeiEWMPath'], _SysMenuId: 'device-menu' }])
  assert.equal(calls[1][4].readUseQueryEngine, false)
})

test('设备动作即使底层 Promise 不返回也会自动解除等待', async () => {
  await assert.rejects(
    () => withDeviceActionTimeout(new Promise(() => {}), 20, '动作超时'),
    /动作超时/
  )
})

test('设备信息分组包含两个图标按钮并复用平台业务链路', () => {
  assert.match(detailSource, /section\.key === deviceActionSectionKey[\s\S]*?@tap\.stop="previewDeviceProduct"[\s\S]*?@tap\.stop="generateDeviceQrCode"/)
  assert.match(detailSource, /resolveDeviceProductId\(this\.detail[\s\S]*?Diy_DingdanSP[\s\S]*?ShangpinID/)
  assert.match(detailSource, /\/pages\/mall\/detail\?id=/)
  assert.match(detailSource, /executeBusinessRowAction\('device-qrcode'/)
  assert.match(detailSource, /device-section-action__icon--product[\s\S]*?device-section-action__icon--qrcode/)
  assert.match(detailSource, /device-section-action--pressed[\s\S]*?transform: scale\(\.97\)/)
  assert.match(detailSource, /\.device-section-action \{[\s\S]*?height: 62rpx;/)
  assert.match(detailSource, /device-section-action--preview[\s\S]*?var\(--mci-bg-muted/)
  assert.match(detailSource, /deviceActionKey === 'qrcode' \? '生成中\.\.\.'/)
  assert.doesNotMatch(detailSource, /<button class="device-section-action/)
  assert.match(detailSource, /@tap\.stop="previewDeviceProduct"/)
  assert.match(detailSource, /withDeviceActionTimeout\(resolveDeviceProductId/)
  assert.doesNotMatch(detailSource, /rowPatch[\s\S]{0,160}await this\.loadDetail\(false\)/)
  assert.match(detailSource, /selectFormTab\(tab\)[\s\S]*?this\.deviceActionKey = ''[\s\S]*?this\.activeFormTabKey = tab\.key/)
  assert.match(detailSource, /onShow\(\)[\s\S]*?this\.deviceActionKey = ''/)
  assert.match(rowActionsSource, /createDeviceQrCodeAdapters\(V8,/)
})

test('设备新增和编辑页把动作挂到永久二维码图片字段并使用原生图片预览', () => {
  assert.match(formExtensionSource, /\['Add', 'Edit'\]\.includes\(context\.mode\)[\s\S]*?name === 'shebeiewmpath'/)
  assert.match(formExtensionSource, /xjy-device-product-preview[\s\S]*?xjy-device-qrcode/)
  assert.match(formExtensionSource, /context\.draftRowId/)
  assert.match(formExtensionSource, /deviceQrCodeValues/)
  assert.doesNotMatch(formExtensionSource, /nativeComponent: 'Qrcode'/)
  assert.match(nativeFormSource, /tenantNativeField\(field\)/)
  assert.match(nativeFormSource, /tenant-field-action--compact/)
  assert.match(nativeFieldSource, /<mci-media-uploader v-if="isImage && hasModelValue"/)
  assert.match(mediaUploaderSource, /preview\(index\)[\s\S]*?uni\.previewImage/)
  assert.match(detailSource, /this\.key === 'devices' \? V8\.FormEngine\.Request\('getformdata'[\s\S]*?readUseQueryEngine: false/)
  assert.doesNotMatch(formExtensionSource, /xjy-device-qrcode[\s\S]{0,1200}uni\.showModal/)
  assert.doesNotMatch(detailSource, /generateDeviceQrCode\(\)[\s\S]{0,700}this\.confirm/)
})
