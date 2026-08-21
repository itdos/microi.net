import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { createMicroiV8 } from '../src/utils/microi.v8.js'

const detailSource = fs.readFileSync(new URL('../src/pages/task/device.vue', import.meta.url), 'utf8')
const uploaderSource = fs.readFileSync(new URL('../src/components/mci-media-uploader/mci-media-uploader.vue', import.meta.url), 'utf8')

test('已完成任务设备隐藏提交入口并切换为只读展示', () => {
  assert.match(detailSource, /isCompleted\(\) \{ return isTaskDeviceCompleted\(this\.device\) \}/)
  assert.match(detailSource, /v-if="!loading && !error && !isCompleted" class="bottom-bar"/)
  assert.match(detailSource, /v-if="!isCompleted" class="draft-action"/)
  assert.match(detailSource, /:readonly="isCompleted"/)
  assert.match(detailSource, /:disabled="isCompleted"/)
  assert.match(detailSource, /if \(this\.isCompleted \|\| this\.submitting \|\| this\.locating\) return/)
  assert.match(detailSource, /removeTaskDraft\(`device:\$\{this\.id\}`\)[\s\S]*this\.form = base/)
})

test('任务设备私有照片使用记录级字段授权上下文', () => {
  assert.match(detailSource, /prepareFileContexts\(device\)/)
  assert.match(detailSource, /formEngineKey: TASK_DEVICE_TABLE/)
  assert.match(detailSource, /formDataId: this\.id/)
  assert.match(detailSource, /sysMenuId: childMenuId/)
  assert.match(detailSource, /tableChildAuth/)
  assert.match(detailSource, /fieldId: field\.Id/)
  assert.match(detailSource, /:file-context="photoFileContext\('JieguoTP'\)"/)
})

test('私有 URL 签发失败时不回退公有文件服务器', async () => {
  assert.match(uploaderSource, /url: url \|\| ''/)
  assert.doesNotMatch(uploaderSource, /url: url \|\| V8\.assetUrl\(path\)/)

  const requests = []
  const V8 = createMicroiV8({
    apiBase: 'https://api.example.test',
    fileServer: 'https://files.example.test',
    osClient: 'demo',
    requestAdapter: async (request) => {
      requests.push(request)
      return { statusCode: 200, data: { Code: 0, Msg: '无权访问' } }
    }
  })

  const url = await V8.resolveFileUrl(
    { Path: '/demo/img/202608/private.jpg', Limit: true },
    { formEngineKey: 'demo_table', formDataId: 'row-1', fieldId: 'field-1', sysMenuId: 'menu-1' }
  )

  assert.equal(url, '')
  assert.equal(requests.length, 2)
  assert.deepEqual(requests.map((item) => item.url), [
    'https://api.example.test/api/HDFS/GetPrivateFileUrl',
    'https://api.example.test/api/HDFS/MallFileUrl'
  ])
})
