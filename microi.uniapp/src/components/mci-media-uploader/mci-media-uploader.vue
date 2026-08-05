<template>
  <view class="mci-media-uploader">
    <view class="mci-media-uploader__grid">
      <view v-for="(item, index) in items" :key="item.Path || item.localPath || index" class="mci-media-uploader__item" :class="{ 'mci-media-uploader__item--file': mediaType === 'file', 'mci-media-uploader__item--circle': shape === 'circle' }">
        <view v-if="mediaType === 'file'" class="mci-media-uploader__file" @tap="previewFile(item)"><text class="mci-media-uploader__file-icon">文</text><text class="mci-media-uploader__file-name">{{ item.Name || item.name || fileName(item.Path) }}</text></view>
        <video v-if="mediaType === 'video' && item.url" class="mci-media-uploader__media" :src="item.url" controls @error="handleMediaError(item)"></video>
        <image v-else-if="mediaType !== 'file' && item.url" class="mci-media-uploader__media" :src="item.url" mode="aspectFill" @error="handleMediaError(item)" @tap="preview(index)" />
        <view v-else-if="mediaType !== 'file'" class="mci-media-uploader__missing"><text>{{ mediaType === 'video' ? '视频暂不可用' : '图片暂不可用' }}</text></view>
        <view v-if="!readonly" class="mci-media-uploader__remove" @tap.stop="remove(index)"><text>×</text></view>
      </view>
      <view v-if="!readonly && items.length < maxCount" class="mci-media-uploader__add" :class="{ 'mci-media-uploader__add--circle': shape === 'circle' }" hover-class="mci-media-uploader__add--pressed" @tap="choose">
        <text class="mci-media-uploader__plus">＋</text>
        <text>{{ uploading ? '上传中' : mediaType === 'video' ? '添加视频' : mediaType === 'file' ? '添加文件' : '添加照片' }}</text>
      </view>
      <text v-if="readonly && !items.length" class="mci-media-uploader__empty">-</text>
    </view>
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
  emits: ['update:modelValue', 'change'],
  data() {
    return { items: [], uploading: false, syncing: false, lastEmittedValue: null }
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
      this.uploading = true
      try {
        if (this.maxCount === 1) this.items = []
        for (const file of files) {
          const filePath = file.tempFilePath || file.path
          const result = await V8.uploadFile(filePath, {
            path: this.uploadPath || (this.mediaType === 'image' ? 'img' : 'file'),
            preview: this.mediaType === 'image',
            multiple: this.maxCount > 1,
            fileName: file.name
          })
          const data = result.Data || {}
          // 本次选择后优先使用小程序临时文件立即展示；临时路径不写入表单。
          // 保存后重新进入页面时，再按持久 Path 和记录权限获取服务端地址。
          const uploaded = await this.resolveItem({
            ...data,
            Path: data.Path,
            localPath: filePath
          }, false, true)
          this.items.push(uploaded)
        }
        this.emitValue()
      } catch (error) {
        uni.showToast({ title: (error && (error.Msg || error.message)) || '上传失败', icon: 'none' })
      } finally {
        this.uploading = false
      }
    },
    remove(index) {
      this.items.splice(index, 1)
      this.emitValue()
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
      const savedItems = this.items.map((item) => {
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
.mci-media-uploader__item,
.mci-media-uploader__add { position: relative; aspect-ratio: 1; min-width: 0; border-radius: 8px; overflow: hidden; }
.mci-media-uploader__item { background: #eaf1f3; }
.mci-media-uploader__item--circle,
.mci-media-uploader__add--circle { border-radius: 50%; }
.mci-media-uploader__item--file { grid-column: span 3; aspect-ratio: auto; min-height: 86rpx; }
.mci-media-uploader__file { height: 86rpx; display: grid; grid-template-columns: 48rpx minmax(0, 1fr); gap: 12rpx; align-items: center; padding: 0 58rpx 0 17rpx; box-sizing: border-box; }
.mci-media-uploader__file-icon { width: 42rpx; height: 48rpx; border-radius: 5rpx; color: #fff; background: #087da8; font-size: 19rpx; line-height: 48rpx; text-align: center; }
.mci-media-uploader__file-name { overflow: hidden; color: #365863; text-overflow: ellipsis; white-space: nowrap; font-size: 22rpx; }
.mci-media-uploader__media { width: 100%; height: 100%; }
.mci-media-uploader__missing { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; padding: 12rpx; box-sizing: border-box; color: #718890; background: #edf3f5; font-size: 20rpx; text-align: center; }
.mci-media-uploader__remove { position: absolute; right: 6rpx; top: 6rpx; width: 42rpx; height: 42rpx; display: flex; align-items: center; justify-content: center; border-radius: 50%; color: #fff; background: rgba(17,35,42,.72); font-size: 32rpx; line-height: 1; }
.mci-media-uploader__add { min-height: 176rpx; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8rpx; border: 1px dashed #9cb8c2; color: #607b85; background: #f7fafb; font-size: 23rpx; transition: transform .18s ease, background-color .18s ease; }
.mci-media-uploader__add--pressed { transform: scale(.97); background: #edf6f8; }
.mci-media-uploader__plus { color: var(--mci-color-primary, #0b86d4); font-size: 52rpx; line-height: 1; }
.mci-media-uploader__empty { color: #82949b; font-size: 27rpx; }
</style>
