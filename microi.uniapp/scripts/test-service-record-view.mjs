import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  buildServiceRecordUpdatePayload,
  cloneServiceRecordEditState,
  normalizeServiceRecordSnapshots,
  serviceRecordPhotoContext
} from '../src/tenants/xjy/service-record-view.mjs'

const rows = normalizeServiceRecordSnapshots(JSON.stringify([{
  Id: 'task-1',
  ShouhouSPArr: [{
    Id: 'device-1',
    AnzhuangWZ: '1楼',
    JieguoTP: JSON.stringify([{ Path: '/private/result.jpg' }]),
    _PrivateFileContext: { JieguoTP: { FormEngineKey: 'diy_shouhousp', FormDataId: 'device-1', FieldId: 'field-1', SysMenuId: 'menu-1' } }
  }]
}]))

assert.equal(rows.length, 1)
assert.equal(rows[0].ShouhouSPArr.length, 1)
assert.deepEqual(rows[0].ShouhouSPArr[0]._photoSources, [{ Path: '/private/result.jpg' }])
assert.deepEqual(serviceRecordPhotoContext(rows[0].ShouhouSPArr[0]), {
  formEngineKey: 'diy_shouhousp', formDataId: 'device-1', fieldId: 'field-1', sysMenuId: 'menu-1', runtimeUrls: {}
})

const payload = buildServiceRecordUpdatePayload({
  recordId: 'record-1',
  updateTime: '2026-09-04 13:00:00',
  form: { KaishiSJ: '2024-01-01', JieshuSJ: '2024-12-31', TenantId: 'forged' },
  snapshots: [{
    Id: 'task-1', Leixing: '安装', FinishTime: '2024-06-07 17:17:21', ShouhouRY: '陈少文', Neirong: '完成',
    TenantId: 'forged', JieguoTP: 'forged', _PrivateFileContext: { forged: true },
    ShouhouSPArr: [{
      Id: 'device-1', AnzhuangWZ: '1楼', KehuSBID: 'forged',
      JieguoTP: JSON.stringify([{
        Id: 'photo-1', Path: 'img/result.jpg', Name: 'result.jpg', Size: 123, State: 1, ContentType: 'image/jpeg',
        Url: 'https://signed.example/private', localPath: 'wxfile://temp', forged: true
      }])
    }]
  }]
})
assert.deepEqual(payload, {
  Action: 'Update', Id: 'record-1', ExpectedUpdateTime: '2026-09-04 13:00:00',
  KaishiSJ: '2024-01-01', JieshuSJ: '2024-12-31',
  Snapshots: [{
    Id: 'task-1', Leixing: '安装', FinishTime: '2024-06-07 17:17:21', ShouhouRY: '陈少文', Neirong: '完成',
    ShouhouSPArr: [{ Id: 'device-1', AnzhuangWZ: '1楼', JieguoTP: [{
      Id: 'photo-1', Path: 'img/result.jpg', Name: 'result.jpg', Size: 123,
      CreateTime: '', State: 1, ContentType: 'image/jpeg'
    }] }]
  }]
})

const cloned = cloneServiceRecordEditState({ KaishiSJ: '2024-01-01', JieshuSJ: '2024-12-31' }, rows)
cloned.snapshots[0].ShouhouSPArr[0].AnzhuangWZ = '2楼'
assert.equal(rows[0].ShouhouSPArr[0].AnzhuangWZ, '1楼')

const businessListSource = readFileSync(new URL('../src/pages/business/list.vue', import.meta.url), 'utf8')
const relatedListSource = readFileSync(new URL('../src/components/mci-business-related-list/mci-business-related-list.vue', import.meta.url), 'utf8')
const archivePageSource = readFileSync(new URL('../src/pages/native/service-record.vue', import.meta.url), 'utf8')
const businessSource = readFileSync(new URL('../src/tenants/xjy/business.js', import.meta.url), 'utf8')
const serviceRecordsConfig = businessSource.match(/serviceRecords:\s*native\(\{([\s\S]*?)\r?\n\s*\}\),\r?\n\s*taskDevices:/)?.[1] || ''
const serviceFormsConfig = businessSource.match(/serviceForms:\s*native\(\{([\s\S]*?)\r?\n\s*\}\),\r?\n\s*filters:/)?.[1] || ''

assert.match(businessListSource, /service-record\?id=\$\{encodeURIComponent\(row\.Id\)\}&mode=view/,
  '客户服务记录表主列表必须进入完整档案查看模式')
assert.match(relatedListSource, /service-record\?id=\$\{encodeURIComponent\(row\.Id\)\}&mode=view/,
  '客户关联列表必须进入完整档案查看模式')
assert.match(serviceRecordsConfig, /table:\s*'Diy_ShouhouDD'/,
  '售后服务记录必须读取逐单售后任务表')
assert.match(serviceFormsConfig, /table:\s*'diy_ServiceRecord'/,
  '客户服务记录表必须读取汇总档案表')
assert.doesNotMatch(serviceRecordsConfig, /menuAliases:[^\n]*服务记录表/,
  '售后服务记录不得复用汇总档案菜单别名')
assert.match(serviceRecordsConfig, /menuAliases:[^\n]*售后任务/,
  '售后服务记录必须通过售后任务菜单取得真实授权上下文')
assert.ok(archivePageSource.indexOf('统计范围') < archivePageSource.indexOf('<template v-if="readOnly">'),
  '客户、日期和服务项目必须在只读档案明细上方共用显示')
assert.match(archivePageSource, /:disabled="readOnly"[^>]*:value="form\.KaishiSJ"/,
  '档案详情的来源日期只读，不能绕开后台编辑权限')
assert.match(archivePageSource, /:disabled="readOnly" @tap="toggleService/,
  '档案详情的服务项目只读，不能绕开后台编辑权限')
assert.match(archivePageSource, /this\.selectedServices\.forEach\(\(value\) =>/,
  '历史已下架服务项目仍要按档案保存值展示')
assert.match(archivePageSource, /await this\.loadServiceTypes\(\)/,
  '档案查看模式也需要加载服务选项的完整清单')
assert.match(archivePageSource, /if \(!this\.readOnly\) throw error\s+this\.serviceTypes = \[\]/,
  '字典接口失败时已保存的档案和服务项目不能被阻断')
assert.match(archivePageSource, /toggleService\(value\) \{\s+if \(this\.readOnly\) return/,
  '只读模式下即使设备意外派发点击也不能修改服务项目')

console.log('service record view tests: 21/21')
