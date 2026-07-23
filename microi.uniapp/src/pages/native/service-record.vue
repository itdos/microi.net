<template>
  <mci-page-shell
    class="service-record-page"
    :style="mciTokenStyle"
    :title="recordId ? '编辑服务记录表' : '生成服务记录表'"
    subtitle="客户服务档案"
    @back="goBack"
  >
    <mci-skeleton v-if="loading" type="form" :rows="6" />
    <scroll-view v-else class="page-scroll" scroll-y>
      <view class="page-content">
        <view class="section-title">统计范围</view>
        <view class="form-panel">
          <view class="field-row field-row--tap" hover-class="field-row--pressed" @tap="openCustomerPicker">
            <text class="field-label">客户名称</text>
            <view class="field-value-line">
              <text class="field-value" :class="{ placeholder: !customer.Id }">{{ customer.KehuMC || '请选择合作客户' }}</text>
              <text class="field-arrow">›</text>
            </view>
          </view>
          <view class="date-grid">
            <picker mode="date" :value="form.KaishiSJ" :end="form.JieshuSJ || '9999-12-31'" @change="form.KaishiSJ = $event.detail.value">
              <view class="field-row field-row--tap">
                <text class="field-label">开始时间</text>
                <text class="field-value" :class="{ placeholder: !form.KaishiSJ }">{{ form.KaishiSJ || '请选择' }}</text>
              </view>
            </picker>
            <picker mode="date" :value="form.JieshuSJ" :start="form.KaishiSJ || '1950-01-01'" @change="form.JieshuSJ = $event.detail.value">
              <view class="field-row field-row--tap">
                <text class="field-label">结束时间</text>
                <text class="field-value" :class="{ placeholder: !form.JieshuSJ }">{{ form.JieshuSJ || '请选择' }}</text>
              </view>
            </picker>
          </view>
        </view>

        <view class="section-heading">
          <text class="section-title">服务项目</text>
          <button class="select-all" @tap="toggleAll">{{ allSelected ? '取消全选' : '全选' }}</button>
        </view>
        <view class="service-panel">
          <view v-if="!serviceTypes.length" class="empty-text">暂无可选服务项目</view>
          <view v-else class="service-grid">
            <button
              v-for="item in serviceTypes"
              :key="item.value"
              class="service-chip"
              :class="{ 'service-chip--active': selectedServices.includes(item.value) }"
              @tap="toggleService(item.value)"
            >
              <text class="chip-check">{{ selectedServices.includes(item.value) ? '✓' : '' }}</text>
              <text>{{ item.label }}</text>
            </button>
          </view>
        </view>

        <view v-if="generatedCount !== null" class="result-band">
          <view><text class="result-number">{{ generatedCount }}</text><text class="result-unit"> 条</text></view>
          <text class="result-label">当前记录表包含的售后服务记录</text>
        </view>
        <view class="bottom-space" />
      </view>
    </scroll-view>

    <view v-if="!loading" class="bottom-bar" slot="fixed">
      <button class="primary-button" :loading="submitting" :disabled="submitting" @tap="submit">
        {{ recordId ? '重新生成并保存' : '生成并保存' }}
      </button>
    </view>

    <view v-if="customerPickerVisible" class="picker-mask" @tap="closeCustomerPicker">
      <view class="picker-sheet" @tap.stop>
        <view class="picker-handle" />
        <view class="picker-header"><text>选择合作客户</text><button class="close-button" @tap="closeCustomerPicker">×</button></view>
        <view class="search-box">
          <text class="search-icon">⌕</text>
          <input v-model="customerKeyword" confirm-type="search" placeholder="搜索客户名称" @confirm="searchCustomers" />
          <button v-if="customerKeyword" class="clear-button" @tap="clearCustomerSearch">×</button>
        </view>
        <scroll-view class="customer-list" scroll-y @scrolltolower="loadMoreCustomers">
          <mci-skeleton v-if="customerLoading && !customers.length" type="list" :rows="5" />
          <button v-for="item in customers" :key="item.Id" class="customer-row" @tap="selectCustomer(item)">
            <view class="customer-main"><text class="customer-name">{{ item.KehuMC || '未命名客户' }}</text><text class="customer-meta">{{ customerMeta(item) }}</text></view>
            <text class="selected-mark">{{ customer.Id === item.Id ? '✓' : '›' }}</text>
          </button>
          <view v-if="!customerLoading && !customers.length" class="empty-text">未找到合作客户</view>
          <view v-if="customerLoading && customers.length" class="loading-more">加载中</view>
        </scroll-view>
      </view>
    </view>
  </mci-page-shell>
</template>

<script>
import { themeMixin } from '@/utils/theme.js'
import { getUser, post, V8 } from '@/utils/request.js'
import { callApiEngine, formatFieldValue, formatRegion, requireLogin } from '@/platform/business-runtime.js'

function today() {
  const now = new Date()
  const pad = (value) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function parseArray(value) {
  if (Array.isArray(value)) return value
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    return String(value).split(',').map((item) => item.trim()).filter(Boolean)
  }
}

export default {
  mixins: [themeMixin],
  data() {
    return {
      loading: true,
      submitting: false,
      recordId: '',
      initialCustomerId: '',
      customer: {},
      form: { KaishiSJ: '', JieshuSJ: today() },
      serviceTypes: [],
      selectedServices: [],
      generatedCount: null,
      customerPickerVisible: false,
      customerKeyword: '',
      customers: [],
      customerPage: 1,
      customerCount: 0,
      customerLoading: false,
      customerSearchTimer: null
    }
  },
  computed: {
    allSelected() {
      return this.serviceTypes.length > 0 && this.selectedServices.length === this.serviceTypes.length
    }
  },
  watch: {
    customerKeyword() {
      clearTimeout(this.customerSearchTimer)
      this.customerSearchTimer = setTimeout(() => this.searchCustomers(), 280)
    }
  },
  async onLoad(options) {
    if (!requireLogin()) return
    this.recordId = options.id || ''
    this.initialCustomerId = options.customerId || ''
    await this.initialize()
  },
  onUnload() { clearTimeout(this.customerSearchTimer) },
  methods: {
    customerMeta(item) {
      return formatRegion(item.Chengshi) || formatFieldValue(item.XiangxiDZ || item.LianxiR, '', { empty: '' }) || '合作客户'
    },
    async initialize() {
      try {
        await this.loadServiceTypes()
        if (this.recordId) await this.loadRecord()
        else if (this.initialCustomerId) await this.loadInitialCustomer(this.initialCustomerId)
      } catch (error) {
        uni.showToast({ title: error.message || '服务记录加载失败', icon: 'none' })
      } finally {
        this.loading = false
      }
    },
    async loadServiceTypes() {
      const result = await post('/api/SysBaseData/getSysBaseData', { ParentKey: 'ShouhouDDLX' }, true)
      const rows = result && Number(result.Code) === 1 && Array.isArray(result.Data) ? result.Data : []
      this.serviceTypes = rows.map((item) => ({ label: item.Value || item.Name || item.Key, value: item.Value || item.Key })).filter((item) => item.value)
    },
    async loadRecord() {
      const result = await V8.FormEngine.GetFormData('diy_ServiceRecord', { Id: this.recordId })
      if (!result || Number(result.Code) !== 1 || !result.Data) throw new Error((result && result.Msg) || '服务记录不存在')
      const row = result.Data
      this.form.KaishiSJ = String(row.KaishiSJ || '').slice(0, 10)
      this.form.JieshuSJ = String(row.JieshuSJ || '').slice(0, 10) || today()
      this.selectedServices = parseArray(row.FuwuXM)
      this.generatedCount = parseArray(row.FuwuJLBSJ).length
      if (row.KehuID) await this.loadInitialCustomer(row.KehuID, row.KehuMC)
      else this.customer = { Id: '', KehuMC: row.KehuMC || '' }
    },
    async loadInitialCustomer(id, fallbackName = '') {
      const result = await V8.FormEngine.GetFormData('Diy_Kehu', { Id: id, _SelectFields: ['Id', 'KehuMC', 'Chengshi', 'XiangxiDZ', 'LianxiR'] })
      this.customer = result && Number(result.Code) === 1 && result.Data ? result.Data : { Id: id, KehuMC: fallbackName }
      if (!this.recordId) await this.applyEarliestServiceDate()
    },
    openCustomerPicker() {
      this.customerPickerVisible = true
      if (!this.customers.length) this.searchCustomers()
    },
    closeCustomerPicker() { this.customerPickerVisible = false },
    clearCustomerSearch() { this.customerKeyword = '' },
    async searchCustomers() {
      this.customerPage = 1
      this.customers = []
      await this.loadCustomers()
    },
    async loadMoreCustomers() {
      if (this.customerLoading || this.customers.length >= this.customerCount) return
      this.customerPage += 1
      await this.loadCustomers()
    },
    async loadCustomers() {
      if (this.customerLoading) return
      this.customerLoading = true
      try {
        const result = await V8.FormEngine.GetTableData('Diy_Kehu', {
          _Where: [{ Name: 'Zhuangtai', Type: '=', Value: '合作客户' }],
          _Keyword: this.customerKeyword.trim(),
          _SelectFields: ['Id', 'KehuMC', 'Chengshi', 'XiangxiDZ', 'LianxiR'],
          _OrderBy: 'UpdateTime', _OrderByType: 'DESC', _PageIndex: this.customerPage, _PageSize: 20
        })
        if (!result || Number(result.Code) !== 1) throw new Error((result && result.Msg) || '客户加载失败')
        const rows = Array.isArray(result.Data) ? result.Data : []
        this.customers = this.customerPage === 1 ? rows : this.customers.concat(rows)
        this.customerCount = Number(result.DataCount || this.customers.length)
      } catch (error) {
        uni.showToast({ title: error.message || '客户加载失败', icon: 'none' })
      } finally {
        this.customerLoading = false
      }
    },
    async selectCustomer(item) {
      this.customer = item
      this.closeCustomerPicker()
      await this.applyEarliestServiceDate()
    },
    async applyEarliestServiceDate() {
      if (!this.customer.Id) return
      try {
        const result = await V8.FormEngine.GetTableData('Diy_Dingdan', {
          _Where: [{ Name: 'KehuID', Type: '=', Value: this.customer.Id }],
          _SelectFields: ['FuwuKSSJ'], _OrderBy: 'FuwuKSSJ', _OrderByType: 'ASC', _PageIndex: 1, _PageSize: 200
        })
        const dates = (result && Array.isArray(result.Data) ? result.Data : []).map((row) => String(row.FuwuKSSJ || '').slice(0, 10)).filter(Boolean).sort()
        this.form.KaishiSJ = dates[0] || ''
        if (this.form.KaishiSJ && (!this.form.JieshuSJ || this.form.JieshuSJ < this.form.KaishiSJ)) {
          this.form.JieshuSJ = this.form.KaishiSJ
        }
      } catch (error) {}
    },
    toggleService(value) {
      const index = this.selectedServices.indexOf(value)
      if (index >= 0) this.selectedServices.splice(index, 1)
      else this.selectedServices.push(value)
    },
    toggleAll() {
      this.selectedServices = this.allSelected ? [] : this.serviceTypes.map((item) => item.value)
    },
    validate() {
      if (!this.customer.KehuMC) throw new Error('请选择合作客户')
      if (this.form.KaishiSJ && this.form.JieshuSJ && this.form.KaishiSJ > this.form.JieshuSJ) throw new Error('结束时间不能早于开始时间')
    },
    async submit() {
      if (this.submitting) return
      try {
        this.validate()
        this.submitting = true
        uni.showLoading({ title: '正在生成', mask: true })
        const serviceJson = this.selectedServices.length ? JSON.stringify(this.selectedServices) : ''
        const generated = await callApiEngine('AddServiceRecords', {
          KehuMC: this.customer.KehuMC,
          KehuID: this.customer.Id || '',
          KaishiSJ: this.form.KaishiSJ,
          JieshuSJ: this.form.JieshuSJ,
          FuwuXM: serviceJson
        })
        if (!generated || Number(generated.Code) !== 1) throw new Error((generated && generated.Msg) || '服务记录生成失败')
        const currentUser = getUser() || {}
        const payload = {
          KehuMC: this.customer.KehuMC,
          KehuID: this.customer.Id || '',
          KaishiSJ: this.form.KaishiSJ,
          JieshuSJ: this.form.JieshuSJ,
          FuwuXM: serviceJson,
          ShengchengSJ: generated.ShengchengSJ || '',
          FuwuJLBSJ: JSON.stringify(Array.isArray(generated.Data) ? generated.Data : []),
          TenantName: currentUser.TenantName || '',
          TenantId: currentUser.TenantId || '',
          _InvokeType: 'Client'
        }
        const saved = this.recordId
          ? await V8.FormEngine.UptFormData('diy_ServiceRecord', { Id: this.recordId, ...payload })
          : await V8.FormEngine.AddFormData('diy_ServiceRecord', payload)
        if (!saved || Number(saved.Code) !== 1) throw new Error((saved && saved.Msg) || '服务记录保存失败')
        this.generatedCount = Array.isArray(generated.Data) ? generated.Data.length : 0
        uni.$emit('xjy-business-refresh', { key: 'serviceForms' })
        uni.showToast({ title: `已生成 ${this.generatedCount} 条记录`, icon: 'success' })
        setTimeout(this.goBack, 900)
      } catch (error) {
        uni.showToast({ title: error.message || '服务记录生成失败', icon: 'none' })
      } finally {
        uni.hideLoading()
        this.submitting = false
      }
    },
    goBack() { uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/workspace/index' }) }) }
  }
}
</script>

<style scoped>
.service-record-page { height: 100vh; background: #f3f7f9; }
.page-scroll { height: calc(100vh - 92rpx - var(--mci-safe-top) - 116rpx - var(--mci-safe-bottom)); }
.page-content { padding: 12rpx 24rpx 0; }
.section-title { display: block; height: 68rpx; color: #526d78; font-size: 23rpx; font-weight: 650; line-height: 68rpx; }
.section-heading { display: flex; align-items: center; justify-content: space-between; }
.form-panel, .service-panel { overflow: hidden; border: 1rpx solid #dfe9ed; border-radius: 8rpx; background: #fff; }
.field-row { box-sizing: border-box; min-height: 108rpx; padding: 17rpx 24rpx 13rpx; border-bottom: 1rpx solid #edf2f4; }
.field-row--tap { transition: background-color .16s ease; }.field-row--pressed { background: #f1f7f9; }
.field-label { display: block; color: #687f88; font-size: 21rpx; }
.field-value-line { display: flex; align-items: center; justify-content: space-between; }
.field-value { display: block; min-width: 0; height: 54rpx; overflow: hidden; color: #183640; font-size: 27rpx; line-height: 54rpx; text-overflow: ellipsis; white-space: nowrap; }
.placeholder { color: #9aa9af; }.field-arrow { flex: none; color: #91a4ac; font-size: 38rpx; line-height: 44rpx; }
.date-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }.date-grid picker:first-child { border-right: 1rpx solid #edf2f4; }.date-grid .field-row { border-bottom: none; }
.select-all, .close-button, .clear-button { margin: 0; padding: 0; border: none; background: transparent; color: #087fbd; font-size: 23rpx; line-height: 1; }.select-all::after, .close-button::after, .clear-button::after { border: none; }
.service-panel { padding: 22rpx; }.service-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14rpx; }
.service-chip { display: flex; align-items: center; min-width: 0; height: 72rpx; margin: 0; padding: 0 16rpx; border: 1rpx solid #dce8ec; border-radius: 8rpx; background: #f7fafb; color: #42606b; font-size: 23rpx; line-height: 72rpx; text-align: left; transition: background-color .16s ease, border-color .16s ease; }
.service-chip::after { border: none; }.service-chip--active { border-color: #48a9c9; background: #eaf7fb; color: #0876a8; }.chip-check { display: inline-flex; align-items: center; justify-content: center; width: 28rpx; height: 28rpx; margin-right: 11rpx; border: 1rpx solid #aac0c8; border-radius: 4rpx; color: #087fbd; font-size: 20rpx; line-height: 28rpx; }
.result-band { display: flex; align-items: center; justify-content: space-between; margin-top: 20rpx; padding: 22rpx 24rpx; border-left: 5rpx solid #19a486; border-radius: 6rpx; background: #fff; }.result-number { color: #16866e; font-size: 40rpx; font-weight: 750; }.result-unit, .result-label { color: #69818b; font-size: 21rpx; }.result-label { max-width: 390rpx; text-align: right; }
.empty-text, .loading-more { padding: 46rpx 20rpx; color: #90a1a8; font-size: 23rpx; text-align: center; }.bottom-space { height: 30rpx; }
.bottom-bar { position: fixed; right: 0; bottom: 0; left: 0; z-index: 20; padding: 16rpx 24rpx calc(16rpx + var(--mci-safe-bottom)); border-top: 1rpx solid #dde7eb; background: rgba(255,255,255,.97); }
.primary-button { height: 82rpx; margin: 0; border-radius: 8rpx; background: #087fbd; color: #fff; font-size: 27rpx; font-weight: 650; line-height: 82rpx; }.primary-button::after { border: none; }.primary-button[disabled] { background: #9bbcc9; color: #fff; }
.picker-mask { position: fixed; inset: 0; z-index: 80; display: flex; align-items: flex-end; background: rgba(16,35,43,.42); }
.picker-sheet { width: 100%; padding-bottom: var(--mci-safe-bottom); border-radius: 12rpx 12rpx 0 0; background: #fff; animation: sheet-up .2s ease-out; }.picker-handle { width: 74rpx; height: 7rpx; margin: 12rpx auto 4rpx; border-radius: 4rpx; background: #d7e1e5; }
.picker-header { display: flex; align-items: center; justify-content: space-between; height: 76rpx; padding: 0 26rpx; color: #183640; font-size: 27rpx; font-weight: 700; }.close-button { width: 58rpx; height: 58rpx; color: #78909a; font-size: 38rpx; line-height: 58rpx; }
.search-box { display: grid; grid-template-columns: 36rpx minmax(0, 1fr) 42rpx; align-items: center; height: 72rpx; margin: 0 24rpx 12rpx; padding: 0 16rpx; border: 1rpx solid #dce7eb; border-radius: 8rpx; background: #f5f8f9; }.search-box input { height: 70rpx; color: #203c46; font-size: 24rpx; }.search-icon { color: #78919a; font-size: 29rpx; }.clear-button { width: 42rpx; height: 42rpx; color: #8ba0a7; font-size: 28rpx; line-height: 42rpx; }
.customer-list { height: min(660rpx, 58vh); }.customer-row { display: flex; align-items: center; justify-content: space-between; width: auto; min-height: 98rpx; margin: 0 24rpx; padding: 14rpx 4rpx; border-bottom: 1rpx solid #edf2f4; border-radius: 0; background: #fff; text-align: left; }.customer-row::after { border: none; }.customer-main { display: flex; min-width: 0; flex: 1; flex-direction: column; }.customer-name { overflow: hidden; color: #1d3944; font-size: 26rpx; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }.customer-meta { margin-top: 6rpx; overflow: hidden; color: #7d929a; font-size: 21rpx; text-overflow: ellipsis; white-space: nowrap; }.selected-mark { flex: none; margin-left: 20rpx; color: #0b83bd; font-size: 31rpx; }
@keyframes sheet-up { from { transform: translateY(36rpx); opacity: .5; } to { transform: translateY(0); opacity: 1; } }
</style>
