<template>
  <view v-if="policy.link || policy.create || policy.unlink" class="device-iot-actions">
    <mci-table-selector v-if="policy.link" :field="selectorField" :parent-table="deviceTable"
      :parent-id="form.Id" :parent-form="form" :parent-menu-id="menuId"
      :readonly="Boolean(busy)" :submit-selection="linkSelection" compact>
      <template #trigger="{ open, disabled }">
        <button class="device-iot-action device-iot-action--link" :disabled="disabled"
          hover-class="device-iot-action--pressed" @tap.stop="open">
          <view class="device-iot-action__icon device-iot-action__icon--link" aria-hidden="true"><view></view><view></view></view>
          <text>{{ busy === 'link' ? '正在关联…' : label('link') }}</text>
        </button>
      </template>
    </mci-table-selector>
      <button v-if="policy.create" class="device-iot-action device-iot-action--create" :disabled="Boolean(busy)"
        hover-class="device-iot-action--pressed" @tap.stop="createDevice">
        <text class="device-iot-action__plus" aria-hidden="true">＋</text>
        <text>{{ busy === 'create' ? '正在打开…' : label('create') }}</text>
      </button>
      <button v-if="policy.unlink" class="device-iot-action device-iot-action--unlink" :disabled="Boolean(busy) || !linked"
        hover-class="device-iot-action--pressed" @tap.stop="unlinkDevice">
        <view class="device-iot-action__icon device-iot-action__icon--unlink" aria-hidden="true"><view></view><view></view></view>
        <text>{{ busy === 'unlink' ? '正在解除…' : label('unlink') }}</text>
      </button>
  </view>
</template>

<script>
import { V8, getUser } from '@/utils/request.js'
import { openForm, findMenu } from '@/platform/business-runtime.js'
import { loadNativeFormDefinition } from '@/platform/native-form.js'
import MciTableSelector from '@/components/mci-table-selector/mci-table-selector.vue'
import { DEVICE_IOT_TABLE, IOT_DEVICE_TABLE, deviceIoTField, deviceIoTMenuId,
  deviceIoTPolicy, assertDeviceIoTAction, deviceIoTWhere, saveDeviceIoTBinding,
  newIoTDeviceDefaults } from '../device-iot-actions.mjs'

export default {
  name: 'XjyDeviceIoTActions',
  components: { MciTableSelector },
  props: {
    definition: { type: Object, default: () => ({}) },
    form: { type: Object, default: () => ({}) },
    menuId: { type: String, default: '' },
    user: { type: Object, default: () => ({}) }
  },
  emits: ['saved'],
  data() { return { busy: '', deviceTable: DEVICE_IOT_TABLE } },
  computed: {
    policy() { return deviceIoTPolicy(this.context()) },
    linked() { return Boolean(this.form.IoTDeviceId) },
    selectorField() {
      const field = deviceIoTField(this.definition, 'link') || {}
      const config = field.config || JSON.parse(field.Config || '{}')
      return { ...field, config: { ...config, OpenTable: { ...config.OpenTable,
        MultipleSelect: false, PropsWhere: [
          ...(Array.isArray(config.OpenTable?.PropsWhere) ? config.OpenTable.PropsWhere : []),
          ...deviceIoTWhere(this.form, this.user)
        ] } } }
    }
  },
  methods: {
    context() { return { definition: this.definition, form: this.form, menuId: this.menuId, user: this.user } },
    // 手机按钮保留明确的动作名，省去重复的“物联网”文字，使三项稳定同行。
    label(action) { return { link: '关联IoT设备', create: '新增IoT设备', unlink: '解除IoT关联' }[action] },
    async authorizedContext(action) {
      // 点击与提交再次读取字段配置和当前会话，避免停留详情期间撤权后继续使用旧入口。
      const user = getUser() || {}
      const definition = await loadNativeFormDefinition(DEVICE_IOT_TABLE, true, { menuId: this.menuId })
      const context = { definition, user, menuId: this.menuId, form: this.form }
      assertDeviceIoTAction(action, context)
      return context
    },
    notifySaved() {
      uni.$emit('microi:data-changed', { table: DEVICE_IOT_TABLE, id: this.form.Id })
      this.$emit('saved')
    },
    async linkSelection({ rows }) {
      if (this.busy) throw new Error('正在处理，请稍候')
      this.busy = 'link'
      try {
        const context = await this.authorizedContext('link')
        await saveDeviceIoTBinding('link', context, rows[0], (table, row) => V8.FormEngine.UptFormData(table, row))
        this.notifySaved()
        return { handled: true, matched: true }
      } finally { this.busy = '' }
    },
    async unlinkDevice() {
      if (this.busy || !this.linked) return
      this.busy = 'unlink'
      try {
        const confirmed = await new Promise(resolve => uni.showModal({ title: '解除 IoT 关联',
          content: '解除后将停止展示此设备的物联网快照，IoT 设备本身会保留。确认解除当前关联？',
          confirmText: '确认解除', confirmColor: '#B45309',
          success: result => resolve(result.confirm), fail: () => resolve(false) }))
        if (!confirmed) return
        const context = await this.authorizedContext('unlink')
        await saveDeviceIoTBinding('unlink', context, null, (table, row) => V8.FormEngine.UptFormData(table, row))
        this.notifySaved()
        uni.showToast({ title: 'IoT 关联已解除', icon: 'success' })
      } catch (error) { uni.showToast({ title: error.message || '解除失败', icon: 'none' }) }
      finally { this.busy = '' }
    },
    async createDevice() {
      if (this.busy) return
      this.busy = 'create'
      try {
        const context = await this.authorizedContext('create')
        const targetMenuId = deviceIoTMenuId(context.definition)
        const menu = await findMenu(['IoT物联网设备'], IOT_DEVICE_TABLE, true, targetMenuId)
        if (!menu?.Id || menu.Id !== targetMenuId) throw new Error('当前账号没有 IoT 设备新增权限')
        const read = async (table, id, aliases) => {
          const sourceMenu = await findMenu(aliases, table)
          if (!sourceMenu?.Id) throw new Error('当前账号没有设备所属合同或订单商品的查看权限')
          return V8.FormEngine.GetFormData(table, { Id: id, _SysMenuId: sourceMenu.Id })
        }
        const defaults = await newIoTDeviceDefaults(this.form, context.user, {
          loadOrderProduct: id => read('Diy_DingdanSP', id, ['订单商品']),
          loadOrder: id => read('Diy_Dingdan', id, ['合同订单'])
        })
        await openForm({ table: IOT_DEVICE_TABLE, mode: 'Add', title: this.label('create'),
          menuId: menu.Id, menuAliases: ['IoT物联网设备'], defaultValues: defaults })
      } catch (error) { uni.showToast({ title: error.message || '打开新增页面失败', icon: 'none' }) }
      finally { this.busy = '' }
    }
  }
}
</script>

<style scoped>
.device-iot-actions { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); align-items: center; gap: 10rpx; margin: 0 22rpx 16rpx; }
.device-iot-action { box-sizing: border-box; display: flex; align-items: center; justify-content: center; gap: 6rpx; width: 100%; min-width: 0; height: 62rpx; margin: 0; padding: 0 8rpx; border-radius: 10rpx; font-size: 22rpx; font-weight: 600; line-height: 1; white-space: nowrap; transition: transform .16s ease, opacity .16s ease; }
.device-iot-action::after { border: 0; }
.device-iot-action--link { border: 1rpx solid var(--mci-border, #dce7eb); background: var(--mci-bg-muted, #f4f8fa); color: #3f6270; box-shadow: none; }
.device-iot-action--create { border: 1rpx solid #f0d4cc; background: #fff6f2; color: #b83f2a; box-shadow: none; }
.device-iot-action--unlink { border: 1rpx solid #ead9c7; background: #fff8ee; color: #92400e; box-shadow: none; }
.device-iot-action__plus { font-size: 27rpx; line-height: 1; color: inherit; }
.device-iot-action__icon { position: relative; width: 24rpx; height: 24rpx; flex-shrink: 0; color: inherit; }
.device-iot-action__icon view { position: absolute; box-sizing: border-box; width: 17rpx; height: 10rpx; border: 1.5px solid currentColor; border-radius: 3px; transform: rotate(-40deg); }
.device-iot-action__icon view:first-child { left: 0; top: 3rpx; }
.device-iot-action__icon view:last-child { right: 0; bottom: 3rpx; }
.device-iot-action__icon--unlink view:first-child { left: -2rpx; top: 0; }
.device-iot-action__icon--unlink view:last-child { right: -2rpx; bottom: 0; }
.device-iot-action--pressed { transform: scale(.97); opacity: .9; }
.device-iot-action:focus-visible { outline: 2px solid #08749c; outline-offset: 3px; }
.device-iot-action[disabled] { color: #65737b; background: #f1f4f5; border-color: #d6e0e4; box-shadow: none; }
@media (prefers-reduced-motion: reduce) { .device-iot-action { transition: none; } }
</style>
