<template>
  <view class="visit-target-fields">
    <view class="visit-target-fields__field">
      <view class="visit-target-fields__heading"><text>拜访对象类型</text></view>
      <view class="visit-target-fields__type" :class="{ 'visit-target-fields__control--active': typeOpen }" @tap.stop>
        <view class="visit-target-fields__type-control" :class="{ focused: typeOpen }">
          <input :value="targetType" class="visit-target-fields__type-input" placeholder="输入关键词检索"
            @focus="openTypeOptions" @input="handleTypeInput" />
          <text class="visit-target-fields__arrow" :class="{ open: typeOpen }" @tap.stop="toggleTypeOptions">›</text>
        </view>
        <view v-if="typeOpen" class="visit-target-fields__type-dropdown">
          <view v-for="option in filteredTypes" :key="option" class="visit-target-fields__type-option"
            :class="{ selected: option === targetType }" hover-class="visit-target-fields__type-option--pressed"
            @tap.stop="selectType(option)">
            <text>{{ option }}</text><text v-if="option === targetType">✓</text>
          </view>
          <view v-if="!filteredTypes.length" class="visit-target-fields__type-empty"><text>未找到匹配类型</text></view>
        </view>
      </view>
    </view>
    <view class="visit-target-fields__field">
      <view class="visit-target-fields__heading"><text>拜访对象</text></view>
      <view class="visit-target-fields__target" :class="{ 'visit-target-fields__control--active': targetOpen }" @tap.stop>
        <mci-visit-target-combobox ref="targetCombobox" :model-value="targetName" :selected-id="targetId"
          :module-key="moduleKey" :target-type="targetType" @update:model-value="updateTargetName"
          @select="selectTarget" @clear="clearTarget" @open-change="handleTargetOpen" />
      </view>
      <text class="visit-target-fields__help">可检索当前账号有权查看的{{ targetType || '拜访对象' }}；未检索到时保留输入并按新对象提交</text>
    </view>
  </view>
</template>

<script>
import MciVisitTargetCombobox from '@/components/mci-visit-target-combobox/mci-visit-target-combobox.vue'

export const VISIT_TARGET_TYPES = ['客户', '项目合伙人', '供应商', '商家']
export const VISIT_TARGET_MODULE_KEYS = { 客户: 'customers', 项目合伙人: 'partners', 供应商: 'suppliers', 商家: 'stores' }

export default {
  name: 'MciVisitTargetFields',
  components: { MciVisitTargetCombobox },
  props: {
    targetType: { type: String, default: '客户' },
    targetName: { type: String, default: '' },
    targetId: { type: [String, Number], default: '' }
  },
  emits: ['update:targetType', 'update:targetName', 'update:targetId', 'select', 'open-change'],
  data() { return { typeOpen: false, targetOpen: false, typeSearchActive: false } },
  computed: {
    filteredTypes() {
      if (!this.typeSearchActive) return VISIT_TARGET_TYPES
      const keyword = String(this.targetType || '').trim()
      return keyword ? VISIT_TARGET_TYPES.filter((item) => item.includes(keyword)) : VISIT_TARGET_TYPES
    },
    moduleKey() { return VISIT_TARGET_MODULE_KEYS[this.targetType] || '' }
  },
  methods: {
    emitOpenState() { this.$emit('open-change', this.typeOpen || this.targetOpen) },
    openTypeOptions() { this.typeOpen = true; this.typeSearchActive = false; this.closeTargetOptions(); this.emitOpenState() },
    toggleTypeOptions() { this.typeOpen ? this.closeTypeOptions() : this.openTypeOptions() },
    closeTypeOptions() { this.typeOpen = false; this.typeSearchActive = false; this.emitOpenState() },
    closeTargetOptions() { if (this.$refs.targetCombobox) this.$refs.targetCombobox.closeOptions() },
    closeOptions() { this.typeOpen = false; this.typeSearchActive = false; this.closeTargetOptions(); this.targetOpen = false; this.emitOpenState() },
    handleTypeInput(event) {
      this.typeSearchActive = true
      this.typeOpen = true
      this.$emit('update:targetType', String(event?.detail?.value || ''))
      this.$emit('update:targetName', '')
      this.$emit('update:targetId', '')
      this.emitOpenState()
    },
    selectType(option) {
      const changed = option !== this.targetType
      this.$emit('update:targetType', option)
      this.typeOpen = false
      this.typeSearchActive = false
      if (changed) {
        this.$emit('update:targetName', '')
        this.$emit('update:targetId', '')
      }
      this.$nextTick(() => { if (this.$refs.targetCombobox) this.$refs.targetCombobox.openOptions() })
    },
    updateTargetName(value) {
      this.$emit('update:targetName', value)
      if (this.targetId) this.$emit('update:targetId', '')
    },
    selectTarget(payload) {
      this.$emit('update:targetName', String(payload?.name || ''))
      this.$emit('update:targetId', String(payload?.id || ''))
      this.$emit('select', payload)
    },
    clearTarget() { this.$emit('update:targetName', ''); this.$emit('update:targetId', '') },
    handleTargetOpen(open) { this.targetOpen = Boolean(open); if (open) this.typeOpen = false; this.emitOpenState() }
  }
}
</script>

<style lang="scss" scoped>
.visit-target-fields__field { position: relative; padding: 22rpx 0; }
.visit-target-fields__field + .visit-target-fields__field { border-top: 1rpx solid #edf2f4; }
.visit-target-fields__heading { margin-bottom: 14rpx; color: #17313b; font-size: 26rpx; font-weight: 600; }
.visit-target-fields__type { position: relative; width: 100%; }
.visit-target-fields__target { position: relative; }
.visit-target-fields__control--active { z-index: 30; }
.visit-target-fields__type-control { box-sizing: border-box; height: 76rpx; display: grid; grid-template-columns: minmax(0, 1fr) 48rpx; align-items: center; padding-left: 14rpx; border: 2rpx solid #d8e6eb; border-radius: 12rpx; background: #fff; }
.visit-target-fields__type-control.focused { border-color: #28a7cf; box-shadow: 0 0 0 4rpx rgba(40, 167, 207, .08); }
.visit-target-fields__type-input { width: 100%; height: 72rpx; color: #233f4b; font-size: 25rpx; }
.visit-target-fields__arrow { align-self: center; justify-self: center; color: #81969e; font-size: 38rpx; line-height: 1; transform: rotate(90deg); transition: transform .18s ease; }
.visit-target-fields__arrow.open { transform: rotate(-90deg); }
.visit-target-fields__type-dropdown { position: absolute; z-index: 30; top: 84rpx; right: 0; left: 0; overflow: hidden; border: 1rpx solid #dce8ec; border-radius: 12rpx; background: #fff; box-shadow: 0 14rpx 38rpx rgba(22, 63, 79, .16); }
.visit-target-fields__type-option { min-height: 76rpx; display: flex; align-items: center; justify-content: space-between; padding: 0 18rpx; border-bottom: 1rpx solid #edf3f5; color: #35515c; font-size: 24rpx; }
.visit-target-fields__type-option.selected { color: #087fae; background: #eef9fc; }
.visit-target-fields__type-option--pressed { background: #f0f7f9; }
.visit-target-fields__type-empty { min-height: 96rpx; display: flex; align-items: center; justify-content: center; color: #83979e; font-size: 22rpx; }
.visit-target-fields__help { display: block; margin-top: 10rpx; color: #8a9da4; font-size: 20rpx; line-height: 30rpx; }
@media (prefers-reduced-motion: reduce) { .visit-target-fields__arrow { transition: none; } }
</style>
