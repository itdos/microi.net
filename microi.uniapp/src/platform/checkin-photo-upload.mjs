const PENDING_STATES = new Set(['queued', 'uploading', 'checking'])
const FAILED_STATES = new Set(['error', 'rejected', 'timeout', 'cancelled'])

function toText(value) {
  return value === null || value === undefined ? '' : String(value).trim()
}

export function createCheckinPhoto(file = {}, options = {}) {
  const path = toText(file.tempFilePath || file.path || options.path)
  return {
    clientId: toText(options.clientId),
    path,
    size: Number(file.size || options.size || 0),
    watermarked: options.watermarked === true || file.watermarked === true,
    sourceFile: file,
    uploadState: 'queued',
    uploadError: '',
    uploadedData: null
  }
}

export function queuedCheckinPhotos(photos = []) {
  return photos.filter((photo) => photo && photo.path && photo.uploadState === 'queued')
}

export function updateCheckinPhotoUploadState(photo, status, payload = {}) {
  if (!photo) return photo
  const normalizedStatus = toText(status).toLowerCase() || 'error'
  photo.uploadState = normalizedStatus
  if (normalizedStatus === 'passed' || normalizedStatus === 'checking') {
    photo.uploadedData = payload.data || payload.Data || photo.uploadedData
    photo.uploadError = ''
  } else if (PENDING_STATES.has(normalizedStatus)) {
    photo.uploadError = ''
  } else {
    const error = payload.error || payload.Error || payload
    photo.uploadError = toText(error && (error.Msg || error.message)) || '照片上传失败'
  }
  return photo
}

export function checkinPhotoUploadStatusText(photo) {
  const state = toText(photo && photo.uploadState).toLowerCase()
  if (state === 'queued') return '等待上传'
  if (state === 'uploading') return '正在上传'
  if (state === 'checking') return '安全检测中'
  if (state === 'passed') return '已上传'
  if (state === 'rejected') return '未通过检测'
  if (state === 'timeout') return '检测超时'
  if (state === 'cancelled') return '已取消'
  return '上传失败'
}

export function getUploadedCheckinPhotoData(photos = []) {
  const pending = photos.filter((photo) => photo && ['queued', 'uploading'].includes(toText(photo.uploadState).toLowerCase()))
  if (pending.length) throw new Error(`还有 ${pending.length} 张照片正在上传，请稍候`)

  const failed = photos.filter((photo) => photo && FAILED_STATES.has(toText(photo.uploadState).toLowerCase()))
  if (failed.length) throw new Error(`有 ${failed.length} 张照片上传失败，请重试或删除后再提交`)

  const missing = photos.filter((photo) => photo && (!photo.uploadedData || !photo.uploadedData.Path))
  if (missing.length) throw new Error(`有 ${missing.length} 张照片尚未完成上传，请重试`)
  return photos.map((photo) => photo.uploadedData)
}
