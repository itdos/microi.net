<template>
  <mci-page-shell class="reminders-page" :style="mciTokenStyle" title="提醒管理" subtitle="客户跟进备忘" @back="goBack">
    <mci-skeleton v-if="loading" type="list" :rows="4" />
    <template v-else>
      <view class="summary-row">
        <view class="summary-item"><text class="summary-value">{{ todayCount }}</text><text class="summary-label">今日提醒</text></view>
        <view class="summary-item"><text class="summary-value">{{ weekCount }}</text><text class="summary-label">本周提醒</text></view>
        <view class="summary-item"><text class="summary-value">{{ pendingCount }}</text><text class="summary-label">待完成</text></view>
      </view>
      <view class="tabs">
        <view v-for="item in tabs" :key="item.key" class="tab" :class="{ active: tab === item.key }" @tap="tab = item.key"><text>{{ item.label }}</text></view>
      </view>
      <scroll-view class="page-scroll" scroll-y>
        <view class="page-content">
          <view v-if="!filteredRows.length" class="empty"><text class="empty-title">暂无提醒</text><text class="empty-note">点击右下角添加</text></view>
          <view v-for="row in filteredRows" :key="row.Id" class="reminder-card" :class="{ done: row.Done, overdue: isOverdue(row) }" @tap="editReminder(row)">
            <view class="card-head"><text class="card-title">{{ row.Title }}</text><text class="state-tag">{{ row.Done ? '已完成' : (isOverdue(row) ? '已超时' : '待提醒') }}</text></view>
            <text v-if="row.CustomerName" class="customer-name">{{ row.CustomerName }}</text>
            <text class="remind-time">{{ row.RemindTime }}</text>
            <text v-if="row.Content" class="content">{{ displayContent(row.Content) }}</text>
            <view class="card-actions" @tap.stop>
              <button class="text-button" @tap="toggleDone(row)">{{ row.Done ? '恢复' : '完成' }}</button>
              <button class="text-button danger" @tap="confirmRemove(row)">删除</button>
            </view>
          </view>
        </view>
      </scroll-view>
      <view class="floating-add" hover-class="floating-add--pressed" @tap="addReminder"><text>＋</text></view>
    </template>

    <view v-if="editorVisible" class="mask" @tap="closeEditor">
      <view class="editor-sheet" @tap.stop>
        <view class="sheet-handle"></view>
        <view class="sheet-head"><text class="sheet-title">{{ form.Id ? '编辑提醒' : '新增提醒' }}</text><text class="sheet-close" @tap="closeEditor">×</text></view>
        <scroll-view class="editor-scroll" scroll-y>
          <view class="field-row" @tap="customerVisible = true"><text class="field-label">客户</text><text class="field-select" :class="{ placeholder: !form.CustomerName }">{{ form.CustomerName || '请选择客户' }} ›</text></view>
          <view class="date-grid">
            <picker mode="date" :value="form.date" @change="form.date = $event.detail.value"><view class="field-row"><text class="field-label">日期</text><text class="field-select">{{ form.date || '请选择' }}</text></view></picker>
            <picker mode="time" :value="form.time" @change="form.time = $event.detail.value"><view class="field-row"><text class="field-label">时间</text><text class="field-select">{{ form.time || '请选择' }}</text></view></picker>
          </view>
          <view class="field-row"><text class="field-label">标题</text><input v-model="form.Title" class="field-input" placeholder="请输入提醒标题" maxlength="50" /></view>
          <view class="field-row"><text class="field-label">内容</text><textarea v-model="form.Content" class="field-textarea" placeholder="请输入提醒内容" maxlength="500" /></view>
        </scroll-view>
        <view class="sheet-bottom"><button class="primary-button" @tap="save">保存提醒</button></view>
      </view>
    </view>

    <view v-if="customerVisible" class="mask mask--upper" @tap="customerVisible = false">
      <view class="customer-sheet" @tap.stop>
        <view class="sheet-handle"></view>
        <view class="sheet-head"><text class="sheet-title">选择客户</text><text class="sheet-close" @tap="customerVisible = false">×</text></view>
        <view class="search-row"><input v-model="customerKeyword" class="search-input" placeholder="搜索客户名称" confirm-type="search" @confirm="loadCustomers" /><button class="search-button" @tap="loadCustomers">搜索</button></view>
        <mci-skeleton v-if="customerLoading" type="list" :rows="3" />
        <scroll-view v-else class="customer-list" scroll-y>
          <view v-for="item in customers" :key="item.Id" class="customer-row" @tap="selectCustomer(item)"><text>{{ item.KehuMC || item.Name || item.Bianhao || '未命名客户' }}</text><text>›</text></view>
          <view v-if="!customers.length" class="empty small"><text class="empty-title">未找到客户</text></view>
        </scroll-view>
      </view>
    </view>
  </mci-page-shell>
</template>

<script>
import { V8 } from '@/utils/request.js'
import { loadReminders, saveReminder, toggleReminder, removeReminder } from '@/platform/reminders.js'
import { themeMixin } from '@/utils/theme.js'
import { formatStructuredValue } from '@/platform/display.js'

function pad(value) { return String(value).padStart(2, '0') }
function localDateText(date = new Date()) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` }
function startOfWeek(date = new Date()) { const value = new Date(date); const day = value.getDay() || 7; value.setHours(0,0,0,0); value.setDate(value.getDate() - day + 1); return value }

export default {
  mixins: [themeMixin],
  data() {
    return {
      loading: true, tab: 'pending', tabs: [{ key: 'pending', label: '待完成' }, { key: 'all', label: '全部' }, { key: 'done', label: '已完成' }],
      rows: [], editorVisible: false, customerVisible: false, customerLoading: false, customerKeyword: '', customers: [],
      form: { Id: '', CustomerId: '', CustomerName: '', date: '', time: '', Title: '', Content: '', Done: false, CreateTime: '' }
    }
  },
  computed: {
    filteredRows() {
      const rows = this.rows.slice().sort((a, b) => String(a.RemindTime || '').localeCompare(String(b.RemindTime || '')))
      if (this.tab === 'pending') return rows.filter((row) => !row.Done)
      if (this.tab === 'done') return rows.filter((row) => row.Done)
      return rows
    },
    todayCount() { const today = localDateText(); return this.rows.filter((row) => String(row.RemindTime || '').startsWith(today)).length },
    weekCount() { const start = startOfWeek().getTime(); const end = start + 7 * 86400000; return this.rows.filter((row) => { const time = new Date(String(row.RemindTime || '').replace(/-/g, '/')).getTime(); return time >= start && time < end }).length },
    pendingCount() { return this.rows.filter((row) => !row.Done).length }
  },
  onLoad() { setTimeout(() => { this.refresh(); this.loading = false }, 80) },
  methods: {
    displayContent(value) { return formatStructuredValue(value, { empty: '' }) },
    goBack() { uni.navigateBack() },
    refresh() { this.rows = loadReminders() },
    isOverdue(row) { const time = new Date(String(row.RemindTime || '').replace(/-/g, '/')).getTime(); return !row.Done && Number.isFinite(time) && time < Date.now() },
    blankForm() { const next = new Date(Date.now() + 3600000); return { Id: '', CustomerId: '', CustomerName: '', date: localDateText(next), time: `${pad(next.getHours())}:${pad(next.getMinutes())}`, Title: '', Content: '', Done: false, CreateTime: '' } },
    addReminder() { this.form = this.blankForm(); this.editorVisible = true; if (!this.customers.length) this.loadCustomers() },
    editReminder(row) { const parts = String(row.RemindTime || '').split(' '); this.form = { ...row, date: parts[0] || '', time: (parts[1] || '').slice(0, 5) }; this.editorVisible = true; if (!this.customers.length) this.loadCustomers() },
    closeEditor() { this.editorVisible = false },
    async loadCustomers() {
      this.customerLoading = true
      try {
        const result = await V8.FormEngine.GetTableData('Diy_Kehu', { _Keyword: this.customerKeyword.trim(), _SelectFields: ['Id', 'KehuMC', 'Name', 'Bianhao'], _OrderBy: 'CreateTime', _OrderByType: 'DESC', _PageIndex: 1, _PageSize: 100 })
        if (!result || Number(result.Code) !== 1) throw new Error((result && result.Msg) || '客户加载失败')
        this.customers = Array.isArray(result.Data) ? result.Data : []
      } catch (error) {
        this.customers = []
        uni.showToast({ title: error.message || '客户加载失败', icon: 'none' })
      } finally { this.customerLoading = false }
    },
    selectCustomer(item) { this.form.CustomerId = item.Id; this.form.CustomerName = item.KehuMC || item.Name || item.Bianhao || ''; this.customerVisible = false },
    save() {
      if (!this.form.CustomerName) return uni.showToast({ title: '请选择客户', icon: 'none' })
      if (!this.form.date || !this.form.time) return uni.showToast({ title: '请选择提醒时间', icon: 'none' })
      if (!this.form.Title.trim()) return uni.showToast({ title: '请输入提醒标题', icon: 'none' })
      if (!this.form.Content.trim()) return uni.showToast({ title: '请输入提醒内容', icon: 'none' })
      saveReminder({ ...this.form, RemindTime: `${this.form.date} ${this.form.time}:00` })
      this.editorVisible = false
      this.refresh()
      uni.showToast({ title: '提醒已保存', icon: 'success' })
    },
    toggleDone(row) { toggleReminder(row.Id, !row.Done); this.refresh() },
    confirmRemove(row) { uni.showModal({ title: '删除提醒', content: `确认删除“${row.Title}”吗？`, success: (result) => { if (!result.confirm) return; removeReminder(row.Id); this.refresh() } }) }
  }
}
</script>

<style scoped>
.summary-row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); margin: 20rpx 24rpx 14rpx; border: 1rpx solid #dfebef; border-radius: 8rpx; background: #fff; }
.summary-item { position: relative; display: flex; flex-direction: column; align-items: center; padding: 20rpx 6rpx; }
.summary-item + .summary-item::before { position: absolute; top: 20rpx; bottom: 20rpx; left: 0; width: 1rpx; background: #e8f0f3; content: ''; }
.summary-value { color: #087ebd; font-size: 34rpx; font-weight: 700; }
.summary-label { margin-top: 3rpx; color: #728891; font-size: 20rpx; }
.tabs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); margin: 0 24rpx; border-bottom: 1rpx solid #dfeaed; }
.tab { position: relative; display: flex; align-items: center; justify-content: center; height: 68rpx; color: #738991; font-size: 23rpx; }
.tab.active { color: #087ebd; font-weight: 650; }
.tab.active::after { position: absolute; bottom: -1rpx; left: 28%; width: 44%; height: 4rpx; border-radius: 2rpx; background: #087ebd; content: ''; }
.page-scroll { height: calc(100vh - 92rpx - var(--mci-safe-top) - 226rpx); }
.page-content { padding: 18rpx 24rpx calc(120rpx + var(--mci-safe-bottom)); }
.reminder-card { margin-bottom: 16rpx; padding: 22rpx 24rpx 14rpx; border: 1rpx solid #dfeaed; border-left: 6rpx solid #1595cb; border-radius: 8rpx; background: #fff; animation: cardIn 220ms ease-out both; }
.reminder-card.overdue { border-left-color: #e15b43; }
.reminder-card.done { border-left-color: #93a4aa; opacity: .78; }
.card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16rpx; }
.card-title { min-width: 0; color: #233f4a; font-size: 27rpx; font-weight: 650; }
.state-tag { flex: 0 0 auto; padding: 5rpx 10rpx; border-radius: 5rpx; background: #edf7fa; color: #087ebd; font-size: 19rpx; }
.overdue .state-tag { background: #fff0ed; color: #d64f36; }
.done .state-tag { background: #eef2f3; color: #71858d; }
.customer-name { display: block; margin-top: 12rpx; color: #44616d; font-size: 23rpx; }
.remind-time { display: block; margin-top: 7rpx; color: #0b82bb; font-size: 22rpx; }
.content { display: -webkit-box; margin-top: 10rpx; overflow: hidden; color: #7b9098; font-size: 22rpx; line-height: 34rpx; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.card-actions { display: flex; justify-content: flex-end; margin-top: 12rpx; border-top: 1rpx solid #eef3f5; }
.text-button { height: 58rpx; margin: 0 0 0 18rpx; padding: 0 10rpx; background: transparent; color: #087ebd; font-size: 22rpx; line-height: 58rpx; }
.text-button.danger { color: #d6533c; }
.text-button::after, .primary-button::after, .search-button::after { border: none; }
.empty { display: flex; flex-direction: column; align-items: center; padding: 100rpx 20rpx; }
.empty.small { padding: 56rpx 20rpx; }
.empty-title { color: #5e7781; font-size: 26rpx; }
.empty-note { margin-top: 8rpx; color: #98a8ae; font-size: 21rpx; }
.floating-add { position: fixed; right: 30rpx; bottom: calc(30rpx + var(--mci-safe-bottom)); z-index: 15; display: flex; align-items: center; justify-content: center; width: 92rpx; height: 92rpx; border-radius: 50%; background: #087ebd; color: #fff; font-size: 52rpx; box-shadow: 0 10rpx 24rpx rgba(8, 126, 189, .24); transition: transform 150ms ease; }
.floating-add--pressed { transform: scale(.92); }
.mask { position: fixed; inset: 0; z-index: 60; display: flex; align-items: flex-end; background: rgba(7, 28, 37, .48); }
.mask--upper { z-index: 70; }
.editor-sheet, .customer-sheet { box-sizing: border-box; width: 100%; max-height: 88vh; padding: 12rpx 24rpx calc(18rpx + var(--mci-safe-bottom)); border-radius: 12rpx 12rpx 0 0; background: #fff; animation: sheetIn 200ms ease-out both; }
.sheet-handle { width: 72rpx; height: 7rpx; margin: 0 auto 10rpx; border-radius: 4rpx; background: #d7e1e5; }
.sheet-head { display: flex; align-items: center; justify-content: space-between; height: 72rpx; }
.sheet-title { color: #193640; font-size: 29rpx; font-weight: 700; }
.sheet-close { padding: 6rpx; color: #758b94; font-size: 40rpx; }
.editor-scroll { max-height: 58vh; }
.field-row { display: flex; flex-direction: column; min-height: 108rpx; padding: 16rpx 4rpx 12rpx; border-bottom: 1rpx solid #edf3f5; }
.field-label { color: #607983; font-size: 21rpx; }
.field-input, .field-select { height: 58rpx; margin-top: 5rpx; color: #193640; font-size: 26rpx; line-height: 58rpx; }
.field-select.placeholder { color: #9aa9ae; }
.field-textarea { box-sizing: border-box; width: 100%; height: 160rpx; margin-top: 10rpx; padding: 14rpx; border-radius: 6rpx; background: #f5f8f9; color: #193640; font-size: 25rpx; line-height: 36rpx; }
.date-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20rpx; }
.sheet-bottom { padding-top: 18rpx; }
.primary-button { height: 80rpx; border-radius: 8rpx; background: #087ebd; color: #fff; font-size: 26rpx; font-weight: 650; line-height: 80rpx; }
.search-row { display: grid; grid-template-columns: minmax(0, 1fr) 112rpx; gap: 12rpx; padding: 8rpx 0 18rpx; }
.search-input { box-sizing: border-box; height: 70rpx; padding: 0 20rpx; border: 1rpx solid #d5e3e8; border-radius: 7rpx; background: #f6f9fa; font-size: 24rpx; }
.search-button { height: 70rpx; border-radius: 7rpx; background: #eaf6fa; color: #087ebd; font-size: 23rpx; line-height: 70rpx; }
.customer-list { height: 58vh; }
.customer-row { display: flex; align-items: center; justify-content: space-between; min-height: 86rpx; padding: 0 8rpx; border-bottom: 1rpx solid #edf3f5; color: #294752; font-size: 25rpx; }
@keyframes cardIn { from { opacity: 0; transform: translateY(10rpx); } to { opacity: 1; transform: none; } }
@keyframes sheetIn { from { transform: translateY(100%); } to { transform: none; } }
@media (prefers-reduced-motion: reduce) { .reminder-card, .editor-sheet, .customer-sheet, .floating-add { animation: none; transition: none; } }
</style>
