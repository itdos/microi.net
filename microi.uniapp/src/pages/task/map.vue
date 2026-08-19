<template>
  <mci-page-shell class="map-page" :style="mciTokenStyle" :title="pageTitle" :subtitle="pageSubtitle" @back="goBack">
    <template #right><view class="refresh-action" hover-class="refresh-action--pressed" @tap="reload"><text>↻</text></view></template>
    <view v-if="mode === 'task' || hasListCustomerFilters" class="task-map-summary"><text>{{ positionedTaskCount }} 个{{ entityLabel }}有坐标</text><text>{{ markers.length }} 个位置 · 共 {{ rows.length }} 个{{ entityLabel }}</text></view>
    <view v-else-if="!taskId" class="range-band"><text>范围</text><slider class="range-slider" :value="radius" min="1" max="50" step="1" active-color="#087DA8" background-color="#dce7eb" block-size="18" @change="changeRadius" /><text>{{ radius }} km</text></view>
    <view v-else class="status-legend"><view><text class="status-dot unfinished"></text><text>未完成设备</text></view><view><text class="status-dot complete"></text><text>已完成设备</text></view></view>
    <view class="map-wrap">
      <view v-if="loading" class="map-loading"><mci-skeleton type="detail" :rows="4" /><text>正在获取位置与数据</text></view>
      <map v-else class="business-map" :latitude="latitude" :longitude="longitude" :markers="markers" :include-points="markers" :show-location="true" :enable-zoom="true" @markertap="selectMarker" />
      <view v-if="!loading && !markers.length" class="map-empty"><text>{{ emptyText }}</text></view>
    </view>
    <view v-if="selected" class="entity-sheet">
      <view class="entity-sheet__handle"></view>
      <view class="entity-sheet__heading">
        <view><text>{{ selectedTitle }}</text><text>{{ selectedSubtitle }}</text></view>
        <view @tap="clearSelection"><text>×</text></view>
      </view>

      <template v-if="mode === 'device'">
        <scroll-view v-if="selectedGroup.length > 1" class="task-group-list" :style="{ height: selectedGroupHeight }" scroll-y :show-scrollbar="false">
          <view v-for="item in selectedGroup" :key="item.TaskDeviceId || item.Id" class="task-group-item" :class="{ active: selected && selectedTaskDeviceKey(selected) === selectedTaskDeviceKey(item) }" @tap="selectGroupTask(item)">
            <view><text>{{ item.ShebeiMC || item.ShangpinMC || '任务设备' }}</text><text>{{ item.ShebeiBH || item.ShebeiXH || '暂无设备编号' }}</text></view>
            <text>{{ item.TaskDeviceStatus || '未完成' }}</text>
          </view>
        </scroll-view>
        <view class="entity-sheet__row"><text>安装位置</text><text>{{ selected.AnzhuangWZ || '-' }}</text></view>
        <view v-if="taskId" class="entity-sheet__row"><text>任务状态</text><text :class="selectedTaskComplete ? 'status-complete' : 'status-unfinished'">{{ selected.TaskDeviceStatus || '未完成' }}</text></view>
        <view class="entity-sheet__row"><text>设备状态</text><text>{{ selected.ShebeiZT || '-' }}</text></view>
      </template>
      <template v-else-if="mode === 'task'">
        <scroll-view v-if="selectedGroup.length > 1" class="task-group-list" :style="{ height: selectedGroupHeight }" scroll-y :show-scrollbar="false">
          <view v-for="item in selectedGroup" :key="item.Id" class="task-group-item" :class="{ active: selected && selected.Id === item.Id }" @tap="selectGroupTask(item)">
            <view><text>{{ item.customer || item.KehuMC || '售后任务' }}</text><text>{{ item.no || item.type || '暂无任务编号' }}</text></view>
            <text>{{ item.state || '待处理' }}</text>
          </view>
        </scroll-view>
        <view class="entity-sheet__row"><text>任务状态</text><text>{{ selected.state || '-' }}</text></view>
        <view class="entity-sheet__row"><text>服务人员</text><text>{{ selected.serviceUser || '-' }}</text></view>
        <view class="entity-sheet__row"><text>现场地址</text><text>{{ selected.address || '-' }}</text></view>
      </template>
      <template v-else-if="mode === 'customer'">
        <scroll-view v-if="selectedGroup.length > 1" class="task-group-list" :style="{ height: selectedGroupHeight }" scroll-y :show-scrollbar="false">
          <view v-for="item in selectedGroup" :key="item.Id" class="task-group-item" :class="{ active: selected && selected.Id === item.Id }" @tap="selectGroupTask(item)">
            <view><text>{{ item.KehuMC || '未命名客户' }}</text><text>{{ [item.Chengshi, item.XiangxiDZ].filter(Boolean).join(' ') || '暂无详细地址' }}</text></view>
            <text>客户</text>
          </view>
        </scroll-view>
        <view class="entity-sheet__row"><text>负责人</text><text>{{ selected.FuzeR || '-' }}</text></view>
        <view class="entity-sheet__row"><text>联系电话</text><text>{{ selected.FuzeRDH || selected.LianxiDH || '-' }}</text></view>
        <view class="entity-sheet__row"><text>详细地址</text><text>{{ [selected.Chengshi, selected.XiangxiDZ].filter(Boolean).join(' ') || '-' }}</text></view>
      </template>
      <template v-else>
        <view class="entity-sheet__row"><text>订单数量</text><text>{{ selected.DingdanSL || 0 }}</text></view>
        <view class="entity-sheet__row"><text>设备数量</text><text>{{ selected.ShebeiSL || 0 }}</text></view>
        <view v-if="mode === 'contacts'" class="contacts-block">
          <text class="contacts-label">客户联系人</text>
          <mci-skeleton v-if="contactsLoading" type="list" :rows="2" />
          <view v-else class="contact-chips">
            <view v-for="contact in contacts" :key="contact.Id" class="contact-chip" @tap="openContact(contact)"><text>{{ contact.Xingming || '未命名' }}</text></view>
            <text v-if="!contacts.length" class="contacts-empty">暂无联系人</text>
          </view>
        </view>
      </template>

      <view class="entity-sheet__actions">
        <view @tap="openSelected"><text>{{ primaryActionLabel }}</text></view>
        <view @tap="navigate"><text>导航到现场</text></view>
      </view>
    </view>
  </mci-page-shell>
</template>

<script>
import { themeMixin } from '@/utils/theme.js'
import { V8 } from '@/utils/request.js'
import { callApiEngine, loadModuleRows, openForm } from '@/platform/business-runtime.js'
import { getBusinessModule } from '@/platform/business.js'
import { loadAllTaskDevices, loadTasks } from '@/utils/xjy-task.js'

const MODE_META = {
  task: { title: '任务地图', entity: '任务', action: '查看任务详情' },
  device: { title: '设备地图', entity: '设备', action: '查看设备详情' },
  customer: { title: '客户地图', entity: '客户', action: '查看客户详情' },
  contacts: { title: '联系人地图', entity: '客户', action: '查看全部联系人' },
  visit: { title: '跟进地图', entity: '客户', action: '查看跟进记录' }
}

// 客户列表的移动端卡片字段通常不包含隐藏经纬度。地图查询必须显式请求坐标，
// 否则虽然分页加载了全部客户，绝大多数行仍会因缺少坐标字段而被过滤掉。
const CUSTOMER_MAP_SELECT_FIELDS = [
  'Id', 'KehuMC', 'FuzeR', 'FuzeRDH', 'LianxiDH',
  'Chengshi', 'XiangxiDZ', 'KehuDT_Lat', 'KehuDT_Lng'
]

function parseTaskFilters(value) {
  if (!value) return {}
  const candidates = [String(value)]
  try {
    const decoded = decodeURIComponent(String(value))
    if (decoded !== candidates[0]) candidates.push(decoded)
  } catch (error) {}
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed
    } catch (error) {}
  }
  return {}
}

export default {
  mixins: [themeMixin],
  data() {
    return {
      mode: 'device', customerId: '', taskId: '', taskType: '', radius: 15, latitude: 30.2741, longitude: 120.1551,
      taskFilters: {}, deviceFilters: {}, customerFilters: {}, rows: [], markers: [], markerGroups: [], selected: null, selectedGroup: [], loading: true, contactsLoading: false, contacts: []
    }
  },
  computed: {
    meta() { return MODE_META[this.mode] || MODE_META.device },
    hasListCustomerFilters() { return this.mode === 'customer' && this.customerFilters.fromList === true },
    pageTitle() { return this.meta.title },
    entityLabel() { return this.meta.entity },
    positionedTaskCount() { return this.markerGroups.reduce((total, group) => total + group.rows.length, 0) },
    pageSubtitle() { return this.mode === 'task' ? `${this.positionedTaskCount}/${this.rows.length} 个任务有坐标 · ${this.markers.length} 个位置` : (this.taskId ? `${this.positionedTaskCount}/${this.rows.length} 台设备有位置 · ${this.markers.length} 个位置` : (this.hasListCustomerFilters ? `${this.positionedTaskCount}/${this.rows.length} 个客户有坐标 · ${this.markers.length} 个位置` : (this.markers.length ? `附近 ${this.markers.length} 个${this.entityLabel}` : `按现场位置查找${this.entityLabel}`))) },
    emptyText() { return this.mode === 'task' ? '当前可查看的售后任务暂无有效坐标' : (this.taskId ? '本任务设备暂无有效定位' : (this.hasListCustomerFilters ? '当前筛选到的客户暂无有效坐标' : `当前范围内暂无${this.entityLabel}`)) },
    selectedTitle() { return this.mode === 'device' ? (this.selectedGroup.length > 1 ? `${this.selectedGroup.length} 台任务设备` : (this.selected.ShebeiMC || this.selected.ShangpinMC || this.selected.KehuMC || '客户设备')) : (this.mode === 'task' ? (this.selectedGroup.length > 1 ? `${this.selectedGroup.length} 个售后任务` : (this.selected.customer || this.selected.KehuMC || '售后任务')) : (this.mode === 'customer' && this.selectedGroup.length > 1 ? `${this.selectedGroup.length} 个客户` : (this.selected.KehuMC || '客户'))) },
    selectedSubtitle() { return this.mode === 'device' ? (this.selectedGroup.length > 1 ? '位于同一安装坐标，请选择设备' : (this.selected.ShebeiBH || this.selected.ShebeiXH || '')) : (this.mode === 'task' ? (this.selectedGroup.length > 1 ? '位于同一服务坐标，请选择任务' : ([this.selected.no, this.selected.type].filter(Boolean).join(' · '))) : (this.mode === 'customer' && this.selectedGroup.length > 1 ? '位于同一客户坐标，请选择客户' : ([this.selected.Chengshi, this.selected.XiangxiDZ].filter(Boolean).join(' ') || this.selected.LianxiR || ''))) },
    selectedGroupHeight() { return `${Math.min(this.selectedGroup.length, 3) * 82}rpx` },
    primaryActionLabel() { return this.taskId ? (this.selectedGroup.length > 1 ? '处理选中设备' : '处理任务设备') : ((this.mode === 'task' || this.mode === 'customer') && this.selectedGroup.length > 1 ? `查看选中${this.entityLabel}` : this.meta.action) },
    selectedTaskComplete() { return !!(this.selected && (String(this.selected.FuwuZTZ) === '1' || this.selected.TaskDeviceStatus === '已完成')) }
  },
  onLoad(options) {
    this.mode = MODE_META[options.mode] ? options.mode : 'device'
    this.customerId = decodeURIComponent(options.customerId || '')
    this.taskId = decodeURIComponent(options.taskId || '')
    this.taskType = decodeURIComponent(options.taskType || '')
    const routeFilters = parseTaskFilters(options.filters)
    this.taskFilters = this.mode === 'task' ? routeFilters : {}
    this.deviceFilters = this.mode === 'device' ? routeFilters : {}
    this.customerFilters = this.mode === 'customer' ? routeFilters : {}
    if (this.taskFilters.customerId) this.customerId = String(this.taskFilters.customerId)
    this.reload()
  },
  methods: {
    coordinates(item) {
      return this.mode === 'device'
        ? { latitude: Number(item.KehuSB_Lat), longitude: Number(item.KehuSB_Lng) }
        : { latitude: Number(item.KehuDT_Lat), longitude: Number(item.KehuDT_Lng) }
    },
    markerRows(rows) {
      if (this.mode === 'task' || (this.mode === 'device' && this.taskId) || this.hasListCustomerFilters) {
        const groupsByCoordinate = new Map()
        const taskRows = rows || []
        taskRows.forEach((item) => {
          const { latitude, longitude } = this.coordinates(item)
          if (!Number.isFinite(latitude) || latitude === 0 || !Number.isFinite(longitude) || longitude === 0) return
          const key = `${latitude},${longitude}`
          if (!groupsByCoordinate.has(key)) groupsByCoordinate.set(key, { latitude, longitude, rows: [] })
          groupsByCoordinate.get(key).rows.push(item)
        })
        this.markerGroups = [...groupsByCoordinate.values()]
        return this.markerGroups.map((group, index) => {
          const first = group.rows[0] || {}
          const count = group.rows.length
          const deviceGroup = this.mode === 'device'
          const customerGroup = this.mode === 'customer'
          const complete = customerGroup || (deviceGroup
            ? group.rows.every((item) => this.isTaskDeviceComplete(item))
            : group.rows.every((item) => this.isAfterSalesTaskComplete(item)))
          return {
            id: index, latitude: group.latitude, longitude: group.longitude, width: 28, height: 36,
            title: count > 1
              ? `${count} ${deviceGroup ? '台任务设备' : (customerGroup ? '个客户' : '个售后任务')}`
              : (deviceGroup ? (first.ShebeiMC || first.ShebeiBH || '任务设备') : (customerGroup ? (first.KehuMC || '客户') : (first.customer || first.KehuMC || first.no || '售后任务'))),
            iconPath: complete ? '/static/xjy/business/dw.png' : '/static/xjy/business/dwRed.png',
            label: {
              content: count > 1 ? `${count}${deviceGroup ? '台设备' : (customerGroup ? '个客户' : '个任务')}` : (deviceGroup ? (complete ? '已完成' : '未完成') : (customerGroup ? '客户' : (first.state || '售后任务'))),
              color: '#ffffff', fontSize: 10, borderRadius: 10, bgColor: complete ? '#0091eb' : '#e5484d', padding: 4, textAlign: 'center'
            }
          }
        })
      }
      this.markerGroups = []
      return (rows || []).map((item, index) => ({ item, index, ...this.coordinates(item) }))
        .filter((entry) => Number.isFinite(entry.latitude) && entry.latitude !== 0 && Number.isFinite(entry.longitude) && entry.longitude !== 0)
        .map((entry) => {
          const complete = String(entry.item.FuwuZTZ) === '1' || entry.item.TaskDeviceStatus === '已完成'
          const markerTitle = this.mode === 'device'
            ? (entry.item.ShebeiMC || entry.item.ShebeiBH || '设备')
            : (this.mode === 'task' ? (entry.item.customer || entry.item.KehuMC || entry.item.no || '售后任务') : (entry.item.KehuMC || '客户'))
          const marker = { id: entry.index, latitude: entry.latitude, longitude: entry.longitude, width: 28, height: 36, title: markerTitle }
          if (this.taskId) {
            marker.iconPath = complete ? '/static/xjy/business/dw.png' : '/static/xjy/business/dwRed.png'
            marker.label = { content: complete ? '已完成' : '未完成', color: '#ffffff', fontSize: 10, borderRadius: 10, bgColor: complete ? '#0091eb' : '#e5484d', padding: 4, textAlign: 'center' }
          }
          return marker
        })
    },
    applyRows(rows) {
      this.rows = Array.isArray(rows) ? rows : []
      this.markers = this.markerRows(this.rows)
      this.selected = null
      this.selectedGroup = []
      this.contacts = []
      if (this.markers.length) { this.latitude = this.markers[0].latitude; this.longitude = this.markers[0].longitude }
    },
    async withCustomerCoordinateDefaults(rows) {
      const devices = Array.isArray(rows) ? rows : []
      const missingCustomerIds = [...new Set(devices
        .filter((item) => {
          const latitude = Number(item.KehuSB_Lat)
          const longitude = Number(item.KehuSB_Lng)
          return item.KehuID && !(Number.isFinite(latitude) && latitude !== 0 &&
            Number.isFinite(longitude) && longitude !== 0)
        })
        .map((item) => String(item.KehuID)))]
      if (!missingCustomerIds.length) return devices

      const customers = []
      for (let index = 0; index < missingCustomerIds.length; index += 200) {
        const result = await V8.FormEngine.GetTableData('Diy_Kehu', {
          _Where: [{ Name: 'Id', Type: 'In', Value: missingCustomerIds.slice(index, index + 200) }],
          _SelectFields: ['Id', 'KehuDT_Lat', 'KehuDT_Lng'],
          _PageIndex: 1,
          _PageSize: 200
        })
        if (result && Number(result.Code) === 1) customers.push(...(result.Data || []))
      }
      const customerById = new Map(customers.map((item) => [String(item.Id), item]))
      return devices.map((device) => {
        const customer = customerById.get(String(device.KehuID))
        if (!customer) return device
        return {
          ...device,
          KehuSB_Lat: customer.KehuDT_Lat,
          KehuSB_Lng: customer.KehuDT_Lng,
          CoordinateSource: 'customer-default'
        }
      })
    },
    async loadCustomerDevices() {
      this.loading = true
      try {
        const result = await V8.FormEngine.GetTableData('Diy_KehuSB', { _Where: [{ Name: 'KehuID', Type: '=', Value: this.customerId }], _PageIndex: 1, _PageSize: 500 })
        if (!result || Number(result.Code) !== 1) throw new Error((result && result.Msg) || '设备加载失败')
        this.applyRows(await this.withCustomerCoordinateDefaults(result.Data))
      } catch (error) { uni.showToast({ title: error.message || '设备加载失败', icon: 'none' }) }
      finally { this.loading = false }
    },
    async loadTaskDevices() {
      this.loading = true
      try {
        const taskDevices = await loadAllTaskDevices(this.taskId, { refresh: true, keyword: this.deviceFilters.keyword || '' })
        const result = await callApiEngine('get_location_shebei-v2', { TaskId: this.taskId })
        if (!result || Number(result.Code) !== 1) throw new Error((result && result.Msg) || '设备位置加载失败')
        const equipmentWithDefaults = Array.isArray(result.Data) ? result.Data : []
        const equipmentById = new Map(equipmentWithDefaults.map((item) => [String(item.Id), item]))
        const equipmentByCode = new Map(equipmentWithDefaults.filter((item) => item.ShebeiBH).map((item) => [String(item.ShebeiBH), item]))
        const equipmentByTaskDeviceId = new Map(equipmentWithDefaults.filter((item) => item.TaskDeviceId).map((item) => [String(item.TaskDeviceId), item]))
        this.applyRows(taskDevices.map((taskDevice) => {
          const source = equipmentByTaskDeviceId.get(String(taskDevice.Id)) ||
            equipmentById.get(String(taskDevice.KehuSBID)) ||
            equipmentByCode.get(String(taskDevice.code)) || {}
          return {
            ...source,
            TaskDeviceId: taskDevice.Id,
            TaskDeviceStatus: taskDevice.status,
            FuwuZTZ: taskDevice.FuwuZTZ,
            FuwuZT: taskDevice.FuwuZT,
            ShebeiMC: taskDevice.name || source.ShebeiMC,
            ShebeiXH: taskDevice.model || source.ShebeiXH,
            ShebeiBH: taskDevice.code || source.ShebeiBH,
            AnzhuangWZ: taskDevice.position || source.AnzhuangWZ
          }
        }))
      } catch (error) { uni.showToast({ title: error.message || '任务设备地图加载失败', icon: 'none' }) }
      finally { this.loading = false }
    },
    async loadTaskMap() {
      this.loading = true
      try {
        const tasks = []
        const pageSize = 300
        let pageIndex = 1
        let count = 0
        do {
          const result = await loadTasks({
            period: 'all', mineOnly: false, ...this.taskFilters,
            pageIndex, pageSize, customerId: this.customerId || '', refresh: pageIndex === 1
          })
          tasks.push(...result.rows)
          count = result.count
          if (!result.rows.length) break
          pageIndex += 1
        } while (tasks.length < count)

        const customerIds = [...new Set(tasks.map((item) => item.KehuID).filter(Boolean).map(String))]
        const customers = []
        for (let index = 0; index < customerIds.length; index += 200) {
          const result = await V8.FormEngine.GetTableData('Diy_Kehu', {
            _Where: [{ Name: 'Id', Type: 'In', Value: customerIds.slice(index, index + 200) }],
            _SelectFields: ['Id', 'KehuMC', 'Chengshi', 'XiangxiDZ', 'KehuDT_Lat', 'KehuDT_Lng'],
            _PageIndex: 1,
            _PageSize: 200
          })
          if (!result || Number(result.Code) !== 1) throw new Error((result && result.Msg) || '客户坐标加载失败')
          customers.push(...(result.Data || []))
        }
        const customerById = new Map(customers.map((item) => [String(item.Id), item]))
        this.applyRows(tasks.map((task) => {
          const customer = customerById.get(String(task.KehuID)) || {}
          return {
            ...task,
            KehuMC: task.customer || customer.KehuMC,
            KehuDT_Lat: task.KehuDT_Lat || customer.KehuDT_Lat,
            KehuDT_Lng: task.KehuDT_Lng || customer.KehuDT_Lng,
            address: task.address || [customer.Chengshi, customer.XiangxiDZ].filter(Boolean).join(' ')
          }
        }))
      } catch (error) { uni.showToast({ title: error.message || '任务地图加载失败', icon: 'none' }) }
      finally { this.loading = false }
    },
    async loadFilteredCustomers() {
      this.loading = true
      try {
        const filters = this.customerFilters || {}
        const config = {
          ...getBusinessModule('customers'),
          menuId: filters.menuId || '',
          selectFields: CUSTOMER_MAP_SELECT_FIELDS
        }
        const pageSize = 500
        const customers = []
        let pageIndex = 1
        let count = 0
        do {
          const result = await loadModuleRows(config, {
            pageIndex,
            pageSize,
            keyword: filters.keyword || '',
            period: filters.period || 'all',
            customRange: filters.customRange || null,
            status: filters.status || '',
            orderBy: filters.orderBy || '',
            orderType: filters.orderType || '',
            extraWhere: Array.isArray(filters.extraWhere) ? filters.extraWhere : [],
            refresh: true
          })
          if (!result.rows.length) break
          customers.push(...result.rows)
          count = result.count
          pageIndex += 1
        } while (customers.length < count)
        this.applyRows(customers)
      } catch (error) { uni.showToast({ title: error.message || '客户地图加载失败', icon: 'none' }) }
      finally { this.loading = false }
    },
    reload() {
      if (this.mode === 'task') { this.loadTaskMap(); return }
      if (this.hasListCustomerFilters) { this.loadFilteredCustomers(); return }
      if (this.taskId && this.mode === 'device') { this.loadTaskDevices(); return }
      if (this.customerId && this.mode === 'device') { this.loadCustomerDevices(); return }
      this.loadNearby()
    },
    loadNearby() {
      if (this.taskId && this.mode === 'device') { this.loadTaskDevices(); return }
      if (this.customerId && this.mode === 'device') { this.loadCustomerDevices(); return }
      this.loading = true
      uni.getLocation({
        type: 'gcj02', isHighAccuracy: true,
        success: async (position) => {
          this.latitude = Number(position.latitude); this.longitude = Number(position.longitude)
          try {
            const engine = this.mode === 'device' ? 'get_location_shebei-v2' : 'get_location_kehu-v2'
            const result = await callApiEngine(engine, { Km: Number(this.radius), Latitude: this.latitude, Longitude: this.longitude })
            if (!result || Number(result.Code) !== 1) throw new Error((result && result.Msg) || `${this.entityLabel}加载失败`)
            this.applyRows(result.Data || [])
          } catch (error) { uni.showToast({ title: error.message || `${this.entityLabel}加载失败`, icon: 'none' }) }
        },
        fail: () => uni.showToast({ title: '请授权定位后重试', icon: 'none' }),
        complete: () => { this.loading = false }
      })
    },
    changeRadius(event) { this.radius = Number(event.detail.value || 15); if (!this.customerId) this.loadNearby() },
    async selectMarker(event) {
      const index = Number(event.detail.markerId)
      if (this.mode === 'task' || (this.mode === 'device' && this.taskId) || this.hasListCustomerFilters) {
        const group = this.markerGroups[index]
        this.selectedGroup = group ? group.rows : []
        this.selected = this.selectedGroup[0] || null
        this.contacts = []
        return
      }
      this.selected = this.rows[index] || null
      this.contacts = []
      if (this.selected && this.mode === 'contacts') await this.loadContacts(this.selected.Id)
    },
    isTaskDeviceComplete(item) { return String(item.FuwuZTZ) === '1' || item.TaskDeviceStatus === '已完成' },
    isAfterSalesTaskComplete(item) { return /已结束|已完成|完成/.test(String(item.state || item.Zhuangtai || '')) },
    selectedTaskDeviceKey(item) { return String((item && (item.TaskDeviceId || item.Id)) || '') },
    selectGroupTask(item) { this.selected = item },
    clearSelection() { this.selected = null; this.selectedGroup = [] },
    async loadContacts(customerId) {
      this.contactsLoading = true
      try {
        const result = await V8.FormEngine.GetTableData('Diy_LianxiR', { _Where: [{ Name: 'KehuID', Type: '=', Value: customerId }], _OrderBy: 'CreateTime', _OrderByType: 'DESC', _PageIndex: 1, _PageSize: 100 })
        this.contacts = result && Number(result.Code) === 1 && Array.isArray(result.Data) ? result.Data : []
      } catch (error) { this.contacts = [] }
      finally { this.contactsLoading = false }
    },
    openContact(contact) { openForm({ table: 'Diy_LianxiR', rowId: contact.Id, mode: 'View', title: '联系人详情', menuAliases: ['联系人'] }) },
    openSelected() {
      if (!this.selected) return
      if (this.mode === 'task') { uni.navigateTo({ url: `/pages/task/detail?id=${encodeURIComponent(this.selected.Id)}` }); return }
      if (this.taskId && this.selected.TaskDeviceId) {
        uni.navigateTo({ url: `/pages/task/device?id=${encodeURIComponent(this.selected.TaskDeviceId)}&taskId=${encodeURIComponent(this.taskId)}&taskType=${encodeURIComponent(this.taskType)}` })
        return
      }
      if (this.mode === 'device') { openForm({ table: 'Diy_KehuSB', rowId: this.selected.Id, mode: 'View', title: '设备详情', menuAliases: ['客户设备', '设备管理'] }); return }
      if (this.mode === 'customer') { uni.navigateTo({ url: `/pages/business/detail?key=customers&id=${encodeURIComponent(this.selected.Id)}` }); return }
      const key = this.mode === 'visit' ? 'visits' : 'contacts'
      uni.navigateTo({ url: `/pages/business/list?key=${key}&whereField=KehuID&whereValue=${encodeURIComponent(this.selected.Id)}` })
    },
    navigate() {
      if (!this.selected) return
      const location = this.coordinates(this.selected)
      uni.openLocation({ latitude: location.latitude, longitude: location.longitude, name: this.selectedTitle, address: this.selectedSubtitle, scale: 16 })
    },
    goBack() { uni.navigateBack() }
  }
}
</script>

<style scoped>
.map-page { height: 100vh; overflow: hidden; }
.refresh-action { display: flex; align-items: center; justify-content: center; width: 64rpx; height: 64rpx; border-radius: 50%; color: #087da8; font-size: 37rpx; transition: transform .18s ease; }
.refresh-action--pressed { transform: rotate(90deg); }
.range-band { box-sizing: border-box; display: grid; grid-template-columns: 70rpx minmax(0,1fr) 90rpx; align-items: center; height: 86rpx; padding: 0 24rpx; border-bottom: 1rpx solid #e2ebee; background: #fff; color: #55727c; font-size: 22rpx; }
.range-band > text:last-child { color: #087da8; font-weight: 700; text-align: right; }
.range-slider { margin: 0; }
.task-map-summary { box-sizing: border-box; display: flex; align-items: center; justify-content: space-between; height: 86rpx; padding: 0 24rpx; border-bottom: 1rpx solid #e2ebee; background: #fff; color: #617982; font-size: 21rpx; }
.task-map-summary text:first-child { color: #087da8; font-weight: 700; }
.status-legend { box-sizing: border-box; display: flex; align-items: center; justify-content: center; gap: 42rpx; height: 86rpx; border-bottom: 1rpx solid #e2ebee; background: #fff; color: #617982; font-size: 21rpx; }.status-legend view { display: flex; align-items: center; gap: 10rpx; }.status-dot { width: 18rpx; height: 18rpx; border-radius: 50%; }.status-dot.unfinished { background: #e5484d; }.status-dot.complete { background: #0091eb; }
.map-wrap { position: relative; height: calc(100vh - var(--mci-safe-top) - 92rpx - 86rpx); }
.business-map { width: 100%; height: 100%; }
.map-loading { position: absolute; inset: 0; padding: 22rpx; background: #f3f7f9; }
.map-loading > text { display: block; margin-top: 20rpx; color: #71868f; font-size: 22rpx; text-align: center; }
.map-empty { position: absolute; top: 24rpx; right: 24rpx; left: 24rpx; padding: 18rpx; border: 1rpx solid #dce7eb; border-radius: 7rpx; background: rgba(255,255,255,.94); color: #667e87; font-size: 23rpx; text-align: center; }
.entity-sheet { position: fixed; right: 18rpx; bottom: calc(18rpx + var(--mci-safe-bottom)); left: 18rpx; z-index: 30; padding: 10rpx 22rpx 21rpx; border: 1rpx solid #dce7eb; border-radius: 8rpx; background: #fff; box-shadow: 0 12rpx 30rpx rgba(16,49,61,.18); animation: sheetUp .2s ease-out both; }
.entity-sheet__handle { width: 62rpx; height: 7rpx; margin: 0 auto 13rpx; border-radius: 4rpx; background: #d7e1e5; }
.entity-sheet__heading { display: flex; align-items: center; justify-content: space-between; min-height: 70rpx; border-bottom: 1rpx solid #edf2f4; }
.entity-sheet__heading > view:first-child text { display: block; }
.entity-sheet__heading > view:first-child text:first-child { color: #294b57; font-size: 27rpx; font-weight: 750; }
.entity-sheet__heading > view:first-child text:last-child { margin-top: 3rpx; color: #84969d; font-size: 19rpx; }
.entity-sheet__heading > view:last-child { width: 52rpx; height: 52rpx; border-radius: 50%; background: #f0f5f7; color: #71858d; font-size: 33rpx; line-height: 52rpx; text-align: center; }
.entity-sheet__row { display: grid; grid-template-columns: 130rpx minmax(0,1fr); align-items: center; min-height: 65rpx; border-bottom: 1rpx solid #f0f4f5; }
.entity-sheet__row text:first-child { color: #788c94; font-size: 21rpx; }
.entity-sheet__row text:last-child { color: #294b57; font-size: 22rpx; text-align: right; }
.task-group-list { margin: 12rpx 0 4rpx; border: 1rpx solid #e5edef; border-radius: 7rpx; background: #f8fbfc; }
.task-group-item { box-sizing: border-box; display: flex; align-items: center; justify-content: space-between; gap: 16rpx; height: 82rpx; padding: 0 16rpx; border-bottom: 1rpx solid #e8eff1; transition: background-color .16s ease; }
.task-group-item:last-child { border-bottom: 0; }
.task-group-item.active { background: #e9f6fa; }
.task-group-item > view { min-width: 0; }
.task-group-item > view text { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.task-group-item > view text:first-child { color: #294b57; font-size: 22rpx; font-weight: 650; }
.task-group-item > view text:last-child { margin-top: 4rpx; color: #87999f; font-size: 18rpx; }
.task-group-item > text { flex: none; max-width: 140rpx; overflow: hidden; color: #087da8; font-size: 19rpx; text-overflow: ellipsis; white-space: nowrap; }
.entity-sheet__row text.status-complete { color: #0091eb; font-weight: 700; }.entity-sheet__row text.status-unfinished { color: #e5484d; font-weight: 700; }
.contacts-block { padding: 14rpx 0 5rpx; border-bottom: 1rpx solid #edf2f4; }
.contacts-label { color: #788c94; font-size: 21rpx; }
.contact-chips { display: flex; flex-wrap: wrap; gap: 10rpx; margin-top: 10rpx; }
.contact-chip { padding: 8rpx 14rpx; border-radius: 6rpx; background: #edf7fa; color: #087da8; font-size: 21rpx; }
.contacts-empty { color: #96a6ac; font-size: 21rpx; }
.entity-sheet__actions { display: grid; grid-template-columns: 1fr 1fr; gap: 12rpx; margin-top: 17rpx; }
.entity-sheet__actions view { height: 70rpx; border-radius: 7rpx; background: #eaf6f9; color: #087da8; font-size: 22rpx; font-weight: 650; line-height: 70rpx; text-align: center; }
.entity-sheet__actions view:last-child { background: #087da8; color: #fff; }
@keyframes sheetUp { from { opacity: 0; transform: translateY(40rpx); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .entity-sheet, .refresh-action, .task-group-item { animation: none; transition: none; } }
</style>
