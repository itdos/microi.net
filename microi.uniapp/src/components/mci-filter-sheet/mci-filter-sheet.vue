<template>
  <view v-if="visible" class="filter-layer" role="dialog" aria-label="高级筛选">
    <view class="filter-layer__mask" @tap="close" />
    <view class="filter-sheet" @tap.stop>
      <view class="filter-sheet__handle" aria-hidden="true" />
      <view class="filter-sheet__head">
        <view>
          <text class="filter-sheet__title">高级筛选</text>
          <text class="filter-sheet__subtitle">筛选项来自当前模块配置</text>
        </view>
        <view class="filter-sheet__close" hover-class="filter-sheet__pressed" aria-label="关闭筛选" @tap="close">
          <view class="filter-sheet__close-icon" aria-hidden="true" />
        </view>
      </view>

      <scroll-view class="filter-sheet__body" scroll-y>
        <view v-for="field in fields" :key="field.key" class="filter-field">
          <text class="filter-field__label">{{ field.label }}</text>

          <input
            v-if="field.type === 'text'"
            class="filter-field__input"
            :value="draft[field.key] || ''"
            :placeholder="field.placeholder || `请输入${field.label}`"
            confirm-type="done"
            @input="setValue(field.key, $event.detail.value)"
          />

          <view v-else-if="field.type === 'range'" class="filter-field__range">
            <input class="filter-field__input" type="digit" :value="rangeValue(field.key, 'min')" placeholder="最小值" @input="setRange(field.key, 'min', $event.detail.value)" />
            <view class="filter-field__range-line" aria-hidden="true" />
            <input class="filter-field__input" type="digit" :value="rangeValue(field.key, 'max')" placeholder="最大值" @input="setRange(field.key, 'max', $event.detail.value)" />
          </view>

          <view v-else-if="field.type === 'date-range'" class="filter-field__range">
            <picker mode="date" :value="rangeValue(field.key, 'start')" @change="setRange(field.key, 'start', $event.detail.value)">
              <view class="filter-field__input filter-field__picker" :class="{ 'is-placeholder': !rangeValue(field.key, 'start') }">
                {{ rangeValue(field.key, 'start') || '开始日期' }}
              </view>
            </picker>
            <view class="filter-field__range-line" aria-hidden="true" />
            <picker mode="date" :value="rangeValue(field.key, 'end')" @change="setRange(field.key, 'end', $event.detail.value)">
              <view class="filter-field__input filter-field__picker" :class="{ 'is-placeholder': !rangeValue(field.key, 'end') }">
                {{ rangeValue(field.key, 'end') || '结束日期' }}
              </view>
            </picker>
          </view>

          <mci-native-field
            v-else-if="field.type === 'options' && field.source === 'native-field' && definition(field.field)"
            :field="definition(field.field)"
            :model-value="draft[field.key]"
            :table-name="tableName"
            :menu-id="menuId"
            :module-engine-key="moduleEngineKey"
            :form-data="draft"
            @update:model-value="setValue(field.key, $event)"
          />

          <view v-else-if="field.type === 'options'" class="filter-field__chips">
            <view
              v-for="option in field.options || []"
              :key="String(option.value)"
              class="filter-field__chip"
              :class="{ 'is-active': optionSelected(field, option) }"
              hover-class="filter-sheet__pressed"
              @tap="toggleOption(field, option)"
            >
              <view class="filter-field__check" aria-hidden="true"><view /></view>
              <text>{{ option.label }}</text>
            </view>
          </view>
        </view>
        <view v-if="!fields.length" class="filter-sheet__empty">当前模块没有配置高级筛选项</view>
        <view class="filter-sheet__body-spacer" aria-hidden="true" />
      </scroll-view>

      <view class="filter-sheet__footer">
        <view class="filter-sheet__button filter-sheet__button--ghost" hover-class="filter-sheet__pressed" @tap="reset">
          <view class="filter-sheet__reset-icon" aria-hidden="true" />
          <text>清空</text>
        </view>
        <view class="filter-sheet__button filter-sheet__button--primary" hover-class="filter-sheet__pressed" @tap="apply">
          <view class="filter-sheet__apply-icon" aria-hidden="true" />
          <text>查看结果</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
function cloneValues(value) {
  if (!value || typeof value !== 'object') return {}
  try { return JSON.parse(JSON.stringify(value)) } catch (error) { return { ...value } }
}

export default {
  name: 'MciFilterSheet',
  props: {
    visible: { type: Boolean, default: false },
    fields: { type: Array, default: () => [] },
    values: { type: Object, default: () => ({}) },
    definitions: { type: Array, default: () => [] },
    tableName: { type: String, default: '' },
    menuId: { type: String, default: '' },
    moduleEngineKey: { type: String, default: '' }
  },
  emits: ['close', 'apply', 'reset'],
  data() {
    return { draft: cloneValues(this.values) }
  },
  watch: {
    visible(value) {
      if (value) this.draft = cloneValues(this.values)
    },
    values: {
      deep: true,
      handler(value) {
        if (!this.visible) this.draft = cloneValues(value)
      }
    }
  },
  methods: {
    definition(name) {
      return this.definitions.find((item) => String(item && item.Name || '').toLowerCase() === String(name || '').toLowerCase()) || null
    },
    rangeValue(key, part) {
      const value = this.draft[key]
      return value && typeof value === 'object' ? (value[part] ?? '') : ''
    },
    setValue(key, value) {
      this.draft = { ...this.draft, [key]: value }
    },
    setRange(key, part, value) {
      this.setValue(key, { ...(this.draft[key] || {}), [part]: value })
    },
    optionSelected(field, option) {
      const value = this.draft[field.key]
      if (Array.isArray(value)) return value.some((item) => String(item) === String(option.value))
      return value !== undefined && value !== null && value !== '' && String(value) === String(option.value)
    },
    toggleOption(field, option) {
      if (field.multiple) {
        const current = Array.isArray(this.draft[field.key]) ? [...this.draft[field.key]] : []
        const index = current.findIndex((item) => String(item) === String(option.value))
        if (index >= 0) current.splice(index, 1)
        else current.push(option.value)
        this.setValue(field.key, current)
        return
      }
      this.setValue(field.key, this.optionSelected(field, option) ? '' : option.value)
    },
    close() { this.$emit('close') },
    reset() {
      this.draft = {}
      this.$emit('reset')
    },
    apply() { this.$emit('apply', cloneValues(this.draft)) }
  }
}
</script>

<style scoped>
.filter-layer { position: fixed; inset: 0; z-index: 80; }
.filter-layer__mask { position: absolute; inset: 0; background: rgba(8, 28, 38, .46); }
.filter-sheet { position: absolute; left: 0; right: 0; bottom: 0; height: min(82vh, 1120rpx); display: flex; flex-direction: column; overflow: hidden; border-radius: 28rpx 28rpx 0 0; color: var(--mci-text-primary, #17313b); background: var(--mci-bg-elevated, #fff); box-shadow: 0 -18rpx 45rpx rgba(10, 43, 58, .18); }
.filter-sheet__handle { flex: none; width: 76rpx; height: 8rpx; margin: 14rpx auto 4rpx; border-radius: 8rpx; background: #d8e1e5; }
.filter-sheet__head { flex: none; min-height: 106rpx; padding: 16rpx 26rpx 14rpx 30rpx; display: flex; align-items: center; justify-content: space-between; border-bottom: 1rpx solid var(--mci-border-color, #e3ebee); box-sizing: border-box; }
.filter-sheet__head > view:first-child { min-width: 0; display: flex; flex-direction: column; }
.filter-sheet__title { font-size: 32rpx; font-weight: 750; }
.filter-sheet__subtitle { margin-top: 4rpx; color: var(--mci-text-secondary, #748991); font-size: 23rpx; line-height: 32rpx; }
.filter-sheet__close { width: 68rpx; height: 68rpx; display: flex; align-items: center; justify-content: center; border-radius: 16rpx; }
.filter-sheet__close-icon { position: relative; width: 28rpx; height: 28rpx; }
.filter-sheet__close-icon::before, .filter-sheet__close-icon::after { position: absolute; top: 13rpx; left: 2rpx; width: 25rpx; height: 3rpx; border-radius: 3rpx; background: currentColor; content: ''; }
.filter-sheet__close-icon::before { transform: rotate(45deg); }
.filter-sheet__close-icon::after { transform: rotate(-45deg); }
.filter-sheet__body { min-height: 0; flex: 1; }
.filter-field { padding: 22rpx 30rpx 24rpx; border-bottom: 1rpx solid var(--mci-border-color, #edf2f4); }
.filter-field__label { display: block; margin-bottom: 15rpx; font-size: 25rpx; font-weight: 680; }
.filter-field__input { height: 76rpx; padding: 0 22rpx; border: 1rpx solid var(--mci-border-color, #dce7eb); border-radius: 12rpx; background: var(--mci-bg-soft, #f6f9fa); box-sizing: border-box; font-size: 25rpx; }
.filter-field__range { display: grid; grid-template-columns: minmax(0, 1fr) 28rpx minmax(0, 1fr); align-items: center; gap: 8rpx; }
.filter-field__range > picker { min-width: 0; }
.filter-field__range-line { width: 20rpx; height: 2rpx; justify-self: center; background: #9caeb5; }
.filter-field__picker { display: flex; align-items: center; color: var(--mci-text-primary, #17313b); white-space: nowrap; }
.filter-field__picker.is-placeholder { color: #8ca0a8; }
.filter-field__chips { display: flex; flex-wrap: wrap; gap: 14rpx; }
.filter-field__chip { min-height: 66rpx; padding: 0 20rpx; display: flex; align-items: center; gap: 10rpx; border: 1rpx solid var(--mci-border-color, #dce7eb); border-radius: 12rpx; color: #536d77; background: var(--mci-bg-soft, #f7fafb); box-sizing: border-box; font-size: 23rpx; }
.filter-field__check { width: 24rpx; height: 24rpx; display: flex; align-items: center; justify-content: center; border: 2rpx solid #a5b5bb; border-radius: 6rpx; box-sizing: border-box; }
.filter-field__check view { width: 10rpx; height: 5rpx; border-left: 3rpx solid transparent; border-bottom: 3rpx solid transparent; transform: rotate(-45deg) translateY(-1rpx); }
.filter-field__chip.is-active { border-color: var(--mci-color-primary, #087da8); color: var(--mci-color-primary, #087da8); background: rgba(8, 125, 168, .08); }
.filter-field__chip.is-active .filter-field__check { border-color: var(--mci-color-primary, #087da8); background: var(--mci-color-primary, #087da8); }
.filter-field__chip.is-active .filter-field__check view { border-color: #fff; }
.filter-sheet__empty { padding: 90rpx 30rpx; color: var(--mci-text-secondary, #7d9198); font-size: 24rpx; text-align: center; }
.filter-sheet__body-spacer { height: 30rpx; }
.filter-sheet__footer { flex: none; padding: 18rpx 26rpx calc(18rpx + var(--mci-safe-bottom)); display: grid; grid-template-columns: 210rpx minmax(0, 1fr); gap: 18rpx; border-top: 1rpx solid var(--mci-border-color, #e3ebee); background: var(--mci-bg-elevated, #fff); }
.filter-sheet__button { height: 82rpx; display: flex; align-items: center; justify-content: center; gap: 12rpx; border-radius: 14rpx; box-sizing: border-box; font-size: 27rpx; font-weight: 700; }
.filter-sheet__button--ghost { border: 1rpx solid var(--mci-border-color, #d6e2e6); color: #506b76; background: var(--mci-bg-soft, #f7fafb); }
.filter-sheet__button--primary { color: #fff; background: var(--mci-color-primary, #087da8); box-shadow: 0 8rpx 18rpx rgba(8, 125, 168, .18); }
.filter-sheet__reset-icon { width: 24rpx; height: 24rpx; border: 3rpx solid currentColor; border-right-color: transparent; border-radius: 50%; box-sizing: border-box; transform: rotate(-35deg); }
.filter-sheet__apply-icon { width: 25rpx; height: 13rpx; border-left: 4rpx solid currentColor; border-bottom: 4rpx solid currentColor; transform: rotate(-45deg) translateY(-2rpx); }
.filter-sheet__pressed { opacity: .68; }
</style>

<style scoped>
.filter-layer__mask { background: rgba(15,23,42,.38); backdrop-filter: blur(3px); }
.filter-sheet { border: 0; border-radius: 32rpx 32rpx 0 0; background: #fff; box-shadow: 0 -18rpx 48rpx rgba(15,23,42,.16); }
.filter-sheet__handle { border-radius: 8rpx; background: #d1d5db; }
.filter-sheet__head { border-bottom-color: var(--mci-divider, #e5e7eb); background: #fff; }
.filter-sheet__title { color: var(--mci-text-primary, #111827); }
.filter-sheet__subtitle { color: var(--mci-text-secondary, #667280); }
.filter-sheet__close { width: 88rpx; height: 88rpx; }
.filter-field { padding: 22rpx 24rpx 26rpx; border-bottom-color: var(--mci-divider, #e5e7eb); }
.filter-field__label { color: var(--mci-text-primary, #111827); }
.filter-field__input { min-height: 88rpx; height: 88rpx; border: 1rpx solid var(--mci-divider, #e5e7eb); border-radius: 18rpx; background: #f8fafc; color: var(--mci-text-primary, #111827); }
.filter-field__chip { min-height: 88rpx; border-color: var(--mci-divider, #e5e7eb); border-radius: 18rpx; color: var(--mci-text-secondary, #667280); background: #f8fafc; }
.filter-field__chip.is-active { border-color: var(--mci-color-primary, #2563eb); color: var(--mci-color-primary, #2563eb); background: var(--mci-color-primary-faint, #eff6ff); }
.filter-sheet__footer { border-top-color: var(--mci-divider, #e5e7eb); background: #fff; box-shadow: 0 -8rpx 24rpx rgba(15,23,42,.06); }
.filter-sheet__button { min-height: 88rpx; height: 88rpx; border-radius: 18rpx; }
.filter-sheet__button--ghost { border: 1rpx solid var(--mci-divider, #e5e7eb); color: var(--mci-text-secondary, #667280); background: #fff; }
.filter-sheet__button--primary { background: var(--mci-color-primary, #2563eb); box-shadow: none; }
</style>
