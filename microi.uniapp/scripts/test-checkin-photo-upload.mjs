import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  checkinPhotoUploadStatusText,
  createCheckinPhoto,
  getUploadedCheckinPhotoData,
  queuedCheckinPhotos,
  updateCheckinPhotoUploadState
} from '../src/platform/checkin-photo-upload.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('现场照片保留本地源并以 queued 状态进入预上传队列', () => {
  const source = { tempFilePath: 'wxfile://photo.jpg', size: 1024, file: { name: 'photo.jpg' } }
  const photo = createCheckinPhoto(source, { clientId: 'photo-1' })
  assert.equal(photo.path, 'wxfile://photo.jpg')
  assert.equal(photo.sourceFile, source)
  assert.equal(photo.uploadState, 'queued')
  assert.deepEqual(queuedCheckinPhotos([photo]), [photo])
})

test('上传成功结果按照片顺序复用，失败或未完成状态阻止提交', () => {
  const first = createCheckinPhoto({ path: 'a.jpg' }, { clientId: 'a' })
  const second = createCheckinPhoto({ path: 'b.jpg' }, { clientId: 'b' })
  updateCheckinPhotoUploadState(first, 'passed', { data: { Path: '/xjy/a.jpg' } })
  updateCheckinPhotoUploadState(second, 'checking', { data: { Path: '/xjy/b.jpg', ContentSecurityStatus: 'Pending' } })
  assert.deepEqual(getUploadedCheckinPhotoData([first, second]).map((item) => item.Path), ['/xjy/a.jpg', '/xjy/b.jpg'])
  updateCheckinPhotoUploadState(second, 'queued')
  assert.throws(() => getUploadedCheckinPhotoData([first, second]), /正在上传/)
  updateCheckinPhotoUploadState(second, 'error', { error: { Msg: '网络异常' } })
  assert.equal(checkinPhotoUploadStatusText(second), '上传失败')
  assert.throws(() => getUploadedCheckinPhotoData([first, second]), /上传失败/)
  updateCheckinPhotoUploadState(second, 'passed', { data: { Path: '/xjy/b.jpg' } })
  assert.deepEqual(getUploadedCheckinPhotoData([first, second]).map((item) => item.Path), ['/xjy/a.jpg', '/xjy/b.jpg'])
})

test('拜访打卡选择后立即调用批量上传，提交不再逐张上传', () => {
  const page = fs.readFileSync(path.join(root, 'src/pages/native/checkin.vue'), 'utf8')
  assert.match(page, /this\.addPhotosAndUpload\(files\)/)
  assert.match(page, /V8\.uploadFiles\(batch\.map/)
  assert.match(page, /concurrency:\s*2/)
  assert.match(page, /const uploaded = await this\.ensurePhotoUploadsReady\(\)/)
  assert.doesNotMatch(page, /for \(const photo of this\.photos\)/)
  assert.doesNotMatch(page, /V8\.uploadFile\(photo\.path/)
})
