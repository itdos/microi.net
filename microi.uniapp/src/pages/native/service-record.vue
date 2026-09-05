<template>
  <mci-page-shell
    class="service-record-page"
    :style="mciTokenStyle"
    :title="pageTitle"
    :subtitle="readOnly ? (archiveEditing ? '修订已归档的客户服务结果' : '已归档的客户服务结果') : '客户服务档案'"
    @back="goBack"
  >
    <mci-skeleton v-if="loading" type="form" :rows="6" />
    <scroll-view v-else class="page-scroll" :class="{ 'page-scroll--readonly': readOnly, 'page-scroll--with-actions': readOnly && canEditArchive }" scroll-y>
      <view class="page-content">
        <template v-if="readOnly">
          <view class="archive-summary">
            <view class="archive-summary__mark"><text>档</text></view>
            <view class="archive-summary__copy">
              <text class="archive-summary__name">{{ customer.KehuMC || '客户服务档案' }}</text>
              <text class="archive-summary__range">{{ form.KaishiSJ || '—' }} 至 {{ form.JieshuSJ || '—' }}</text>
            </view>
            <view class="archive-summary__count"><text>{{ generatedCount || 0 }}</text><text>条记录</text></view>
          </view>

          <view v-if="archiveEditing" class="archive-edit-panel">
            <view class="archive-edit-panel__title"><view class="edit-pencil" /><text>档案统计范围</text></view>
            <view class="archive-edit-dates">
              <picker mode="date" :value="form.KaishiSJ" :end="form.JieshuSJ || '9999-12-31'" @change="form.KaishiSJ = $event.detail.value">
                <view class="archive-edit-field archive-edit-field--picker"><text>开始时间</text><text>{{ form.KaishiSJ || '请选择' }}</text></view>
              </picker>
              <picker mode="date" :value="form.JieshuSJ" :start="form.KaishiSJ || '1950-01-01'" @change="form.JieshuSJ = $event.detail.value">
                <view class="archive-edit-field archive-edit-field--picker"><text>结束时间</text><text>{{ form.JieshuSJ || '请选择' }}</text></view>
              </picker>
            </view>
            <text class="archive-edit-panel__hint">客户、所属商家、关联任务和设备标识保持不变；设备照片可新增、替换或撤下，原文件不会从服务器删除。</text>
          </view>

          <view class="section-heading archive-section-heading">
            <text class="section-title">档案明细</text>
            <text class="archive-generated-time">生成于 {{ generatedTime || '—' }}</text>
          </view>
          <view v-if="!serviceSnapshots.length" class="archive-empty">
            <text class="archive-empty__icon">⌕</text>
            <text class="archive-empty__title">档案中暂无服务记录</text>
            <text class="archive-empty__text">请返回任务详情后联系管理员重新生成。</text>
          </view>
          <view v-for="(item, index) in serviceSnapshots" :key="item.Id || index" class="archive-card">
            <view class="archive-card__header" :class="{ 'archive-card__header--editing': archiveEditing }">
              <view class="archive-card__sequence"><text>{{ index + 1 }}</text></view>
              <view v-if="!archiveEditing" class="archive-card__heading"><text>{{ item.Leixing || '售后服务' }}</text><text>{{ item.FinishTime || '未填写完成时间' }}</text></view>
              <view v-else class="archive-card__edit-heading">
                <text class="archive-edit-label">服务类型</text>
                <input v-model.trim="item.Leixing" maxlength="100" placeholder="请输入服务类型" />
                <text class="archive-edit-label archive-edit-label--time">完成时间</text>
                <view class="archive-time-grid">
                  <picker mode="date" :value="serviceDate(item.FinishTime)" @change="setServiceFinishDate(item, $event.detail.value)">
                    <view class="archive-mini-picker">{{ serviceDate(item.FinishTime) || '选择日期' }}</view>
                  </picker>
                  <picker mode="time" :value="serviceTime(item.FinishTime)" @change="setServiceFinishTime(item, $event.detail.value)">
                    <view class="archive-mini-picker">{{ serviceTime(item.FinishTime) || '选择时间' }}</view>
                  </picker>
                </view>
              </view>
              <text class="archive-card__status">{{ archiveEditing ? '修订中' : '已完成' }}</text>
            </view>
            <view v-if="!archiveEditing" class="archive-card__facts">
              <view><text>服务人员</text><text>{{ item.ShouhouRY || '—' }}</text></view>
              <view><text>服务内容</text><text>{{ item.Neirong || '—' }}</text></view>
            </view>
            <view v-else class="archive-card__edit-body">
              <label class="archive-edit-field"><text>服务人员</text><input v-model.trim="item.ShouhouRY" maxlength="100" placeholder="请输入服务人员" /></label>
              <label class="archive-edit-field archive-edit-field--textarea"><text>服务内容</text><textarea v-model.trim="item.Neirong" maxlength="5000" auto-height placeholder="请输入服务内容" /></label>
            </view>
            <view v-if="item.ShouhouSPArr.length" class="archive-devices">
              <view class="archive-devices__title"><text>设备结果</text><text>{{ item.ShouhouSPArr.length }} 台</text></view>
              <view v-for="(device, deviceIndex) in item.ShouhouSPArr" :key="device.Id || deviceIndex" class="archive-device">
                <view class="archive-device__heading"><text>设备 {{ deviceIndex + 1 }}</text><text v-if="!archiveEditing">{{ device.AnzhuangWZ || '未填写安装位置' }}</text><input v-else v-model.trim="device.AnzhuangWZ" maxlength="255" placeholder="请输入安装位置" /></view>
                <mci-media-uploader
                  v-if="archiveEditing"
                  v-model="device.JieguoTP"
                  class="archive-photo-uploader"
                  :max-count="9"
                  :upload-path="archivePhotoUploadPath(device)"
                  :file-context="archivePhotoFileContext(device)"
                  :upload-context="archivePhotoUploadContext"
                  replaceable
                  remove-text="撤"
                  @upload-state="setArchivePhotoUploadState(device, $event)"
                />
                <text v-if="archiveEditing" class="archive-photo-help">点照片可预览；“换”用于替换，“撤”用于从本档案撤下，最多 9 张。</text>
                <view v-else-if="device._photos.length" class="archive-photo-grid">
                  <image v-for="photo in device._photos" :key="photo" class="archive-photo" :src="photo" mode="aspectFill" @tap="previewArchivePhoto(device._photos, photo)" />
                </view>
                <text v-else-if="!archiveEditing" class="archive-device__empty">无结果照片</text>
              </view>
            </view>
          </view>
          <view class="bottom-space" />
        </template>

        <template v-else>
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
        </template>
      </view>
    </scroll-view>

    <view v-if="!loading && !readOnly" class="bottom-bar" slot="fixed">
      <button class="primary-button" :loading="submitting" :disabled="submitting" @tap="submit">
        {{ recordId ? '重新生成并保存' : '生成并保存' }}
      </button>
    </view>

    <view v-if="!loading && readOnly && canEditArchive" class="bottom-bar" slot="fixed">
      <button v-if="!archiveEditing" class="primary-button primary-button--icon" hover-class="primary-button--pressed" @tap="beginArchiveEdit">
        <view class="edit-pencil edit-pencil--white" /><text>修改服务档案</text>
      </button>
      <view v-else class="archive-action-grid">
        <button class="secondary-button" :disabled="submitting" hover-class="secondary-button--pressed" @tap="cancelArchiveEdit"><view class="cancel-icon" /><text>取消</text></button>
        <button class="primary-button primary-button--icon" :loading="submitting" :disabled="submitting || archivePhotoUploadBlocked" hover-class="primary-button--pressed" @tap="saveArchiveEdit"><view class="save-icon" /><text>{{ archivePhotoUploadBlocked ? '照片处理中' : '保存修改' }}</text></button>
      </view>
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
import {
  buildServiceRecordUpdatePayload,
  cloneServiceRecordEditState,
  normalizeServiceRecordSnapshots,
  serviceRecordPhotoContext
} from '@/tenants/xjy/service-record-view.mjs'

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
      readOnly: false,
      canEditArchive: false,
      archiveEditing: false,
      archiveEditBackup: null,
      archivePhotoUrls: {},
      archivePhotoUploadStates: {},
      archivePhotoUploadContext: {},
      recordUpdateTime: '',
      recordId: '',
      initialCustomerId: '',
      customer: {},
      form: { KaishiSJ: '', JieshuSJ: today() },
      serviceTypes: [],
      selectedServices: [],
      generatedCount: null,
      generatedTime: '',
      serviceSnapshots: [],
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
    pageTitle() {
      if (this.readOnly) return this.archiveEditing ? '修改服务档案' : '服务档案'
      return this.recordId ? '编辑服务记录表' : '生成服务记录表'
    },
    allSelected() {
      return this.serviceTypes.length > 0 && this.selectedServices.length === this.serviceTypes.length
    },
    archivePhotoUploadBlocked() {
      return Object.values(this.archivePhotoUploadStates).some((state) => Number(state && state.pendingCount || 0) > 0 || Number(state && state.failedCount || 0) > 0)
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
    this.readOnly = options.mode === 'view'
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
        if (!this.readOnly) await this.loadServiceTypes()
        if (this.recordId) {
          await this.loadRecord()
          if (this.readOnly) {
            await this.loadArchiveCapabilities()
            await this.resolveSnapshotPhotos()
          }
        }
        else if (this.initialCustomerId) await this.loadInitialCustomer(this.initialCustomerId)
      } catch (error) {
        uni.showToast({ title: error.message || '服务记录加载失败', icon: 'none' })
      } finally {
        this.loading = false
      }
    },
    async loadServiceTypes() {
      const result = await post('/apiengine/platform-sys-base-data?Action=GetSysBaseData', { ParentKey: 'ShouhouDDLX' }, true)
      const rows = result && Number(result.Code) === 1 && Array.isArray(result.Data) ? result.Data : []
      this.serviceTypes = rows.map((item) => ({ label: item.Value || item.Name || item.Key, value: item.Value || item.Key })).filter((item) => item.value)
    },
    async loadRecord() {
      const result = await V8.FormEngine.GetFormData('diy_ServiceRecord', { Id: this.recordId })
      if (!result || Number(result.Code) !== 1 || !result.Data) throw new Error((result && result.Msg) || '服务记录不存在')
      const row = result.Data
      this.recordUpdateTime = row.UpdateTime || ''
      this.form.KaishiSJ = String(row.KaishiSJ || '').slice(0, 10)
      this.form.JieshuSJ = String(row.JieshuSJ || '').slice(0, 10) || today()
      this.selectedServices = parseArray(row.FuwuXM)
      this.generatedTime = row.ShengchengSJ || ''
      this.serviceSnapshots = normalizeServiceRecordSnapshots(row.FuwuJLBSJ)
      this.generatedCount = this.serviceSnapshots.length
      if (this.readOnly) {
        this.customer = { Id: row.KehuID || '', KehuMC: row.KehuMC || '' }
      } else if (row.KehuID) await this.loadInitialCustomer(row.KehuID, row.KehuMC)
      else this.customer = { Id: '', KehuMC: row.KehuMC || '' }
    },
    async loadArchiveCapabilities() {
      try {
        const result = await V8.ApiEngine.Run('service_record_manage', { Action: 'Capabilities', Id: this.recordId }, { checkCode: false })
        const data = result && result.Data || {}
        this.canEditArchive = Number(result && result.Code) === 1 && data.CanEdit === true
        this.archivePhotoUrls = data.PhotoUrls && typeof data.PhotoUrls === 'object' ? data.PhotoUrls : {}
        if (data.UpdateTime !== undefined) this.recordUpdateTime = data.UpdateTime || ''
      } catch (error) {
        // 能力接口失败时保持只读，不能因为前端缓存角色而放开保存入口。
        this.canEditArchive = false
        this.archivePhotoUrls = {}
      }
    },
    async resolveSnapshotPhotos() {
      await Promise.all(this.serviceSnapshots.map((service) => Promise.all(service.ShouhouSPArr.map(async (device) => {
        // 使用归档快照保存的可信上下文签发私有文件地址；上下文无效时不降级为公开链接。
        const context = serviceRecordPhotoContext(device)
        const photos = await Promise.all(device._photoSources.map((photo) => {
          const source = photo && typeof photo === 'object' ? photo : { Path: photo }
          const path = String(source.Path || source.FilePathName || source.FilePath || source.FullPath || '')
          const runtimeUrl = this.archivePhotoUrls[String(source.Id || '')] || this.archivePhotoUrls[path]
          return runtimeUrl || V8.resolveFileUrl(photo, context).catch(() => '')
        }))
        device._photos = photos.filter(Boolean)
      }))))
    },
    archivePhotoFileContext(device) {
      return serviceRecordPhotoContext(device, this.archivePhotoUrls)
    },
    archivePhotoUploadPath(device) {
      return `xjy/service-record/${this.recordId}/${device && device.Id || 'device'}`
    },
    setArchivePhotoUploadState(device, state) {
      const key = String(device && device.Id || '')
      if (!key) return
      this.archivePhotoUploadStates = { ...this.archivePhotoUploadStates, [key]: state || {} }
    },
    previewArchivePhoto(urls, current) {
      if (!Array.isArray(urls) || !urls.length) return
      uni.previewImage({ urls, current })
    },
    serviceDate(value) { return String(value || '').slice(0, 10) },
    serviceTime(value) { return String(value || '').slice(11, 16) },
    setServiceFinishDate(item, value) {
      const time = this.serviceTime(item.FinishTime) || '00:00'
      item.FinishTime = `${value} ${time}:00`
    },
    setServiceFinishTime(item, value) {
      const date = this.serviceDate(item.FinishTime) || today()
      item.FinishTime = `${date} ${value}:00`
    },
    beginArchiveEdit() {
      if (!this.canEditArchive || this.archiveEditing) return
      this.archiveEditBackup = cloneServiceRecordEditState(this.form, this.serviceSnapshots)
      this.archivePhotoUploadStates = {}
      this.archiveEditing = true
    },
    cancelArchiveEdit() {
      if (this.archiveEditBackup) {
        this.form = this.archiveEditBackup.form
        this.serviceSnapshots = this.archiveEditBackup.snapshots
      }
      this.archiveEditBackup = null
      this.archivePhotoUploadStates = {}
      this.archiveEditing = false
    },
    validateArchiveEdit() {
      if (!this.form.JieshuSJ) throw new Error('请选择结束时间')
      if (this.archivePhotoUploadBlocked) throw new Error('请等待设备照片处理完成')
      if (this.form.KaishiSJ && this.form.KaishiSJ > this.form.JieshuSJ) throw new Error('结束时间不能早于开始时间')
      this.serviceSnapshots.forEach((service, index) => {
        if (!String(service.Leixing || '').trim()) throw new Error(`请填写第 ${index + 1} 条记录的服务类型`)
        if (!String(service.FinishTime || '').trim()) throw new Error(`请填写第 ${index + 1} 条记录的完成时间`)
      })
    },
    async saveArchiveEdit() {
      if (this.submitting || !this.canEditArchive) return
      try {
        this.validateArchiveEdit()
        this.submitting = true
        uni.showLoading({ title: '正在保存', mask: true })
        const payload = buildServiceRecordUpdatePayload({
          recordId: this.recordId,
          updateTime: this.recordUpdateTime,
          form: this.form,
          snapshots: this.serviceSnapshots
        })
        const result = await V8.ApiEngine.Run('service_record_manage', payload, { checkCode: false })
        if (!result || Number(result.Code) !== 1) throw new Error(result && result.Msg || '服务档案保存失败')
        this.archiveEditing = false
        this.archiveEditBackup = null
        this.archivePhotoUploadStates = {}
        await this.loadRecord()
        await this.loadArchiveCapabilities()
        await this.resolveSnapshotPhotos()
        uni.$emit('xjy-business-refresh', { key: 'serviceForms' })
        uni.showToast({ title: result.Data && result.Data.Skipped ? '档案内容未变化' : '服务档案已保存', icon: 'success' })
      } catch (error) {
        uni.showToast({ title: error.message || '服务档案保存失败', icon: 'none' })
      } finally {
        uni.hideLoading()
        this.submitting = false
      }
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
    goBack() {
      if (this.archiveEditing) {
        uni.showModal({
          title: '放弃本次修改？', content: '尚未保存的档案内容将恢复。', confirmText: '放弃修改',
          success: ({ confirm }) => { if (confirm) this.cancelArchiveEdit() }
        })
        return
      }
      uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/workspace/index' }) })
    }
  }
}
</script>

<style scoped>
.service-record-page { height: 100vh; background: #f3f7f9; }
.page-scroll { height: calc(100vh - 92rpx - var(--mci-safe-top) - 116rpx - var(--mci-safe-bottom)); }
.page-scroll--readonly { height: calc(100vh - 92rpx - var(--mci-safe-top)); }
.page-scroll--with-actions { height: calc(100vh - 92rpx - var(--mci-safe-top) - 116rpx - var(--mci-safe-bottom)); }
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
.archive-summary { display: grid; grid-template-columns: 72rpx minmax(0,1fr) auto; gap: 18rpx; align-items: center; padding: 26rpx 24rpx; border: 1rpx solid #dce8ec; border-radius: 10rpx; background: #fff; box-shadow: 0 8rpx 24rpx rgba(28,72,88,.06); }
.archive-summary__mark { display: flex; align-items: center; justify-content: center; width: 68rpx; height: 68rpx; border-radius: 9rpx; background: #e8f6fa; color: #087fbd; font-size: 26rpx; font-weight: 750; }.archive-summary__copy { min-width: 0; }.archive-summary__name, .archive-summary__range { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.archive-summary__name { color: #183640; font-size: 28rpx; font-weight: 750; }.archive-summary__range { margin-top: 8rpx; color: #526b75; font-size: 21rpx; }.archive-summary__count { text-align: right; }.archive-summary__count text { display: block; }.archive-summary__count text:first-child { color: #0f6c59; font-size: 38rpx; font-weight: 750; line-height: 1; }.archive-summary__count text:last-child { margin-top: 7rpx; color: #526b75; font-size: 21rpx; }
.archive-edit-panel { margin-top: 16rpx; padding: 20rpx 22rpx; border: 1rpx solid #b9dce8; border-radius: 9rpx; background: #f2fbfd; }.archive-edit-panel__title { display: flex; align-items: center; gap: 14rpx; color: #174b5d; font-size: 24rpx; font-weight: 750; }.archive-edit-panel__hint { display: block; margin-top: 15rpx; color: #526b75; font-size: 20rpx; line-height: 1.55; }.archive-edit-dates { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 12rpx; margin-top: 18rpx; }.archive-edit-dates picker { min-width: 0; }
.archive-section-heading { margin-top: 14rpx; }.archive-generated-time { color: #526b75; font-size: 21rpx; font-weight: 400; }.archive-empty { display: flex; min-height: 300rpx; flex-direction: column; align-items: center; justify-content: center; border: 1rpx solid #e0eaed; border-radius: 9rpx; background: #fff; text-align: center; }.archive-empty__icon { color: #547885; font-size: 54rpx; }.archive-empty__title { margin-top: 12rpx; color: #36525c; font-size: 25rpx; font-weight: 700; }.archive-empty__text { margin-top: 8rpx; color: #526b75; font-size: 21rpx; }
.archive-card { margin-bottom: 18rpx; overflow: hidden; border: 1rpx solid #dce7eb; border-radius: 9rpx; background: #fff; }.archive-card__header { display: grid; grid-template-columns: 50rpx minmax(0,1fr) auto; gap: 14rpx; align-items: center; padding: 22rpx 22rpx 18rpx; border-bottom: 1rpx solid #edf2f4; }.archive-card__sequence { display: flex; align-items: center; justify-content: center; width: 46rpx; height: 46rpx; border-radius: 50%; background: #e8f5f9; color: #087aa9; font-size: 21rpx; font-weight: 750; }.archive-card__heading { min-width: 0; }.archive-card__heading text { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.archive-card__heading text:first-child { color: #213f49; font-size: 26rpx; font-weight: 750; }.archive-card__heading text:last-child { margin-top: 5rpx; color: #526b75; font-size: 20rpx; }.archive-card__status { padding: 7rpx 11rpx; border-radius: 5rpx; background: #e8f7f1; color: #147358; font-size: 19rpx; font-weight: 650; }
.archive-card__facts { padding: 4rpx 22rpx; }.archive-card__facts view { display: grid; grid-template-columns: 132rpx minmax(0,1fr); gap: 16rpx; min-height: 72rpx; align-items: center; border-bottom: 1rpx solid #f0f4f5; }.archive-card__facts view:last-child { border-bottom: none; }.archive-card__facts text:first-child { color: #526b75; font-size: 21rpx; }.archive-card__facts text:last-child { color: #294750; font-size: 23rpx; overflow-wrap: anywhere; }
.archive-card__header--editing { align-items: start; }.archive-card__edit-heading { min-width: 0; }.archive-edit-label { display: block; color: #526b75; font-size: 19rpx; }.archive-edit-label--time { margin-top: 12rpx; }.archive-card__edit-heading input, .archive-device__heading input, .archive-edit-field input { box-sizing: border-box; width: 100%; height: 66rpx; margin-top: 6rpx; padding: 0 16rpx; border: 1rpx solid #cbdde3; border-radius: 7rpx; background: #f8fbfc; color: #213f49; font-size: 23rpx; }.archive-time-grid { display: grid; grid-template-columns: minmax(0,1.35fr) minmax(0,1fr); gap: 10rpx; margin-top: 6rpx; }.archive-mini-picker { box-sizing: border-box; height: 66rpx; padding: 0 12rpx; overflow: hidden; border: 1rpx solid #cbdde3; border-radius: 7rpx; background: #f8fbfc; color: #294750; font-size: 21rpx; line-height: 66rpx; text-overflow: ellipsis; white-space: nowrap; }.archive-card__edit-body { padding: 16rpx 22rpx 20rpx; border-bottom: 1rpx solid #edf2f4; }.archive-edit-field { display: block; min-width: 0; }.archive-edit-field + .archive-edit-field { margin-top: 16rpx; }.archive-edit-field > text:first-child { display: block; color: #526b75; font-size: 20rpx; }.archive-edit-field--picker { box-sizing: border-box; min-height: 84rpx; padding: 12rpx 14rpx; border: 1rpx solid #cbdde3; border-radius: 7rpx; background: #fff; }.archive-edit-field--picker text:last-child { display: block; margin-top: 8rpx; overflow: hidden; color: #213f49; font-size: 22rpx; text-overflow: ellipsis; white-space: nowrap; }.archive-edit-field--textarea textarea { box-sizing: border-box; width: 100%; min-height: 126rpx; margin-top: 7rpx; padding: 14rpx 16rpx; border: 1rpx solid #cbdde3; border-radius: 7rpx; background: #f8fbfc; color: #213f49; font-size: 23rpx; line-height: 1.55; }
.archive-devices { border-top: 10rpx solid #f3f7f9; }.archive-devices__title { display: flex; align-items: center; justify-content: space-between; height: 70rpx; padding: 0 22rpx; color: #35525c; font-size: 22rpx; font-weight: 700; }.archive-devices__title text:last-child { color: #526b75; font-size: 20rpx; font-weight: 500; }.archive-device { margin: 0 22rpx; padding: 17rpx 0 20rpx; border-top: 1rpx solid #edf2f4; }.archive-device__heading { display: flex; align-items: center; justify-content: space-between; gap: 20rpx; }.archive-device__heading text:first-child { flex: none; color: #526b75; font-size: 21rpx; font-weight: 650; }.archive-device__heading text:last-child { min-width: 0; overflow: hidden; color: #294750; font-size: 22rpx; text-overflow: ellipsis; white-space: nowrap; }.archive-device__empty { display: block; margin-top: 12rpx; padding: 16rpx; border-radius: 7rpx; background: #f6f9fa; color: #526b75; font-size: 24rpx; text-align: center; }.archive-photo-grid { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 10rpx; margin-top: 14rpx; }.archive-photo { width: 100%; height: 176rpx; border-radius: 7rpx; background: #edf3f5; }
.archive-device__heading input { min-width: 0; margin-top: 0; }
.archive-photo-uploader { display: block; margin-top: 14rpx; }.archive-photo-help { display: block; margin-top: 12rpx; color: #526b75; font-size: 20rpx; line-height: 1.5; }
.empty-text, .loading-more { padding: 46rpx 20rpx; color: #90a1a8; font-size: 23rpx; text-align: center; }.bottom-space { height: 30rpx; }
.bottom-bar { position: fixed; right: 0; bottom: 0; left: 0; z-index: 20; padding: 16rpx 24rpx calc(16rpx + var(--mci-safe-bottom)); border-top: 1rpx solid #dde7eb; background: rgba(255,255,255,.97); }
.primary-button { height: 82rpx; margin: 0; border-radius: 8rpx; background: #087fbd; color: #fff; font-size: 27rpx; font-weight: 650; line-height: 82rpx; }.primary-button::after { border: none; }.primary-button[disabled] { background: #9bbcc9; color: #fff; }
.primary-button--icon, .secondary-button { display: flex; align-items: center; justify-content: center; gap: 14rpx; line-height: 1; transition: transform .14s ease, background-color .14s ease; }.primary-button--pressed, .secondary-button--pressed { transform: scale(.985); }.archive-action-grid { display: grid; grid-template-columns: minmax(0,.72fr) minmax(0,1.28fr); gap: 14rpx; }.secondary-button { height: 82rpx; margin: 0; border: 1rpx solid #bfd0d6; border-radius: 8rpx; background: #fff; color: #35525c; font-size: 26rpx; font-weight: 650; }.secondary-button::after { border: none; }.edit-pencil { position: relative; width: 28rpx; height: 9rpx; border-radius: 3rpx; background: #087fbd; transform: rotate(-42deg); }.edit-pencil::after { position: absolute; right: -7rpx; top: 0; width: 0; height: 0; border-top: 5rpx solid transparent; border-bottom: 5rpx solid transparent; border-left: 8rpx solid #087fbd; content: ''; }.edit-pencil--white { background: #fff; }.edit-pencil--white::after { border-left-color: #fff; }.cancel-icon { position: relative; width: 25rpx; height: 25rpx; }.cancel-icon::before, .cancel-icon::after { position: absolute; left: 11rpx; top: 0; width: 3rpx; height: 27rpx; border-radius: 2rpx; background: #526b75; content: ''; transform: rotate(45deg); }.cancel-icon::after { transform: rotate(-45deg); }.save-icon { position: relative; box-sizing: border-box; width: 28rpx; height: 28rpx; border: 3rpx solid #fff; border-radius: 3rpx; }.save-icon::before { position: absolute; right: 3rpx; bottom: 3rpx; left: 3rpx; height: 7rpx; border: 2rpx solid #fff; border-radius: 1rpx; content: ''; }
.picker-mask { position: fixed; inset: 0; z-index: 80; display: flex; align-items: flex-end; background: rgba(16,35,43,.42); }
.picker-sheet { width: 100%; padding-bottom: var(--mci-safe-bottom); border-radius: 12rpx 12rpx 0 0; background: #fff; animation: sheet-up .2s ease-out; }.picker-handle { width: 74rpx; height: 7rpx; margin: 12rpx auto 4rpx; border-radius: 4rpx; background: #d7e1e5; }
.picker-header { display: flex; align-items: center; justify-content: space-between; height: 76rpx; padding: 0 26rpx; color: #183640; font-size: 27rpx; font-weight: 700; }.close-button { width: 58rpx; height: 58rpx; color: #78909a; font-size: 38rpx; line-height: 58rpx; }
.search-box { display: grid; grid-template-columns: 36rpx minmax(0, 1fr) 42rpx; align-items: center; height: 72rpx; margin: 0 24rpx 12rpx; padding: 0 16rpx; border: 1rpx solid #dce7eb; border-radius: 8rpx; background: #f5f8f9; }.search-box input { height: 70rpx; color: #203c46; font-size: 24rpx; }.search-icon { color: #78919a; font-size: 29rpx; }.clear-button { width: 42rpx; height: 42rpx; color: #8ba0a7; font-size: 28rpx; line-height: 42rpx; }
.customer-list { height: min(660rpx, 58vh); }.customer-row { display: flex; align-items: center; justify-content: space-between; width: auto; min-height: 98rpx; margin: 0 24rpx; padding: 14rpx 4rpx; border-bottom: 1rpx solid #edf2f4; border-radius: 0; background: #fff; text-align: left; }.customer-row::after { border: none; }.customer-main { display: flex; min-width: 0; flex: 1; flex-direction: column; }.customer-name { overflow: hidden; color: #1d3944; font-size: 26rpx; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }.customer-meta { margin-top: 6rpx; overflow: hidden; color: #7d929a; font-size: 21rpx; text-overflow: ellipsis; white-space: nowrap; }.selected-mark { flex: none; margin-left: 20rpx; color: #0b83bd; font-size: 31rpx; }
@keyframes sheet-up { from { transform: translateY(36rpx); opacity: .5; } to { transform: translateY(0); opacity: 1; } }
</style>
