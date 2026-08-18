<template>
  <mci-page-shell class="device-page" :style="mciTokenStyle" title="设备处理" :subtitle="device.ShebeiBH || device.ShebeiXH || ''" @back="goBack">
    <template #right><view class="draft-action" hover-class="draft-action--pressed" @tap="saveDraft"><text>存草稿</text></view></template>

    <mci-skeleton v-if="loading" type="form" :rows="8" />
    <view v-else-if="error" class="error-state"><text class="error-state__title">设备任务加载失败</text><text class="error-state__text">{{ error }}</text><view class="error-state__button" @tap="loadDevice"><text>重新加载</text></view></view>

    <scroll-view v-else class="device-scroll" scroll-y>
      <view v-if="draftRestored" class="draft-tip"><view><text class="draft-tip__title">已恢复未提交草稿</text><text class="draft-tip__time">{{ draftTime }}</text></view><view @tap="discardDraft"><text>放弃草稿</text></view></view>

      <view class="device-summary">
        <image src="/static/xjy/business/shebei.png" mode="aspectFit" />
        <view class="device-summary__copy"><text class="device-summary__name">{{ device.ShebeiMC || device.ShangpinMC || '服务设备' }}</text><text class="device-summary__meta">{{ [device.ShebeiXH, device.ShebeiBH].filter(Boolean).join(' · ') || '暂无型号和编号' }}</text><text class="device-summary__position">{{ form.AnzhuangWZ || '暂未维护安装位置' }}</text></view>
        <text class="device-summary__status" :class="{ complete: device.FuwuZT === '已完成' }">{{ device.FuwuZT || '未完成' }}</text>
      </view>

      <view class="section-band">
        <view class="section-heading" hover-class="section-heading--pressed" @tap="toggleSection('result')"><view class="section-heading__accent"></view><text>处理结果</text><text class="section-heading__hint">选填</text><view class="section-heading__chevron" :class="{ open: sectionOpen.result }"></view></view>
        <view v-show="sectionOpen.result" class="section-body">
          <textarea v-model="form.ChuliJG" class="result-textarea" maxlength="1500" placeholder="请记录故障现象、处理过程、处理结果和后续建议" />
          <view class="word-count"><text>{{ form.ChuliJG.length }}/1500</text></view>
        </view>
      </view>

      <view class="section-band">
        <view class="section-heading" hover-class="section-heading--pressed" @tap="toggleSection('resultPhotos')"><view class="section-heading__accent"></view><text>结果照片</text><text class="section-heading__hint">支持水印相机和相册</text><view class="section-heading__chevron" :class="{ open: sectionOpen.resultPhotos }"></view></view>
        <view v-show="sectionOpen.resultPhotos" class="section-body">
          <view class="upload-block"><mci-media-uploader v-model="form.JieguoTP" :max-count="9" :upload-path="uploadPath('result')" /></view>
          <view class="watermark-command" hover-class="watermark-command--pressed" @tap="openWatermark('JieguoTP')"><image src="/static/xjy/watermarkCamera/camera.png" mode="aspectFit" /><text>拍摄带时间、客户和位置水印的照片</text><text>›</text></view>
        </view>
      </view>

      <view v-if="isInstall" class="section-band">
        <view class="section-heading" hover-class="section-heading--pressed" @tap="toggleSection('installPhotos')"><view class="section-heading__accent"></view><text>安装验收照片</text><text class="section-heading__hint">按类别留档</text><view class="section-heading__chevron" :class="{ open: sectionOpen.installPhotos }"></view></view>
        <view v-show="sectionOpen.installPhotos" class="section-body">
          <view v-for="photo in installPhotoFields" :key="photo.name" class="photo-category">
            <view class="photo-category__heading"><text>{{ photo.label }}</text><text>{{ photoDescription(photo.name) }}</text></view>
            <mci-media-uploader v-model="form[photo.name]" :max-count="photo.max" :upload-path="uploadPath(photo.name)" />
          </view>
        </view>
      </view>

      <view class="section-band">
        <view class="section-heading" hover-class="section-heading--pressed" @tap="toggleSection('scene')"><view class="section-heading__accent"></view><text>现场补充</text><text class="section-heading__hint">位置、图片与视频</text><view class="section-heading__chevron" :class="{ open: sectionOpen.scene }"></view></view>
        <view v-show="sectionOpen.scene" class="section-body">
          <view class="site-field">
            <view class="site-field__heading">
              <text>安装位置</text>
              <view class="site-field__location" :class="{ disabled: locating }" hover-class="site-field__location--pressed" @tap="locateDevice">
                <image src="/static/xjy/business/dw.png" mode="aspectFit" />
                <text>{{ locating ? '定位中…' : '现场定位' }}</text>
              </view>
            </view>
            <input v-model.trim="form.AnzhuangWZ" maxlength="200" confirm-type="done" placeholder="定位后可补充楼层、房间或点位" />
            <text v-if="hasDeviceCoordinates" class="site-field__location-tip">已保存坐标，可继续修改补充安装位置文字</text>
          </view>
          <view class="photo-category"><view class="photo-category__heading"><text>现场环境照片</text><text>展示设备周边与施工环境</text></view><mci-media-uploader v-model="form.XianchangZP" :max-count="6" :upload-path="uploadPath('scene')" /></view>
          <view class="photo-category"><view class="photo-category__heading"><text>服务视频</text><text>建议控制时长，降低上传等待</text></view><mci-media-uploader v-model="form.ShipinSC" media-type="video" :max-count="3" :upload-path="uploadPath('video')" /></view>
        </view>
      </view>

      <view class="section-band">
        <view class="section-heading" hover-class="section-heading--pressed" @tap="toggleSection('equipment')"><view class="section-heading__accent"></view><text>设备与耗材</text><text class="section-heading__hint"></text><view class="section-heading__chevron" :class="{ open: sectionOpen.equipment }"></view></view>
        <view v-show="sectionOpen.equipment" class="section-body">
          <view class="info-row"><text>订单编号</text><text>{{ device.DingdanBH || '-' }}</text></view>
          <view class="info-row"><text>设备状态</text><text>{{ device.ShebeiZT || '-' }}</text></view>
          <view class="info-row"><text>服务类型</text><text>{{ taskType || device.Leixing || '-' }}</text></view>
          <view class="section-command" hover-class="section-command--pressed" @tap="openConsumables"><image src="/static/xjy/business/lvxin.png" mode="aspectFit" /><view><text>查看与维护设备耗材</text><text>滤芯型号、级数、周期、价格与优惠</text></view><text>›</text></view>
        </view>
      </view>

      <view class="quality-note"><view></view><text>提交后该设备将标记为已完成，并同步结果照片和安装分类照片到客户设备档案。</text></view>
      <view class="device-spacer"></view>
    </scroll-view>

    <view v-if="!loading && !error" class="bottom-bar"><view class="bottom-button bottom-button--plain" hover-class="bottom-button--pressed" @tap="saveDraft"><text>保存草稿</text></view><view class="bottom-button bottom-button--primary" :class="{ disabled: submitting }" hover-class="bottom-button--pressed" @tap="submit"><text>{{ submitting ? '正在提交' : '完成并提交' }}</text></view></view>
  </mci-page-shell>
</template>

<script>
import { themeMixin } from '@/utils/theme.js'
import { V8 } from '@/utils/request.js'
import { normalizeChosenLocation, reverseGeocode } from '@/platform/location.js'
import {
  TASK_PHOTO_FIELDS,
  loadTaskDeviceDetail,
  readTaskDraft,
  removeTaskDraft,
  saveTaskDevice,
  writeTaskDraft
} from '@/utils/xjy-task.js'

const FORM_FIELDS = ['ChuliJG', 'AnzhuangWZ', 'KehuSB_Lat', 'KehuSB_Lng', 'JieguoTP', 'ShipinSC', 'ZhengmianZP', 'farZP', 'LvxinZP', 'GuanluZP', 'MingpaiCSZP', 'TiaoxingMZP', 'JixieBHZP', 'XianchangZP']
const TEXT_FIELDS = ['ChuliJG', 'AnzhuangWZ', 'KehuSB_Lat', 'KehuSB_Lng']
const emptyFormValue = (field) => TEXT_FIELDS.includes(field) ? '' : '[]'
const AMAP_REVERSE_GEOCODE_ENGINE = 'xjy-amap-regeo'

function requestChosenLocation() {
  return new Promise((resolve, reject) => {
    uni.chooseLocation({ success: resolve, fail: reject })
  })
}

function validCoordinatePair(latitude, longitude) {
  const lat = Number(latitude)
  const lng = Number(longitude)
  return Number.isFinite(lat) && lat >= -90 && lat <= 90 &&
    Number.isFinite(lng) && lng >= -180 && lng <= 180 &&
    !(lat === 0 && lng === 0)
}

export default {
  mixins: [themeMixin],
  data() {
    return {
      id: '', taskId: '', taskType: '', device: {}, form: {}, loading: true, submitting: false, locating: false,
      error: '', draftRestored: false, draftSavedAt: 0, pendingWatermarkField: '',
      locationUpdated: false,
      sectionOpen: { result: true, resultPhotos: true, installPhotos: true, scene: true, equipment: true }
    }
  },
  computed: {
    isInstall() { return /安装/.test(this.taskType || this.device.Leixing || '') },
    installPhotoFields() { return TASK_PHOTO_FIELDS.filter((item) => !['JieguoTP', 'XianchangZP'].includes(item.name)) },
    draftTime() { return this.draftSavedAt ? `保存于 ${new Date(this.draftSavedAt).toLocaleString()}` : '' },
    hasDeviceCoordinates() { return validCoordinatePair(this.form.KehuSB_Lat, this.form.KehuSB_Lng) }
  },
  onLoad(options) {
    this.id = decodeURIComponent(options.id || '')
    this.taskId = decodeURIComponent(options.taskId || '')
    this.taskType = decodeURIComponent(options.taskType || '')
    this.initializeForm()
    this.loadDevice()
  },
  methods: {
    initializeForm() { const form = {}; FORM_FIELDS.forEach((field) => { form[field] = emptyFormValue(field) }); this.form = form },
    toggleSection(name) { this.sectionOpen[name] = !this.sectionOpen[name] },
    async loadDevice() {
      if (!this.id) { this.error = '缺少售后设备编号'; this.loading = false; return }
      this.loading = true; this.error = ''
      try {
        const device = await loadTaskDeviceDetail(this.id)
        this.device = device
        const base = {}; FORM_FIELDS.forEach((field) => { base[field] = device[field] || emptyFormValue(field) })
        const draft = readTaskDraft(`device:${this.id}`)
        if (draft && draft.savedAt) {
          this.form = { ...base, ...(draft.form || {}) }
          this.locationUpdated = draft.locationUpdated === true
          this.draftRestored = true
          this.draftSavedAt = draft.savedAt
        } else this.form = base
      } catch (error) { this.error = error.message || '设备任务加载失败' } finally { this.loading = false }
    },
    uploadPath(kind) { return `xjy/task-device/${String(this.taskId || 'task')}/${String(this.device.ShebeiBH || this.id)}/${kind}` },
    photoDescription(name) {
      const map = { ZhengmianZP: '完整展示设备正面', farZP: '展示设备与安装环境', LvxinZP: '滤芯安装与标签清晰可见', GuanluZP: '进出水及排水管路', MingpaiCSZP: '设备铭牌和参数', TiaoxingMZP: '条形码完整清晰', JixieBHZP: '机械编号完整清晰' }
      return map[name] || '按现场实际情况拍摄'
    },
    openWatermark(field) {
      this.pendingWatermarkField = field
      const query = `customer=${encodeURIComponent(this.device.KehuMC || '')}&address=${encodeURIComponent(this.form.AnzhuangWZ || this.device.AnzhuangWZ || '')}`
      uni.navigateTo({
        url: `/pages/native/watermark-camera?${query}`,
        success: (result) => {
          if (!result.eventChannel) return
          result.eventChannel.on('watermarkCaptured', async (data) => {
            if (!data || !data.path) return
            try {
              const upload = await V8.uploadFile(data.path, { path: this.uploadPath('watermark'), preview: true })
              const current = this.parseUpload(this.form[this.pendingWatermarkField])
              current.push(upload.Data)
              this.form[this.pendingWatermarkField] = JSON.stringify(current)
            } catch (error) { uni.showToast({ title: error.message || '水印照片上传失败', icon: 'none' }) }
          })
        }
      })
    },
    parseUpload(value) { if (!value) return []; if (Array.isArray(value)) return value; try { const rows = JSON.parse(value); return Array.isArray(rows) ? rows : [rows] } catch (error) { return [] } },
    async locateDevice() {
      if (this.locating) return
      this.locating = true
      try {
        const source = await requestChosenLocation()
        let geocode = null
        try {
          geocode = await reverseGeocode(source.longitude, source.latitude, {
            apiEngineKey: AMAP_REVERSE_GEOCODE_ENGINE
          })
        } catch (error) {
          // 微信地图选点已包含地址时，逆地理编码失败不阻断现场提交。
        }
        const location = normalizeChosenLocation(source, geocode)
        if (!validCoordinatePair(location.latitude, location.longitude)) throw new Error('定位坐标无效')
        if (!location.address) throw new Error('未获取到详细地址')
        this.form.AnzhuangWZ = location.address
        this.form.KehuSB_Lat = Number(location.latitude)
        this.form.KehuSB_Lng = Number(location.longitude)
        this.locationUpdated = true
        uni.showToast({ title: '安装位置已更新', icon: 'success' })
      } catch (error) {
        const message = String(error && error.errMsg || error && error.message || '')
        if (!/cancel/i.test(message)) {
          uni.showToast({ title: error.message || '现场定位失败', icon: 'none' })
        }
      } finally {
        this.locating = false
      }
    },
    saveDraft(showToast = true) {
      writeTaskDraft(`device:${this.id}`, { form: { ...this.form }, locationUpdated: this.locationUpdated })
      this.draftRestored = true; this.draftSavedAt = Date.now()
      if (showToast) uni.showToast({ title: '草稿已保存', icon: 'success' })
    },
    discardDraft() { removeTaskDraft(`device:${this.id}`); this.draftRestored = false; this.draftSavedAt = 0; this.loadDevice() },
    openConsumables() { uni.navigateTo({ url: `/pages/task/consumable?deviceId=${encodeURIComponent(this.id)}&taskId=${encodeURIComponent(this.taskId)}&orderId=${encodeURIComponent(this.device.DingdanID || '')}` }) },
    async submit() {
      if (this.submitting || this.locating) return
      if (this.parseUpload(this.form.JieguoTP).length === 0) {
        const confirmed = await new Promise((resolve) => uni.showModal({ title: '尚未上传结果照片', content: '建议至少上传一张现场结果照片。确认仍要提交吗？', success: (result) => resolve(!!result.confirm), fail: () => resolve(false) }))
        if (!confirmed) return
      }
      this.submitting = true; uni.showLoading({ title: '正在同步', mask: true })
      try {
        await saveTaskDevice(this.id, this.taskType, {
          ...this.form,
          _LocationUpdated: this.locationUpdated
        }, this.device)
        removeTaskDraft(`device:${this.id}`)
        uni.$emit('xjy:task-changed', { id: this.taskId })
        uni.showToast({ title: '设备处理完成', icon: 'success' })
        setTimeout(() => this.goBack(), 650)
      } catch (error) {
        this.saveDraft(false)
        uni.showToast({ title: error.message || error.Msg || '提交失败，草稿已保留', icon: 'none' })
      } finally { uni.hideLoading(); this.submitting = false }
    },
    goBack() { uni.navigateBack() }
  }
}
</script>

<style scoped>
.device-page { height: 100vh; overflow: hidden; }.draft-action { min-width: 74rpx; height: 58rpx; display: flex; align-items: center; justify-content: center; border-radius: 6px; color: #087da8; font-size: 21rpx; font-weight: 650; transition: background .16s ease; }.draft-action--pressed { background: #edf7fa; }
.device-scroll { height: calc(100vh - var(--mci-safe-top) - 92rpx - 112rpx - var(--mci-safe-bottom)); }.draft-tip { min-height: 74rpx; display: flex; align-items: center; justify-content: space-between; padding: 10rpx 24rpx; color: #76591d; background: #fff8e7; box-sizing: border-box; }.draft-tip__title,.draft-tip__time { display:block; }.draft-tip__title { font-size:22rpx;font-weight:650; }.draft-tip__time { margin-top:3rpx;font-size:18rpx;opacity:.72; }.draft-tip>view:last-child { padding:13rpx;color:#a25920;font-size:20rpx; }
.device-summary { display:grid;grid-template-columns:76rpx minmax(0,1fr) auto;gap:16rpx;align-items:center;padding:26rpx 24rpx;background:#063b5c;color:#fff; }.device-summary image{width:62rpx;height:62rpx;padding:7rpx;border-radius:8px;background:#fff;box-sizing:border-box}.device-summary__copy{min-width:0}.device-summary__name,.device-summary__meta,.device-summary__position{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.device-summary__name{font-size:29rpx;font-weight:750}.device-summary__meta{margin-top:6rpx;color:rgba(255,255,255,.74);font-size:21rpx}.device-summary__position{margin-top:5rpx;color:rgba(255,255,255,.58);font-size:19rpx}.device-summary__status{padding:8rpx 12rpx;border-radius:6px;color:#fff;background:#c27a20;font-size:20rpx}.device-summary__status.complete{background:#147657}
.section-band{margin-top:14rpx;padding:0 24rpx;background:#fff}.section-heading{min-height:82rpx;display:flex;align-items:center;border-bottom:1px solid #edf2f4;color:#244954;font-size:27rpx;font-weight:700}.section-heading>view{width:7rpx;height:28rpx;margin-right:13rpx;border-radius:3rpx;background:#e54625}.section-heading__required{margin-left:8rpx;color:#d2463f;font-size:19rpx;font-weight:500}.section-heading__hint{flex:1;color:#86989f;font-size:19rpx;font-weight:400;text-align:right}.result-textarea{width:100%;height:220rpx;padding:20rpx 2rpx 4rpx;box-sizing:border-box;color:#294b57;font-size:24rpx;line-height:1.65}.word-count{padding:0 0 15rpx;color:#9aa9af;font-size:19rpx;text-align:right}.upload-block{padding:20rpx 0 16rpx}.watermark-command{min-height:76rpx;display:grid;grid-template-columns:43rpx minmax(0,1fr) 24rpx;gap:12rpx;align-items:center;border-top:1px solid #edf2f4;color:#466570;font-size:22rpx;transition:background .16s ease}.watermark-command image{width:38rpx;height:38rpx}.watermark-command>text:last-child{color:#9babb1;font-size:30rpx}.watermark-command--pressed{background:#f1f7f9}.photo-category{padding:20rpx 0;border-bottom:1px solid #edf2f4}.photo-category:last-child{border-bottom:none}.photo-category__heading{margin-bottom:15rpx}.photo-category__heading text{display:block}.photo-category__heading text:first-child{color:#345762;font-size:23rpx;font-weight:650}.photo-category__heading text:last-child{margin-top:4rpx;color:#8a9ba2;font-size:19rpx}.info-row{min-height:74rpx;display:grid;grid-template-columns:160rpx minmax(0,1fr);align-items:center;border-bottom:1px solid #f0f4f5}.info-row text:first-child{color:#71868f;font-size:22rpx}.info-row text:last-child{color:#294b57;font-size:23rpx;text-align:right}.section-command{min-height:94rpx;display:grid;grid-template-columns:48rpx minmax(0,1fr) 24rpx;gap:13rpx;align-items:center;transition:background .16s ease}.section-command image{width:42rpx;height:42rpx}.section-command>view text{display:block}.section-command>view text:first-child{color:#294b57;font-size:23rpx;font-weight:650}.section-command>view text:last-child{margin-top:4rpx;color:#899ba2;font-size:19rpx}.section-command>text:last-child{color:#9babb1;font-size:30rpx}.section-command--pressed{background:#f1f7f9}.quality-note{display:flex;gap:12rpx;margin:18rpx 24rpx 0;padding:18rpx;color:#59747e;background:#eaf5f8;font-size:21rpx;line-height:1.6}.quality-note>view{flex:none;width:6rpx;border-radius:3rpx;background:#087da8}.device-spacer{height:32rpx}.bottom-bar{position:fixed;right:0;bottom:0;left:0;z-index:30;display:grid;grid-template-columns:.8fr 1.2fr;gap:13rpx;padding:15rpx 21rpx calc(15rpx + var(--mci-safe-bottom));border-top:1px solid #e3ebee;background:rgba(255,255,255,.97)}.bottom-button{height:82rpx;border-radius:7px;font-size:25rpx;font-weight:700;line-height:82rpx;text-align:center;transition:transform .16s ease}.bottom-button--plain{color:#496671;background:#edf3f5}.bottom-button--primary{color:#fff;background:#e54625}.bottom-button.disabled{opacity:.58}.bottom-button--pressed{transform:scale(.98)}.error-state{min-height:70vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:50rpx;text-align:center}.error-state__title{font-size:29rpx;font-weight:700}.error-state__text{margin-top:10rpx;color:#7b8f97;font-size:23rpx}.error-state__button{margin-top:25rpx;padding:15rpx 32rpx;border-radius:6px;color:#fff;background:#087da8;font-size:23rpx}@media(prefers-reduced-motion:reduce){.bottom-button,.watermark-command,.section-command{transition:none}}
.section-heading{min-height:88rpx;transition:background .16s ease}.section-heading--pressed{background:#f4f8f9}.section-heading>.section-heading__accent{flex:none;width:7rpx;height:28rpx;margin-right:13rpx;border-radius:3rpx;background:#e54625}.section-heading>.section-heading__chevron{flex:none;width:13rpx;height:13rpx;margin:0 5rpx 0 18rpx;border-right:2rpx solid #8fa0a6;border-bottom:2rpx solid #8fa0a6;border-radius:0;background:transparent;transform:rotate(-45deg);transition:transform .2s ease}.section-heading>.section-heading__chevron.open{transform:rotate(45deg)}.section-body{overflow:hidden}.site-field{padding:20rpx 0;border-bottom:1px solid #edf2f4}.site-field__heading{display:flex;align-items:center;justify-content:space-between;gap:16rpx;margin-bottom:12rpx}.site-field__heading>text{color:#345762;font-size:23rpx;font-weight:650}.site-field__location{display:flex;align-items:center;gap:7rpx;min-height:52rpx;padding:0 17rpx;border:1px solid #8bcada;border-radius:26rpx;color:#087da8;background:#eef9fb;font-size:20rpx;font-weight:650;transition:transform .16s ease,opacity .16s ease}.site-field__location image{width:28rpx;height:28rpx}.site-field__location.disabled{opacity:.55}.site-field__location--pressed{transform:scale(.96)}.site-field input{width:100%;height:88rpx;padding:0 22rpx;border:1px solid #d9e4e8;border-radius:8px;box-sizing:border-box;color:#294b57;background:#f8fbfc;font-size:24rpx}.site-field input:focus{border-color:#55abc6;background:#fff}.site-field__location-tip{display:block;margin-top:10rpx;color:#72909a;font-size:19rpx;line-height:1.5}@media(prefers-reduced-motion:reduce){.section-heading,.section-heading>.section-heading__chevron,.site-field__location{transition:none}}
</style>
