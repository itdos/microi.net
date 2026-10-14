import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import {
  checkinPhotoUploadStatusText,
  createCheckinPhoto,
  getUploadedCheckinPhotoData,
  queuedCheckinPhotos,
  updateCheckinPhotoUploadState
} from '../src/platform/checkin-photo-upload.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function createPageRuntime(V8) {
  const source = fs.readFileSync(path.join(root, 'src/pages/native/checkin.vue'), 'utf8')
    .match(/<script>([\s\S]*?)<\/script>/)[1]
    .replace(/^[ \t]*import\s[\s\S]*?from\s+['"][^'"]+['"]\s*;?\r?$/gm, '')
    .replace('export default {', 'globalThis.component = {')
  const scope = {
    V8,
    uni: { showToast() {} },
    themeMixin: {},
    MciVisitTargetFields: {},
    checkinTimeLabel() {},
    checkinPhotoUploadStatusText,
    createCheckinPhoto,
    getUploadedCheckinPhotoData,
    queuedCheckinPhotos,
    updateCheckinPhotoUploadState,
    console,
    setTimeout,
    clearTimeout,
    clearInterval
  }
  vm.runInNewContext(source, scope)
  const page = scope.component.data()
  for (const [name, method] of Object.entries(scope.component.methods)) page[name] = method.bind(page)
  page.onUnload = scope.component.onUnload.bind(page)
  return page
}

const flushAsync = () => new Promise((resolve) => setImmediate(resolve))
const reviewData = (id = 'review-1') => ({
  Path: `/xjy/checkin/${id}.jpg`,
  ContentSecurityReviewId: id,
  ContentSecurityStatus: 'Pending'
})
const deferred = () => {
  let resolve
  const promise = new Promise((complete) => { resolve = complete })
  return { promise, resolve }
}

function uploadResult(data) {
  return { Code: 1, Data: data }
}

function addQueuedPhoto(page) {
  const photo = createCheckinPhoto({ path: 'wxfile://photo.jpg' }, { clientId: 'photo-1' })
  page.photos = [photo]
  return photo
}

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

test('拜访照片 Pending 后查询审核状态，Passed 解除遮罩并回写审核结果', async () => {
  let reviewCalls = 0
  const page = createPageRuntime({
    async uploadFiles() { return [uploadResult(reviewData())] },
    async waitForContentSecurityBatch(ids) {
      reviewCalls += 1
      assert.deepEqual(Array.from(ids), ['review-1'])
      return { Items: [{ ReviewId: 'review-1', Status: 'Passed' }] }
    }
  })
  const photo = addQueuedPhoto(page)
  await page.drainPhotoUploadQueue()
  await flushAsync()
  assert.equal(reviewCalls, 1)
  assert.equal(photo.uploadState, 'passed')
  assert.equal(photo.uploadedData.ContentSecurityStatus, 'Passed')
  assert.equal(getUploadedCheckinPhotoData(page.photos)[0].Path, '/xjy/checkin/review-1.jpg')
})

for (const status of ['Rejected', 'Timeout', 'Error']) {
  test(`拜访照片审核 ${status} 结束等待，显示失败并允许重试`, async () => {
    const page = createPageRuntime({
      async uploadFiles() { return [uploadResult(reviewData())] },
      async waitForContentSecurityBatch() {
        return { Items: [{ ReviewId: 'review-1', Status: status }] }
      }
    })
    const photo = addQueuedPhoto(page)
    await page.drainPhotoUploadQueue()
    await flushAsync()
    assert.equal(photo.uploadState, status.toLowerCase())
    assert.equal(page.isPhotoUploadFailed(photo), true)
    assert.ok(photo.uploadError)
    assert.throws(() => getUploadedCheckinPhotoData(page.photos), /上传失败/)
  })
}

test('拜访照片状态查询异常结束 checking，不永久保留安全校验遮罩', async () => {
  const page = createPageRuntime({
    async uploadFiles() { return [uploadResult(reviewData())] },
    async waitForContentSecurityBatch() { throw new Error('审核查询网络异常') }
  })
  const photo = addQueuedPhoto(page)
  await page.drainPhotoUploadQueue()
  await flushAsync()
  assert.equal(photo.uploadState, 'error')
  assert.match(photo.uploadError, /审核查询网络异常/)
})

test('关闭安全审核后的普通上传无需查询审核状态', async () => {
  let reviewCalls = 0
  const page = createPageRuntime({
    async uploadFiles() {
      return [uploadResult({ Path: '/xjy/checkin/plain.jpg', ContentSecurityEnabled: false })]
    },
    async waitForContentSecurityBatch() { reviewCalls += 1; throw new Error('不应查询') }
  })
  const photo = addQueuedPhoto(page)
  await page.drainPhotoUploadQueue()
  await flushAsync()
  assert.equal(reviewCalls, 0)
  assert.equal(photo.uploadState, 'passed')
})

test('重试生成新审核后，旧审核迟到结果不能覆盖新照片状态', async () => {
  const oldReview = deferred()
  const newReview = deferred()
  let uploads = 0
  const page = createPageRuntime({
    async uploadFiles() { return [uploadResult(reviewData(++uploads === 1 ? 'old-review' : 'new-review'))] },
    waitForContentSecurityBatch(ids) {
      return ids[0] === 'old-review' ? oldReview.promise : newReview.promise
    }
  })
  const photo = addQueuedPhoto(page)
  await page.drainPhotoUploadQueue()
  await flushAsync()
  assert.equal(photo.uploadState, 'checking')
  page.retryPhoto(photo.clientId)
  await flushAsync()
  assert.equal(uploads, 2)
  newReview.resolve({ Items: [{ ReviewId: 'new-review', Status: 'Passed' }] })
  await flushAsync()
  assert.equal(photo.uploadState, 'passed')
  oldReview.resolve({ Items: [{ ReviewId: 'old-review', Status: 'Rejected' }] })
  await flushAsync()
  assert.equal(photo.uploadState, 'passed')
  assert.equal(photo.uploadedData.ContentSecurityReviewId, 'new-review')
})

test('拜访页面卸载取消审核轮询，迟到结果不回写照片', async () => {
  const review = deferred()
  let pollOptions
  const page = createPageRuntime({
    async uploadFiles() { return [uploadResult(reviewData())] },
    waitForContentSecurityBatch(ids, options) { pollOptions = options; return review.promise }
  })
  const photo = addQueuedPhoto(page)
  await page.drainPhotoUploadQueue()
  await flushAsync()
  page.onUnload()
  assert.equal(pollOptions.isCancelled(), true)
  review.resolve({ Items: [{ ReviewId: 'review-1', Status: 'Passed' }] })
  await flushAsync()
  assert.equal(photo.uploadState, 'checking')
})

test('删除现场照片取消对应审核轮询，迟到结果不回写已删除照片', async () => {
  const review = deferred()
  let pollOptions
  const page = createPageRuntime({
    async uploadFiles() { return [uploadResult(reviewData())] },
    waitForContentSecurityBatch(ids, options) { pollOptions = options; return review.promise }
  })
  const photo = addQueuedPhoto(page)
  await page.drainPhotoUploadQueue()
  await flushAsync()
  page.removePhoto(0)
  assert.equal(pollOptions.isReviewCancelled('review-1'), true)
  review.resolve({ Items: [{ ReviewId: 'review-1', Status: 'Passed' }] })
  await flushAsync()
  assert.equal(page.photos.length, 0)
  assert.equal(photo.uploadState, 'checking')
})
