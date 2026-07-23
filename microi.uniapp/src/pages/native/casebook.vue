<template>
  <mci-page-shell class="casebook-page" :style="mciTokenStyle" :title="bookId ? '案例册详情' : '新增案例册'" subtitle="客户成功案例" @back="goBack">
    <mci-skeleton v-if="loading" type="list" :rows="6" />
    <scroll-view v-else class="page-scroll" scroll-y>
      <view class="page-content">
        <view class="book-panel">
          <view class="book-accent" />
          <view class="book-content">
            <text class="book-label">案例册名称</text>
            <input v-if="canEdit" v-model="bookName" class="book-input" placeholder="请输入案例册名称" maxlength="50" />
            <text v-else class="book-title">{{ bookName || '未命名案例册' }}</text>
            <view v-if="bookId" class="book-meta"><text>{{ book.UserName || '集福鲤平台' }}</text><text>{{ book.TenantName || currentUser.TenantName || '' }}</text><text>{{ formatDate(book.UpdateTime || book.CreateTime) }}</text></view>
          </view>
          <button v-if="bookId && canEdit && bookName !== originalName" class="save-name-button" :loading="savingName" @tap="saveName">保存名称</button>
        </view>

        <view v-if="bookId" class="section-heading">
          <view><text class="section-title">已收录案例</text><text class="section-count">{{ children.length }}</text></view>
          <button v-if="canEdit" class="add-case-button" @tap="openCasePicker"><text>＋</text> 添加案例</button>
        </view>

        <view v-if="bookId && childLoading" class="case-list"><mci-skeleton type="list" :rows="4" /></view>
        <view v-else-if="bookId && children.length" class="case-list">
          <view v-for="item in children" :key="item.Id" class="case-card" hover-class="case-card--pressed" @tap="editChild(item)">
            <view class="case-head"><text class="case-title">{{ item.Biaoti || item.KehuMC || '客户案例' }}</text><button v-if="canEdit" class="delete-button" @tap.stop="removeChild(item)">删除</button></view>
            <text v-if="item.KehuMC" class="customer-name">{{ item.KehuMC }}</text>
            <view class="case-lines">
              <view v-if="item.YinshuiXQ"><text>饮水需求</text><text>{{ item.YinshuiXQ }}</text></view>
              <view v-if="item.JiejueFA"><text>解决方案</text><text>{{ item.JiejueFA }}</text></view>
              <view v-if="item.KehuPJ"><text>客户评价</text><text>{{ item.KehuPJ }}</text></view>
            </view>
            <view v-if="item._photos && item._photos.length" class="photo-row">
              <image v-for="(photo, index) in item._photos.slice(0, 3)" :key="photo" :src="photo" mode="aspectFill" @tap.stop="previewPhotos(item._photos, index)" />
              <view v-if="item._photos.length > 3" class="photo-more"><text>+{{ item._photos.length - 3 }}</text></view>
            </view>
            <view class="case-foot"><text>{{ item.TuijianPY || '查看案例详情' }}</text><text>›</text></view>
          </view>
        </view>
        <view v-else-if="bookId" class="empty-state"><view class="empty-mark"><text>案</text></view><text class="empty-title">尚未收录客户案例</text></view>
        <view class="bottom-space" />
      </view>
    </scroll-view>

    <view v-if="!loading && !bookId && canEdit" class="bottom-bar" slot="fixed"><button class="primary-button" :loading="creating" :disabled="creating" @tap="createBook">保存案例册</button></view>

    <view v-if="casePickerVisible" class="picker-mask" @tap="closeCasePicker">
      <view class="picker-sheet" @tap.stop>
        <view class="picker-handle" />
        <view class="picker-header"><view><text>选择客户案例</text><text v-if="selectedCaseIds.length" class="selected-count">已选 {{ selectedCaseIds.length }}</text></view><button class="close-button" @tap="closeCasePicker">×</button></view>
        <view class="search-box"><text class="search-icon">⌕</text><input v-model="caseKeyword" confirm-type="search" placeholder="搜索标题或客户" @confirm="searchCases" /><button v-if="caseKeyword" class="clear-button" @tap="caseKeyword = ''">×</button></view>
        <scroll-view class="source-list" scroll-y @scrolltolower="loadMoreCases">
          <mci-skeleton v-if="caseLoading && !sourceCases.length" type="list" :rows="5" />
          <button v-for="item in sourceCases" :key="item.Id" class="source-row" :class="{ 'source-row--selected': selectedCaseIds.includes(item.Id), 'source-row--added': isAdded(item) }" :disabled="isAdded(item)" @tap="toggleCase(item)">
            <view class="source-check"><text>{{ isAdded(item) ? '✓' : selectedCaseIds.includes(item.Id) ? '✓' : '' }}</text></view>
            <view class="source-main"><text>{{ item.Biaoti || '未命名案例' }}</text><text>{{ item.KehuMC || '未关联客户' }}{{ isAdded(item) ? ' · 已收录' : '' }}</text></view>
          </button>
          <view v-if="!caseLoading && !sourceCases.length" class="empty-list">未找到客户案例</view>
          <view v-if="caseLoading && sourceCases.length" class="loading-more">加载中</view>
        </scroll-view>
        <view class="picker-submit"><button :loading="addingCases" :disabled="!selectedCaseIds.length || addingCases" @tap="addSelectedCases">添加 {{ selectedCaseIds.length || '' }}</button></view>
      </view>
    </view>
  </mci-page-shell>
</template>

<script>
import { themeMixin } from '@/utils/theme.js'
import { getUser, V8 } from '@/utils/request.js'
import { requireLogin } from '@/platform/business-runtime.js'

function parseUpload(value) {
  if (!value) return []
  if (Array.isArray(value)) return value
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : [parsed]
  } catch (error) {
    return String(value).split(',').map((item) => item.trim()).filter(Boolean)
  }
}

export default {
  mixins: [themeMixin],
  data() {
    return {
      loading: true, childLoading: false, creating: false, savingName: false, addingCases: false,
      bookId: '', book: {}, bookName: '', originalName: '', currentUser: {}, children: [],
      casePickerVisible: false, caseKeyword: '', caseLoading: false, sourceCases: [], casePage: 1, caseCount: 0, selectedCaseIds: [], searchTimer: null
    }
  },
  computed: { canEdit() { return Boolean(this.currentUser.TenantId) } },
  watch: {
    caseKeyword() {
      clearTimeout(this.searchTimer)
      this.searchTimer = setTimeout(() => this.searchCases(), 280)
    }
  },
  async onLoad(options) {
    if (!requireLogin()) return
    this.currentUser = getUser() || {}
    this.bookId = options.id || ''
    if (!this.canEdit && !this.bookId) {
      uni.showToast({ title: '当前账号不能新建案例册', icon: 'none' })
      setTimeout(this.goBack, 800)
      return
    }
    await this.initialize()
  },
  onUnload() { clearTimeout(this.searchTimer) },
  methods: {
    async initialize() {
      try {
        if (this.bookId) {
          await this.loadBook()
          await this.loadChildren()
        }
      } catch (error) { uni.showToast({ title: error.message || '案例册加载失败', icon: 'none' }) }
      finally { this.loading = false }
    },
    async loadBook() {
      const result = await V8.FormEngine.GetFormData('diy_anlice', { Id: this.bookId })
      if (!result || Number(result.Code) !== 1 || !result.Data) throw new Error((result && result.Msg) || '案例册不存在')
      this.book = result.Data
      this.bookName = result.Data.AnliCMC || ''
      this.originalName = this.bookName
    },
    async loadChildren() {
      this.childLoading = true
      try {
        const result = await V8.FormEngine.GetTableData('diy_anlice_child', {
          _Where: [{ Name: 'AnliCID', Type: '=', Value: this.bookId }], _OrderBy: 'CreateTime', _OrderByType: 'DESC', _PageIndex: 1, _PageSize: 500
        })
        const rows = result && Number(result.Code) === 1 && Array.isArray(result.Data) ? result.Data : []
        this.children = await Promise.all(rows.map(async (row) => {
          const paths = parseUpload(row.KehuALZP).map((item) => typeof item === 'object' ? item.Url || item.Path || item.FilePath || item.FilePathName : item).filter(Boolean)
          const photos = await Promise.all(paths.slice(0, 10).map((path) => V8.resolveFileUrl(path).catch(() => V8.assetUrl(path))))
          return { ...row, _photos: photos.filter(Boolean) }
        }))
      } finally { this.childLoading = false }
    },
    async createBook() {
      if (!this.bookName.trim()) { uni.showToast({ title: '请输入案例册名称', icon: 'none' }); return }
      if (this.creating) return
      this.creating = true
      try {
        const result = await V8.FormEngine.AddFormData('diy_anlice', {
          AnliCMC: this.bookName.trim(), TenantId: this.currentUser.TenantId || '', TenantName: this.currentUser.TenantName || '', _InvokeType: 'Client'
        })
        if (!result || Number(result.Code) !== 1) throw new Error((result && result.Msg) || '案例册保存失败')
        let id = result.Data && typeof result.Data === 'object' ? result.Data.Id : result.Data
        if (!id || typeof id !== 'string') {
          const query = await V8.FormEngine.GetTableData('diy_anlice', {
            _Where: [{ Name: 'AnliCMC', Type: '=', Value: this.bookName.trim() }], _OrderBy: 'CreateTime', _OrderByType: 'DESC', _PageIndex: 1, _PageSize: 1
          })
          id = query && query.Data && query.Data[0] ? query.Data[0].Id : ''
        }
        uni.$emit('xjy-business-refresh', { key: 'casebooks' })
        uni.showToast({ title: '案例册已创建', icon: 'success' })
        if (id) { this.bookId = id; await this.loadBook(); await this.loadChildren() }
        else setTimeout(this.goBack, 700)
      } catch (error) { uni.showToast({ title: error.message || '案例册保存失败', icon: 'none' }) }
      finally { this.creating = false }
    },
    async saveName() {
      if (!this.bookName.trim()) { uni.showToast({ title: '请输入案例册名称', icon: 'none' }); return }
      this.savingName = true
      try {
        const result = await V8.FormEngine.UptFormData('diy_anlice', { Id: this.bookId, AnliCMC: this.bookName.trim(), _InvokeType: 'Client' })
        if (!result || Number(result.Code) !== 1) throw new Error((result && result.Msg) || '名称保存失败')
        this.originalName = this.bookName.trim()
        uni.$emit('xjy-business-refresh', { key: 'casebooks' })
        uni.showToast({ title: '名称已保存', icon: 'success' })
      } catch (error) { uni.showToast({ title: error.message || '名称保存失败', icon: 'none' }) }
      finally { this.savingName = false }
    },
    openCasePicker() { this.casePickerVisible = true; this.selectedCaseIds = []; if (!this.sourceCases.length) this.searchCases() },
    closeCasePicker() { this.casePickerVisible = false },
    async searchCases() { this.casePage = 1; this.sourceCases = []; await this.loadCases() },
    async loadMoreCases() {
      if (this.caseLoading || this.sourceCases.length >= this.caseCount) return
      this.casePage += 1
      await this.loadCases()
    },
    async loadCases() {
      if (this.caseLoading) return
      this.caseLoading = true
      try {
        const result = await V8.FormEngine.GetTableData('Diy_Anli', {
          _Keyword: this.caseKeyword.trim(), _OrderBy: 'UpdateTime', _OrderByType: 'DESC', _PageIndex: this.casePage, _PageSize: 20
        })
        if (!result || Number(result.Code) !== 1) throw new Error((result && result.Msg) || '客户案例加载失败')
        const rows = Array.isArray(result.Data) ? result.Data : []
        this.sourceCases = this.casePage === 1 ? rows : this.sourceCases.concat(rows)
        this.caseCount = Number(result.DataCount || this.sourceCases.length)
      } catch (error) { uni.showToast({ title: error.message || '客户案例加载失败', icon: 'none' }) }
      finally { this.caseLoading = false }
    },
    isAdded(item) { return this.children.some((child) => String(child.KehuID || '') === String(item.KehuID || '') && String(child.Biaoti || '') === String(item.Biaoti || '')) },
    toggleCase(item) {
      if (this.isAdded(item)) return
      const index = this.selectedCaseIds.indexOf(item.Id)
      if (index >= 0) this.selectedCaseIds.splice(index, 1)
      else this.selectedCaseIds.push(item.Id)
    },
    async addSelectedCases() {
      if (!this.selectedCaseIds.length || this.addingCases) return
      this.addingCases = true
      try {
        const selected = this.sourceCases.filter((item) => this.selectedCaseIds.includes(item.Id))
        const rows = selected.map((item) => ({
          FormEngineKey: 'diy_anlice_child',
          _RowModel: {
            Biaoti: item.Biaoti || '', KehuMC: item.KehuMC || item.SuoshuKH || '', KehuID: item.KehuID || '', KehuALZP: item.Tupian || '',
            KehuGK: item.KehuGK || '', YinshuiXQ: item.YinshuiXQ || '', JiejueFA: item.JiejueFA || '', KehuPJ: item.KehuPJ || '', TuijianPY: item.TuijianPY || '',
            AnliCID: this.bookId, TenantId: this.currentUser.TenantId || '', TenantName: this.currentUser.TenantName || ''
          }
        }))
        const result = await V8.FormEngine.AddTableData(rows)
        if (!result || Number(result.Code) !== 1) throw new Error((result && result.Msg) || '案例添加失败')
        this.closeCasePicker()
        await this.loadChildren()
        uni.showToast({ title: `已添加 ${rows.length} 个案例`, icon: 'success' })
      } catch (error) { uni.showToast({ title: error.message || '案例添加失败', icon: 'none' }) }
      finally { this.addingCases = false }
    },
    editChild(item) {
      uni.navigateTo({ url: `/pages/native-form/index?table=diy_anlice_child&id=${encodeURIComponent(item.Id)}&mode=${this.canEdit ? 'Edit' : 'View'}&title=${encodeURIComponent('案例详情')}` })
    },
    removeChild(item) {
      uni.showModal({ title: '移出案例册', content: `确定移出“${item.Biaoti || item.KehuMC || '该案例'}”吗？`, success: async (modal) => {
        if (!modal.confirm) return
        try {
          const result = await V8.FormEngine.DelFormData({ FormEngineKey: 'diy_anlice_child', Id: item.Id })
          if (!result || Number(result.Code) !== 1) throw new Error((result && result.Msg) || '移出失败')
          await this.loadChildren()
          uni.showToast({ title: '已移出', icon: 'success' })
        } catch (error) { uni.showToast({ title: error.message || '移出失败', icon: 'none' }) }
      } })
    },
    previewPhotos(urls, index) { uni.previewImage({ current: urls[index], urls }) },
    formatDate(value) { return value ? String(value).replace('T', ' ').slice(0, 16) : '' },
    goBack() { uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/workspace/index' }) }) }
  }
}
</script>

<style scoped>
.casebook-page { height: 100vh; background: #f3f7f9; }.page-scroll { height: calc(100vh - 92rpx - var(--mci-safe-top)); }.page-content { padding: 18rpx 24rpx calc(36rpx + var(--mci-safe-bottom)); }
.book-panel { position: relative; display: flex; align-items: center; min-height: 160rpx; overflow: hidden; border: 1rpx solid #dfe9ed; border-radius: 8rpx; background: #fff; }.book-accent { align-self: stretch; width: 7rpx; background: #0c83bd; }.book-content { min-width: 0; flex: 1; padding: 24rpx; }.book-label { display: block; color: #708791; font-size: 21rpx; }.book-input, .book-title { display: block; height: 58rpx; margin-top: 4rpx; color: #183640; font-size: 31rpx; font-weight: 700; line-height: 58rpx; }.book-meta { display: flex; flex-wrap: wrap; margin-top: 4rpx; color: #84969d; font-size: 20rpx; }.book-meta text { margin-right: 18rpx; }.save-name-button { flex: none; height: 58rpx; margin: 0 22rpx 0 0; padding: 0 18rpx; border: 1rpx solid #b9d8e4; border-radius: 6rpx; background: #f2f9fb; color: #087bac; font-size: 21rpx; line-height: 58rpx; }.save-name-button::after { border: none; }
.section-heading { display: flex; align-items: center; justify-content: space-between; height: 96rpx; }.section-title { color: #34525e; font-size: 27rpx; font-weight: 700; }.section-count { margin-left: 10rpx; color: #81969e; font-size: 22rpx; }.add-case-button { height: 58rpx; margin: 0; padding: 0 17rpx; border: 1rpx solid #bedce6; border-radius: 6rpx; background: #fff; color: #087fbd; font-size: 22rpx; line-height: 58rpx; }.add-case-button::after { border: none; }
.case-list { display: flex; flex-direction: column; gap: 16rpx; }.case-card { padding: 22rpx 24rpx 16rpx; border: 1rpx solid #dfe9ed; border-radius: 8rpx; background: #fff; transition: background-color .16s ease; }.case-card--pressed { background: #f3f8fa; }.case-head { display: flex; align-items: center; justify-content: space-between; }.case-title { min-width: 0; overflow: hidden; color: #193844; font-size: 28rpx; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }.delete-button { flex: none; height: 48rpx; margin: 0 0 0 18rpx; padding: 0 10rpx; background: transparent; color: #c84d42; font-size: 20rpx; line-height: 48rpx; }.delete-button::after { border: none; }.customer-name { display: block; margin-top: 6rpx; color: #0c7fac; font-size: 22rpx; }
.case-lines { margin-top: 16rpx; padding: 12rpx 16rpx; border-radius: 6rpx; background: #f5f8f9; }.case-lines view { display: grid; grid-template-columns: 116rpx minmax(0, 1fr); padding: 5rpx 0; font-size: 21rpx; line-height: 31rpx; }.case-lines view text:first-child { color: #778d95; }.case-lines view text:last-child { overflow: hidden; color: #405c66; text-overflow: ellipsis; white-space: nowrap; }
.photo-row { position: relative; display: grid; grid-template-columns: repeat(3, 112rpx); gap: 10rpx; margin-top: 14rpx; }.photo-row image, .photo-more { width: 112rpx; height: 88rpx; border-radius: 6rpx; background: #e9eff1; }.photo-more { position: absolute; right: 0; display: flex; align-items: center; justify-content: center; background: rgba(24,54,64,.74); color: #fff; font-size: 23rpx; }.case-foot { display: flex; align-items: center; justify-content: space-between; margin-top: 14rpx; padding-top: 13rpx; border-top: 1rpx solid #edf2f4; color: #84979e; font-size: 20rpx; }.case-foot text:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.case-foot text:last-child { margin-left: 18rpx; color: #0b82ba; font-size: 30rpx; }
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 420rpx; }.empty-mark { display: flex; align-items: center; justify-content: center; width: 82rpx; height: 82rpx; border: 1rpx solid #c9dce3; border-radius: 50%; background: #fff; color: #5b8799; font-size: 30rpx; }.empty-title { margin-top: 18rpx; color: #84979e; font-size: 23rpx; }.bottom-space { height: 30rpx; }
.bottom-bar { position: fixed; right: 0; bottom: 0; left: 0; z-index: 20; padding: 16rpx 24rpx calc(16rpx + var(--mci-safe-bottom)); border-top: 1rpx solid #dde7eb; background: rgba(255,255,255,.97); }.primary-button { height: 82rpx; margin: 0; border-radius: 8rpx; background: #087fbd; color: #fff; font-size: 27rpx; font-weight: 650; line-height: 82rpx; }.primary-button::after { border: none; }
.picker-mask { position: fixed; inset: 0; z-index: 80; display: flex; align-items: flex-end; background: rgba(16,35,43,.42); }.picker-sheet { width: 100%; padding-bottom: var(--mci-safe-bottom); border-radius: 12rpx 12rpx 0 0; background: #fff; animation: sheet-up .2s ease-out; }.picker-handle { width: 74rpx; height: 7rpx; margin: 12rpx auto 4rpx; border-radius: 4rpx; background: #d7e1e5; }.picker-header { display: flex; align-items: center; justify-content: space-between; min-height: 76rpx; padding: 0 26rpx; color: #183640; font-size: 27rpx; font-weight: 700; }.picker-header > view { display: flex; align-items: baseline; }.selected-count { margin-left: 14rpx; color: #0781b7; font-size: 21rpx; font-weight: 500; }.close-button, .clear-button { margin: 0; padding: 0; border: none; background: transparent; color: #78909a; }.close-button::after, .clear-button::after { border: none; }.close-button { width: 58rpx; height: 58rpx; font-size: 38rpx; line-height: 58rpx; }
.search-box { display: grid; grid-template-columns: 36rpx minmax(0, 1fr) 42rpx; align-items: center; height: 72rpx; margin: 0 24rpx 12rpx; padding: 0 16rpx; border: 1rpx solid #dce7eb; border-radius: 8rpx; background: #f5f8f9; }.search-box input { height: 70rpx; color: #203c46; font-size: 24rpx; }.search-icon { color: #78919a; font-size: 29rpx; }.clear-button { width: 42rpx; height: 42rpx; font-size: 28rpx; line-height: 42rpx; }
.source-list { height: min(610rpx, 53vh); }.source-row { display: grid; grid-template-columns: 44rpx minmax(0, 1fr); align-items: center; width: auto; min-height: 94rpx; margin: 0 24rpx; padding: 12rpx 4rpx; border-bottom: 1rpx solid #edf2f4; border-radius: 0; background: #fff; text-align: left; }.source-row::after { border: none; }.source-row--selected { background: #f0f9fc; }.source-row--added { opacity: .58; }.source-check { display: flex; align-items: center; justify-content: center; width: 28rpx; height: 28rpx; border: 1rpx solid #afc3ca; border-radius: 4rpx; color: #087fbd; font-size: 20rpx; }.source-row--selected .source-check, .source-row--added .source-check { border-color: #48a9c9; background: #e5f5fa; }.source-main { display: flex; min-width: 0; flex-direction: column; }.source-main text:first-child { overflow: hidden; color: #1b3944; font-size: 25rpx; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }.source-main text:last-child { margin-top: 5rpx; color: #81949c; font-size: 20rpx; }.empty-list, .loading-more { padding: 50rpx 20rpx; color: #8ba0a8; font-size: 22rpx; text-align: center; }
.picker-submit { padding: 14rpx 24rpx 16rpx; border-top: 1rpx solid #e5edef; }.picker-submit button { height: 76rpx; border-radius: 8rpx; background: #087fbd; color: #fff; font-size: 25rpx; line-height: 76rpx; }.picker-submit button::after { border: none; }.picker-submit button[disabled] { background: #a2bdc8; color: #fff; }
@keyframes sheet-up { from { transform: translateY(36rpx); opacity: .5; } to { transform: translateY(0); opacity: 1; } }
</style>
