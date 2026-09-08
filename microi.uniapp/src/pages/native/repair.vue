<template>
  <mci-page-shell class="repair-page" :style="mciTokenStyle" title="设备报修" subtitle="提交后自动生成售后任务" @back="goBack">
    <mci-skeleton v-if="loading" type="form" :rows="7" />
    <view v-else-if="error" class="error-state">
      <image src="/static/xjy/business/sh.png" mode="aspectFit" />
      <text>{{ error }}</text>
      <view @tap="loadData"><text>重新加载</text></view>
    </view>
    <scroll-view v-else class="repair-scroll" scroll-y>
      <view v-if="!directRepair" class="device-band">
        <image src="/static/xjy/business/shebei.png" mode="aspectFit" />
        <view>
          <text>{{ device.ShebeiMC || device.ShangpinMC || '客户设备' }}</text>
          <text>{{ [device.ShebeiBH, device.ShebeiXH, device.AnzhuangWZ].filter(Boolean).join(' · ') || '设备信息已关联' }}</text>
        </view>
        <text>{{ device.ShebeiZT || '使用中' }}</text>
      </view>

      <view v-if="directRepair" class="section-band device-section">
        <view class="form-row form-row--picker" hover-class="type-option--pressed" @tap="openDevicePicker">
          <text><text class="required">*</text>设备型号</text>
          <text :class="{ placeholder: !deviceId }">{{ deviceLoading ? '正在加载设备…' : deviceLabel || '请选择报修设备' }}</text>
          <text>›</text>
        </view>
        <text v-if="deviceId" class="selected-device-note">{{ [device.ShebeiBH, device.KehuMC, device.AnzhuangWZ].filter(Boolean).join(' · ') }}</text>
        <text v-else class="selected-device-note">请从当前账号有权查看的设备中选择</text>
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
          <mci-media-uploader v-model="form.images" :max-count="9" media-type="image" upload-path="xjy/repair/images" :file-context="uncommittedFileContext" />
        </view>
        <view class="upload-group">
          <view class="upload-title"><text>故障视频</text><text>最多 3 个</text></view>
          <mci-media-uploader v-model="form.videos" :max-count="3" media-type="video" upload-path="xjy/repair/videos" :file-context="uncommittedFileContext" />
        </view>
      </view>
      <view class="safe-space"></view>
    </scroll-view>

    <template #fixed>
      <view v-if="!loading && !error" class="submit-bar">
        <view class="submit-tip"><text>提交后可在“售后任务”跟踪进度</text></view>
        <view class="submit-button" :class="{ disabled: submitting || deviceLoading || !deviceId }" :aria-disabled="submitting || deviceLoading || !deviceId" hover-class="submit-button--pressed" @tap="submit">
          <image src="/static/xjy/user/my-baoxiu.png" mode="aspectFit" />
          <text>{{ submitting ? '提交中' : '提交报修' }}</text>
        </view>
      </view>
      <root-portal v-if="devicePickerVisible">
        <view class="device-picker-mask" :style="mciTokenStyle" @tap="closeDevicePicker">
          <view class="device-picker-sheet" @tap.stop>
            <view class="device-picker-head"><text>选择报修设备</text><view @tap="closeDevicePicker"><text>×</text></view></view>
            <text class="device-picker-hint">仅展示当前账号设备列表权限内的设备</text>
            <view class="device-picker-search">
              <input v-model="deviceKeyword" placeholder="搜索型号、编号、安装位置" confirm-type="search" @input="scheduleDeviceSearch" @confirm="searchDevices" />
              <view @tap="searchDevices"><text>搜索</text></view>
            </view>
            <scroll-view class="device-picker-list" scroll-y lower-threshold="100" @scrolltolower="loadMoreDevices">
              <mci-skeleton v-if="deviceListLoading && !deviceRows.length" type="list" :rows="4" />
              <view v-else-if="deviceListError && !deviceRows.length" class="device-picker-state">
                <text>{{ deviceListError }}</text><view @tap="searchDevices"><text>重新加载</text></view>
              </view>
              <view v-else-if="!deviceRows.length" class="device-picker-state"><text>{{ deviceKeyword ? '未找到匹配的设备，请更换关键词' : '当前账号暂无可报修的设备' }}</text></view>
              <view v-else>
                <view v-for="row in deviceRows" :key="row.Id" class="device-picker-row" :class="{ selected: String(row.Id) === String(deviceId) }" hover-class="type-option--pressed" @tap="selectDevice(row)">
                  <text class="device-picker-model">{{ row.ShebeiXH || row.ShebeiMC || row.ShangpinMC || '未填写型号' }}</text>
                  <text>设备编号：{{ row.ShebeiBH || '未填写' }}</text>
                  <text>客户：{{ row.KehuMC || '未填写' }}</text>
                  <text>安装位置：{{ row.AnzhuangWZ || '未填写' }}</text>
                </view>
                <view class="device-picker-footer" @tap="loadMoreDevices"><text>{{ deviceListLoading ? '正在加载…' : deviceListError ? '加载失败，点击重试' : deviceListFinished ? `共 ${deviceTotal} 台设备` : '加载更多' }}</text></view>
              </view>
            </scroll-view>
          </view>
        </view>
      </root-portal>
    </template>
  </mci-page-shell>
</template>

<script>
import { themeMixin } from '@/utils/theme.js'
import { V8, getUser, post } from '@/utils/request.js'
import { callApiEngine, findMenu, loadModuleRows, requireLogin } from '@/platform/business-runtime.js'
import { getBusinessModule } from '@/platform/business.js'

function parseRegion(value) {
  if (!value) return []
  if (Array.isArray(value)) return value.filter(Boolean)
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) return parsed.filter(Boolean)
  } catch (error) {}
  return String(value).split(/[,/]/).map((item) => item.trim()).filter(Boolean)
}

// 报修附件由 shenqing_shouhou 在提交时创建新记录；提交前不存在可授权的
// FormDataId。上传组件仅展示本地临时地址，任何意外回填的私有路径均失败关闭。
const UNCOMMITTED_PRIVATE_FILE_CONTEXT = Object.freeze({ private: true, failClosed: true })

export default {
  mixins: [themeMixin],
  data() {
    return {
      directRepair: false,
      deviceId: '',
      device: {},
      deviceLoading: false,
      deviceRequestId: 0,
      devicePickerVisible: false,
      deviceKeyword: '',
      deviceRows: [],
      devicePage: 0,
      deviceTotal: 0,
      deviceListFinished: false,
      deviceListLoading: false,
      deviceListError: '',
      deviceListRequestId: 0,
      deviceSearchTimer: null,
      customer: {},
      repairTypes: [],
      loading: true,
      submitting: false,
      error: '',
      form: { contact: '', phone: '', region: [], address: '', types: [], otherType: '', reason: '', images: '', videos: '' },
      uncommittedFileContext: UNCOMMITTED_PRIVATE_FILE_CONTEXT
    }
  },
  computed: {
    deviceLabel() { return this.device.ShebeiXH || this.device.ShebeiMC || this.device.ShangpinMC || this.device.ShebeiBH || '' },
    regionText() { return this.form.region.join(' / ') }
  },
  onLoad(options) {
    // 显式入口标记隔离新流程，设备详情/列表原有的 deviceId、id 链接继续展示设备信息。
    this.directRepair = options.entry === 'quick'
    this.deviceId = this.directRepair ? '' : decodeURIComponent(options.deviceId || options.id || '')
    if (!requireLogin()) return
    this.loadData()
  },
  onUnload() {
    clearTimeout(this.deviceSearchTimer)
    this.deviceRequestId += 1
    this.deviceListRequestId += 1
  },
  methods: {
    async authorizedDeviceModule(refresh = false) {
      const base = getBusinessModule('devices')
      if (!base) throw new Error('设备模块未配置')
      const menu = await findMenu(base.menuAliases || [], base.table, refresh)
      if (!menu || !menu.Id) throw new Error('当前账号没有设备列表查看权限，请联系管理员')
      return { ...base, menuId: menu.Id, moduleEngineKey: menu.ModuleEngineKey || base.table }
    },
    async checkSelectedDevice(id) {
      const config = await this.authorizedDeviceModule(true)
      // 用同一授权列表回查选中 Id，禁止在设备失效或权限变化后回退到无菜单查询。
      const result = await loadModuleRows(config, { pageSize: 1, extraWhere: [['Id', '=', id]], refresh: true })
      if (!result.rows.some((row) => String(row.Id) === String(id))) throw new Error('该设备已不可用或不在当前账号权限内，请重新选择')
      return config
    },
    openDevicePicker() {
      if (this.submitting || this.deviceLoading) return
      this.devicePickerVisible = true
      this.deviceKeyword = ''
      this.searchDevices()
    },
    closeDevicePicker() {
      clearTimeout(this.deviceSearchTimer)
      this.deviceListRequestId += 1
      this.deviceListLoading = false
      this.devicePickerVisible = false
    },
    scheduleDeviceSearch() {
      clearTimeout(this.deviceSearchTimer)
      // 立即使旧搜索失效，防止防抖期间显示旧关键词结果并被误选。
      this.deviceListRequestId += 1
      this.deviceRows = []
      this.deviceListLoading = true
      this.deviceSearchTimer = setTimeout(() => this.searchDevices(), 350)
    },
    searchDevices() {
      clearTimeout(this.deviceSearchTimer)
      return this.loadDevices(true)
    },
    async loadDevices(reset = false) {
      if (!reset && (this.deviceListLoading || this.deviceListFinished)) return
      const requestId = ++this.deviceListRequestId
      const pageIndex = reset ? 1 : this.devicePage + 1
      const keyword = this.deviceKeyword.trim()
      if (reset) { this.deviceRows = []; this.deviceTotal = 0; this.devicePage = 0; this.deviceListFinished = false }
      this.deviceListLoading = true
      this.deviceListError = ''
      try {
        const config = await this.authorizedDeviceModule(reset)
        // 明确按卡片字段做分组 OR 查询，安装位置命中即可；不叠加菜单 _Keyword，
        // 避免“位置匹配但型号不匹配”的设备被二次过滤。权限仍由授权菜单限定。
        const searchFields = ['ShebeiXH', 'ShebeiBH', 'ShangpinMC', 'KehuMC', 'AnzhuangWZ']
        const extraWhere = keyword ? searchFields.map((Name, index) => ({
          Name, Type: 'Like', Value: keyword, AndOr: index === 0 ? 'AND' : 'OR',
          GroupStart: index === 0, GroupEnd: index === searchFields.length - 1
        })) : []
        const result = await loadModuleRows(config, { pageIndex, pageSize: 20, extraWhere, refresh: true })
        if (requestId !== this.deviceListRequestId) return
        this.deviceRows = reset ? result.rows : this.deviceRows.concat(result.rows)
        this.devicePage = pageIndex
        this.deviceTotal = result.count || this.deviceRows.length
        this.deviceListFinished = result.rows.length < 20 || (result.count > 0 && this.deviceRows.length >= result.count)
      } catch (error) {
        if (requestId === this.deviceListRequestId) this.deviceListError = error.message || '设备加载失败'
      } finally {
        if (requestId === this.deviceListRequestId) this.deviceListLoading = false
      }
    },
    loadMoreDevices() { return this.loadDevices() },
    clearDevice() {
      this.deviceId = ''
      this.device = {}
      this.customer = {}
      Object.assign(this.form, { contact: '', phone: '', region: [], address: '' })
    },
    fillContact() {
      const source = { ...this.device, ...this.customer }
      this.form.contact = source.LianxiR || source.KehuLXR || ''
      this.form.phone = source.LianxiDH || source.KehuDH || source.ShoujiH || ''
      this.form.region = parseRegion(source.Chengshi)
      this.form.address = source.XiangxiDZ || source.Dizhi || source.AnzhuangWZ || ''
    },
    async selectDevice(row) {
      if (this.deviceLoading || this.submitting || !row.Id) return
      this.closeDevicePicker()
      this.clearDevice()
      const requestId = ++this.deviceRequestId
      this.deviceLoading = true
      try {
        const id = String(row.Id)
        const config = await this.checkSelectedDevice(id)
        const [deviceResult, customerResult] = await Promise.all([
          V8.FormEngine.GetFormData(config.table, { Id: id, _SysMenuId: config.menuId }),
          callApiEngine('repair_customer', { Id: id })
        ])
        if (!deviceResult || Number(deviceResult.Code) !== 1) throw new Error(deviceResult && deviceResult.Msg || '设备信息加载失败')
        if (!customerResult || Number(customerResult.Code) !== 1) throw new Error(customerResult && customerResult.Msg || '联系信息加载失败，请重新选择设备')
        if (requestId !== this.deviceRequestId) return
        this.device = deviceResult.Data || {}
        this.customer = customerResult.Data || {}
        this.deviceId = id
        this.fillContact()
      } catch (error) {
        if (requestId === this.deviceRequestId) uni.showToast({ title: error.message || '设备加载失败，请重试', icon: 'none' })
      } finally {
        if (requestId === this.deviceRequestId) this.deviceLoading = false
      }
    },
    async loadData() {
      if (!this.directRepair && !this.deviceId) { this.error = '缺少设备编号'; this.loading = false; return }
      this.loading = true
      this.error = ''
      try {
        const [deviceResult, customerResult, typeResult] = await Promise.allSettled([
          this.directRepair ? Promise.resolve(null) : V8.FormEngine.GetFormData('Diy_KehuSB', { Id: this.deviceId }),
          this.directRepair ? Promise.resolve(null) : callApiEngine('repair_customer', { Id: this.deviceId }),
          post('/apiengine/platform-sys-base-data?Action=GetSysBaseData', { ParentKey: 'BaoxiuLX' }, true)
        ])
        if (!this.directRepair && (deviceResult.status !== 'fulfilled' || !deviceResult.value || Number(deviceResult.value.Code) !== 1)) {
          throw new Error('设备信息加载失败')
        }
        this.device = deviceResult.value && deviceResult.value.Data || {}
        this.customer = customerResult.status === 'fulfilled' && customerResult.value && Number(customerResult.value.Code) === 1
          ? (customerResult.value.Data || {})
          : {}
        const baseRows = typeResult.status === 'fulfilled' && typeResult.value && Number(typeResult.value.Code) === 1
          ? (typeResult.value.Data || [])
          : []
        this.repairTypes = baseRows.map((item) => ({ value: item.Key || item.Id, name: item.Value || item.Name || item.Key })).filter((item) => item.name)
        this.fillContact()
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
      if (this.deviceLoading) return '设备信息加载中，请稍候'
      if (!this.deviceId) return this.directRepair ? '请选择设备型号' : '缺少设备编号'
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
        if (this.directRepair) {
          try { await this.checkSelectedDevice(this.deviceId) }
          catch (error) { this.clearDevice(); throw error }
        }
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
        const taskId = String(result.Data && (result.Data.TaskId || result.Data.Id) || '').trim()
        const targetUrl = taskId
          ? `/pages/task/list?scope=all&focusTaskId=${encodeURIComponent(taskId)}`
          : '/pages/task/list?scope=all'
        uni.showToast({ title: '报修提交成功', icon: 'success' })
        setTimeout(() => uni.redirectTo({ url: targetUrl }), 650)
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
.device-section{padding-bottom:18rpx}.selected-device-note{display:block;margin-top:12rpx;color:#7a9099;font-size:21rpx;line-height:32rpx;word-break:break-all}
.device-picker-mask{position:fixed;inset:0;z-index:9999;display:flex;align-items:flex-end;background:rgba(9,29,37,.48)}
/* root-portal 会脱离页面变量继承链：弹层显式接入主题，安全区缺省时也保留左右留白。 */
.device-picker-sheet{box-sizing:border-box;display:flex;flex-direction:column;width:100%;height:78vh;max-height:calc(100vh - var(--mci-safe-top,0px) - 92rpx);padding:24rpx 32rpx;padding-bottom:calc(24rpx + var(--mci-safe-bottom,0px));border-radius:16rpx 16rpx 0 0;background:#f4f8fa}
.device-picker-head{display:flex;flex:none;align-items:center;justify-content:space-between;color:#294b57;font-size:30rpx;font-weight:700}.device-picker-head>view{display:flex;align-items:center;justify-content:center;width:72rpx;height:72rpx;color:#718994;font-size:40rpx}
.device-picker-hint{flex:none;color:#7a9099;font-size:22rpx}.device-picker-search{display:flex;flex:none;align-items:center;gap:16rpx;margin:20rpx 0;padding:0 18rpx;border:1px solid #dce8ed;border-radius:8px;background:#fff}.device-picker-search input{flex:1;min-width:0;height:84rpx;color:#294b57;font-size:24rpx}.device-picker-search>view{display:flex;align-items:center;min-height:84rpx;color:#087dad;font-size:24rpx}
.device-picker-list{flex:1;height:0;min-height:0}.device-picker-row{margin-bottom:16rpx;padding:20rpx;border:1px solid #dce8ed;border-radius:8px;background:#fff}.device-picker-row.selected{border-color:#087dad;background:#eef9fc}.device-picker-row>text{display:block;margin-top:6rpx;color:#637c86;font-size:22rpx;line-height:34rpx;word-break:break-all}.device-picker-row .device-picker-model{margin:0;color:#294b57;font-size:27rpx;font-weight:700}
.device-picker-state{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:38vh;padding:24rpx;color:#718994;font-size:25rpx;line-height:38rpx;text-align:center}.device-picker-state>view{margin-top:20rpx;padding:16rpx 24rpx;color:#087dad}.device-picker-footer{padding:22rpx;color:#718994;font-size:23rpx;text-align:center}
.repair-page{height:100vh;overflow:hidden}.repair-scroll{height:calc(100vh - var(--mci-safe-top) - 92rpx - 118rpx - var(--mci-safe-bottom))}.device-band{display:grid;grid-template-columns:68rpx minmax(0,1fr) auto;gap:16rpx;align-items:center;padding:24rpx;color:#fff;background:#063b5c}.device-band image{box-sizing:border-box;width:58rpx;height:58rpx;padding:6rpx;border-radius:8px;background:#fff}.device-band>view{min-width:0}.device-band>view text{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.device-band>view text:first-child{font-size:28rpx;font-weight:750}.device-band>view text:last-child{margin-top:6rpx;color:rgba(255,255,255,.7);font-size:20rpx}.device-band>text{padding:7rpx 11rpx;border-radius:6px;background:rgba(255,255,255,.15);font-size:20rpx}.section-band{margin-top:14rpx;padding:0 24rpx 24rpx;background:#fff}.section-head{min-height:88rpx;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #edf2f4}.section-head text:first-child{color:#294b57;font-size:27rpx;font-weight:750}.section-head text:last-child{color:#8a9ca3;font-size:20rpx}.form-row{min-height:84rpx;display:grid;grid-template-columns:190rpx minmax(0,1fr);align-items:center;border-bottom:1px solid #eff3f5}.form-row>text:first-child{color:#637c86;font-size:23rpx}.form-row input{height:72rpx;color:#294b57;font-size:24rpx;text-align:right}.form-row--picker{grid-template-columns:190rpx minmax(0,1fr) 24rpx}.form-row--picker>text:nth-child(2){overflow:hidden;color:#294b57;font-size:24rpx;text-align:right;text-overflow:ellipsis;white-space:nowrap}.form-row--picker>text:last-child{color:#9aaab0;font-size:31rpx;text-align:right}.form-row--picker .placeholder{color:#a5b2b7}.required{margin-right:4rpx;color:#d9472b}.type-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12rpx;padding:20rpx 0}.type-option{min-height:64rpx;display:flex;align-items:center;justify-content:space-between;padding:0 16rpx;border:1px solid #dce8ed;border-radius:8px;color:#54717c;background:#f8fbfc;font-size:22rpx;transition:transform .14s ease,background .14s ease}.type-option.active{border-color:rgba(11,134,212,.38);color:#087dad;background:#e9f6fa}.type-option text:last-child{font-size:25rpx}.type-option--pressed{transform:scale(.97)}.type-empty{padding:22rpx 0;color:#899ba2;font-size:22rpx}.reason-input{box-sizing:border-box;width:100%;height:230rpx;margin-top:20rpx;padding:18rpx;border:1px solid #dfe9ed;border-radius:8px;color:#294b57;background:#f7fafb;font-size:24rpx;line-height:38rpx}.upload-group{margin-top:24rpx}.upload-title{display:flex;align-items:center;justify-content:space-between;margin-bottom:14rpx}.upload-title text:first-child{color:#4b6873;font-size:23rpx;font-weight:650}.upload-title text:last-child{color:#94a4aa;font-size:19rpx}.safe-space{height:30rpx}.submit-bar{position:fixed;right:0;bottom:0;left:0;z-index:18;display:grid;grid-template-columns:minmax(0,1fr) 230rpx;gap:16rpx;align-items:center;box-sizing:border-box;min-height:112rpx;padding:15rpx max(24rpx,var(--mci-safe-right)) calc(15rpx + var(--mci-safe-bottom)) max(24rpx,var(--mci-safe-left));border-top:1px solid #e4ecef;background:rgba(255,255,255,.97);box-shadow:0 -8rpx 24rpx rgba(20,61,78,.07)}.submit-tip{min-width:0;color:#7a9099;font-size:20rpx;line-height:30rpx}.submit-button{display:flex;align-items:center;justify-content:center;gap:10rpx;height:76rpx;border-radius:8px;color:#fff;background:#e54625;font-size:25rpx;font-weight:750;text-align:center;transition:transform .15s ease}.submit-button image{width:34rpx;height:34rpx;filter:brightness(0) invert(1)}.submit-button--pressed{transform:scale(.97)}.submit-button.disabled{opacity:.58}.error-state{min-height:62vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40rpx;color:#6f858e;font-size:24rpx}.error-state image{width:100rpx;height:100rpx;opacity:.45}.error-state>text{margin-top:18rpx}.error-state>view{margin-top:22rpx;padding:14rpx 28rpx;border-radius:7px;color:#fff;background:#087da8}@media(prefers-reduced-motion:reduce){.type-option,.submit-button{transition:none}}
</style>
