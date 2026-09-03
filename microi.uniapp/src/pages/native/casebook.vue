<template>
  <mci-page-shell class="casebook-page" :style="mciTokenStyle" :title="bookId ? '案例册详情' : '新增案例册'" subtitle="客户成功案例" @back="goBack">
    <mci-skeleton v-if="loading" type="list" :rows="6" />
    <scroll-view v-else class="page-scroll" scroll-y>
      <view class="page-content">
        <view class="book-panel">
          <view class="book-accent" />
          <view class="book-content">
            <text class="book-label">案例册名称</text>
            <input v-if="!bookId && canEdit" v-model="bookName" class="book-input" placeholder="请输入案例册名称" maxlength="50" />
            <text v-else class="book-title">{{ bookName || '未命名案例册' }}</text>
            <view v-if="bookId" class="book-meta"><text>{{ book.UserName || '集福鲤平台' }}</text><text>{{ book.TenantName || currentUser.TenantName || '' }}</text><text>{{ formatDate(book.UpdateTime || book.CreateTime) }}</text></view>
          </view>
        </view>

        <view v-if="bookId || canEdit" class="section-heading">
          <view><text class="section-title">{{ bookId ? '已收录案例' : '已选案例' }}</text><text class="section-count">{{ children.length }}</text></view>
          <button v-if="canEdit" class="add-case-button" @tap="openCasePicker"><text>＋</text> 添加案例</button>
        </view>
        <view v-if="bookId && casePhotoContextError" class="private-media-notice"><text>{{ casePhotoContextError }}</text></view>

        <view v-if="bookId && childLoading" class="case-list"><mci-skeleton type="list" :rows="4" /></view>
        <view v-else-if="children.length" class="case-list">
          <view v-for="item in children" :key="item.Id" class="case-card" :class="{ 'case-card--pending': item._pending }" hover-class="case-card--pressed" @tap="openChildDetail(item)">
            <view class="case-head"><text class="case-title">{{ item.Biaoti || item.KehuMC || '客户案例' }}</text><button v-if="canEdit" class="delete-button" @tap.stop="removeChild(item)">{{ item._pending ? '移除' : '删除' }}</button></view>
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
            <view class="case-foot"><text>{{ item._pending ? '保存案例册时一并添加' : canEditCase ? '编辑案例详情' : item.TuijianPY || '查看案例详情' }}</text><text>{{ item._pending ? '待保存' : '›' }}</text></view>
          </view>
        </view>
        <view v-else-if="bookId || canEdit" class="empty-state"><view class="empty-mark"><text>案</text></view><text class="empty-title">{{ bookId ? '尚未收录客户案例' : '尚未选择客户案例' }}</text></view>
        <view class="bottom-space" />
      </view>
    </scroll-view>

    <view v-if="!loading && !casePickerVisible && canEdit" class="bottom-bar" slot="fixed"><button class="primary-button" :loading="savingBook" :disabled="savingBook" @tap="saveBook">{{ bookActionLabel }}</button></view>

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
import { findMenu, openForm, requireLogin } from '@/platform/business-runtime.js'
import { loadNativeFormDefinition } from '@/platform/native-form.js'
import { canEditMenuRecord } from '@/platform/menu-permission.js'

const CASEBOOK_TABLE = 'diy_anlice'
const CASE_CHILD_TABLE = 'diy_anlice_child'
const CASE_PHOTO_FIELD = 'KehuALZP'
const EMPTY_PRIVATE_FILE_CONTEXT = Object.freeze({ private: true, failClosed: true })

function caseChildSnapshot(item, bookId, currentUser) {
  return {
    Biaoti: item.Biaoti || '',
    KehuMC: item.KehuMC || item.SuoshuKH || '',
    KehuID: item.KehuID || '',
    KehuALZP: item.KehuALZP || item.Tupian || '',
    KehuGK: item.KehuGK || item.Textarea419 || '',
    YinshuiXQ: item.YinshuiXQ || '',
    JiejueFA: item.JiejueFA || '',
    KehuPJ: item.KehuPJ || item.Textarea619 || '',
    TuijianPY: item.TuijianPY || '',
    Select178: item.Select178 || item.KehuLX || '',
    Select224: item.Select224 || item.ShebeiXH || '',
    Textarea419: item.Textarea419 || item.KehuGK || '',
    DateTime340: item.DateTime340 || item.HezuoSJ || '',
    Text727: item.Text727 || item.ShebeiSL || '',
    Textarea579: item.Textarea579 || item.HezuoNR || '',
    Textarea619: item.Textarea619 || item.KehuPJ || '',
    Textarea749: item.Textarea749 || item.ShujuZM || '',
    AnliCID: bookId,
    TenantId: currentUser.TenantId || '',
    TenantName: currentUser.TenantName || ''
  }
}

export default {
  mixins: [themeMixin],
  data() {
    return {
      loading: true, childLoading: false, creating: false, addingCases: false,
      bookId: '', book: {}, bookName: '', bookMenuId: '', currentUser: {}, children: [],
      casePhotoContext: EMPTY_PRIVATE_FILE_CONTEXT, casePhotoContextError: '',
      casePickerVisible: false, caseKeyword: '', caseLoading: false, sourceCases: [], casePage: 1, caseCount: 0, selectedCaseIds: [], searchTimer: null
    }
  },
  computed: {
    canEdit() {
      if (!this.bookId) return Boolean(this.currentUser.TenantId)
      return canEditMenuRecord(this.bookMenuId, this.currentUser)
    },
    canEditCase() { return canEditMenuRecord(this.casePhotoContext.sysMenuId, this.currentUser) },
    hasPendingChildren() { return this.children.some((item) => item._pending) },
    savingBook() { return this.creating || this.addingCases },
    bookActionLabel() {
      if (!this.bookId) return '✓ 保存案例册'
      return this.hasPendingChildren ? '✓ 保存已选案例' : '✎ 编辑案例册'
    }
  },
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
  async onShow() {
    if (this.loading || !this.bookId) return
    try {
      // 从原生编辑表单返回时回源，确保案例册名称与案例快照立即反映刚保存的内容。
      await Promise.all([this.loadBook(), this.loadChildren()])
    } catch (error) {
      uni.showToast({ title: error.message || '案例册刷新失败', icon: 'none' })
    }
  },
  onUnload() { clearTimeout(this.searchTimer) },
  methods: {
    async initialize() {
      try {
        if (this.bookId) {
          await Promise.all([this.loadBook(), this.prepareBookPermissionContext(), this.prepareCasePhotoContext()])
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
    },
    async prepareBookPermissionContext() {
      try {
        const menu = await findMenu(['案例册'], CASEBOOK_TABLE)
        this.bookMenuId = String(menu && menu.Id || '')
      } catch (error) {
        this.bookMenuId = ''
      }
    },
    async loadChildren() {
      this.childLoading = true
      try {
        const result = await V8.FormEngine.GetTableData('diy_anlice_child', {
          _Where: [{ Name: 'AnliCID', Type: '=', Value: this.bookId }], _OrderBy: 'CreateTime', _OrderByType: 'DESC', _PageIndex: 1, _PageSize: 500
        })
        const rows = result && Number(result.Code) === 1 && Array.isArray(result.Data) ? result.Data : []
        this.children = await Promise.all(rows.map(async (row) => {
          const paths = V8.normalizeUploadValue(row[CASE_PHOTO_FIELD])
          const context = this.casePhotoFileContext(row.Id)
          const photos = await Promise.all(paths.slice(0, 10).map((path) => V8.resolveFileUrl(path, context).catch(() => '')))
          return { ...row, _photos: photos.filter(Boolean) }
        }))
      } finally { this.childLoading = false }
    },
    async prepareCasePhotoContext() {
      this.casePhotoContext = EMPTY_PRIVATE_FILE_CONTEXT
      this.casePhotoContextError = ''
      try {
        const menu = await findMenu(['案例册', '客户案例'], CASE_CHILD_TABLE)
        if (!menu || !menu.Id) throw new Error('当前账号没有案例明细菜单权限')
        const definition = await loadNativeFormDefinition(CASE_CHILD_TABLE, false, { menuId: menu.Id })
        const field = (definition.fields || []).find((item) => String(item.Name || '').toLowerCase() === CASE_PHOTO_FIELD.toLowerCase())
        if (!field || !field.Id) throw new Error('案例照片字段元数据不完整')
        this.casePhotoContext = {
          formEngineKey: CASE_CHILD_TABLE,
          fieldId: field.Id,
          sysMenuId: menu.Id
        }
      } catch (error) {
        this.casePhotoContextError = (error && error.message) || '案例照片授权上下文不可用，私有图片已隐藏'
      }
    },
    casePhotoFileContext(formDataId) {
      if (!formDataId || !this.casePhotoContext.fieldId || !this.casePhotoContext.sysMenuId) return EMPTY_PRIVATE_FILE_CONTEXT
      return { ...this.casePhotoContext, formDataId }
    },
    emitBookChanged(action) {
      // 业务列表统一监听该事件；在返回列表页的 onShow 中再强制回源，避免沿用进入详情前的快照。
      uni.$emit('microi:data-changed', { table: 'diy_anlice', action, id: this.bookId })
    },
    saveBook() {
      if (!this.bookId) return this.createBook()
      return this.hasPendingChildren ? this.savePendingCases() : this.openBookEdit()
    },
    openBookEdit() {
      if (!this.canEdit) {
        uni.showToast({ title: '当前账号没有案例册编辑权限', icon: 'none' })
        return
      }
      return openForm({
        table: CASEBOOK_TABLE,
        rowId: this.bookId,
        mode: 'Edit',
        title: '编辑案例册',
        menuId: this.bookMenuId,
        menuAliases: ['案例册']
      })
    },
    async createBook() {
      if (!this.bookName.trim()) { uni.showToast({ title: '请输入案例册名称', icon: 'none' }); return }
      if (this.creating) return
      this.creating = true
      const pendingChildren = this.children.filter((item) => item._pending)
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
        if (!id) throw new Error('案例册已创建，但未能获取记录编号，请返回列表查看')

        this.bookId = String(id)
        // 新建页不会执行 initialize 中的详情初始化；必须同时补齐菜单权限和私有图片上下文。
        await Promise.all([this.loadBook(), this.prepareBookPermissionContext(), this.prepareCasePhotoContext()])
        this.emitBookChanged('Add')
        if (pendingChildren.length) {
          try {
            await this.persistCases(pendingChildren)
          } catch (error) {
            this.children = pendingChildren
            uni.showModal({
              title: '案例册已创建',
              content: `${(error && (error.Msg || error.message)) || '所选案例保存失败'}，请点击“保存已选案例”重试。`,
              showCancel: false
            })
            return
          }
        }
        await this.loadChildren()
        uni.showToast({ title: pendingChildren.length ? '案例册及案例已保存' : '案例册已创建', icon: 'success' })
      } catch (error) { uni.showToast({ title: error.message || '案例册保存失败', icon: 'none' }) }
      finally { this.creating = false }
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
        if (!this.bookId) {
          const staged = selected.map((item, index) => ({
            ...caseChildSnapshot(item, '', this.currentUser),
            Id: `pending:${item.Id || `${Date.now()}-${index}`}`,
            _sourceId: item.Id,
            _pending: true,
            _photos: []
          }))
          this.children = this.children.concat(staged.filter((item) => !this.isAdded(item)))
          this.closeCasePicker()
          uni.showToast({ title: `已选择 ${staged.length} 个案例`, icon: 'success' })
          return
        }

        await this.persistCases(selected)
        this.closeCasePicker()
        await this.loadChildren()
        uni.showToast({ title: `已添加 ${selected.length} 个案例`, icon: 'success' })
      } catch (error) { uni.showToast({ title: error.message || '案例添加失败', icon: 'none' }) }
      finally { this.addingCases = false }
    },
    async persistCases(items) {
      const rows = items.map((item) => ({
        FormEngineKey: CASE_CHILD_TABLE,
        _RowModel: caseChildSnapshot(item, this.bookId, this.currentUser)
      }))
      const result = await V8.FormEngine.AddTableData(rows)
      if (!result || Number(result.Code) !== 1) throw new Error((result && result.Msg) || '案例添加失败')
    },
    async savePendingCases() {
      const pending = this.children.filter((item) => item._pending)
      if (!this.bookId || !pending.length || this.addingCases) return
      this.addingCases = true
      try {
        await this.persistCases(pending)
        await this.loadChildren()
        uni.showToast({ title: `已添加 ${pending.length} 个案例`, icon: 'success' })
      } catch (error) {
        uni.showToast({ title: error.message || '案例添加失败', icon: 'none' })
      } finally {
        this.addingCases = false
      }
    },
    openChildDetail(item) {
      if (item._pending) {
        uni.showToast({ title: '保存案例册后可查看详情', icon: 'none' })
        return
      }
      const menuId = String(this.casePhotoContext.sysMenuId || '')
      const mode = this.canEditCase ? 'Edit' : 'View'
      const params = [
        `table=${encodeURIComponent(CASE_CHILD_TABLE)}`,
        `id=${encodeURIComponent(item.Id)}`,
        `mode=${encodeURIComponent(mode)}`,
        `title=${encodeURIComponent('案例详情')}`
      ]
      // 列表缩略图与详情图必须复用同一个已授权菜单。否则详情页虽能读取记录，
      // 私有文件解析仍会因缺少 SysMenuId 失败关闭并显示“图片暂不可用”。
      if (menuId) {
        params.push(`menuId=${encodeURIComponent(menuId)}`)
        params.push(`fileMenuId=${encodeURIComponent(menuId)}`)
      }
      uni.navigateTo({ url: `/pages/native-form/index?${params.join('&')}` })
    },
    removeChild(item) {
      if (item._pending) {
        this.children = this.children.filter((child) => child.Id !== item.Id)
        return
      }
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
.book-panel { position: relative; display: flex; align-items: center; min-height: 160rpx; overflow: hidden; border: 1rpx solid #dfe9ed; border-radius: 8rpx; background: #fff; }.book-accent { align-self: stretch; width: 7rpx; background: #0c83bd; }.book-content { min-width: 0; flex: 1; padding: 24rpx; }.book-label { display: block; color: #708791; font-size: 21rpx; }.book-input, .book-title { display: block; height: 58rpx; margin-top: 4rpx; color: #183640; font-size: 31rpx; font-weight: 700; line-height: 58rpx; }.book-meta { display: flex; flex-wrap: wrap; margin-top: 4rpx; color: #84969d; font-size: 20rpx; }.book-meta text { margin-right: 18rpx; }
.section-heading { display: flex; align-items: center; justify-content: space-between; height: 96rpx; }.section-title { color: #34525e; font-size: 27rpx; font-weight: 700; }.section-count { margin-left: 10rpx; color: #81969e; font-size: 22rpx; }.add-case-button { height: 58rpx; margin: 0; padding: 0 17rpx; border: 1rpx solid #bedce6; border-radius: 6rpx; background: #fff; color: #087fbd; font-size: 22rpx; line-height: 58rpx; }.add-case-button::after { border: none; }
.private-media-notice { margin-bottom: 16rpx; padding: 16rpx 18rpx; border: 1rpx solid #f0d9b5; border-radius: 6rpx; color: #8b6428; background: #fff9ec; font-size: 20rpx; line-height: 1.55; }
.case-list { display: flex; flex-direction: column; gap: 16rpx; }.case-card { padding: 22rpx 24rpx 16rpx; border: 1rpx solid #dfe9ed; border-radius: 8rpx; background: #fff; transition: background-color .16s ease; }.case-card--pressed { background: #f3f8fa; }.case-head { display: flex; align-items: center; justify-content: space-between; }.case-title { min-width: 0; overflow: hidden; color: #193844; font-size: 28rpx; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }.delete-button { flex: none; height: 48rpx; margin: 0 0 0 18rpx; padding: 0 10rpx; background: transparent; color: #c84d42; font-size: 20rpx; line-height: 48rpx; }.delete-button::after { border: none; }.customer-name { display: block; margin-top: 6rpx; color: #0c7fac; font-size: 22rpx; }
.case-lines { margin-top: 16rpx; padding: 12rpx 16rpx; border-radius: 6rpx; background: #f5f8f9; }.case-lines view { display: grid; grid-template-columns: 116rpx minmax(0, 1fr); padding: 5rpx 0; font-size: 21rpx; line-height: 31rpx; }.case-lines view text:first-child { color: #778d95; }.case-lines view text:last-child { overflow: hidden; color: #405c66; text-overflow: ellipsis; white-space: nowrap; }
.photo-row { position: relative; display: grid; grid-template-columns: repeat(3, 112rpx); gap: 10rpx; margin-top: 14rpx; }.photo-row image, .photo-more { width: 112rpx; height: 88rpx; border-radius: 6rpx; background: #e9eff1; }.photo-more { position: absolute; right: 0; display: flex; align-items: center; justify-content: center; background: rgba(24,54,64,.74); color: #fff; font-size: 23rpx; }.case-foot { display: flex; align-items: center; justify-content: space-between; margin-top: 14rpx; padding-top: 13rpx; border-top: 1rpx solid #edf2f4; color: #84979e; font-size: 20rpx; }.case-foot text:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.case-foot text:last-child { margin-left: 18rpx; color: #0b82ba; font-size: 30rpx; }
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 420rpx; }.empty-mark { display: flex; align-items: center; justify-content: center; width: 82rpx; height: 82rpx; border: 1rpx solid #c9dce3; border-radius: 50%; background: #fff; color: #5b8799; font-size: 30rpx; }.empty-title { margin-top: 18rpx; color: #84979e; font-size: 23rpx; }.bottom-space { height: 124rpx; }
.bottom-bar { position: fixed; right: 0; bottom: 0; left: 0; z-index: 20; padding: 16rpx 24rpx calc(16rpx + var(--mci-safe-bottom)); border-top: 1rpx solid #dde7eb; background: rgba(255,255,255,.97); }.primary-button { height: 82rpx; margin: 0; border-radius: 8rpx; background: #087fbd; color: #fff; font-size: 27rpx; font-weight: 650; line-height: 82rpx; }.primary-button::after { border: none; }
.picker-mask { position: fixed; inset: 0; z-index: 80; display: flex; align-items: flex-end; background: rgba(16,35,43,.42); }.picker-sheet { width: 100%; padding-bottom: var(--mci-safe-bottom); border-radius: 12rpx 12rpx 0 0; background: #fff; animation: sheet-up .2s ease-out; }.picker-handle { width: 74rpx; height: 7rpx; margin: 12rpx auto 4rpx; border-radius: 4rpx; background: #d7e1e5; }.picker-header { display: flex; align-items: center; justify-content: space-between; min-height: 76rpx; padding: 0 26rpx; color: #183640; font-size: 27rpx; font-weight: 700; }.picker-header > view { display: flex; align-items: baseline; }.selected-count { margin-left: 14rpx; color: #0781b7; font-size: 21rpx; font-weight: 500; }.close-button, .clear-button { margin: 0; padding: 0; border: none; background: transparent; color: #78909a; }.close-button::after, .clear-button::after { border: none; }.close-button { width: 58rpx; height: 58rpx; font-size: 38rpx; line-height: 58rpx; }
.search-box { display: grid; grid-template-columns: 36rpx minmax(0, 1fr) 42rpx; align-items: center; height: 72rpx; margin: 0 24rpx 12rpx; padding: 0 16rpx; border: 1rpx solid #dce7eb; border-radius: 8rpx; background: #f5f8f9; }.search-box input { height: 70rpx; color: #203c46; font-size: 24rpx; }.search-icon { color: #78919a; font-size: 29rpx; }.clear-button { width: 42rpx; height: 42rpx; font-size: 28rpx; line-height: 42rpx; }
.source-list { height: min(610rpx, 53vh); }.source-row { display: grid; grid-template-columns: 44rpx minmax(0, 1fr); align-items: center; width: auto; min-height: 94rpx; margin: 0 24rpx; padding: 12rpx 4rpx; border-bottom: 1rpx solid #edf2f4; border-radius: 0; background: #fff; text-align: left; }.source-row::after { border: none; }.source-row--selected { background: #f0f9fc; }.source-row--added { opacity: .58; }.source-check { display: flex; align-items: center; justify-content: center; width: 28rpx; height: 28rpx; border: 1rpx solid #afc3ca; border-radius: 4rpx; color: #087fbd; font-size: 20rpx; }.source-row--selected .source-check, .source-row--added .source-check { border-color: #48a9c9; background: #e5f5fa; }.source-main { display: flex; min-width: 0; flex-direction: column; }.source-main text:first-child { overflow: hidden; color: #1b3944; font-size: 25rpx; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }.source-main text:last-child { margin-top: 5rpx; color: #81949c; font-size: 20rpx; }.empty-list, .loading-more { padding: 50rpx 20rpx; color: #8ba0a8; font-size: 22rpx; text-align: center; }
.picker-submit { padding: 14rpx 24rpx 16rpx; border-top: 1rpx solid #e5edef; }.picker-submit button { height: 76rpx; border-radius: 8rpx; background: #087fbd; color: #fff; font-size: 25rpx; line-height: 76rpx; }.picker-submit button::after { border: none; }.picker-submit button[disabled] { background: #a2bdc8; color: #fff; }
@keyframes sheet-up { from { transform: translateY(36rpx); opacity: .5; } to { transform: translateY(0); opacity: 1; } }
</style>
