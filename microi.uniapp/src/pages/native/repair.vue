<template>
  <mci-page-shell class="repair-page" :style="mciTokenStyle" title="设备报修" subtitle="提交后自动生成售后任务" @back="goBack">
    <mci-skeleton v-if="loading" type="form" :rows="7" />
    <view v-else-if="error" class="error-state">
      <image src="/static/xjy/business/sh.png" mode="aspectFit" />
      <text>{{ error }}</text>
      <view @tap="loadData"><text>重新加载</text></view>
    </view>
    <scroll-view v-else class="repair-scroll" scroll-y>
      <view class="device-band">
        <image src="/static/xjy/business/shebei.png" mode="aspectFit" />
        <view>
          <text>{{ device.ShebeiMC || device.ShangpinMC || '客户设备' }}</text>
          <text>{{ [device.ShebeiBH, device.ShebeiXH, device.AnzhuangWZ].filter(Boolean).join(' · ') || '设备信息已关联' }}</text>
        </view>
        <text>{{ device.ShebeiZT || '使用中' }}</text>
      </view>

      <view class="section-band">
        <view class="section-head"><text>联系信息</text><text>用于售后人员上门联系</text></view>
        <view class="form-row"><text><text class="required">*</text>联系人</text><input v-model="form.contact" placeholder="请输入联系人" /></view>
        <view class="form-row"><text>手机号码</text><input v-model="form.phone" type="number" maxlength="11" placeholder="请输入手机号码" /></view>
        <picker mode="region" :value="form.region" @change="changeRegion">
          <view class="form-row form-row--picker"><text><text class="required">*</text>省市区</text><text :class="{ placeholder: !form.region.length }">{{ regionText || '请选择所在省市区' }}</text><text>›</text></view>
        </picker>
        <view class="form-row"><text><text class="required">*</text>详细地址</text><input v-model="form.address" placeholder="请输入详细地址" /></view>
      </view>

      <view class="section-band">
        <view class="section-head"><text>报修类型</text><text>可多选</text></view>
        <view v-if="repairTypes.length" class="type-grid">
          <view
            v-for="item in repairTypes"
            :key="item.value"
            class="type-option"
            :class="{ active: form.types.includes(item.name) }"
            hover-class="type-option--pressed"
            @tap="toggleType(item.name)"
          ><text>{{ item.name }}</text><text>{{ form.types.includes(item.name) ? '✓' : '＋' }}</text></view>
        </view>
        <view v-else class="type-empty"><text>后台暂未配置报修类型，可在下方补充</text></view>
        <view class="form-row"><text>其他类型</text><input v-model="form.otherType" placeholder="请输入其他报修类型" /></view>
      </view>

      <view class="section-band">
        <view class="section-head"><text>问题描述</text><text>描述越清楚，处理越及时</text></view>
        <textarea v-model="form.reason" class="reason-input" maxlength="1000" placeholder="请描述故障现象、发生时间及当前影响" />
        <view class="upload-group">
          <view class="upload-title"><text>现场照片</text><text>最多 9 张</text></view>
          <mci-media-uploader v-model="form.images" :max-count="9" media-type="image" upload-path="xjy/repair/images" />
        </view>
        <view class="upload-group">
          <view class="upload-title"><text>故障视频</text><text>最多 3 个</text></view>
          <mci-media-uploader v-model="form.videos" :max-count="3" media-type="video" upload-path="xjy/repair/videos" />
        </view>
      </view>
      <view class="safe-space"></view>
    </scroll-view>

    <template #fixed>
      <view v-if="!loading && !error" class="submit-bar">
        <view class="submit-tip"><text>提交后可在“售后任务”跟踪进度</text></view>
        <view class="submit-button" :class="{ disabled: submitting }" hover-class="submit-button--pressed" @tap="submit"><text>{{ submitting ? '提交中' : '提交报修' }}</text></view>
      </view>
    </template>
  </mci-page-shell>
</template>

<script>
import { themeMixin } from '@/utils/theme.js'
import { V8, getUser, post } from '@/utils/request.js'
import { callApiEngine } from '@/platform/business-runtime.js'

function parseRegion(value) {
  if (!value) return []
  if (Array.isArray(value)) return value.filter(Boolean)
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) return parsed.filter(Boolean)
  } catch (error) {}
  return String(value).split(/[,/]/).map((item) => item.trim()).filter(Boolean)
}

export default {
  mixins: [themeMixin],
  data() {
    return {
      deviceId: '',
      device: {},
      customer: {},
      repairTypes: [],
      loading: true,
      submitting: false,
      error: '',
      form: { contact: '', phone: '', region: [], address: '', types: [], otherType: '', reason: '', images: '', videos: '' }
    }
  },
  computed: {
    regionText() { return this.form.region.join(' / ') }
  },
  onLoad(options) {
    this.deviceId = decodeURIComponent(options.deviceId || options.id || '')
    this.loadData()
  },
  methods: {
    async loadData() {
      if (!this.deviceId) { this.error = '缺少设备编号'; this.loading = false; return }
      this.loading = true
      this.error = ''
      try {
        const [deviceResult, customerResult, typeResult] = await Promise.allSettled([
          V8.FormEngine.GetFormData('Diy_KehuSB', { Id: this.deviceId }),
          callApiEngine('repair_customer', { Id: this.deviceId }),
          post('/api/SysBaseData/getSysBaseData', { ParentKey: 'BaoxiuLX' }, true)
        ])
        if (deviceResult.status !== 'fulfilled' || !deviceResult.value || Number(deviceResult.value.Code) !== 1) {
          throw new Error('设备信息加载失败')
        }
        this.device = deviceResult.value.Data || {}
        this.customer = customerResult.status === 'fulfilled' && customerResult.value && Number(customerResult.value.Code) === 1
          ? (customerResult.value.Data || {})
          : {}
        const baseRows = typeResult.status === 'fulfilled' && typeResult.value && Number(typeResult.value.Code) === 1
          ? (typeResult.value.Data || [])
          : []
        this.repairTypes = baseRows.map((item) => ({ value: item.Key || item.Id, name: item.Value || item.Name || item.Key })).filter((item) => item.name)
        const source = { ...this.device, ...this.customer }
        this.form.contact = source.LianxiR || source.KehuLXR || ''
        this.form.phone = source.LianxiDH || source.KehuDH || source.ShoujiH || ''
        this.form.region = parseRegion(source.Chengshi)
        this.form.address = source.XiangxiDZ || source.Dizhi || source.AnzhuangWZ || ''
      } catch (error) {
        this.error = error.message || '报修信息加载失败'
      } finally {
        this.loading = false
      }
    },
    changeRegion(event) { this.form.region = Array.isArray(event.detail.value) ? event.detail.value : [] },
    toggleType(name) {
      const index = this.form.types.indexOf(name)
      if (index >= 0) this.form.types.splice(index, 1)
      else this.form.types.push(name)
    },
    validate() {
      if (!this.form.contact.trim()) return '请输入联系人'
      if (this.form.phone && !/^1\d{10}$/.test(this.form.phone)) return '请输入正确的手机号码'
      if (this.form.region.length < 2) return '请选择所在省市区'
      if (!this.form.address.trim()) return '请输入详细地址'
      if (!this.form.types.length && !this.form.otherType.trim()) return '请选择或填写报修类型'
      return ''
    },
    async submit() {
      if (this.submitting) return
      const message = this.validate()
      if (message) { uni.showToast({ title: message, icon: 'none' }); return }
      this.submitting = true
      uni.showLoading({ title: '正在提交', mask: true })
      try {
        const user = getUser() || {}
        const result = await callApiEngine('shenqing_shouhou', {
          KehuSBID: this.deviceId,
          KehuLXR: this.form.contact.trim(),
          KehuDH: this.form.phone.trim(),
          Chengshi: JSON.stringify(this.form.region),
          Dizhi: this.form.address.trim(),
          BaoxiuLX: JSON.stringify(this.form.types),
          Neirong: this.form.reason.trim(),
          KehuSCZP: this.form.images || '[]',
          ShouhouLX: this.form.otherType.trim(),
          ShifouZQXSH: 0,
          TenantName: this.device.TenantName || this.customer.TenantName || user.TenantName || '',
          TenantId: this.device.TenantId || this.customer.TenantId || user.TenantId || '',
          Shipin: this.form.videos || '[]',
          KehuGLZH: this.customer.KehuGLZH || this.device.KehuGLZH || ''
        })
        if (!result || Number(result.Code) !== 1) throw new Error((result && result.Msg) || '报修提交失败')
        uni.showToast({ title: '报修提交成功', icon: 'success' })
        setTimeout(() => uni.redirectTo({ url: '/pages/task/list?scope=all' }), 650)
      } catch (error) {
        uni.showToast({ title: error.message || '报修提交失败', icon: 'none' })
      } finally {
        uni.hideLoading()
        this.submitting = false
      }
    },
    goBack() { uni.navigateBack() }
  }
}
</script>

<style scoped>
.repair-page{height:100vh;overflow:hidden}.repair-scroll{height:calc(100vh - var(--mci-safe-top) - 92rpx - 118rpx - var(--mci-safe-bottom))}.device-band{display:grid;grid-template-columns:68rpx minmax(0,1fr) auto;gap:16rpx;align-items:center;padding:24rpx;color:#fff;background:#063b5c}.device-band image{box-sizing:border-box;width:58rpx;height:58rpx;padding:6rpx;border-radius:8px;background:#fff}.device-band>view{min-width:0}.device-band>view text{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.device-band>view text:first-child{font-size:28rpx;font-weight:750}.device-band>view text:last-child{margin-top:6rpx;color:rgba(255,255,255,.7);font-size:20rpx}.device-band>text{padding:7rpx 11rpx;border-radius:6px;background:rgba(255,255,255,.15);font-size:20rpx}.section-band{margin-top:14rpx;padding:0 24rpx 24rpx;background:#fff}.section-head{min-height:88rpx;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #edf2f4}.section-head text:first-child{color:#294b57;font-size:27rpx;font-weight:750}.section-head text:last-child{color:#8a9ca3;font-size:20rpx}.form-row{min-height:84rpx;display:grid;grid-template-columns:190rpx minmax(0,1fr);align-items:center;border-bottom:1px solid #eff3f5}.form-row>text:first-child{color:#637c86;font-size:23rpx}.form-row input{height:72rpx;color:#294b57;font-size:24rpx;text-align:right}.form-row--picker{grid-template-columns:190rpx minmax(0,1fr) 24rpx}.form-row--picker>text:nth-child(2){overflow:hidden;color:#294b57;font-size:24rpx;text-align:right;text-overflow:ellipsis;white-space:nowrap}.form-row--picker>text:last-child{color:#9aaab0;font-size:31rpx;text-align:right}.form-row--picker .placeholder{color:#a5b2b7}.required{margin-right:4rpx;color:#d9472b}.type-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12rpx;padding:20rpx 0}.type-option{min-height:64rpx;display:flex;align-items:center;justify-content:space-between;padding:0 16rpx;border:1px solid #dce8ed;border-radius:8px;color:#54717c;background:#f8fbfc;font-size:22rpx;transition:transform .14s ease,background .14s ease}.type-option.active{border-color:rgba(11,134,212,.38);color:#087dad;background:#e9f6fa}.type-option text:last-child{font-size:25rpx}.type-option--pressed{transform:scale(.97)}.type-empty{padding:22rpx 0;color:#899ba2;font-size:22rpx}.reason-input{box-sizing:border-box;width:100%;height:230rpx;margin-top:20rpx;padding:18rpx;border:1px solid #dfe9ed;border-radius:8px;color:#294b57;background:#f7fafb;font-size:24rpx;line-height:38rpx}.upload-group{margin-top:24rpx}.upload-title{display:flex;align-items:center;justify-content:space-between;margin-bottom:14rpx}.upload-title text:first-child{color:#4b6873;font-size:23rpx;font-weight:650}.upload-title text:last-child{color:#94a4aa;font-size:19rpx}.safe-space{height:30rpx}.submit-bar{position:fixed;right:0;bottom:0;left:0;z-index:18;display:grid;grid-template-columns:minmax(0,1fr) 230rpx;gap:16rpx;align-items:center;box-sizing:border-box;min-height:112rpx;padding:15rpx max(24rpx,var(--mci-safe-right)) calc(15rpx + var(--mci-safe-bottom)) max(24rpx,var(--mci-safe-left));border-top:1px solid #e4ecef;background:rgba(255,255,255,.97);box-shadow:0 -8rpx 24rpx rgba(20,61,78,.07)}.submit-tip{min-width:0;color:#7a9099;font-size:20rpx;line-height:30rpx}.submit-button{height:76rpx;border-radius:8px;color:#fff;background:#e54625;font-size:25rpx;font-weight:750;line-height:76rpx;text-align:center;transition:transform .15s ease}.submit-button--pressed{transform:scale(.97)}.submit-button.disabled{opacity:.58}.error-state{min-height:62vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40rpx;color:#6f858e;font-size:24rpx}.error-state image{width:100rpx;height:100rpx;opacity:.45}.error-state>text{margin-top:18rpx}.error-state>view{margin-top:22rpx;padding:14rpx 28rpx;border-radius:7px;color:#fff;background:#087da8}@media(prefers-reduced-motion:reduce){.type-option,.submit-button{transition:none}}
</style>
