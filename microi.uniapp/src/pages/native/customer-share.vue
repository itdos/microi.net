<template>
  <mci-page-shell class="share-page" :style="mciTokenStyle" title="分享客户" subtitle="跨商家协作" @back="goBack">
    <mci-skeleton v-if="loading" type="list" :rows="6" />
    <view v-else-if="error" class="error-state"><text>{{ error }}</text><view @tap="loadData"><text>重新加载</text></view></view>
    <scroll-view v-else class="share-scroll" scroll-y>
      <view class="customer-band">
        <image src="/static/xjy/business/kehu.png" mode="aspectFit" />
        <view><text>{{ customer.KehuMC || '客户' }}</text><text>{{ customerMeta }}</text></view>
        <text>{{ customer.Zhuangtai || '客户资料' }}</text>
      </view>

      <view class="section-band">
        <view class="section-head"><text>选择接收商家</text><text>必选</text></view>
        <view class="tenant-search"><input v-model="keyword" placeholder="搜索商家名称" /></view>
        <view v-if="filteredTenants.length" class="tenant-list">
          <view v-for="item in filteredTenants" :key="item.Id" class="tenant-row" :class="{ active: selectedTenant && selectedTenant.Id === item.Id }" hover-class="tenant-row--pressed" @tap="selectedTenant = item">
            <view><text>{{ item.TenantName }}</text><text>{{ tenantMeta(item) }}</text></view>
            <text>{{ selectedTenant && selectedTenant.Id === item.Id ? '✓' : '○' }}</text>
          </view>
        </view>
        <view v-else class="empty-row"><text>没有匹配的商家</text></view>
      </view>

      <view class="section-band">
        <view class="section-head"><text>同时分享关联资料</text><text>按需勾选</text></view>
        <view class="relation-grid">
          <view v-for="item in relations" :key="item.name" class="relation-option" :class="{ active: item.checked }" hover-class="relation-option--pressed" @tap="item.checked = !item.checked">
            <image :src="item.icon" mode="aspectFit" /><text>{{ item.name }}</text><text>{{ item.checked ? '✓' : '＋' }}</text>
          </view>
        </view>
        <view class="share-notice"><text>客户主档始终分享。勾选的关联资料将由后台接口按权限复制到接收商家。</text></view>
      </view>
      <view class="safe-space"></view>
    </scroll-view>

    <template #fixed>
      <view v-if="!loading && !error" class="submit-bar">
        <view><text>{{ selectedTenant ? selectedTenant.TenantName : '尚未选择接收商家' }}</text><text>已选 {{ selectedRelations.length }} 类关联资料</text></view>
        <view class="submit-button" :class="{ disabled: submitting }" hover-class="submit-button--pressed" @tap="submit"><text>{{ submitting ? '分享中' : '确认分享' }}</text></view>
      </view>
    </template>
  </mci-page-shell>
</template>

<script>
import { themeMixin } from '@/utils/theme.js'
import { V8 } from '@/utils/request.js'
import { callApiEngine, formatFieldValue, formatRegion } from '@/platform/business-runtime.js'

export default {
  mixins: [themeMixin],
  data() {
    return {
      customerId: '', customer: {}, tenants: [], selectedTenant: null, keyword: '', loading: true, submitting: false, error: '',
      relations: [
        { name: '联系人', icon: '/static/xjy/business/lianxiren.png', checked: false },
        { name: '跟进', icon: '/static/xjy/business/baifang.png', checked: false },
        { name: '商机', icon: '/static/xjy/business/shouyi.png', checked: false },
        { name: '订单', icon: '/static/xjy/business/dingdan.png', checked: false },
        { name: '设备', icon: '/static/xjy/business/shebei.png', checked: false }
      ]
    }
  },
  computed: {
    filteredTenants() {
      const keyword = this.keyword.trim().toLowerCase()
      if (!keyword) return this.tenants
      return this.tenants.filter((item) => String(item.TenantName || '').toLowerCase().includes(keyword))
    },
    customerMeta() {
      return [
        formatFieldValue(this.customer.LianxiR, '', { empty: '' }),
        formatFieldValue(this.customer.LianxiDH, '', { empty: '' }),
        formatRegion(this.customer.Chengshi)
      ].filter(Boolean).join(' · ') || '客户资料'
    },
    selectedRelations() { return this.relations.filter((item) => item.checked).map((item) => item.name) }
  },
  onLoad(options) { this.customerId = decodeURIComponent(options.customerId || options.id || ''); this.loadData() },
  methods: {
    tenantMeta(item) {
      return [formatFieldValue(item.LianxiR, '', { empty: '' }), formatFieldValue(item.LianxiDH, '', { empty: '' })]
        .filter(Boolean).join(' · ') || '集福鲤合作商家'
    },
    async loadData() {
      if (!this.customerId) { this.error = '缺少客户编号'; this.loading = false; return }
      this.loading = true; this.error = ''
      try {
        const [customerResult, tenantResult] = await Promise.all([
          V8.FormEngine.GetFormData('Diy_Kehu', { Id: this.customerId }),
          V8.FormEngine.GetTableData('Diy_Tenant', { _PageIndex: 1, _PageSize: 500, _OrderBy: 'TenantName', _OrderByType: 'ASC' })
        ])
        if (!customerResult || Number(customerResult.Code) !== 1) throw new Error((customerResult && customerResult.Msg) || '客户加载失败')
        if (!tenantResult || Number(tenantResult.Code) !== 1) throw new Error((tenantResult && tenantResult.Msg) || '商家加载失败')
        this.customer = customerResult.Data || {}
        this.tenants = (tenantResult.Data || []).filter((item) => item.Id && String(item.Id) !== String(this.customer.TenantId || ''))
      } catch (error) { this.error = error.message || '分享信息加载失败' } finally { this.loading = false }
    },
    async submit() {
      if (this.submitting) return
      if (!this.selectedTenant) { uni.showToast({ title: '请选择接收商家', icon: 'none' }); return }
      const confirmed = await new Promise((resolve) => uni.showModal({ title: '确认分享客户', content: `将客户分享给“${this.selectedTenant.TenantName}”，确认继续吗？`, success: (result) => resolve(Boolean(result.confirm)), fail: () => resolve(false) }))
      if (!confirmed) return
      this.submitting = true
      uni.showLoading({ title: '正在分享', mask: true })
      try {
        const result = await callApiEngine('AddSharekhToTenant', {
          kehuData: this.customer,
          selectData: { Shangjia: { ...this.selectedTenant }, Zibiao: this.selectedRelations }
        })
        if (!result || Number(result.Code) !== 1) throw new Error((result && result.Msg) || '客户分享失败')
        uni.showToast({ title: '客户分享成功', icon: 'success' })
        setTimeout(() => this.goBack(), 650)
      } catch (error) { uni.showToast({ title: error.message || '客户分享失败', icon: 'none' }) } finally { uni.hideLoading(); this.submitting = false }
    },
    goBack() { uni.navigateBack() }
  }
}
</script>

<style scoped>
.share-page{height:100vh;overflow:hidden}.share-scroll{height:calc(100vh - var(--mci-safe-top) - 92rpx - 116rpx - var(--mci-safe-bottom))}.customer-band{display:grid;grid-template-columns:66rpx minmax(0,1fr) auto;gap:15rpx;align-items:center;padding:24rpx;color:#fff;background:#063b5c}.customer-band image{box-sizing:border-box;width:56rpx;height:56rpx;padding:6rpx;border-radius:8px;background:#fff}.customer-band>view{min-width:0}.customer-band>view text{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.customer-band>view text:first-child{font-size:28rpx;font-weight:750}.customer-band>view text:last-child{margin-top:5rpx;color:rgba(255,255,255,.68);font-size:20rpx}.customer-band>text{padding:7rpx 11rpx;border-radius:6px;background:rgba(255,255,255,.15);font-size:20rpx}.section-band{margin-top:14rpx;padding:0 24rpx 24rpx;background:#fff}.section-head{min-height:88rpx;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #edf2f4}.section-head text:first-child{color:#294b57;font-size:27rpx;font-weight:750}.section-head text:last-child{color:#8a9ca3;font-size:20rpx}.tenant-search{padding:16rpx 0 8rpx}.tenant-search input{box-sizing:border-box;height:68rpx;padding:0 18rpx;border:1px solid #dce8ed;border-radius:8px;color:#294b57;background:#f7fafb;font-size:23rpx}.tenant-list{max-height:460rpx;overflow:auto}.tenant-row{min-height:84rpx;display:grid;grid-template-columns:minmax(0,1fr) 42rpx;gap:14rpx;align-items:center;border-bottom:1px solid #edf2f4;transition:background .14s ease}.tenant-row>view{min-width:0}.tenant-row>view text{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.tenant-row>view text:first-child{color:#365864;font-size:24rpx;font-weight:650}.tenant-row>view text:last-child{margin-top:4rpx;color:#8b9da4;font-size:19rpx}.tenant-row>text{color:#a0afb5;font-size:29rpx;text-align:center}.tenant-row.active{background:#edf8fb}.tenant-row.active>text{color:#0b86d4}.tenant-row--pressed{background:#f1f7f9}.empty-row{padding:34rpx 0;color:#8b9da4;font-size:22rpx;text-align:center}.relation-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12rpx;padding:20rpx 0}.relation-option{min-height:72rpx;display:grid;grid-template-columns:42rpx minmax(0,1fr) 30rpx;gap:10rpx;align-items:center;padding:0 15rpx;border:1px solid #dce8ed;border-radius:8px;color:#58727c;background:#f8fbfc;font-size:22rpx;transition:transform .14s ease,background .14s ease}.relation-option image{width:36rpx;height:36rpx}.relation-option>text:nth-child(2){overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.relation-option>text:last-child{text-align:right}.relation-option.active{border-color:rgba(11,134,212,.36);color:#087dad;background:#e9f6fa}.relation-option--pressed{transform:scale(.97)}.share-notice{padding:16rpx;border-radius:7px;color:#6d848d;background:#f2f7f8;font-size:20rpx;line-height:32rpx}.safe-space{height:26rpx}.submit-bar{position:fixed;right:0;bottom:0;left:0;z-index:18;display:grid;grid-template-columns:minmax(0,1fr) 220rpx;gap:16rpx;align-items:center;box-sizing:border-box;min-height:112rpx;padding:15rpx max(24rpx,var(--mci-safe-right)) calc(15rpx + var(--mci-safe-bottom)) max(24rpx,var(--mci-safe-left));border-top:1px solid #e4ecef;background:rgba(255,255,255,.97);box-shadow:0 -8rpx 24rpx rgba(20,61,78,.07)}.submit-bar>view:first-child{min-width:0}.submit-bar>view:first-child text{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.submit-bar>view:first-child text:first-child{color:#365864;font-size:22rpx;font-weight:650}.submit-bar>view:first-child text:last-child{margin-top:4rpx;color:#8a9ca3;font-size:19rpx}.submit-button{height:76rpx;border-radius:8px;color:#fff;background:#e54625;font-size:25rpx;font-weight:750;line-height:76rpx;text-align:center;transition:transform .15s ease}.submit-button--pressed{transform:scale(.97)}.submit-button.disabled{opacity:.58}.error-state{min-height:62vh;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#718790;font-size:24rpx}.error-state>view{margin-top:20rpx;padding:14rpx 28rpx;border-radius:7px;color:#fff;background:#087da8}@media(prefers-reduced-motion:reduce){.tenant-row,.relation-option,.submit-button{transition:none}}
</style>
