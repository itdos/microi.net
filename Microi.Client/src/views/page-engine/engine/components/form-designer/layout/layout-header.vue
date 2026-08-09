<template>
  <div class="layout-headerPanel">
    <div class="header-accent-bar"></div>
    <div class="header-body">
      <div class="header-section header-left">
        <el-icon class="lefticon" @click="pageEngineStore.changeLeft">
          <component
            :is="formData.JsonObj.formConfig.left == true ? Fold : Expand"
          ></component>
        </el-icon>
        <div class="header-brand">
          <span class="brand-text">{{ title }}</span>
          <el-icon class="brand-icon" :size="15"><MagicStick /></el-icon>
        </div>
      </div>
      <div class="header-section header-center">
        <div class="toolbar-group">
          <el-tooltip content="页面数据可视化" placement="bottom">
            <el-button size="small" text :icon="Tickets" @click="showJsonClick">JSON</el-button>
          </el-tooltip>
          <el-tooltip content="撤销（Ctrl/Cmd + Z）" placement="bottom">
            <el-button size="small" text :icon="RefreshLeft" :disabled="!canUndo" aria-label="撤销" @click="undoDesign" />
          </el-tooltip>
          <el-tooltip content="重做（Ctrl/Cmd + Shift + Z / Ctrl + Y）" placement="bottom">
            <el-button size="small" text :icon="RefreshRight" :disabled="!canRedo" aria-label="重做" @click="redoDesign" />
          </el-tooltip>
          <el-dropdown trigger="click" @command="versionCommand" :teleported="true">
            <el-button size="small" text :icon="Clock">
              版本<el-icon class="el-icon--right"><ArrowDown /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="history"><el-icon><Clock /></el-icon>历史与差异</el-dropdown-item>
                <el-dropdown-item command="assets"><el-icon><Collection /></el-icon>区块与模板资产</el-dropdown-item>
                <el-dropdown-item command="source"><el-icon><DocumentCopy /></el-icon>Vue 源码桥接</el-dropdown-item>
                <el-dropdown-item command="export"><el-icon><Download /></el-icon>导出设计</el-dropdown-item>
                <el-dropdown-item command="import"><el-icon><Upload /></el-icon>导入设计</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <el-tooltip content="清空所有容器和组件" placement="bottom">
            <el-button size="small" text :icon="Delete" @click="clearClick">清空</el-button>
          </el-tooltip>
          <el-dropdown trigger="click" @command="mockClick" :teleported="true">
            <el-button size="small" text :loading="btnLoading" :icon="Star">
              模板<el-icon class="el-icon--right"><ArrowDown /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item :command="0"><el-icon><Star /></el-icon>模板 1</el-dropdown-item>
                <el-dropdown-item :command="1"><el-icon><Star /></el-icon>模板 2</el-dropdown-item>
                <el-dropdown-item :command="2"><el-icon><Star /></el-icon>模板 3</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
        <el-divider direction="vertical" class="header-divider" />
        <el-button type="success" size="small" plain :icon="View" @click="previewClick" round>预览</el-button>
        <el-button type="primary" size="small" :loading="btnLoading" @click="saveClick" :icon="Collection" round>保存</el-button>
      </div>
      <div class="header-section header-right">
        <el-tooltip content="切换主题模式" placement="bottom">
          <el-switch
            @change="darkChange"
            v-model="isDark"
            class="theme-switch"
            :active-action-icon="Moon"
            :inactive-action-icon="Sunny"
          />
        </el-tooltip>
        <el-tooltip content="初始化页面配置" placement="bottom">
          <el-button size="small" type="info" text :icon="Setting" @click="setIni" circle />
        </el-tooltip>
      </div>
    </div>
  </div>
  <el-drawer title="页面JSON" v-model="jsonDrawer" direction="ltr">
    <el-form>
      <el-form-item label="">
        <JsonEditor
          v-if="jsonDrawer"
          height="680px"
          v-model="curPageJson"
          :option="jsonEditorOption"
        />
      </el-form-item>
    </el-form>
  </el-drawer>

  <el-dialog
    @closed="closeDialog"
    top="5vh"
    title="预览页面"
    width="90%"
    v-model="dialogFormVisible"
    draggable
    align-center
  >
    <form-renderer
      :isPrivew="dialogFormVisible"
      v-if="dialogFormVisible"
    ></form-renderer>
  </el-dialog>

  <el-dialog
    v-model="historyDialogVisible"
    title="界面版本历史"
    width="920px"
    destroy-on-close
  >
    <div class="version-summary">
      <span>当前内容哈希</span>
      <code>{{ shortHash(currentHash) || '尚未读取' }}</code>
      <el-tag v-if="pageEngineStore.historyAvailable" type="success" effect="plain">历史治理已启用</el-tag>
      <el-tag v-else type="info" effect="plain">历史治理未安装</el-tag>
    </div>
    <el-table
      v-loading="historyLoading"
      :data="historyItems"
      row-key="Id"
      max-height="500"
      empty-text="暂无历史版本"
    >
      <el-table-column prop="VersionNo" label="版本" width="170" />
      <el-table-column prop="ChangeSummary" label="变更摘要" min-width="220" show-overflow-tooltip />
      <el-table-column prop="UserName" label="操作人" width="120" />
      <el-table-column prop="CreateTime" label="时间" width="180" />
      <el-table-column label="内容哈希" width="130">
        <template #default="scope"><code>{{ shortHash(scope.row.ContentHash) }}</code></template>
      </el-table-column>
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="scope">
          <el-button link type="primary" @click="compareHistory(scope.row)">比较</el-button>
          <el-button link type="warning" @click="rollbackHistory(scope.row)">回滚</el-button>
        </template>
      </el-table-column>
    </el-table>
    <template #footer>
      <el-button @click="historyDialogVisible = false">关闭</el-button>
      <el-button type="primary" :loading="historyLoading" @click="loadHistory">刷新</el-button>
    </template>
  </el-dialog>

  <el-dialog
    v-model="diffDialogVisible"
    title="界面版本语义差异"
    width="900px"
    destroy-on-close
  >
    <div class="diff-metrics" v-if="diffResult">
      <el-tag type="success">新增 {{ diffResult.Added || 0 }}</el-tag>
      <el-tag type="danger">删除 {{ diffResult.Removed || 0 }}</el-tag>
      <el-tag type="warning">修改 {{ diffResult.Changed || 0 }}</el-tag>
      <el-tag v-if="diffResult.Equal" type="info">内容一致</el-tag>
      <el-tag v-if="diffResult.Truncated" type="warning">结果已截断</el-tag>
    </div>
    <el-table :data="diffResult?.Changes || []" max-height="520" empty-text="两个版本内容一致">
      <el-table-column prop="Type" label="类型" width="90" />
      <el-table-column prop="Path" label="路径" min-width="230" show-overflow-tooltip />
      <el-table-column label="变更前" min-width="210" show-overflow-tooltip>
        <template #default="scope">{{ diffValue(scope.row.Before) }}</template>
      </el-table-column>
      <el-table-column label="变更后" min-width="210" show-overflow-tooltip>
        <template #default="scope">{{ diffValue(scope.row.After) }}</template>
      </el-table-column>
    </el-table>
  </el-dialog>

  <el-dialog
    v-model="sourceDialogVisible"
    title="可视设计 ↔ Vue 源码桥接"
    width="min(1100px, 94vw)"
    destroy-on-close
  >
    <div class="source-bridge-note">
      <el-icon><Lock /></el-icon>
      <div>
        <strong>受控、可审阅、可无损回导</strong>
        <span>只解析标记区内的页面 JSON，不执行 Vue 文件中的 script；任意 Vue 项目不能伪装成设计器结构。</span>
      </div>
      <el-tag v-if="sourceMeta.sourceChanged" type="warning" effect="plain">源码已编辑</el-tag>
      <el-tag v-else type="success" effect="plain">来源摘要一致</el-tag>
    </div>
    <el-input
      v-model="sourceText"
      class="source-bridge-editor"
      type="textarea"
      :rows="26"
      resize="vertical"
      spellcheck="false"
    />
    <div class="source-bridge-meta">
      <span>Schema v{{ sourceMeta.schemaVersion || 1 }}</span>
      <code>{{ shortHash(sourceMeta.currentHash || sourceMeta.declaredHash) || '尚未校验' }}</code>
      <span>{{ sourceText.length.toLocaleString() }} 字符</span>
    </div>
    <template #footer>
      <el-button @click="chooseSourceFile"><el-icon><Upload /></el-icon>读取 .vue</el-button>
      <el-button @click="downloadSource"><el-icon><Download /></el-icon>下载源码</el-button>
      <el-button @click="sourceDialogVisible = false">关闭</el-button>
      <el-button type="primary" :loading="sourceBusy" @click="applySourceToCanvas">导入到画布</el-button>
    </template>
  </el-dialog>

  <el-dialog
    v-model="assetDialogVisible"
    title="区块、组件与页面模板资产"
    width="min(1080px, 94vw)"
    destroy-on-close
  >
    <div class="asset-library-toolbar">
      <el-select v-model="assetTypeFilter" placeholder="全部类型" clearable>
        <el-option label="区块" value="Block" />
        <el-option label="组件" value="Component" />
        <el-option label="页面模板" value="PageTemplate" />
        <el-option label="主题" value="Theme" />
        <el-option label="数据适配器" value="DataAdapter" />
      </el-select>
      <el-input v-model.trim="assetKeyword" clearable placeholder="搜索名称、Key、标签或负责人" />
      <el-button :loading="assetLoading" @click="loadAssetLibrary">刷新</el-button>
    </div>
    <el-alert
      title="资产使用已发布的不可变版本；依赖、内容哈希和兼容范围由接口引擎重新校验。"
      type="info"
      :closable="false"
      show-icon
    />
    <div v-loading="assetLoading" class="asset-library-grid">
      <article v-for="item in filteredAssets" :key="item.Id" class="asset-library-card">
        <header><span>{{ assetTypeLabel(item.AssetType) }}</span><el-tag size="small" effect="plain">{{ item.Scope || 'Tenant' }}</el-tag></header>
        <strong>{{ item.Name }}</strong>
        <code>{{ item.PackageKey }}</code>
        <p>{{ item.Description || '暂无说明' }}</p>
        <footer><small>{{ item.Owner || '未指定负责人' }}</small><el-button link type="primary" :loading="assetApplyingKey === item.PackageKey" @click="applyAsset(item)">应用到画布</el-button></footer>
      </article>
      <el-empty v-if="!assetLoading && !filteredAssets.length" description="暂无匹配的已发布资产" />
    </div>
    <template #footer><el-button @click="assetDialogVisible = false">关闭</el-button></template>
  </el-dialog>

  <input
    ref="importFileInput"
    class="page-import-input"
    type="file"
    accept="application/json,.json,.microi-page.json"
    @change="handleImportFile"
  />
  <input
    ref="sourceFileInput"
    class="page-import-input"
    type="file"
    accept="text/plain,text/x-vue,.vue,.microi-page.vue"
    @change="handleSourceFile"
  />
</template>

<script setup name="layout-header">
import { nextTick, ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { storeToRefs } from 'pinia'
import { EventBus } from '../../../utils/eventBus.js'
import { usePageEngineStore } from '../../../stores/pageEngine'
import { ElMessageBox, ElNotification, ElLoading } from 'element-plus'
import PageVersionApi from '../../../../version-api.js'
import PageSourceBridge from '../../../../source-bridge.js'
import formRenderer from '../../form-renderer/index.vue'
import { deepClone, generateId } from '../../../utils/util.js'
import {
  Moon,
  Sunny,
  Fold,
  Expand,
  InfoFilled,
  QuestionFilled,
  FullScreen,
  View,
  Collection,
  Tickets,
  ScaleToOriginal,
  Delete,
  Setting,
  Star,
  Lock,
  Unlock,
  ArrowDown,
  Clock,
  Download,
  Upload,
  DocumentCopy,
  RefreshLeft,
  RefreshRight,
} from '@element-plus/icons-vue'
import JsonEditor from 'ceel-json-editor'
import 'jsoneditor/dist/jsoneditor.css'

// 动态导入新文件
const importTempData = async (index) => {
  switch (index) {
    case 0:
      return (await import('../../../mocks/temp0')).temp0
    case 1:
      return (await import('../../../mocks/temp1')).temp1
    case 2:
      return (await import('../../../mocks/temp2')).temp2
    default:
      return null
  }
}

const pageEngineStore = usePageEngineStore()
const { formData } = storeToRefs(pageEngineStore)
const btnLoading = ref(false)
const historyDialogVisible = ref(false)
const diffDialogVisible = ref(false)
const historyLoading = ref(false)
const historyItems = ref([])
const diffResult = ref(null)
const importFileInput = ref(null)
const sourceFileInput = ref(null)
const sourceDialogVisible = ref(false)
const sourceBusy = ref(false)
const sourceText = ref('')
const sourceFileName = ref('page.microi-page.vue')
const sourceMeta = ref({ schemaVersion: 1, currentHash: '', declaredHash: '', sourceChanged: false })
const assetDialogVisible = ref(false)
const assetLoading = ref(false)
const assetItems = ref([])
const assetTypeFilter = ref('')
const assetKeyword = ref('')
const assetApplyingKey = ref('')
const currentHash = computed(() => pageEngineStore.currentHash || '')
const canUndo = computed(() => pageEngineStore.undoStack.length > 0)
const canRedo = computed(() => pageEngineStore.redoStack.length > 0)
const filteredAssets = computed(() => {
  const keyword = assetKeyword.value.toLowerCase()
  return assetItems.value.filter((item) => {
    if (assetTypeFilter.value && item.AssetType !== assetTypeFilter.value) return false
    if (!keyword) return true
    return [item.Name, item.PackageKey, item.Owner, item.TagsJson, item.Description]
      .join(' ').toLowerCase().includes(keyword)
  })
})
let historyTimer = null
const scheduleHistoryCapture = () => {
  if (pageEngineStore.historyApplying) return
  if (historyTimer) window.clearTimeout(historyTimer)
  historyTimer = window.setTimeout(() => {
    historyTimer = null
    pageEngineStore.captureDesignHistory()
  }, 280)
}
watch(() => formData.value?.JsonObj, scheduleHistoryCapture, { deep: true, immediate: true })
const finishHistoryApply = () => nextTick(() => pageEngineStore.finishDesignHistoryApply())
const undoDesign = () => {
  if (historyTimer) { window.clearTimeout(historyTimer); historyTimer = null }
  if (pageEngineStore.undoDesign()) finishHistoryApply()
}
const redoDesign = () => {
  if (historyTimer) { window.clearTimeout(historyTimer); historyTimer = null }
  if (pageEngineStore.redoDesign()) finishHistoryApply()
}
const handleHistoryShortcut = (event) => {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return
  const target = event.target
  if (target?.closest?.('input,textarea,[contenteditable="true"],.ace_editor,.monaco-editor,.jsoneditor')) return
  const key = String(event.key || '').toLowerCase()
  if (key === 'z' && event.shiftKey) { event.preventDefault(); redoDesign(); return }
  if (key === 'z') { event.preventDefault(); undoDesign(); return }
  if (key === 'y' && !event.metaKey) { event.preventDefault(); redoDesign() }
}
onMounted(() => window.addEventListener('keydown', handleHistoryShortcut))
onBeforeUnmount(() => {
  if (historyTimer) window.clearTimeout(historyTimer)
  window.removeEventListener('keydown', handleHistoryShortcut)
})

//页面标题
const title = ref('界面引擎')

// 页面配置里的暗黑开关只属于当前设计数据，不再改写后台全局 html.dark。
const isDark = ref(pageEngineStore.dark == 'true' || pageEngineStore.dark == true)

//json在线编辑器
const jsonEditorOption = {
  mode: 'code',
  onChange: (v) => {
    // console.log(v)
  },
}

//切换主题
const darkChange = () => {
  pageEngineStore.setDark(isDark.value)
}

//预览
const dialogFormVisible = ref(false)
const previewClick = () => {
  dialogFormVisible.value = true
}

//关闭预览时恢复设置
const closeDialog = () => {
  formData.value.JsonObj.formConfig.mask = true
  formData.value.JsonObj.formConfig.drag = true
  formData.value.JsonObj.formConfig.hover = true
  formData.value.JsonObj.formConfig.link = false
  dialogFormVisible.value = false
}

//保存事件

const saveClick = async () => {
  if (btnLoading.value) return
  btnLoading.value = true
  try {
    const plainData = JSON.parse(JSON.stringify(formData.value || {}))
    const result = await PageVersionApi.save({
      PageId: plainData.Id,
      Title: plainData.Title || plainData.Name || '未命名界面',
      Number: plainData.Number,
      Desc: plainData.Desc,
      RoutePath: plainData.RoutePath,
      ComponentPath: plainData.ComponentPath,
      JsonStr: JSON.stringify(plainData.JsonObj || {}),
      ExpectedCurrentHash: currentHash.value || undefined,
      ChangeSummary: '界面设计器保存',
    })
    if (!result || result.Code !== 1) {
      const conflict = result?.Data?.Conflict === true
      throw new Error(result?.Msg || (conflict ? '界面已被其他用户修改，请刷新后重试' : '保存界面失败'))
    }
    pageEngineStore.setVersionState(
      result.Data?.CurrentHash || currentHash.value,
      result.Data?.HistoryAvailable
    )
    ElNotification({
      type: 'success',
      title: '保存成功',
      message: result.Msg || result.Data?.Message || '界面配置已持久化',
      duration: 1800,
    })
    EventBus.emit('saveFormJson', { ...plainData, __persisted: true })
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(
        { key: 'saveFormJson', value: JSON.stringify(plainData), persisted: true },
        window.location.origin
      )
    }
    localStorage.removeItem('page_formData')
  } catch (error) {
    ElNotification({
      type: 'error',
      title: '保存失败',
      message: error?.message || '界面保存失败，请稍后重试',
      duration: 3500,
    })
  } finally {
    btnLoading.value = false
  }
}

const shortHash = (value) => {
  const text = String(value || '')
  return text.length > 16 ? `${text.slice(0, 8)}…${text.slice(-6)}` : text
}

const diffValue = (value) => {
  if (value === undefined || value === null) return '—'
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  return text.length > 180 ? `${text.slice(0, 180)}…` : text
}

const loadHistory = async () => {
  if (!formData.value?.Id) return
  historyLoading.value = true
  try {
    const result = await PageVersionApi.listHistory(formData.value.Id, 1, 100)
    if (!result || result.Code !== 1) throw new Error(result?.Msg || '读取界面历史失败')
    historyItems.value = result.Data?.Items || []
    pageEngineStore.setVersionState(result.Data?.CurrentHash || currentHash.value, true)
  } catch (error) {
    historyItems.value = []
    ElNotification({
      type: 'warning',
      title: '版本历史不可用',
      message: error?.message || '请先安装或更新 AI 平台治理中心应用',
      duration: 3500,
    })
  } finally {
    historyLoading.value = false
  }
}

const openHistory = async () => {
  historyDialogVisible.value = true
  await loadHistory()
}

const compareHistory = async (row) => {
  historyLoading.value = true
  try {
    const result = await PageVersionApi.compare(formData.value.Id, row.Id)
    if (!result || result.Code !== 1) throw new Error(result?.Msg || '比较界面版本失败')
    diffResult.value = result.Data || {}
    diffDialogVisible.value = true
  } catch (error) {
    ElNotification({ type: 'error', title: '比较失败', message: error?.message || '无法比较版本' })
  } finally {
    historyLoading.value = false
  }
}

const applyServerPage = (page) => {
  if (!page) return
  let jsonObj = page.JsonObj || {}
  if (typeof jsonObj === 'string') jsonObj = JSON.parse(jsonObj || '{}')
  pageEngineStore.updateFormData({
    ...formData.value,
    Id: page.Id || formData.value.Id,
    Title: page.Title || '',
    Number: page.Number || '',
    Desc: page.Desc || '',
    RoutePath: page.RoutePath || '',
    ComponentPath: page.ComponentPath || '',
    JsonObj: jsonObj,
  })
  pageEngineStore.setVersionState(page.CurrentHash, page.HistoryAvailable)
}

const rollbackHistory = async (row) => {
  if (!currentHash.value) {
    ElNotification({ type: 'warning', title: '无法回滚', message: '尚未读取当前内容哈希，请刷新历史后重试' })
    return
  }
  try {
    await ElMessageBox.confirm(
      `确定回滚到版本 ${row.VersionNo || row.Id}？当前内容不会被删除，而会生成一条新的审计版本。`,
      '回滚界面版本',
      { confirmButtonText: '确认回滚', cancelButtonText: '取消', type: 'warning' }
    )
    historyLoading.value = true
    const result = await PageVersionApi.rollback(
      formData.value.Id,
      row.Id,
      currentHash.value,
      `设计器回滚到版本 ${row.VersionNo || row.Id}`
    )
    if (!result || result.Code !== 1) throw new Error(result?.Msg || '回滚界面失败')
    const detail = await PageVersionApi.detail(formData.value.Id)
    if (!detail || detail.Code !== 1) throw new Error(detail?.Msg || '回滚成功但重新读取界面失败')
    applyServerPage(detail.Data)
    await loadHistory()
    ElNotification({ type: 'success', title: '回滚成功', message: result.Msg || '界面已恢复并生成新的审计版本' })
  } catch (error) {
    if (error === 'cancel' || error === 'close') return
    ElNotification({ type: 'error', title: '回滚失败', message: error?.message || '无法回滚界面版本' })
  } finally {
    historyLoading.value = false
  }
}

const exportDesign = async () => {
  try {
    const result = await PageVersionApi.export(formData.value?.Id)
    if (!result || result.Code !== 1) throw new Error(result?.Msg || '导出界面失败')
    const data = result.Data || {}
    const blob = new Blob([JSON.stringify(data.Snapshot || {}, null, 2)], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = data.FileName || 'page.microi-page.json'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  } catch (error) {
    ElNotification({ type: 'error', title: '导出失败', message: error?.message || '无法导出界面设计' })
  }
}

const importDesign = () => {
  if (importFileInput.value) {
    importFileInput.value.value = ''
    importFileInput.value.click()
  }
}

const downloadText = (text, fileName, contentType) => {
  const blob = new Blob([text], { type: contentType || 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

const openSourceBridge = async () => {
  sourceBusy.value = true
  try {
    const result = await PageSourceBridge.build(JSON.parse(JSON.stringify(formData.value || {})))
    sourceText.value = result.source
    sourceFileName.value = result.fileName
    sourceMeta.value = {
      schemaVersion: result.schemaVersion,
      currentHash: result.hash,
      declaredHash: result.hash,
      sourceChanged: false,
    }
    sourceDialogVisible.value = true
  } catch (error) {
    ElNotification({ type: 'error', title: '源码生成失败', message: error?.message || '无法生成界面 Vue 源码' })
  } finally {
    sourceBusy.value = false
  }
}

const chooseSourceFile = () => {
  if (!sourceFileInput.value) return
  sourceFileInput.value.value = ''
  sourceFileInput.value.click()
}

const handleSourceFile = async (event) => {
  const file = event?.target?.files?.[0]
  if (!file) return
  try {
    if (file.size > 8 * 1024 * 1024) throw new Error('界面 Vue 源码不能超过 8MB')
    const text = await file.text()
    const parsed = await PageSourceBridge.parse(text)
    sourceText.value = text
    sourceFileName.value = file.name || 'page.microi-page.vue'
    sourceMeta.value = parsed
    sourceDialogVisible.value = true
  } catch (error) {
    ElNotification({ type: 'error', title: '源码读取失败', message: error?.message || '界面 Vue 源码无效' })
  }
}

const downloadSource = async () => {
  try {
    if (!sourceText.value) await openSourceBridge()
    downloadText(sourceText.value, sourceFileName.value || 'page.microi-page.vue', 'text/x-vue;charset=utf-8')
  } catch (error) {
    ElNotification({ type: 'error', title: '源码下载失败', message: error?.message || '无法下载界面 Vue 源码' })
  }
}

const normalizeImportedPage = (source) => {
  const root = source?.Snapshot || source || {}
  const page = root.Page || root
  let jsonObj = page.JsonObj ?? page.jsonObj ?? root.JsonObj
  if (typeof jsonObj === 'string') jsonObj = JSON.parse(jsonObj || '{}')
  if (!jsonObj || typeof jsonObj !== 'object' || Array.isArray(jsonObj)) {
    throw new Error('导入文件缺少有效的 Page.JsonObj 对象')
  }
  if (!jsonObj.formConfig || typeof jsonObj.formConfig !== 'object' || Array.isArray(jsonObj.formConfig)) {
    jsonObj.formConfig = {}
  }
  if (!Array.isArray(jsonObj.wrapperList)) jsonObj.wrapperList = []
  return {
    Title: page.Title,
    Number: page.Number,
    Desc: page.Desc,
    RoutePath: page.RoutePath,
    ComponentPath: page.ComponentPath,
    JsonObj: JSON.parse(JSON.stringify(jsonObj)),
  }
}

const applyImportedPage = (imported) => {
  pageEngineStore.updateFormData({
    ...formData.value,
    Title: imported.Title || formData.value.Title,
    Number: imported.Number || formData.value.Number,
    Desc: imported.Desc ?? formData.value.Desc,
    RoutePath: imported.RoutePath ?? formData.value.RoutePath,
    ComponentPath: imported.ComponentPath ?? formData.value.ComponentPath,
    JsonObj: imported.JsonObj,
  })
}

const applySourceToCanvas = async () => {
  sourceBusy.value = true
  try {
    const parsed = await PageSourceBridge.parse(sourceText.value)
    const imported = normalizeImportedPage(parsed.page)
    const warning = parsed.sourceChanged
      ? '源码标记区已被编辑。确认用编辑后的页面结构替换当前画布？只有点击“保存”后才会写入服务器。'
      : '确认用该 Vue 源码中的页面结构替换当前画布？只有点击“保存”后才会写入服务器。'
    await ElMessageBox.confirm(warning, '导入界面 Vue 源码', {
      confirmButtonText: '导入到画布', cancelButtonText: '取消', type: parsed.sourceChanged ? 'warning' : 'info'
    })
    applyImportedPage(imported)
    sourceMeta.value = parsed
    sourceDialogVisible.value = false
    ElNotification({ type: 'success', title: '源码已导入', message: '页面结构已载入画布，请预览并点击保存' })
  } catch (error) {
    if (error === 'cancel' || error === 'close') return
    ElNotification({ type: 'error', title: '源码导入失败', message: error?.message || '界面 Vue 源码无效' })
  } finally {
    sourceBusy.value = false
  }
}

const assetTypeLabel = (value) => ({
  Block: '区块',
  Component: '组件',
  PageTemplate: '页面模板',
  Theme: '主题',
  DataAdapter: '数据适配器',
}[value] || value || '资产')

const loadAssetLibrary = async () => {
  assetLoading.value = true
  try {
    const result = await PageVersionApi.listPublishedAssets()
    if (!result || result.Code !== 1) throw new Error(result?.Msg || '读取资产库失败')
    assetItems.value = Array.isArray(result.Data) ? result.Data : (result.Data?.List || [])
  } catch (error) {
    assetItems.value = []
    ElNotification({
      type: 'warning',
      title: '资产库不可用',
      message: error?.message || '请先安装或更新 AI 平台治理中心应用',
      duration: 3500,
    })
  } finally {
    assetLoading.value = false
  }
}

const openAssetLibrary = async () => {
  assetDialogVisible.value = true
  await loadAssetLibrary()
}

const rekeyAssetTree = (source, inheritedWrapperNumber) => {
  const value = deepClone(source)
  const visit = (node, wrapperNumber) => {
    if (!node || typeof node !== 'object') return
    let nextWrapperNumber = wrapperNumber
    if (node.wrapperOption && typeof node.wrapperOption === 'object') {
      nextWrapperNumber = generateId()
      node.wrapperOption.number = nextWrapperNumber
    }
    if (node.widgetOption && typeof node.widgetOption === 'object') {
      node.widgetOption.number = generateId()
      if (nextWrapperNumber) node.widgetOption.wrapperNumber = nextWrapperNumber
    }
    if (Array.isArray(node)) {
      node.forEach((item) => visit(item, nextWrapperNumber))
      return
    }
    Object.keys(node).forEach((key) => visit(node[key], nextWrapperNumber))
  }
  visit(value, inheritedWrapperNumber)
  return value
}

const applyAsset = async (item) => {
  assetApplyingKey.value = item.PackageKey
  try {
    const result = await PageVersionApi.resolveAsset(item.PackageKey)
    if (!result || result.Code !== 1 || !result.Data) throw new Error(result?.Msg || '资产解析失败')
    const asset = result.Data
    const content = asset.Content || {}
    const type = asset.Package?.AssetType || item.AssetType
    if (type === 'PageTemplate') {
      const jsonObj = content.Page?.JsonObj || content.JsonObj || content
      const imported = normalizeImportedPage({ JsonObj: jsonObj })
      await ElMessageBox.confirm('页面模板会替换当前画布。只有点击“保存”后才写入服务器，是否继续？', '应用页面模板', {
        confirmButtonText: '替换画布', cancelButtonText: '取消', type: 'warning'
      })
      pageEngineStore.updateFormData({ ...formData.value, JsonObj: imported.JsonObj })
    } else if (type === 'Block') {
      const wrappers = content.Wrappers || (content.Wrapper ? [content.Wrapper] : [])
      if (!Array.isArray(wrappers) || !wrappers.length) throw new Error('区块资产缺少 Wrapper 或 Wrappers')
      wrappers.forEach((wrapper) => pageEngineStore.addWrapper(rekeyAssetTree(wrapper)))
    } else if (type === 'Component') {
      const widget = content.Widget || content
      if (!widget?.widgetOption) throw new Error('组件资产缺少 Widget')
      if (pageEngineStore.curWrapperIdx < 0) throw new Error('请先在画布中选择一个容器')
      const wrapper = formData.value.JsonObj.wrapperList[pageEngineStore.curWrapperIdx]
      const wrapperNumber = wrapper?.wrapperOption?.number
      pageEngineStore.addWidget(pageEngineStore.curWrapperIdx, rekeyAssetTree(widget, wrapperNumber))
    } else if (type === 'Theme') {
      const theme = content.FormConfig || content.Theme || content
      if (!theme || typeof theme !== 'object' || Array.isArray(theme)) throw new Error('主题资产内容无效')
      Object.assign(formData.value.JsonObj.formConfig, deepClone(theme))
    } else {
      throw new Error('数据适配器资产请在组件的数据绑定面板中引用，不能直接放入画布')
    }
    assetDialogVisible.value = false
    ElNotification({
      type: 'success',
      title: '资产已应用',
      message: `${asset.Package?.Name || item.Name} ${asset.Version?.VersionNo || ''} 已载入画布，请预览后保存`,
    })
  } catch (error) {
    if (error === 'cancel' || error === 'close') return
    ElNotification({ type: 'error', title: '应用资产失败', message: error?.message || '无法应用该资产' })
  } finally {
    assetApplyingKey.value = ''
  }
}

const handleImportFile = async (event) => {
  const file = event?.target?.files?.[0]
  if (!file) return
  try {
    if (file.size > 5 * 1024 * 1024) throw new Error('界面设计文件不能超过 5MB')
    const imported = normalizeImportedPage(JSON.parse(await file.text()))
    await ElMessageBox.confirm('导入会替换当前画布，但只有点击“保存”后才会写入服务器。是否继续？', '导入界面设计', {
      confirmButtonText: '导入到画布', cancelButtonText: '取消', type: 'warning'
    })
    applyImportedPage(imported)
    ElNotification({ type: 'success', title: '导入完成', message: '设计已载入画布，请检查后点击保存' })
  } catch (error) {
    if (error === 'cancel' || error === 'close') return
    ElNotification({ type: 'error', title: '导入失败', message: error?.message || '界面设计文件无效' })
  }
}

const versionCommand = (command) => {
  if (command === 'history') openHistory()
  if (command === 'assets') openAssetLibrary()
  if (command === 'source') openSourceBridge()
  if (command === 'export') exportDesign()
  if (command === 'import') importDesign()
}

const jsonDrawer = ref(false)
const showJsonClick = () => {
  jsonDrawer.value = true
}

//当前组件json
const curPageJson = computed({
  get() {
    return JSON.stringify(formData.value, null, '  ')
  },
  set(newValue) {
    try {
      const parsed = JSON.parse(newValue)
      // 更新 curWidget 的值，假设 curWidget 是响应式的 ref 或 pinia store 的响应式属性
      Object.assign(formData.value, parsed)
    } catch (e) {
      console.error('JSON 解析失败')
    }
  },
})

//清空组件
const clearClick = () => {
  ElMessageBox.confirm('是否清空当前画布所有容器和组件?', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  })
    .then(() => {
      pageEngineStore.clearWrapper()
      //清除缓存
      localStorage.removeItem('page_formData')
      ElNotification({
        type: 'success',
        title: '提示',
        message: '画布已清空',
        duration: 1000,
      })
    })
    .catch(() => {
      // console.log('取消')
    }).canel
}

//初始化当前页面，
const setIni = () => {
  ElMessageBox.confirm('是否初始化当前页面配置吗?', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  })
    .then(() => {
      pageEngineStore.setIni()
      ElNotification({
        type: 'success',
        title: '提示',
        message: '页面已初始化',
        duration: 1000,
      })
    })
    .catch(() => {
      // console.log('取消')
    })
}

//是否切换模板1
const mockClick = (index) => {
  ElMessageBox.confirm('是否切换模板吗?', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  })
    .then(async () => {
      const loadingInstance = ElLoading.service({ fullscreen: true })
      btnLoading.value = true

      let mockData = await importTempData(index)
      formData.value.JsonObj = { ...mockData.JsonObj }

      nextTick(() => {
        btnLoading.value = false
        loadingInstance.close()
      })
      ElNotification({
        type: 'success',
        title: '提示',
        message: '已切换模板' + (index + 1),
        duration: 1000,
      })
    })
    .catch(() => {
      // console.log('取消')
      btnLoading.value = false
    })
}
</script>

<style lang="scss" scoped>
.layout-headerPanel {
  position: relative;

  .header-accent-bar {
    height: 3px;
    background: linear-gradient(90deg, var(--el-color-primary), var(--el-color-success), var(--el-color-warning));
  }

  .header-body {
    display: flex;
    align-items: center;
    height: 53px;
    padding: 0 16px;
    background-color: var(--el-bg-color);
    border-bottom: 1px solid var(--el-border-color-lighter);
    box-shadow: 0 1px 6px rgba(0, 0, 0, 0.04);
    transition: all 0.3s;
    gap: 12px;
  }

  .header-section {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .header-left {
    flex: 0 0 auto;
    gap: 12px;
  }

  .header-center {
    flex: 1;
    justify-content: center;
    gap: 8px;
  }

  .header-right {
    flex: 0 0 auto;
    gap: 12px;
    .ve__button.is-circle{
      width: 32px;
      height: 32px;
    }
  }

  .lefticon {
    font-size: 18px;
    cursor: pointer;
    color: var(--el-text-color-secondary);
    padding: 6px;
    border-radius: 6px;
    transition: all 0.2s;
    &:hover {
      color: var(--el-color-primary);
      background-color: var(--el-color-primary-light-9);
    }
  }

  .header-brand {
    display: flex;
    align-items: center;
    gap: 6px;
    .brand-text {
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.5px;
      background-image: linear-gradient(135deg, var(--el-color-primary), var(--el-color-success));
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
      white-space: nowrap;
    }
    .brand-icon {
      color: var(--el-color-success);
      animation: sparkle 2s ease-in-out infinite;
    }
  }

  .toolbar-group {
    display: flex;
    align-items: center;
    background: var(--el-fill-color-lighter);
    border-radius: 8px;
    padding: 2px 4px;
    gap: 2px;
    transition: background-color 0.3s;
  }

  .header-divider {
    height: 20px;
    margin: 0 4px;
  }

  .theme-switch {
    --el-switch-on-color: #e6a23c;
    --el-switch-off-color: #409eff;
  }
}

.version-summary,
.diff-metrics {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}

.version-summary code,
.microi-page-engine code {
  padding: 2px 6px;
  border-radius: 4px;
  color: var(--el-color-primary);
  background: var(--el-fill-color-light);
}

.page-import-input {
  display: none;
}

.source-bridge-note {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  padding: 11px 13px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  background: var(--el-fill-color-light);
}

.source-bridge-note > .el-icon {
  color: var(--el-color-success);
  font-size: 20px;
}

.source-bridge-note > div {
  display: grid;
  gap: 3px;
}

.source-bridge-note span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.source-bridge-editor :deep(textarea) {
  min-height: 460px !important;
  color: var(--el-text-color-primary);
  background: var(--el-bg-color-page);
  font-family: "Cascadia Code", "JetBrains Mono", Consolas, monospace;
  font-size: 12px;
  line-height: 1.6;
  tab-size: 2;
}

.source-bridge-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 9px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.source-bridge-meta code {
  color: var(--el-color-primary);
}

.asset-library-toolbar {
  display: grid;
  grid-template-columns: 180px minmax(260px, 1fr) auto;
  gap: 9px;
  margin-bottom: 12px;
}

.asset-library-grid {
  display: grid;
  min-height: 260px;
  max-height: 560px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 11px;
  margin-top: 12px;
  overflow: auto;
}

.asset-library-grid > .el-empty {
  grid-column: 1 / -1;
}

.asset-library-card {
  display: grid;
  align-content: start;
  gap: 8px;
  min-width: 0;
  padding: 13px;
  border: 1px solid var(--el-border-color);
  border-radius: 10px;
  background: var(--el-bg-color);
  transition: border-color .18s ease, transform .18s ease;
}

.asset-library-card:hover {
  border-color: var(--el-color-primary-light-5);
  transform: translateY(-1px);
}

.asset-library-card header,
.asset-library-card footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.asset-library-card header > span {
  color: var(--el-color-primary);
  font-size: 12px;
  font-weight: 700;
}

.asset-library-card strong,
.asset-library-card code {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.asset-library-card code {
  color: var(--el-text-color-secondary);
  font-size: 11px;
}

.asset-library-card p {
  display: -webkit-box;
  min-height: 38px;
  margin: 0;
  overflow: hidden;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.55;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.asset-library-card small {
  overflow: hidden;
  color: var(--el-text-color-placeholder);
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 720px) {
  .source-bridge-note {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .source-bridge-note > .el-tag {
    grid-column: 1 / -1;
    justify-self: start;
  }

  .source-bridge-editor :deep(textarea) {
    min-height: 360px !important;
  }

  .asset-library-toolbar,
  .asset-library-grid {
    grid-template-columns: 1fr;
  }
}

@media (min-width: 721px) and (max-width: 980px) {
  .asset-library-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@keyframes sparkle {
  0%, 100% { opacity: 1; transform: rotate(0deg); }
  50% { opacity: 0.6; transform: rotate(15deg); }
}
</style>
