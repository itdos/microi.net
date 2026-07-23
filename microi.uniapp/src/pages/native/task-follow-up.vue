<template>
  <mci-page-shell class="follow-up-page" :style="mciTokenStyle" title="追加评价" :subtitle="task.ShouhouFWBH || '售后服务'" @back="goBack">
    <mci-skeleton v-if="loading" type="form" :rows="5" />
    <scroll-view v-else class="page-scroll" scroll-y>
      <view class="page-content">
        <view class="task-band"><view class="task-mark"><text>评</text></view><view><text>{{ task.KehuMC || '售后服务' }}</text><text>{{ [task.Leixing, task.ShouhouRY, formatDate(task.FinishTime)].filter(Boolean).join(' · ') }}</text></view></view>
        <view class="section-title">现场照片</view>
        <view class="upload-panel"><mci-media-uploader v-model="photos" :max-count="9" upload-path="xjy/task-follow-up" /></view>
        <view class="section-title">追加内容</view>
        <view class="text-panel"><textarea v-model="content" maxlength="500" placeholder="补充本次服务体验或意见建议" /><text>{{ content.length }}/500</text></view>
        <view class="bottom-space" />
      </view>
    </scroll-view>
    <view v-if="!loading" class="bottom-bar" slot="fixed"><button class="primary-button" :loading="submitting" :disabled="submitting" @tap="submit">提交追加评价</button></view>
  </mci-page-shell>
</template>

<script>
import { themeMixin } from '@/utils/theme.js'
import { V8 } from '@/utils/request.js'
import { requireLogin } from '@/platform/business-runtime.js'

export default {
  mixins: [themeMixin],
  data() { return { id: '', task: {}, photos: '[]', content: '', loading: true, submitting: false } },
  async onLoad(options) {
    if (!requireLogin()) return
    this.id = decodeURIComponent(options.id || '')
    await this.loadTask()
  },
  methods: {
    async loadTask() {
      try {
        const result = await V8.FormEngine.GetFormData('Diy_ShouhouDD', { Id: this.id })
        if (!result || Number(result.Code) !== 1 || !result.Data) throw new Error((result && result.Msg) || '任务不存在')
        this.task = result.Data
        this.photos = result.Data.ZhuipingT || '[]'
        this.content = result.Data.ZhuipingNR || ''
      } catch (error) { uni.showToast({ title: error.message || '任务加载失败', icon: 'none' }) }
      finally { this.loading = false }
    },
    async submit() {
      if (this.submitting) return
      if (!this.content.trim() && (!this.photos || this.photos === '[]')) { uni.showToast({ title: '请填写内容或上传照片', icon: 'none' }); return }
      this.submitting = true
      try {
        const result = await V8.FormEngine.UptFormData('Diy_ShouhouDD', {
          Id: this.id, ZhuipingT: this.photos || '[]', ZhuipingNR: this.content.trim(), _InvokeType: 'Client'
        })
        if (!result || Number(result.Code) !== 1) throw new Error((result && result.Msg) || '追加评价提交失败')
        uni.$emit('xjy:task-changed', { id: this.id })
        uni.showToast({ title: '追加评价已提交', icon: 'success' })
        setTimeout(this.goBack, 800)
      } catch (error) { uni.showToast({ title: error.message || '追加评价提交失败', icon: 'none' }) }
      finally { this.submitting = false }
    },
    formatDate(value) { return value ? String(value).replace('T', ' ').slice(0, 16) : '' },
    goBack() { uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/workspace/index' }) }) }
  }
}
</script>

<style scoped>
.follow-up-page { height: 100vh; background: #f3f7f9; }.page-scroll { height: calc(100vh - 92rpx - var(--mci-safe-top) - 116rpx - var(--mci-safe-bottom)); }.page-content { padding: 18rpx 24rpx 0; }
.task-band { display: grid; grid-template-columns: 72rpx minmax(0, 1fr); gap: 17rpx; align-items: center; min-height: 120rpx; padding: 18rpx 22rpx; border: 1rpx solid #dfe9ed; border-radius: 8rpx; background: #fff; }.task-mark { display: flex; align-items: center; justify-content: center; width: 64rpx; height: 64rpx; border-radius: 50%; background: #e8f6fa; color: #087fbd; font-size: 27rpx; font-weight: 750; }.task-band > view:last-child { min-width: 0; }.task-band > view:last-child text { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.task-band > view:last-child text:first-child { color: #1d3b46; font-size: 27rpx; font-weight: 700; }.task-band > view:last-child text:last-child { margin-top: 7rpx; color: #81959c; font-size: 20rpx; }
.section-title { height: 72rpx; color: #526d78; font-size: 23rpx; font-weight: 650; line-height: 72rpx; }.upload-panel, .text-panel { padding: 22rpx; border: 1rpx solid #dfe9ed; border-radius: 8rpx; background: #fff; }.text-panel textarea { box-sizing: border-box; width: 100%; height: 250rpx; padding: 18rpx; border-radius: 6rpx; background: #f5f8f9; color: #1d3b46; font-size: 25rpx; line-height: 38rpx; }.text-panel > text { display: block; margin-top: 10rpx; color: #91a1a7; font-size: 19rpx; text-align: right; }.bottom-space { height: 30rpx; }
.bottom-bar { position: fixed; right: 0; bottom: 0; left: 0; z-index: 20; padding: 16rpx 24rpx calc(16rpx + var(--mci-safe-bottom)); border-top: 1rpx solid #dde7eb; background: rgba(255,255,255,.97); }.primary-button { height: 82rpx; margin: 0; border-radius: 8rpx; background: #087fbd; color: #fff; font-size: 27rpx; font-weight: 650; line-height: 82rpx; }.primary-button::after { border: none; }.primary-button[disabled] { background: #9dbbc7; color: #fff; }
</style>
