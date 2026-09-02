import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const enginePath = path.join(
  projectRoot,
  'Microi-V8-Engine',
  '集福鲤平台 (api.jifulii.com)',
  'xjy.Product.Internal',
  '接口引擎',
  '投诉举报',
  '[投诉举报]用户端(xjy-complaint-user).js'
)
const manifestPath = path.join(
  projectRoot,
  'Microi-V8-Engine',
  '集福鲤平台 (api.jifulii.com)',
  'xjy.Product.Internal',
  '投诉举报中心',
  'complaint-center.manifest.json'
)
const uploaderPath = path.join(projectRoot, 'microi.uniapp', 'src', 'components', 'mci-media-uploader', 'mci-media-uploader.vue')
const detailPath = path.join(projectRoot, 'microi.uniapp', 'src', 'pages', 'complaint', 'detail.vue')
const adminEnginePath = path.join(
  projectRoot,
  'Microi-V8-Engine',
  '集福鲤平台 (api.jifulii.com)',
  'xjy.Product.Internal',
  '接口引擎',
  '投诉举报',
  '[投诉举报]管理端(xjy-complaint-admin).js'
)

const engineSource = fs.readFileSync(enginePath, 'utf8')
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
const uploaderSource = fs.readFileSync(uploaderPath, 'utf8')
const detailSource = fs.readFileSync(detailPath, 'utf8')
const adminEngineSource = fs.readFileSync(adminEnginePath, 'utf8')
const publishButtonRoot = path.join(
  projectRoot,
  'Microi-V8-Engine',
  '集福鲤平台 (api.jifulii.com)',
  'xjy.Product.Internal',
  '模块引擎',
  '投诉举报处理（01M1E47DG1MTF41VQQCAQKSQ8R）'
)
const publishRowSource = fs.readFileSync(
  path.join(publishButtonRoot, '[行]更多按钮（MoreBtns）', '审核并发布公示（01M1E4BTNPUBLISH00000000007）.js'),
  'utf8'
)
const publishRowVisibilitySource = fs.readFileSync(
  path.join(publishButtonRoot, '[行]更多按钮（MoreBtns）', '审核并发布公示_显隐判断（01M1E4BTNPUBLISH00000000007）.js'),
  'utf8'
)
const publishFormSource = fs.readFileSync(
  path.join(publishButtonRoot, '[表单]更多按钮（FormBtns）', '审核并发布公示（01M1E4BTNPUBLISHFORM0000008）.js'),
  'utf8'
)

function functionSource(name, nextName) {
  const start = engineSource.indexOf(`function ${name}(`)
  const end = engineSource.indexOf(`function ${nextName}(`, start)
  assert.notEqual(start, -1, `missing ${name}`)
  assert.notEqual(end, -1, `missing boundary ${nextName}`)
  return engineSource.slice(start, end)
}

function evidenceRuntime() {
  const context = {
    JSON,
    Math,
    Number,
    String,
    isNaN,
    now: () => '2026-09-02 10:00:00',
    V8: {
      Method: {
        NewUlid: () => '01TESTULID',
        GetPrivateFileUrl: ({ FilePathName }) => `https://signed.example/${FilePathName.replace(/^\/+/, '')}`
      }
    }
  }
  vm.createContext(context)
  vm.runInContext([
    functionSource('text', 'number'),
    functionSource('number', 'booleanValue'),
    functionSource('toArray', 'pageValue'),
    functionSource('safeJson', 'resolveEvidence'),
    functionSource('resolveEvidence', 'enumValue')
  ].join('\n'), context)
  return context
}

function adminFunctionSource(name, nextName) {
  const start = adminEngineSource.indexOf(`function ${name}(`)
  const end = adminEngineSource.indexOf(`function ${nextName}(`, start)
  assert.notEqual(start, -1, `missing admin ${name}`)
  assert.notEqual(end, -1, `missing admin boundary ${nextName}`)
  return adminEngineSource.slice(start, end)
}

function adminEvidenceRuntime() {
  const context = {
    JSON,
    Math,
    Number,
    String,
    isNaN,
    now: () => '2026-09-02 14:30:00'
  }
  vm.createContext(context)
  vm.runInContext([
    adminFunctionSource('text', 'number'),
    adminFunctionSource('number', 'toArray'),
    adminFunctionSource('toArray', 'normalizeUploadList'),
    adminFunctionSource('normalizeUploadList', 'mergeUploadList'),
    adminFunctionSource('mergeUploadList', 'ok')
  ].join('\n'), context)
  return context
}

function adminDurationRuntime() {
  const parseDateTime = (value) => {
    const timestamp = Date.parse(String(value).replace(' ', 'T'))
    if (Number.isNaN(timestamp)) throw new Error('invalid date')
    return {
      timestamp,
      CompareTo(other) { return Math.sign(timestamp - other.timestamp) },
      Subtract(other) { return { TotalHours: (timestamp - other.timestamp) / 3600000 } }
    }
  }
  const context = {
    Number,
    String,
    isNaN,
    System: {
      DateTime: { Parse: parseDateTime },
      Math: { Round: (value, digits) => Math.round(value * (10 ** digits)) / (10 ** digits) }
    }
  }
  vm.createContext(context)
  vm.runInContext([
    adminFunctionSource('number', 'toArray'),
    adminFunctionSource('hoursBetween', 'dateIsAfter'),
    adminFunctionSource('dateIsAfter', 'isOverdueResult'),
    adminFunctionSource('isOverdueResult', 'maskNo')
  ].join('\n'), context)
  return context
}

test('投诉证据只保存吾码标准上传字段', () => {
  const runtime = evidenceRuntime()
  const stored = JSON.parse(runtime.safeJson(JSON.stringify([{
    Id: '01FILE',
    Name: '现场.png',
    Size: 128,
    Path: '/xjy/img/现场.png',
    ContentType: 'image/png',
    Url: 'https://temporary.example/preview'
  }]), 9))

  assert.deepEqual(JSON.parse(JSON.stringify(stored)), [{
    Id: '01FILE',
    Name: '现场.png',
    Size: 128,
    CreateTime: '2026-09-02 10:00:00',
    Path: '/xjy/img/现场.png',
    State: 1,
    ContentType: 'image/png'
  }])
  assert.deepEqual(JSON.parse(runtime.safeJson('[{"path":"/legacy.png"}]', 9)), [])
})

test('详情响应在服务端签发私有文件临时地址', () => {
  const runtime = evidenceRuntime()
  const resolved = runtime.resolveEvidence(JSON.stringify([{
    Id: '01FILE',
    Name: '现场.png',
    Size: 128,
    Path: '/xjy/img/现场.png',
    State: 1,
    ContentType: 'image/png'
  }]))
  assert.equal(resolved[0].Url, 'https://signed.example/xjy/img/现场.png')
  assert.deepEqual(JSON.parse(JSON.stringify(runtime.resolveEvidence('[{"path":"/legacy.png"}]'))), [])
})

test('补充材料同时归档到主工单并在处理轨迹中返回可预览附件', () => {
  const runtime = evidenceRuntime()
  const stored = runtime.mergeEvidence(
    '[{"Id":"01OLD","Path":"/xjy/file/old.pdf","Name":"old.pdf"}]',
    '[{"Id":"01NEW","Path":"/xjy/file/new.jpg","Name":"new.jpg"},{"Id":"01DUP","Path":"/xjy/file/old.pdf","Name":"duplicate.pdf"}]',
    100
  )
  assert.deepEqual(JSON.parse(stored).map((item) => item.Path), ['/xjy/file/old.pdf', '/xjy/file/new.jpg'])
  assert.match(engineSource, /EvidenceFiles:\s*archivedEvidenceFiles/)
  assert.match(engineSource, /actionList\[i\]\.Attachments\s*=\s*resolveEvidence/)
  assert.match(detailSource, /class="timeline-attachments"/)
  assert.match(detailSource, /actionImages\(item\)/)
  assert.match(detailSource, /actionVideos\(item\)/)
  assert.match(detailSource, /actionFiles\(item\)/)
})

test('管理端可将轨迹附件幂等归档到投诉主表', () => {
  const runtime = adminEvidenceRuntime()
  const merged = runtime.mergeUploadList(
    '[{"Id":"01OLD","Path":"/xjy/file/original.mp4","Name":"original.mp4"}]',
    '[{"Id":"01NEW","Path":"/xjy/file/supplement.jpg","Name":"supplement.jpg"},{"Id":"01DUP","Path":"/xjy/file/original.mp4","Name":"duplicate.mp4"}]',
    100
  )
  assert.deepEqual(JSON.parse(JSON.stringify(merged)).map((item) => item.Path), [
    '/xjy/file/original.mp4',
    '/xjy/file/supplement.jpg'
  ])
  assert.match(adminEngineSource, /EvidenceFiles:\s*JSON\.stringify\(merged\)/)
  assert.match(adminEngineSource, /ActionType', '=', 'Append'/)
  assert.match(adminEngineSource, /if\(action==='SyncSupplementAttachments'\)return syncSupplementAttachments\(\)/)
})

test('后台公示由行按钮和详情表单按钮调用专用发布接口', () => {
  assert.match(publishRowSource, /DialogType:\s*'Dialog'/)
  assert.match(publishRowSource, /ApiEngineKey:\s*'xjy-complaint-admin'/)
  assert.match(publishRowSource, /Action:\s*'Publish'/)
  assert.equal(publishFormSource, publishRowSource)
})

test('审核并发布公示按钮只对符合公示条件的处理完成记录显示', () => {
  const evaluate = (form) => {
    const context = { V8: { Form: form, Result: undefined } }
    vm.runInNewContext(publishRowVisibilitySource, context)
    return context.V8.Result
  }

  assert.equal(evaluate({ PublicConsent: 1, Confidentiality: 'Normal', Status: 'Closed', PublicStatus: 'NotPublished' }), true)
  assert.equal(evaluate({ PublicConsent: 1, Confidentiality: 'Normal', Status: 'Closed', PublicStatus: 'Published' }), false)
  assert.equal(evaluate({ PublicConsent: 0, Confidentiality: 'Normal', Status: 'Closed', PublicStatus: 'Pending' }), false)
  assert.equal(evaluate({ PublicConsent: 1, Confidentiality: 'Confidential', Status: 'Closed', PublicStatus: 'Pending' }), false)
})

test('同意脱敏公示在处理完成后进入待审核，审核发布仍由主管显式执行', () => {
  assert.match(engineSource, /PublicStatus:\s*'None'/)
  assert.match(engineSource, /target === 'Closed'.*updateModel\.PublicStatus = 'Pending'/)
  assert.match(adminEngineSource, /options\.publicReview.*update\.PublicStatus = 'Pending'/s)
  assert.match(adminEngineSource, /Action\|\|'Stats'/)
  assert.match(adminEngineSource, /if\(action==='Publish'\)return publish\(\)/)
  assert.match(detailSource, /同意脱敏公示表示授权平台在办结后进行审核/)
})

test('公示响应与办结耗时使用真实里程碑计算，逾期结果与后台字段一致', () => {
  const runtime = adminDurationRuntime()
  assert.equal(runtime.hoursBetween('2026-09-02 10:02:45', '2026-09-02 13:49:15'), 3.78)
  assert.equal(runtime.hoursBetween('2026-09-02 10:02:45', '2026-09-02 13:55:01'), 3.87)
  assert.equal(runtime.hoursBetween('2026-09-02 13:55:01', '2026-09-02 10:02:45'), null)
  assert.equal(runtime.isOverdueResult({
    OverdueCount: 0,
    AcceptedAt: '2026-09-02 13:46:35',
    AcceptDeadline: '2026-09-03 10:02:45',
    FirstRepliedAt: '2026-09-02 13:49:15',
    FirstReplyDeadline: '2026-09-04 13:46:35',
    ResolvedAt: '2026-09-02 13:55:01',
    ResolveDeadline: '2026-09-07 13:46:35'
  }), 0)
  assert.equal(runtime.isOverdueResult({
    OverdueCount: 0,
    AcceptedAt: '2026-09-03 10:02:46',
    AcceptDeadline: '2026-09-03 10:02:45'
  }), 1)
  assert.match(adminEngineSource, /model\.FirstRepliedAt\|\|model\.ResolvedAt\|\|model\.ClosedAt/)
  assert.match(adminEngineSource, /IsOverdue:isOverdueResult\(model\)/)
  assert.match(detailSource, /<text>是否逾期<\/text>/)
  assert.doesNotMatch(detailSource, /<text>时限结果<\/text>/)
})

test('只读上传控件消费服务端已鉴权 URL，字段配置保持私有多文件', () => {
  assert.match(uploaderSource, /resolveItem\(item, false, this\.readonly\)/)
  assert.match(uploaderSource, /V8\.resolveFileUrl\(providedUrl, this\.fileContext\)/)

  const complaint = manifest.tables.find((item) => item.name === 'diy_complaint')
  const images = complaint.fields.find((item) => item.name === 'EvidenceImages')
  const files = complaint.fields.find((item) => item.name === 'EvidenceFiles')
  assert.deepEqual([images.config.ImgUpload.Limit, images.config.ImgUpload.Multiple, images.config.ImgUpload.MaxCount], [true, true, 9])
  assert.deepEqual([files.config.FileUpload.Limit, files.config.FileUpload.Multiple, files.config.FileUpload.MaxCount], [true, true, 5])
})
