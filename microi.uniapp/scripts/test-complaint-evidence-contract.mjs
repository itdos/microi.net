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

const engineSource = fs.readFileSync(enginePath, 'utf8')
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
const uploaderSource = fs.readFileSync(uploaderPath, 'utf8')

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

test('只读上传控件消费服务端已鉴权 URL，字段配置保持私有多文件', () => {
  assert.match(uploaderSource, /resolveItem\(item, false, this\.readonly\)/)
  assert.match(uploaderSource, /V8\.resolveFileUrl\(providedUrl, this\.fileContext\)/)

  const complaint = manifest.tables.find((item) => item.name === 'diy_complaint')
  const images = complaint.fields.find((item) => item.name === 'EvidenceImages')
  const files = complaint.fields.find((item) => item.name === 'EvidenceFiles')
  assert.deepEqual([images.config.ImgUpload.Limit, images.config.ImgUpload.Multiple, images.config.ImgUpload.MaxCount], [true, true, 9])
  assert.deepEqual([files.config.FileUpload.Limit, files.config.FileUpload.Multiple, files.config.FileUpload.MaxCount], [true, true, 5])
})
