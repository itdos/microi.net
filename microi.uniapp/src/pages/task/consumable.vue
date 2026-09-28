<template>
  <mci-page-shell class="consumable-page" :style="mciTokenStyle" title="设备耗材" subtitle="滤芯周期与价格维护" @back="goBack">
    <template #right><view v-if="equipment.DingdanSPID && canAddConsumable" class="nav-add" hover-class="nav-add--pressed" @tap="addConsumable"><text>＋</text></view></template>
    <mci-skeleton v-if="loading" type="list" :rows="5" />
    <view v-else-if="error" class="error-state"><text>{{ error }}</text><view @tap="loadData"><text>重新加载</text></view></view>

    <scroll-view v-else class="page-scroll" scroll-y>
      <view class="equipment-band"><image src="/static/xjy/business/lvxin.png" mode="aspectFit" /><view><text>{{ equipment.ShebeiMC || equipment.ShebeiBH || '设备耗材' }}</text><text>{{ [equipment.ShebeiXH, equipment.AnzhuangWZ].filter(Boolean).join(' · ') }}</text></view><text>{{ consumables.length }} 级</text></view>

      <view v-if="consumables.length" class="consumable-list">
        <view v-for="(item,index) in consumables" :key="item.Id || index" class="consumable-row" :class="{ active: editing && editing.Id === item.Id }" hover-class="consumable-row--pressed" @tap="edit(item)">
          <view class="level-mark"><text>{{ item.Paixu || index + 1 }}</text><text>级</text></view><view class="consumable-copy"><text class="consumable-name">{{ item.LvxinMC || item.ShangpinMC || '滤芯' }}</text><text class="consumable-model">{{ item.LvxinXH || item.ShangpinXH || '暂无型号' }}</text><view class="consumable-meta"><text>{{ item.GenghuanZQ || '-' }} 个月/次</text><text>¥{{ money(item.LvxinDJ) }}</text><text>优惠 {{ item.YouhuiFD || 0 }}%</text></view></view><text class="row-arrow">›</text>
        </view>
      </view>
      <view v-else class="empty-state"><image src="/static/xjy/business/lvxin.png" mode="aspectFit" /><text>当前设备未配置耗材</text><text>{{ canAddConsumable ? '可通过右上角新增，或在订单商品中维护' : '请联系有权限的人员在订单商品中维护' }}</text></view>

      <view v-if="editing" class="editor-band">
        <view class="editor-heading"><view><text>{{ canEditConsumable ? '编辑' : '查看' }} {{ editing.LvxinMC || '滤芯' }}</text><text>{{ editing.LvxinXH || '' }}</text></view><view @tap="closeEditor"><text>×</text></view></view>
        <view class="form-row"><text>滤芯级数</text><input v-if="canEditConsumable" v-model="form.Paixu" type="number" placeholder="请输入级数" /><text v-else class="form-value">{{ displayValue(form.Paixu) }}</text></view>
        <view class="form-row"><text>更换周期(月)</text><input v-if="canEditConsumable" v-model="form.GenghuanZQ" type="digit" placeholder="请输入周期" /><text v-else class="form-value">{{ displayValue(form.GenghuanZQ) }}</text></view>
        <view class="form-row"><text>滤芯单价</text><view class="money-control"><text>¥</text><input v-if="canEditConsumable" v-model="form.LvxinDJ" type="digit" placeholder="0.00" /><text v-else class="form-value">{{ money(form.LvxinDJ) }}</text></view></view>
        <view class="form-row"><text>优惠幅度(%)</text><input v-if="canEditConsumable" v-model="form.YouhuiFD" type="digit" placeholder="0" /><text v-else class="form-value">{{ displayValue(form.YouhuiFD) }}</text></view>
        <view class="calculation-band"><view><text>{{ annualQuantity }}</text><text>每年预计数量</text></view><view><text>¥{{ annualTotal }}</text><text>年度原价</text></view><view><text>¥{{ discountTotal }}</text><text>优惠后总价</text></view></view>
        <view v-if="canEditConsumable" class="editor-actions"><view @tap="closeEditor"><text>取消</text></view><view :class="{ disabled: saving }" @tap="save"><text>{{ saving ? '保存中' : '保存耗材' }}</text></view></view>
      </view>
      <view class="safe-space"></view>
    </scroll-view>
  </mci-page-shell>
</template>

<script>
import { buildFriendShare, buildTimelineShare } from '@/utils/share.js'
import { themeMixin } from '@/utils/theme.js'
import { V8, getUser } from '@/utils/request.js'
import { callApiEngine, findMenu, openForm } from '@/platform/business-runtime.js'
import { canAddMenuRecord, canAddTableRecord, canEditMenuRecord, canEditTableRecord } from '@/platform/menu-permission.js'
import { loadTaskEquipmentPackage } from '@/utils/xjy-task.js'

export default {
  onShareAppMessage() { return buildFriendShare(this, 'pages/task/consumable') },
  onShareTimeline() { return buildTimelineShare(this, 'pages/task/consumable') },
  mixins: [themeMixin],
  data() { return { deviceId: '', taskId: '', source: 'task', equipment: {}, consumables: [], editing: null, form: {}, loading: true, saving: false, error: '', currentUser: {}, consumableMenuId: '', consumableTableId: '', permissionReady: false } },
  computed: {
    canAddConsumable() { return this.permissionReady && (canAddTableRecord(this.consumableTableId, this.currentUser) || canAddMenuRecord(this.consumableMenuId, this.currentUser)) },
    canEditConsumable() { return this.permissionReady && (canEditTableRecord(this.consumableTableId, this.currentUser) || canEditMenuRecord(this.consumableMenuId, this.currentUser)) },
    annualQuantity() { const cycle = Number(this.form.GenghuanZQ || 0); return cycle > 0 ? Math.max(1, Math.ceil(12 / cycle)) : 0 },
    annualTotalNumber() { return this.annualQuantity * Number(this.form.LvxinDJ || 0) },
    annualTotal() { return this.money(this.annualTotalNumber) },
    discountTotal() { return this.money(this.annualTotalNumber * (1 - Math.min(100, Math.max(0, Number(this.form.YouhuiFD || 0))) / 100)) }
  },
  onLoad(options) { this.deviceId = decodeURIComponent(options.deviceId || ''); this.taskId = decodeURIComponent(options.taskId || ''); this.source = options.source === 'device' ? 'device' : 'task'; this.currentUser = getUser() || {}; this.bootstrap() },
  methods: {
    async bootstrap() { await Promise.all([this.loadPermissionContext(), this.loadData()]) },
    async loadPermissionContext(refresh = false) {
      this.permissionReady = false
      try {
        await V8.RefreshLoginUser()
      } catch (error) {}
      this.currentUser = getUser() || {}
      this.consumableMenuId = ''
      this.consumableTableId = ''
      try {
        const menu = await findMenu(['订单商品滤芯表', '订单耗材', '设备耗材', '滤芯'], 'diy_dingdansphc', refresh)
        this.consumableMenuId = String(menu && menu.Id || '')
        this.consumableTableId = String(menu && menu.DiyTableId || '')
      } catch (error) {}
      try {
        const authorization = this.consumableMenuId ? { _SysMenuId: this.consumableMenuId } : {}
        const result = await V8.FormEngine.GetDiyTableModel('diy_dingdansphc', authorization)
        if (result && Number(result.Code) === 1 && result.Data) {
          this.consumableTableId = String(result.Data.Id || this.consumableTableId || '')
        }
      } catch (error) {}
      this.permissionReady = true
    },
    async loadData() {
      if (!this.deviceId) { this.error = '缺少售后设备编号'; this.loading = false; return }
      this.loading = true; this.error = ''
      try {
        if (this.source === 'device') {
          const [deviceResult, consumableResult] = await Promise.all([
            V8.FormEngine.GetFormData('Diy_KehuSB', { Id: this.deviceId }),
            callApiEngine('equipment_consumables', { Id: this.deviceId })
          ])
          if (!deviceResult || Number(deviceResult.Code) !== 1 || !deviceResult.Data) throw new Error((deviceResult && deviceResult.Msg) || '设备不存在')
          if (!consumableResult || Number(consumableResult.Code) !== 1) throw new Error((consumableResult && consumableResult.Msg) || '耗材加载失败')
          this.equipment = deviceResult.Data
          this.consumables = Array.isArray(consumableResult.Data) ? consumableResult.Data : []
        } else {
          const data = await loadTaskEquipmentPackage(this.deviceId)
          this.equipment = data.SB || {}
          this.consumables = Array.isArray(data.HC) ? data.HC : []
        }
      } catch (error) { this.error = error.message || '耗材加载失败' } finally { this.loading = false }
    },
    money(value) { const number = Number(value || 0); return Number.isFinite(number) ? number.toFixed(2) : '0.00' },
    displayValue(value) { return value === '' || value === null || value === undefined ? '—' : value },
    edit(item) { this.editing = item; this.form = { Paixu: item.Paixu ?? '', GenghuanZQ: item.GenghuanZQ ?? '', LvxinDJ: item.LvxinDJ ?? '', YouhuiFD: item.YouhuiFD ?? '' } },
    closeEditor() { this.editing = null; this.form = {} },
    async save() {
      if (!this.editing || this.saving) return
      if (!this.canEditConsumable) { uni.showToast({ title: '当前账号没有耗材编辑权限', icon: 'none' }); return }
      if (this.form.LvxinDJ === '' || Number(this.form.LvxinDJ) < 0) { uni.showToast({ title: '请输入有效滤芯单价', icon: 'none' }); return }
      if (Number(this.form.GenghuanZQ || 0) <= 0) { uni.showToast({ title: '更换周期必须大于 0', icon: 'none' }); return }
      this.saving = true
      try {
        const payload = { Id: this.editing.Id, ...this.form, _InvokeType: 'Client' }
        if (this.consumableMenuId) payload._SysMenuId = this.consumableMenuId
        const result = await V8.FormEngine.UptFormData('diy_dingdansphc', payload)
        if (!result || Number(result.Code) !== 1) throw new Error((result && result.Msg) || '耗材保存失败')
        uni.showToast({ title: '耗材已保存', icon: 'success' }); this.closeEditor(); await this.loadData()
      } catch (error) { uni.showToast({ title: error.message || '耗材保存失败', icon: 'none' }) } finally { this.saving = false }
    },
    addConsumable() {
      if (!this.canAddConsumable) { uni.showToast({ title: '当前账号没有耗材新增权限', icon: 'none' }); return }
      openForm({ table: 'diy_dingdansphc', mode: 'Add', title: '新增设备耗材', menuId: this.consumableMenuId, menuAliases: ['订单商品滤芯表', '订单耗材', '设备耗材', '滤芯'], defaultValues: { DingdanSPID: this.equipment.DingdanSPID, DingdanID: this.equipment.DingdanID, ShangpinID: this.equipment.ShangpinID } })
    },
    goBack() { uni.navigateBack() }
  }
}
</script>

<style scoped>
.consumable-page{height:100vh;overflow:hidden}.nav-add{width:62rpx;height:62rpx;display:flex;align-items:center;justify-content:center;border-radius:50%;color:#087da8;font-size:39rpx;transition:transform .16s ease}.nav-add--pressed{transform:scale(.92)}.page-scroll{height:calc(100vh - var(--mci-safe-top) - 92rpx)}.equipment-band{display:grid;grid-template-columns:66rpx minmax(0,1fr) auto;gap:15rpx;align-items:center;padding:24rpx;color:#fff;background:#063b5c}.equipment-band image{width:56rpx;height:56rpx;padding:6rpx;border-radius:8px;background:#fff;box-sizing:border-box}.equipment-band>view{min-width:0}.equipment-band>view text{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.equipment-band>view text:first-child{font-size:28rpx;font-weight:750}.equipment-band>view text:last-child{margin-top:5rpx;color:rgba(255,255,255,.66);font-size:20rpx}.equipment-band>text{padding:7rpx 11rpx;border-radius:6px;background:rgba(255,255,255,.15);font-size:20rpx}.consumable-list{margin-top:14rpx;padding:0 23rpx;background:#fff}.consumable-row{min-height:120rpx;display:grid;grid-template-columns:60rpx minmax(0,1fr) 26rpx;gap:15rpx;align-items:center;border-bottom:1px solid #edf2f4;transition:background .16s ease}.consumable-row.active,.consumable-row--pressed{background:#edf7fa}.level-mark{width:54rpx;height:54rpx;display:flex;align-items:baseline;justify-content:center;border-radius:8px;color:#087da8;background:#e8f5f9}.level-mark text:first-child{font-size:25rpx;font-weight:750}.level-mark text:last-child{font-size:17rpx}.consumable-copy{min-width:0}.consumable-name,.consumable-model{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.consumable-name{color:#294b57;font-size:25rpx;font-weight:700}.consumable-model{margin-top:4rpx;color:#82959d;font-size:20rpx}.consumable-meta{display:flex;gap:18rpx;margin-top:8rpx;color:#647e87;font-size:19rpx}.row-arrow{color:#9babb1;font-size:32rpx}.empty-state{min-height:52vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:50rpx}.empty-state image{width:105rpx;height:105rpx;opacity:.42}.empty-state text:nth-child(2){margin-top:19rpx;color:#365762;font-size:27rpx;font-weight:650}.empty-state text:last-child{margin-top:7rpx;color:#899aa1;font-size:21rpx}.editor-band{margin-top:14rpx;padding:0 24rpx 24rpx;background:#fff}.editor-heading{min-height:90rpx;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #edf2f4}.editor-heading>view:first-child text{display:block}.editor-heading>view:first-child text:first-child{color:#294b57;font-size:27rpx;font-weight:750}.editor-heading>view:first-child text:last-child{margin-top:3rpx;color:#899aa1;font-size:19rpx}.editor-heading>view:last-child{width:54rpx;height:54rpx;border-radius:50%;color:#70848c;background:#f0f5f7;font-size:33rpx;line-height:54rpx;text-align:center}.form-row{min-height:82rpx;display:grid;grid-template-columns:200rpx minmax(0,1fr);align-items:center;border-bottom:1px solid #f0f4f5}.form-row>text{color:#647d86;font-size:23rpx}.form-row input{height:70rpx;color:#294b57;font-size:24rpx;text-align:right}.form-row>.form-value{color:#294b57;font-size:24rpx;text-align:right}.money-control{display:flex;align-items:center;justify-content:flex-end}.money-control text{color:#e54625;font-size:25rpx}.money-control .form-value{margin-left:8rpx;color:#294b57;font-size:24rpx}.money-control input{width:220rpx}.calculation-band{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));margin-top:20rpx;padding:19rpx 0;border-radius:7px;background:#edf7fa}.calculation-band view{min-width:0;border-right:1px solid #d7e9ef;text-align:center}.calculation-band view:last-child{border-right:none}.calculation-band text{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.calculation-band text:first-child{color:#087da8;font-size:24rpx;font-weight:750}.calculation-band text:last-child{margin-top:5rpx;color:#738991;font-size:18rpx}.editor-actions{display:grid;grid-template-columns:.8fr 1.2fr;gap:13rpx;margin-top:22rpx}.editor-actions view{height:76rpx;border-radius:7px;color:#496671;background:#edf3f5;font-size:24rpx;font-weight:700;line-height:76rpx;text-align:center}.editor-actions view:last-child{color:#fff;background:#e54625}.editor-actions .disabled{opacity:.58}.safe-space{height:35rpx}.error-state{min-height:60vh;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#748991;font-size:23rpx}.error-state view{margin-top:20rpx;padding:14rpx 28rpx;border-radius:6px;color:#fff;background:#087da8}@media(prefers-reduced-motion:reduce){.consumable-row,.nav-add{transition:none}}
</style>
