import assert from 'node:assert/strict'
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

console.log('service record view tests: 8/8')
