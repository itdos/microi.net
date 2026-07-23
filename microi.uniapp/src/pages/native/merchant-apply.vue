<template>
  <mci-page-shell class="merchant-page" :style="mciTokenStyle" title="商家入驻" subtitle="提交资料后进入平台审核" @back="goBack">
    <mci-skeleton v-if="loading" type="form" :rows="7" />
    <view v-else-if="alreadyJoined" class="joined-state">
      <view class="joined-mark"><text>✓</text></view><text class="joined-title">已加入商家</text><text class="joined-text">{{ currentUser.TenantName || '当前账号已有所属商家' }}</text>
      <button class="secondary-button" @tap="goHome">返回首页</button>
    </view>
    <scroll-view v-else class="page-scroll" scroll-y>
      <view class="page-content">
        <view class="section-title"><text>基本资料</text></view>
        <view class="form-panel">
          <view class="field-row"><text class="field-label">商家名称</text><input v-model="form.TenantName" class="field-input" placeholder="请输入商家名称" maxlength="80" @blur="checkTenantName" /></view>
          <picker mode="region" :value="region" @change="region = $event.detail.value"><view class="field-row"><text class="field-label">省市区</text><text class="field-select" :class="{ placeholder: !region.length }">{{ region.length ? region.join(' / ') : '请选择省市区' }} ›</text></view></picker>
          <view class="field-row"><text class="field-label">详细地址</text><input v-model="form.Dizhi" class="field-input" placeholder="请输入详细地址" maxlength="120" /></view>
          <view class="field-row"><text class="field-label">联系人</text><input v-model="form.LianxiR" class="field-input" placeholder="请输入联系人" maxlength="30" /></view>
          <view class="field-row"><text class="field-label">联系人电话</text><input v-model="form.LianxiRDH" class="field-input" type="number" placeholder="请输入联系电话" maxlength="11" /></view>
          <view class="field-row"><text class="field-label">主营产品</text><input v-model="form.ZhuyingCP" class="field-input" placeholder="请输入主营产品" maxlength="120" /></view>
          <picker :range="industries" range-key="HangyeMC" @change="selectIndustry"><view class="field-row"><text class="field-label">所属行业</text><text class="field-select" :class="{ placeholder: !industry }">{{ industry ? industry.HangyeMC : '请选择所属行业' }} ›</text></view></picker>
        </view>

        <view class="section-title"><text>营业与介绍</text></view>
        <view class="form-panel">
          <view class="time-grid">
            <picker mode="time" :value="form.YingyeKSSJ" @change="form.YingyeKSSJ = $event.detail.value"><view class="field-row"><text class="field-label">营业开始</text><text class="field-select">{{ form.YingyeKSSJ || '请选择' }}</text></view></picker>
            <picker mode="time" :value="form.YingyeJSSJ" @change="form.YingyeJSSJ = $event.detail.value"><view class="field-row"><text class="field-label">营业结束</text><text class="field-select">{{ form.YingyeJSSJ || '请选择' }}</text></view></picker>
          </view>
          <view class="field-row field-row--textarea"><text class="field-label">商家介绍</text><textarea v-model="form.ShangjiaJS" class="field-textarea" placeholder="请输入商家介绍" maxlength="1000" /></view>
        </view>

        <view class="section-title"><text>资质材料</text></view>
        <view class="upload-panel">
          <view v-for="field in uploadFields" :key="field.key" class="upload-row"><text class="field-label">{{ field.label }}</text><mci-media-uploader v-model="form[field.key]" :max-count="field.max" :upload-path="`xjy/merchant/${field.key}`" /></view>
        </view>
        <view class="bottom-space"></view>
      </view>
    </scroll-view>
    <view v-if="!loading && !alreadyJoined" class="bottom-bar" slot="fixed"><button class="primary-button" :loading="submitting" :disabled="submitting" @tap="submit">提交入驻申请</button></view>
  </mci-page-shell>
</template>

<script>
import { themeMixin } from '@/utils/theme.js'
import { getToken, getUser, V8 } from '@/utils/request.js'
import { captureInvitation, getInvitation, clearInvitation } from '@/platform/invitation.js'

export default {
  mixins: [themeMixin],
  data() {
    return {
      loading: true, submitting: false, initialized: false, currentUser: {}, industries: [], industry: null, region: [],
      form: { TenantName: '', Dizhi: '', LianxiR: '', LianxiRDH: '', ZhuyingCP: '', YingyeKSSJ: '', YingyeJSSJ: '', ShangjiaJS: '', ShangjiaZZ: '', ErweiMJT: '', GaoxinQY: '', ISO: '', ThreeA: '' },
      uploadFields: [{ key: 'ShangjiaZZ', label: '商家资质', max: 6 }, { key: 'ErweiMJT', label: '二维码截图', max: 1 }, { key: 'GaoxinQY', label: '高新企业资质', max: 3 }, { key: 'ISO', label: 'ISO 资质', max: 3 }, { key: 'ThreeA', label: '3A 资质', max: 3 }]
    }
  },
  computed: { alreadyJoined() { return Boolean(this.currentUser.TenantId) } },
  onLoad(options) {
    captureInvitation(options || {})
    if (!getToken()) {
      const query = Object.keys(options || {}).map((key) => `${key}=${encodeURIComponent(options[key])}`).join('&')
      const redirect = `/pages/native/merchant-apply${query ? `?${query}` : ''}`
      uni.redirectTo({ url: `/pages/login/index?redirect=${encodeURIComponent(redirect)}` })
      return
    }
    this.initialize()
  },
  onShow() { if (!this.initialized && getToken()) this.initialize() },
  methods: {
    goBack() { uni.navigateBack({ fail: () => this.goHome() }) },
    goHome() { uni.switchTab({ url: '/pages/workspace/index' }) },
    async initialize() {
      if (this.initialized) return
      this.initialized = true
      this.currentUser = getUser() || {}
      this.form.LianxiR = this.currentUser.Name || ''
      this.form.LianxiRDH = this.currentUser.Phone || ''
      try {
        const result = await V8.FormEngine.GetTableData('diy_hangYe', { _OrderBy: 'CreateTime', _OrderByType: 'ASC', _PageIndex: 1, _PageSize: 300 })
        this.industries = result && Number(result.Code) === 1 && Array.isArray(result.Data) ? result.Data : []
      } catch (error) { this.industries = [] }
      finally { this.loading = false }
    },
    selectIndustry(event) { this.industry = this.industries[Number(event.detail.value)] || null },
    async checkTenantName() {
      if (!this.form.TenantName.trim()) return true
      try {
        const result = await V8.FormEngine.GetTableData('Diy_Tenant', { _Where: [{ Name: 'TenantName', Type: '=', Value: this.form.TenantName.trim() }], _SelectFields: ['Id'], _PageIndex: 1, _PageSize: 1 })
        if (result && Number(result.Code) === 1 && Number(result.DataCount || (result.Data || []).length) > 0) {
          uni.showToast({ title: '该商家名称已存在', icon: 'none' }); return false
        }
      } catch (error) {}
      return true
    },
    validate() {
      if (!this.form.TenantName.trim()) throw new Error('请输入商家名称')
      if (!this.region.length) throw new Error('请选择省市区')
      if (!this.form.Dizhi.trim()) throw new Error('请输入详细地址')
      if (!this.form.LianxiR.trim()) throw new Error('请输入联系人')
      if (!/^1[3-9]\d{9}$/.test(this.form.LianxiRDH)) throw new Error('请输入正确的联系人电话')
      if (!this.form.ZhuyingCP.trim()) throw new Error('请输入主营产品')
      if (!this.industry) throw new Error('请选择所属行业')
    },
    async submit() {
      if (this.submitting) return
      try {
        this.validate()
        if (!(await this.checkTenantName())) return
        this.submitting = true
        const invitation = getInvitation()
        const result = await V8.FormEngine.AddFormData('Diy_Tenant', {
          ...this.form,
          TenantName: this.form.TenantName.trim(),
          Chengshi: JSON.stringify(this.region),
          SuoshuHY: JSON.stringify(this.industry),
          Zhuangtai: '待审核',
          ShenqingRID: this.currentUser.Id || '',
          ShenqingR: this.currentUser.Name || this.currentUser.Account || '',
          YaoqingR: invitation.InviterName || '',
          YaoqingRID: invitation.InviterId || '',
          _InvokeType: 'Client'
        })
        if (!result || Number(result.Code) !== 1) throw new Error((result && result.Msg) || '入驻申请提交失败')
        clearInvitation()
        uni.showToast({ title: '申请已提交', icon: 'success' })
        setTimeout(this.goHome, 1000)
      } catch (error) { uni.showToast({ title: error.message || '入驻申请提交失败', icon: 'none' }) }
      finally { this.submitting = false }
    }
  }
}
</script>

<style scoped>
.page-scroll { height: calc(100vh - 92rpx - var(--mci-safe-top) - 116rpx - var(--mci-safe-bottom)); }
.page-content { padding: 14rpx 24rpx 0; }
.section-title { display: flex; align-items: center; height: 74rpx; color: #496570; font-size: 24rpx; font-weight: 650; }
.form-panel, .upload-panel { border: 1rpx solid #e0eaee; border-radius: 8rpx; overflow: hidden; background: #fff; }
.field-row { display: flex; flex-direction: column; min-height: 112rpx; padding: 17rpx 24rpx 13rpx; border-bottom: 1rpx solid #edf3f5; }
.field-row:last-child { border-bottom: none; }
.field-label { color: #607983; font-size: 21rpx; }
.field-input, .field-select { height: 58rpx; margin-top: 4rpx; color: #193640; font-size: 26rpx; line-height: 58rpx; }
.field-select.placeholder { color: #99a8ae; }
.time-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.time-grid > picker:first-child { border-right: 1rpx solid #edf3f5; }
.field-row--textarea { min-height: 210rpx; }
.field-textarea { box-sizing: border-box; width: 100%; height: 150rpx; margin-top: 9rpx; padding: 14rpx; border-radius: 6rpx; background: #f5f8f9; color: #193640; font-size: 25rpx; line-height: 36rpx; }
.upload-row { padding: 20rpx 24rpx 24rpx; border-bottom: 1rpx solid #edf3f5; }
.upload-row:last-child { border-bottom: none; }
.upload-row > .field-label { display: block; margin-bottom: 14rpx; }
.bottom-space { height: 28rpx; }
.bottom-bar { position: fixed; right: 0; bottom: 0; left: 0; z-index: 18; padding: 16rpx 24rpx calc(16rpx + var(--mci-safe-bottom)); border-top: 1rpx solid #e0eaee; background: rgba(255,255,255,.97); }
.primary-button, .secondary-button { height: 82rpx; border-radius: 8rpx; font-size: 27rpx; font-weight: 650; line-height: 82rpx; }
.primary-button { background: #087ebd; color: #fff; }.primary-button[disabled] { background: #9bbbc9; color: #fff; }
.secondary-button { width: 260rpx; margin-top: 30rpx; border: 1rpx solid #bed6df; background: #fff; color: #087ebd; }
.primary-button::after, .secondary-button::after { border: none; }
.joined-state { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 68vh; padding: 40rpx; }
.joined-mark { display: flex; align-items: center; justify-content: center; width: 92rpx; height: 92rpx; border-radius: 50%; background: #e8f7f1; color: #14845f; font-size: 48rpx; }
.joined-title { margin-top: 22rpx; color: #23424d; font-size: 31rpx; font-weight: 700; }.joined-text { margin-top: 10rpx; color: #71868f; font-size: 23rpx; }
</style>
