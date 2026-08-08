<template>
  <view class="mci-media-uploader">
    <view class="mci-media-uploader__grid" :class="{ 'mci-media-uploader__grid--circle': shape === 'circle' }">
      <view v-for="(item, index) in items" :key="item.clientId || item.Path || item.localPath || index" class="mci-media-uploader__item" :class="{ 'mci-media-uploader__item--file': mediaType === 'file', 'mci-media-uploader__item--circle': shape === 'circle' }">
        <view v-if="mediaType === 'file'" class="mci-media-uploader__file" @tap="previewFile(item)"><text class="mci-media-uploader__file-icon">文</text><text class="mci-media-uploader__file-name">{{ item.Name || item.name || fileName(item.Path) }}</text></view>
        <video v-if="mediaType === 'video' && item.url" class="mci-media-uploader__media" :src="item.url" controls @error="handleMediaError(item)"></video>
        <image v-else-if="mediaType !== 'file' && item.url" class="mci-media-uploader__media" :src="item.url" mode="aspectFill" @error="handleMediaError(item)" @tap="preview(index)" />
        <view v-else-if="mediaType !== 'file'" class="mci-media-uploader__missing"><text>{{ mediaType === 'video' ? '视频暂不可用' : '图片暂不可用' }}</text></view>
        <view v-if="item.uploadState && item.uploadState !== 'passed'" class="mci-media-uploader__status" :class="'mci-media-uploader__status--' + item.uploadState">
          <text>{{ uploadStatusText(item) }}</text>
        </view>
        <view v-if="!readonly" class="mci-media-uploader__remove" @tap.stop="remove(index)"><text>×</text></view>
      </view>
      <view v-if="!readonly && items.length < maxCount" class="mci-media-uploader__add" :class="{ 'mci-media-uploader__add--circle': shape === 'circle' }" hover-class="mci-media-uploader__add--pressed" @tap="choose">
        <text class="mci-media-uploader__plus">＋</text>
        <text>{{ uploading ? '处理中' : mediaType === 'video' ? '添加视频' : mediaType === 'file' ? '添加文件' : '添加照片' }}</text>
      </view>
      <text v-if="readonly && !items.length" class="mci-media-uploader__empty">-</text>
    </view>
    <text v-if="!readonly && uploadSummary" class="mci-media-uploader__summary">{{ uploadSummary }}</text>
  </view>
</template>

<script>
import { V8 } from '@/utils/request.js'
import { normalizeUploadItems } from '@/platform/display.js'

function parseValue(value) {
  return normalizeUploadItems(value)
}

export default {
  name: 'MciMediaUploader',
  props: {
    modelValue: { type: [String, Array, Object], default: '' },
    maxCount: { type: Number, default: 9 },
    mediaType: { type: String, default: 'image' },
    uploadPath: { type: String, default: '' },
    fileContext: { type: Object, default: () => ({}) },
    readonly: { type: Boolean, default: false },
    shape: { type: String, default: 'square' }
  },
  emits: ['update:modelValue', 'change', 'upload-state'],
  data() {
    return { items: [], uploading: false, syncing: false, lastEmittedValue: null, uploadGeneration: 0, uploadSequence: 0 }
  },
  watch: {
    modelValue: {
      immediate: true,
      handler(value) {
        if (this.lastEmittedValue !== null && value === this.lastEmittedValue) {
          this.lastEmittedValue = null
          return
        }
        this.syncItems()
      }
    },
    fileContext: {
      deep: true,
      handler(value, oldValue) {
        const current = JSON.stringify(value || {})
        const previous = JSON.stringify(oldValue || {})
        if (current !== previous) this.syncItems()
      }
    }
  },
  computed: {
    uploadSummary() {
      const state = this.currentUploadState()
      if (state.pendingCount > 0) return `已通过 ${state.passedCount}/${state.totalCount}，${state.pendingCount} 张处理中`
      if (state.failedCount > 0) return `${state.failedCount} 张未完成，请删除后重试`
      return ''
    }
  },
  beforeUnmount() {
    this.uploadGeneration += 1
    this.uploading = false
    this.$emit('upload-state', { pendingCount: 0, failedCount: 0, passedCount: 0, totalCount: 0 })
  },
  methods: {
    async syncItems() {
      if (this.syncing) return
      this.syncing = true
      try {
        const rows = parseValue(this.modelValue)
        this.items = await Promise.all(rows.filter(Boolean).map((item) => this.resolveItem(item)))
      } finally {
        this.syncing = false
      }
    },
    async resolveItem(item, forceServer = false, preferProvidedUrl = false) {
      const raw = typeof item === 'string' ? { Path: item } : item
      const path = raw.Path || raw.FilePathName || raw.FilePath || raw.FullPath || raw.url || raw.Url || raw.src || ''
      const localPath = forceServer ? '' : (raw.localPath || '')
      const providedUrl = raw.Url || raw.FileUrl || raw.FileURL || raw.PreviewUrl || raw.PreviewURL || raw.FullUrl || ''
      let url = localPath || (preferProvidedUrl ? providedUrl : '')
      if (!url && path) {
        url = await V8.resolveFileUrl(
          { ...raw, Path: path, Url: '', url: '', localPath: '' },
          this.fileContext
        )
      }
      return {
        ...raw,
        Path: path,
        url: url || V8.assetUrl(path),
        localPath,
        resolving: false,
        resolveFailures: 0
      }
    },
    choose() {
      if (this.uploading) return
      if (this.mediaType === 'file') {
        const remaining = Math.max(1, this.maxCount - this.items.length)
        const done = (result) => this.uploadFiles((result.tempFiles || result.files || []).map((file) => ({ tempFilePath: file.path || file.tempFilePath, size: file.size, name: file.name })))
        if (typeof uni.chooseMessageFile === 'function') {
          uni.chooseMessageFile({ count: remaining, type: 'all', success: done })
        } else if (typeof uni.chooseFile === 'function') {
          uni.chooseFile({ count: remaining, success: done })
        } else {
          uni.showToast({ title: '当前端暂不支持文件选择', icon: 'none' })
        }
        return
      }
      if (this.mediaType === 'video') {
        uni.chooseVideo({ sourceType: ['camera', 'album'], compressed: true, success: (result) => this.uploadFiles([{ tempFilePath: result.tempFilePath, size: result.size, name: result.name }]) })
        return
      }
      const remaining = Math.max(1, this.maxCount - this.items.length)
      if (typeof uni.chooseMedia === 'function') {
        uni.chooseMedia({ count: remaining, mediaType: ['image'], sourceType: ['camera', 'album'], success: (result) => this.uploadFiles(result.tempFiles || []) })
      } else {
        uni.chooseImage({ count: remaining, sourceType: ['camera', 'album'], success: (result) => this.uploadFiles((result.tempFilePaths || []).map((path) => ({ tempFilePath: path }))) })
      }
    },
    async uploadFiles(files) {
      if (this.uploading) return
      if (this.maxCount === 1) this.items = []
      const capacity = Math.max(0, this.maxCount - this.items.length)
      const selected = (files || []).filter(Boolean).slice(0, capacity)
      if (!selected.length) return

      const generation = ++this.uploadGeneration
      const batch = selected.map((file) => {
        const filePath = file.tempFilePath || file.path || ''
        const clientId = `upload-${Date.now()}-${++this.uploadSequence}`
        this.items.push({
          clientId,
          Path: '',
          Name: file.name || this.fileName(filePath),
          localPath: filePath,
          url: filePath,
          uploadState: 'queued',
          uploadError: ''
        })
        return { ...file, filePath, clientId }
      })

      this.uploading = true
      this.emitUploadState()
      const findItemIndex = (clientId) => this.items.findIndex((item) => item.clientId === clientId)
      try {
        const outcomes = await V8.uploadFiles(batch, {
          path: this.uploadPath || (this.mediaType === 'image' ? 'img' : 'file'),
          preview: this.mediaType === 'image',
          multiple: this.maxCount > 1,
          concurrency: 3,
          resolveUrl: false,
          isCancelled: () => generation !== this.uploadGeneration,
          isItemCancelled: (index) => generation !== this.uploadGeneration || findItemIndex(batch[index].clientId) < 0,
          onItemChange: ({ Index, Status, Result, Error }) => {
            if (generation !== this.uploadGeneration || !batch[Index]) return
            const itemIndex = findItemIndex(batch[Index].clientId)
            if (itemIndex < 0) return
            const current = this.items[itemIndex]
            if (Status === 'passed' && Result && Result.Data) {
              const data = Result.Data
              this.items.splice(itemIndex, 1, {
                ...data,
                Path: data.Path,
                clientId: batch[Index].clientId,
                localPath: batch[Index].filePath,
                url: batch[Index].filePath,
                uploadState: 'passed',
                uploadError: '',
                resolving: false,
                resolveFailures: 0
              })
              this.emitValue()
            } else {
              this.items.splice(itemIndex, 1, {
                ...current,
                uploadState: Status || 'error',
                uploadError: (Error && (Error.Msg || Error.message)) || ''
              })
            }
            this.emitUploadState()
          }
        })
        const failed = outcomes.filter((item) => item && Number(item.Code) !== 1 && !(item.Error && item.Error.Cancelled))
        if (failed.length) {
          const rejected = failed.filter((item) => item.Error && item.Error.Status === 'Rejected').length
          uni.showToast({
            title: rejected > 0 ? `${rejected} 张图片未通过安全检测` : `${failed.length} 张文件处理未完成`,
            icon: 'none'
          })
        }
      } catch (error) {
        if (!(error && error.Cancelled)) {
          uni.showToast({ title: (error && (error.Msg || error.message)) || '上传失败', icon: 'none' })
        }
      } finally {
        if (generation === this.uploadGeneration) {
          this.uploading = false
          this.emitValue()
          this.emitUploadState()
        }
      }
    },
    remove(index) {
      this.items.splice(index, 1)
      this.emitValue()
      this.emitUploadState()
    },
    preview(index) {
      uni.previewImage({ current: index, urls: this.items.map((item) => item.url).filter(Boolean) })
    },
    async handleMediaError(item) {
      if (!item || item.resolving || Number(item.resolveFailures || 0) >= 1) return
      item.resolving = true
      item.resolveFailures = Number(item.resolveFailures || 0) + 1
      item.url = ''
      try {
        const refreshed = await this.resolveItem(item, true)
        item.url = refreshed.url
      } catch (error) {
        item.url = ''
      } finally {
        item.resolving = false
      }
    },
    fileName(path) { return String(path || '文件').split(/[\\/]/).pop() || '文件' },
    uploadStatusText(item) {
      const labels = {
        queued: '等待上传',
        uploading: '上传中',
        checking: '安全检测中',
        rejected: '未通过检测',
        timeout: '检测超时',
        error: '处理失败',
        cancelled: '已取消'
      }
      return labels[item.uploadState] || '处理中'
    },
    currentUploadState() {
      const pendingStates = new Set(['queued', 'uploading', 'checking'])
      const failedStates = new Set(['rejected', 'timeout', 'error'])
      const pendingCount = this.items.filter((item) => pendingStates.has(item.uploadState)).length
      const failedCount = this.items.filter((item) => failedStates.has(item.uploadState)).length
      const passedCount = this.items.filter((item) => item.Path && !pendingStates.has(item.uploadState) && !failedStates.has(item.uploadState)).length
      return { pendingCount, failedCount, passedCount, totalCount: this.items.length }
    },
    emitUploadState() {
      this.$emit('upload-state', this.currentUploadState())
    },
    previewFile(item) {
      const url = item.url || item.Url
      if (!url) return
      uni.downloadFile({
        url,
        success: (result) => {
          if (result.statusCode !== 200) return uni.showToast({ title: '文件下载失败', icon: 'none' })
          uni.openDocument({ filePath: result.tempFilePath, showMenu: true, fail: () => uni.showToast({ title: '当前文件无法预览', icon: 'none' }) })
        },
        fail: () => uni.showToast({ title: '文件下载失败', icon: 'none' })
      })
    },
    emitValue() {
      const savedItems = this.items.filter((item) => item && item.Path && item.uploadState !== 'checking' && item.uploadState !== 'uploading' && item.uploadState !== 'queued').map((item) => {
        const {
          url,
          Url,
          FileUrl,
          FileURL,
          PreviewUrl,
          PreviewURL,
          FullUrl,
          localPath,
          resolving,
          resolveFailures,
          clientId,
          uploadState,
          uploadError,
          ...saved
        } = item
        return saved
      })
      const value = this.maxCount === 1
        ? (savedItems[0] ? JSON.stringify(savedItems[0]) : '')
        : JSON.stringify(savedItems)
      this.lastEmittedValue = value
      this.$emit('update:modelValue', value)
      this.$emit('change', value)
    }
  }
}
</script>

<style scoped>
.mci-media-uploader__grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14rpx; }
.mci-media-uploader__grid--circle { grid-template-columns: minmax(0, 1fr); }
.mci-media-uploader__item,
.mci-media-uploader__add { position: relative; aspect-ratio: 1; min-width: 0; border-radius: 8px; overflow: hidden; }
.mci-media-uploader__item { background: #eaf1f3; }
.mci-media-uploader__item--circle { overflow: visible; border-radius: 50%; }
.mci-media-uploader__item--circle .mci-media-uploader__media,
.mci-media-uploader__item--circle .mci-media-uploader__missing { overflow: hidden; border-radius: 50%; }
.mci-media-uploader__add--circle { border-radius: 50%; }
.mci-media-uploader__item--file { grid-column: span 3; aspect-ratio: auto; min-height: 86rpx; }
.mci-media-uploader__file { height: 86rpx; display: grid; grid-template-columns: 48rpx minmax(0, 1fr); gap: 12rpx; align-items: center; padding: 0 58rpx 0 17rpx; box-sizing: border-box; }
.mci-media-uploader__file-icon { width: 42rpx; height: 48rpx; border-radius: 5rpx; color: #fff; background: #087da8; font-size: 19rpx; line-height: 48rpx; text-align: center; }
.mci-media-uploader__file-name { overflow: hidden; color: #365863; text-overflow: ellipsis; white-space: nowrap; font-size: 22rpx; }
.mci-media-uploader__media { width: 100%; height: 100%; }
.mci-media-uploader__missing { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; padding: 12rpx; box-sizing: border-box; color: #718890; background: #edf3f5; font-size: 20rpx; text-align: center; }
.mci-media-uploader__status { position: absolute; top: 0; right: 0; bottom: 0; left: 0; z-index: 1; display: flex; align-items: center; justify-content: center; padding: 18rpx; box-sizing: border-box; color: #fff; background: rgba(19,43,52,.62); font-size: 21rpx; font-weight: 600; text-align: center; }
.mci-media-uploader__status--rejected,
.mci-media-uploader__status--error,
.mci-media-uploader__status--timeout { background: rgba(151,48,31,.76); }
.mci-media-uploader__status--cancelled { background: rgba(72,82,87,.7); }
.mci-media-uploader__remove { position: absolute; right: 6rpx; top: 6rpx; z-index: 2; width: 42rpx; height: 42rpx; display: flex; align-items: center; justify-content: center; border-radius: 50%; color: #fff; background: rgba(17,35,42,.72); font-size: 32rpx; line-height: 1; }
.mci-media-uploader__item--circle .mci-media-uploader__remove { right: -10rpx; top: -10rpx; z-index: 2; width: 40rpx; height: 40rpx; border: 3rpx solid #fff; box-sizing: border-box; background: rgba(38, 56, 64, .88); font-size: 28rpx; box-shadow: 0 3rpx 10rpx rgba(17, 35, 42, .24); }
.mci-media-uploader__add { min-height: 176rpx; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8rpx; border: 1px dashed #9cb8c2; color: #607b85; background: #f7fafb; font-size: 23rpx; transition: transform .18s ease, background-color .18s ease; }
.mci-media-uploader__add--pressed { transform: scale(.97); background: #edf6f8; }
.mci-media-uploader__plus { color: var(--mci-color-primary, #0b86d4); font-size: 52rpx; line-height: 1; }
.mci-media-uploader__empty { color: #82949b; font-size: 27rpx; }
.mci-media-uploader__summary { display: block; margin-top: 12rpx; color: #718890; font-size: 21rpx; line-height: 30rpx; }
</style>
