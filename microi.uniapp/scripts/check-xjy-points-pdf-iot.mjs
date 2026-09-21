import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'

function read(relativeUrl) {
  return fs.readFileSync(new URL(relativeUrl, import.meta.url), 'utf8')
}

const profile = read('../profiles/xjy/profile.cjs')
const api = read('../src/utils/api.js')
const mallIndex = read('../src/pages/mall/index.vue')
const mallDetail = read('../src/pages/mall/detail.vue')
const casebook = read('../src/pages/native/casebook.vue')
const joinForm = read('../src/components/mci-join-form/mci-join-form.vue')
const business = read('../src/tenants/xjy/business.js')
const engineRoot = '../../Microi-V8-Engine/%E9%9B%86%E7%A6%8F%E9%B2%A4%E5%B9%B3%E5%8F%B0%20(api.jifulii.com)/xjy.Product.Internal/%E6%8E%A5%E5%8F%A3%E5%BC%95%E6%93%8E/'
const businessRoot = engineRoot + '%E9%9B%86%E7%A6%8F%E9%B2%A4%E4%B8%9A%E5%8A%A1/'
const uncategorizedRoot = engineRoot + '%E6%9C%AA%E5%88%86%E7%B1%BB/'
const pointsEngine = read(businessRoot + '%E7%A7%AF%E5%88%86%E5%95%86%E5%9F%8E%E5%85%91%E6%8D%A2(xjy-integral-mall).js')
const pdfEngine = read(businessRoot + '%E6%A1%88%E4%BE%8B%E5%86%8CPDF%E5%AF%BC%E5%87%BA(xjy-casebook-export-pdf).js')
const snapshotEngine = read(businessRoot + '%E5%AE%A2%E6%88%B7%E8%AE%BE%E5%A4%87IoT%E5%BF%AB%E7%85%A7(xjy-device-iot-snapshot).js')
const callbackEngine = read(uncategorizedRoot + '%5B%E4%B8%87%E8%83%BD%E6%9D%BF%5D%E6%8E%A5%E6%94%B6%E6%95%B0%E6%8D%AE(iot-receive-universal-board-data).js')

assert.match(profile, /pointsMall:\s*true/)
assert.match(profile, /casebookPdf:\s*true/)

assert.match(api, /JifenDH/)
assert.match(api, /xjy-integral-mall/)
assert.match(api, /xjy-casebook-export-pdf/)
assert.match(mallIndex, /积分商城/)
assert.match(mallIndex, /pointsOnly:\s*this\.pointsOnly/)
assert.match(mallDetail, /RequestId:\s*this\.redeemRequestId/)
assert.match(mallDetail, /redeemTotal\s*>\s*this\.pointsBalance/)

assert.match(casebook, /wx\.env\.USER_DATA_PATH/)
assert.match(casebook, /showMenu:\s*true/)
assert.match(casebook, /URL\.createObjectURL/)
assert.match(joinForm, /SnapshotApiEngineKey/)
assert.match(joinForm, /xjy-device-iot-snapshot|snapshotApiEngineKey/)
assert.match(business, /table:\s*'diy_integral_ledger'/)

assert.match(pointsEngine, /FOR UPDATE/)
assert.match(pointsEngine, /RequestId/)
assert.match(pointsEngine, /IntegralExchangeRefund/)
assert.match(pointsEngine, /diy_integral_ledger/)
assert.match(pdfEngine, /%PDF-1\.4/)
assert.match(pdfEngine, /Version:\s*v1\.1\.6/)
assert.match(pdfEngine, /V8\.Image\.Create/)
assert.match(pdfEngine, /V8\.Image\.Overlay/)
assert.match(pdfEngine, /V8\.Image\.Resize/)
assert.match(pdfEngine, /BRAND_LOGO_BASE64/)
assert.match(pdfEngine, /新纪源 · 新商净/)
assert.doesNotMatch(pdfEngine, /872, 66, 286, 96, '#d92d20'/)
assert.match(pdfEngine, /'客户名称'/)
assert.match(pdfEngine, /'所属城市'/)
assert.match(pdfEngine, /'XDRINKTEK  COOPERATIVE  CASE'/)
assert.match(pdfEngine, /'合作时间'/)
assert.match(pdfEngine, /'合作内容'/)
assert.match(pdfEngine, /'客户评价'/)
assert.match(pdfEngine, /'数据证明'/)
assert.doesNotMatch(pdfEngine, /PROJECT SNAPSHOT/)
assert.match(pdfEngine, /addContentCard/)
assert.doesNotMatch(pdfEngine, /function addMetric/)
assert.match(pdfEngine, /KehuALZP/)
assert.match(pdfEngine, /\/ASCIIHexDecode \/DCTDecode/)
assert.match(pdfEngine, /MAX_CASE_COUNT/)
assert.match(pdfEngine, /MAX_PHOTO_COUNT\s*=\s*6/)
assert.match(pdfEngine, /photoBase64List\.length === 4 \? 2 : 3/)
assert.match(pdfEngine, /OverviewLines:\s*overviewLines/)
assert.match(pdfEngine, /TitleY:\s*titleY/)
assert.match(pdfEngine, /function createCasePage/)
assert.match(pdfEngine, /\/\/ zhy：/)
assert.match(snapshotEngine, /diy_yuelong_device/)
assert.match(snapshotEngine, /pending-binding/)
assert.match(callbackEngine, /HmacSha1Sign/)
assert.match(callbackEngine, /UnprotectApiEngineSecret/)
assert.doesNotMatch(callbackEngine, /accessKey(?:Id|Secret)\s*[:=]\s*['\"][^'\"]+['\"]/i)

const onePixelJpeg = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAEf/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9oADAMBAAIAAwAAABCf/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPxB//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPxB//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxB//9k='
const counters = { create: 0, overlay: 0, resize: 0, privateUrl: 0, download: 0, createdTexts: [] }
const bookId = '11111111-1111-1111-1111-111111111111'
const V8 = {
  Param: { BookId: bookId },
  OsClient: 'xjy',
  SysConfig: { FileServer: 'https://public-files.example.test/' },
  CurrentUser: { Id: 'user-1', TenantId: 'tenant-1', TenantName: '测试商家', Level: 1 },
  FormEngine: {
    GetFormData() {
      return {
        Code: 1,
        Data: {
          Id: bookId,
          AnliCMC: '自动化案例册',
          TenantId: 'tenant-1',
          TenantName: '测试商家',
          UserId: 'user-1',
          UserName: '测试人员'
        }
      }
    },
    GetTableData() {
      return {
        Code: 1,
        Data: [
          {
            Id: 'case-1',
            Biaoti: '第一个客户案例',
            KehuMC: '客户甲',
            KehuLX: '央企',
            Chengshi: '宁波',
            HezuoSJ: '2026-09',
            HezuoNR: '商用饮水设备安装与维护',
            KehuPJ: '运行稳定，服务及时',
            ShujuZM: '能耗与水效达到预期',
            KehuALZP: JSON.stringify(Array.from({ length: 7 }, (_, index) => ({ Path: `/private/case-${index + 1}.jpg` })))
          },
          {
            Id: 'case-2',
            Biaoti: '第二个客户案例',
            KehuMC: '客户乙',
            Chengshi: '杭州',
            HezuoSJ: '2026-08'
          }
        ]
      }
    }
  },
  Method: {
    GetPrivateFileUrl() {
      counters.privateUrl += 1
      return { Code: 1, Data: { Url: 'https://files.example.test/signed/case-1.jpg' } }
    }
  },
  Http: {
    GetResponse({ Url }) {
      counters.download += 1
      if (Url.includes('/signed/')) return { StatusCode: 403, RawBytes: null }
      return { StatusCode: 200, RawBytes: Buffer.from(onePixelJpeg, 'base64') }
    }
  },
  Image: {
    Create(options) {
      counters.create += 1
      counters.createdTexts.push(...(options.Elements || []).filter((item) => item.Type === 'text').map((item) => item.Text))
      return { Code: 1, Data: { FileByteBase64: onePixelJpeg } }
    },
    Convert() {
      return { Code: 1, Data: { FileByteBase64: onePixelJpeg } }
    },
    Resize() {
      counters.resize += 1
      return { Code: 1, Data: { FileByteBase64: onePixelJpeg } }
    },
    Overlay() {
      counters.overlay += 1
      return { Code: 1, Data: { FileByteBase64: onePixelJpeg } }
    }
  },
  Base64: {
    StringToBase64(value) {
      return Buffer.from(value, 'ascii').toString('base64')
    }
  },
  EncryptHelper: {
    Sha256Hex(value) {
      return crypto.createHash('sha256').update(value, 'ascii').digest('hex')
    }
  }
}
const System = {
  Convert: {
    FromBase64String(value) {
      return Buffer.from(value, 'base64')
    },
    ToBase64String(value) {
      return Buffer.from(value).toString('base64')
    }
  }
}
const runPdfEngine = new Function('V8', 'DateNow', 'System', pdfEngine)
const pdfResult = runPdfEngine(V8, () => '2026-09-20', System)
assert.equal(pdfResult.Code, 1)
assert.equal(pdfResult.Data.CaseCount, 2)
assert.equal(pdfResult.Data.PageCount, 2)
assert.equal(pdfResult.Data.ImageWarningCount, 0)
assert.equal(counters.create, 2)
assert.equal(counters.overlay, 2)
assert.equal(counters.resize, 6)
assert.equal(counters.privateUrl, 6)
assert.equal(counters.download, 12)
assert.ok(counters.createdTexts.includes('央企'))
assert.ok(counters.createdTexts.includes('自动化案例册'))
assert.ok(counters.createdTexts.includes('案例图片 · 共 7 张，展示前 6 张'))
assert.ok(!counters.createdTexts.includes('标题'))
assert.ok(!counters.createdTexts.includes('客户概括'))
assert.ok(!counters.createdTexts.includes('客户类型'))
assert.ok(counters.createdTexts.includes('1 / 2'))
assert.ok(counters.createdTexts.includes('2 / 2'))
assert.ok(!counters.createdTexts.some((text) => String(text).includes('集福鲤平台生成')))

const decodedPdf = Buffer.from(pdfResult.Data.FileByteBase64, 'base64').toString('ascii')
assert.ok(decodedPdf.startsWith('%PDF-1.4'))
assert.match(decodedPdf, /\/Count 2\b/)
assert.equal((decodedPdf.match(/\/Type \/Page\b/g) || []).length, 2)
assert.equal((decodedPdf.match(/\/Subtype \/Image\b/g) || []).length, 2)
assert.equal((decodedPdf.match(/\/ASCIIHexDecode \/DCTDecode/g) || []).length, 2)

console.log('xjy points, PDF and IoT contract checks passed')
