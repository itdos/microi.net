import assert from 'node:assert/strict'
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
const v8Root = '../../Microi-V8-Engine/%E9%9B%86%E7%A6%8F%E9%B2%A4%E5%B9%B3%E5%8F%B0%20(api.jifulii.com)/xjy.Product.Internal/%E6%8E%A5%E5%8F%A3%E5%BC%95%E6%93%8E/%E6%9C%AA%E5%88%86%E7%B1%BB/'
const pointsEngine = read(`${v8Root}%E7%A7%AF%E5%88%86%E5%95%86%E5%9F%8E%E5%85%91%E6%8D%A2(xjy-integral-mall).js`)
const pdfEngine = read(`${v8Root}%E6%A1%88%E4%BE%8B%E5%86%8C%E5%AF%BC%E5%87%BAPDF(xjy-casebook-export-pdf).js`)
const snapshotEngine = read(`${v8Root}%E8%AE%BE%E5%A4%87IoT%E5%BF%AB%E7%85%A7(xjy-device-iot-snapshot).js`)
const callbackEngine = read(`${v8Root}%5B%E4%B8%87%E8%83%BD%E6%9D%BF%5D%E6%8E%A5%E6%94%B6%E6%95%B0%E6%8D%AE(iot-receive-universal-board-data).js`)

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
assert.match(snapshotEngine, /diy_yuelong_device/)
assert.match(snapshotEngine, /pending-binding/)
assert.match(callbackEngine, /HmacSha1Sign/)
assert.match(callbackEngine, /UnprotectApiEngineSecret/)
assert.doesNotMatch(callbackEngine, /accessKey(?:Id|Secret)\s*[:=]\s*['\"][^'\"]+['\"]/i)

console.log('xjy points, PDF and IoT contract checks passed')
