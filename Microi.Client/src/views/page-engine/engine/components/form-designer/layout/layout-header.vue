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
          <el-tooltip :content="$t('Msg.PageEngine.visualPage')" placement="bottom">
            <el-button size="small" text :icon="Tickets" @click="showJsonClick">JSON</el-button>
          </el-tooltip>
          <el-tooltip :content="$t('Msg.PageEngine.undo') + ' (Ctrl/Cmd + Z)'" placement="bottom">
            <el-button size="small" text :icon="RefreshLeft" :disabled="!canUndo" :aria-label="$t('Msg.PageEngine.undo')" @click="undoDesign" />
          </el-tooltip>
          <el-tooltip :content="$t('Msg.PageEngine.redo') + ' (Ctrl/Cmd + Shift + Z / Ctrl + Y)'" placement="bottom">
            <el-button size="small" text :icon="RefreshRight" :disabled="!canRedo" :aria-label="$t('Msg.PageEngine.redo')" @click="redoDesign" />
          </el-tooltip>
          <el-dropdown trigger="click" @command="versionCommand" :teleported="true">
            <el-button size="small" text :icon="Clock">
              {{ $t("Msg.PageEngine.version") }}<el-icon class="el-icon--right"><ArrowDown /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="history"><el-icon><Clock /></el-icon>{{ $t("Msg.PageEngine.historyAndDiff") }}</el-dropdown-item>
                <el-dropdown-item command="assets"><el-icon><Collection /></el-icon>{{ $t("Msg.PageEngine.assets") }}</el-dropdown-item>
                <el-dropdown-item command="source"><el-icon><DocumentCopy /></el-icon>{{ $t("Msg.PageEngine.vueBridge") }}</el-dropdown-item>
                <el-dropdown-item command="export"><el-icon><Download /></el-icon>{{ $t("Msg.PageEngine.exportDesign") }}</el-dropdown-item>
                <el-dropdown-item command="import"><el-icon><Upload /></el-icon>{{ $t("Msg.PageEngine.importDesign") }}</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <el-tooltip :content="$t('Msg.PageEngine.clearTip')" placement="bottom">
            <el-button size="small" text :icon="Delete" @click="clearClick">{{ $t("Msg.PageEngine.clear") }}</el-button>
          </el-tooltip>
          <el-dropdown trigger="click" @command="mockClick" :teleported="true">
            <el-button size="small" text :loading="btnLoading" :icon="Star">
              {{ $t("Msg.PageEngine.templates") }}<el-icon class="el-icon--right"><ArrowDown /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item :command="0"><el-icon><Star /></el-icon>{{ $t("Msg.PageEngine.templateN", { index: 1 }) }}</el-dropdown-item>
                <el-dropdown-item :command="1"><el-icon><Star /></el-icon>{{ $t("Msg.PageEngine.templateN", { index: 2 }) }}</el-dropdown-item>
                <el-dropdown-item :command="2"><el-icon><Star /></el-icon>{{ $t("Msg.PageEngine.templateN", { index: 3 }) }}</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
        <el-divider direction="vertical" class="header-divider" />
        <el-button type="success" size="small" plain :icon="View" @click="previewClick" round>{{ $t("Msg.PageEngine.preview") }}</el-button>
        <el-button type="primary" size="small" :loading="btnLoading" @click="saveClick" :icon="Collection" round>{{ $t("Msg.PageEngine.save") }}</el-button>
      </div>
      <div class="header-section header-right">
        <el-tooltip :content="$t('Msg.PageEngine.switchTheme')" placement="bottom">
          <el-switch
            @change="darkChange"
            v-model="isDark"
            class="theme-switch"
            :active-action-icon="Moon"
            :inactive-action-icon="Sunny"
          />
        </el-tooltip>
        <el-tooltip :content="$t('Msg.PageEngine.initialize')" placement="bottom">
          <el-button size="small" type="info" text :icon="Setting" @click="setIni" circle />
        </el-tooltip>
      </div>
    </div>
  </div>
  <el-drawer :title="$t('Msg.PageEngine.pageJson')" v-model="jsonDrawer" direction="ltr">
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
    :title="$t('Msg.PageEngine.previewPage')"
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
    :title="$t('Msg.PageEngine.historyTitle')"
    width="920px"
    destroy-on-close
  >
    <div class="version-summary">
      <span>{{ $t("Msg.PageEngine.currentHash") }}</span>
      <code>{{ shortHash(currentHash) || $t('Msg.PageEngine.notRead') }}</code>
      <el-tag v-if="pageEngineStore.historyAvailable" type="success" effect="plain">{{ $t("Msg.PageEngine.historyEnabled") }}</el-tag>
      <el-tag v-else type="info" effect="plain">{{ $t("Msg.PageEngine.historyMissing") }}</el-tag>
    </div>
    <el-table
      v-mci-loading:table="historyLoading"
      :data="historyItems"
      row-key="Id"
      max-height="500"
      :empty-text="$t('Msg.PageEngine.noHistory')"
    >
      <el-table-column prop="VersionNo" :label="$t('Msg.PageEngine.version')" width="170" />
      <el-table-column prop="ChangeSummary" :label="$t('Msg.PageEngine.changeSummary')" min-width="220" show-overflow-tooltip />
      <el-table-column prop="UserName" :label="$t('Msg.PageEngine.operator')" width="120" />
      <el-table-column prop="CreateTime" :label="$t('Msg.PageEngine.time')" width="180" />
      <el-table-column :label="$t('Msg.PageEngine.contentHash')" width="130">
        <template #default="scope"><code>{{ shortHash(scope.row.ContentHash) }}</code></template>
      </el-table-column>
      <el-table-column :label="$t('Msg.PageEngine.operation')" width="150" fixed="right">
        <template #default="scope">
          <el-button link type="primary" @click="compareHistory(scope.row)">{{ $t("Msg.PageEngine.compare") }}</el-button>
          <el-button link type="warning" @click="rollbackHistory(scope.row)">{{ $t("Msg.PageEngine.rollback") }}</el-button>
        </template>
      </el-table-column>
    </el-table>
    <template #footer>
      <el-button @click="historyDialogVisible = false">{{ $t("Msg.PageEngine.close") }}</el-button>
      <el-button type="primary" :loading="historyLoading" @click="loadHistory">{{ $t("Msg.PageEngine.refresh") }}</el-button>
    </template>
  </el-dialog>

  <el-dialog
    v-model="diffDialogVisible"
    :title="$t('Msg.PageEngine.diffTitle')"
    width="900px"
    destroy-on-close
  >
    <div class="diff-metrics" v-if="diffResult">
      <el-tag type="success">{{ $t("Msg.PageEngine.added", { count: diffResult.Added || 0 }) }}</el-tag>
      <el-tag type="danger">{{ $t("Msg.PageEngine.removed", { count: diffResult.Removed || 0 }) }}</el-tag>
      <el-tag type="warning">{{ $t("Msg.PageEngine.changed", { count: diffResult.Changed || 0 }) }}</el-tag>
      <el-tag v-if="diffResult.Equal" type="info">{{ $t("Msg.PageEngine.equal") }}</el-tag>
      <el-tag v-if="diffResult.Truncated" type="warning">{{ $t("Msg.PageEngine.truncated") }}</el-tag>
    </div>
    <el-table :data="diffResult?.Changes || []" max-height="520" :empty-text="$t('Msg.PageEngine.versionsEqual')">
      <el-table-column prop="Type" :label="$t('Msg.PageEngine.type')" width="90" />
      <el-table-column prop="Path" :label="$t('Msg.PageEngine.path')" min-width="230" show-overflow-tooltip />
      <el-table-column :label="$t('Msg.PageEngine.before')" min-width="210" show-overflow-tooltip>
        <template #default="scope">{{ diffValue(scope.row.Before) }}</template>
      </el-table-column>
      <el-table-column :label="$t('Msg.PageEngine.after')" min-width="210" show-overflow-tooltip>
        <template #default="scope">{{ diffValue(scope.row.After) }}</template>
      </el-table-column>
    </el-table>
  </el-dialog>

  <el-dialog
    v-model="sourceDialogVisible"
    :title="$t('Msg.PageEngine.sourceTitle')"
    width="min(1100px, 94vw)"
    destroy-on-close
  >
    <div class="source-bridge-note">
      <el-icon><Lock /></el-icon>
      <div>
        <strong>{{ $t("Msg.PageEngine.sourceSafe") }}</strong>
        <span>{{ $t("Msg.PageEngine.sourceDescription") }}</span>
      </div>
      <el-tag v-if="sourceMeta.sourceChanged" type="warning" effect="plain">{{ $t("Msg.PageEngine.sourceEdited") }}</el-tag>
      <el-tag v-else type="success" effect="plain">{{ $t("Msg.PageEngine.sourceSame") }}</el-tag>
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
      <code>{{ shortHash(sourceMeta.currentHash || sourceMeta.declaredHash) || $t('Msg.PageEngine.notVerified') }}</code>
      <span>{{ $t("Msg.PageEngine.characters", { count: sourceText.length.toLocaleString() }) }}</span>
    </div>
    <template #footer>
      <el-button @click="chooseSourceFile"><el-icon><Upload /></el-icon>{{ $t("Msg.PageEngine.readVue") }}</el-button>
      <el-button @click="downloadSource"><el-icon><Download /></el-icon>{{ $t("Msg.PageEngine.downloadSource") }}</el-button>
      <el-button @click="sourceDialogVisible = false">{{ $t("Msg.PageEngine.close") }}</el-button>
      <el-button type="primary" :loading="sourceBusy" @click="applySourceToCanvas">{{ $t("Msg.PageEngine.importCanvas") }}</el-button>
    </template>
  </el-dialog>

  <el-dialog
    v-model="assetDialogVisible"
    :title="$t('Msg.PageEngine.assetTitle')"
    width="min(1080px, 94vw)"
    destroy-on-close
  >
    <div class="asset-library-toolbar">
      <el-select v-model="assetTypeFilter" :placeholder="$t('Msg.PageEngine.allTypes')" clearable>
        <el-option :label="$t('Msg.PageEngine.block')" value="Block" />
        <el-option :label="$t('Msg.PageEngine.component')" value="Component" />
        <el-option :label="$t('Msg.PageEngine.pageTemplate')" value="PageTemplate" />
        <el-option :label="$t('Msg.PageEngine.theme')" value="Theme" />
        <el-option :label="$t('Msg.PageEngine.dataAdapter')" value="DataAdapter" />
      </el-select>
      <el-input v-model.trim="assetKeyword" clearable :placeholder="$t('Msg.PageEngine.assetSearch')" />
      <el-button :loading="assetLoading" @click="loadAssetLibrary">{{ $t("Msg.PageEngine.refresh") }}</el-button>
    </div>
    <el-alert
      :title="$t('Msg.PageEngine.assetImmutable')"
      type="info"
      :closable="false"
      show-icon
    />
    <div v-mci-loading:cards="assetLoading" class="asset-library-grid">
      <article v-for="item in filteredAssets" :key="item.Id" class="asset-library-card">
        <header><span>{{ assetTypeLabel(item.AssetType) }}</span><el-tag size="small" effect="plain">{{ item.Scope || 'Tenant' }}</el-tag></header>
        <strong>{{ item.Name }}</strong>
        <code>{{ item.PackageKey }}</code>
        <p>{{ item.Description || $t('Msg.PageEngine.noDescription') }}</p>
        <footer><small>{{ item.Owner || $t('Msg.PageEngine.noOwner') }}</small><el-button link type="primary" :loading="assetApplyingKey === item.PackageKey" @click="applyAsset(item)">{{ $t("Msg.PageEngine.applyCanvas") }}</el-button></footer>
      </article>
      <el-empty v-if="!assetLoading && !filteredAssets.length" :description="$t('Msg.PageEngine.noAssets')" />
    </div>
    <template #footer><el-button @click="assetDialogVisible = false">{{ $t("Msg.PageEngine.close") }}</el-button></template>
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
import { useI18n } from 'vue-i18n'
import { EventBus } from '../../../utils/eventBus.js'
import { usePageEngineStore } from '../../../stores/pageEngine'
import { ElMessageBox, ElNotification } from 'element-plus'
import { openMciLoading } from '@/utils/mci-loading'
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
const { t } = useI18n()
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
const title = computed(() => t('Msg.PageEngine.title'))

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
      Title: plainData.Title || plainData.Name || t('Msg.PageEngine.unnamedPage'),
      Number: plainData.Number,
      Desc: plainData.Desc,
      RoutePath: plainData.RoutePath,
      ComponentPath: plainData.ComponentPath,
      JsonStr: JSON.stringify(plainData.JsonObj || {}),
      ExpectedCurrentHash: currentHash.value || undefined,
      ChangeSummary: t('Msg.PageEngine.saveSummary'),
    })
    if (!result || result.Code !== 1) {
      const conflict = result?.Data?.Conflict === true
      throw new Error(result?.Msg || (conflict ? t('Msg.PageEngine.concurrentChanged') : t('Msg.PageEngine.saveFailed')))
    }
    pageEngineStore.setVersionState(
      result.Data?.CurrentHash || currentHash.value,
      result.Data?.HistoryAvailable
    )
    ElNotification({
      type: 'success',
      title: t('Msg.PageEngine.saveSuccess'),
      message: result.Msg || result.Data?.Message || t('Msg.PageEngine.persisted'),
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
      title: t('Msg.PageEngine.saveFailed'),
      message: error?.message || t('Msg.PageEngine.saveLater'),
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
    if (!result || result.Code !== 1) throw new Error(result?.Msg || t('Msg.PageEngine.readHistoryFailed'))
    historyItems.value = result.Data?.Items || []
    pageEngineStore.setVersionState(result.Data?.CurrentHash || currentHash.value, true)
  } catch (error) {
    historyItems.value = []
    ElNotification({
      type: 'warning',
      title: t('Msg.PageEngine.historyUnavailable'),
      message: error?.message || t('Msg.PageEngine.installGovernance'),
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
    if (!result || result.Code !== 1) throw new Error(result?.Msg || t('Msg.PageEngine.compareVersionFailed'))
    diffResult.value = result.Data || {}
    diffDialogVisible.value = true
  } catch (error) {
    ElNotification({ type: 'error', title: t('Msg.PageEngine.compareFailed'), message: error?.message || t('Msg.PageEngine.cannotCompare') })
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
    ElNotification({ type: 'warning', title: t('Msg.PageEngine.cannotRollback'), message: t('Msg.PageEngine.hashMissing') })
    return
  }
  try {
    await ElMessageBox.confirm(
      t('Msg.PageEngine.rollbackConfirm', { version: row.VersionNo || row.Id }),
      t('Msg.PageEngine.rollbackTitle'),
      { confirmButtonText: t('Msg.PageEngine.confirmRollback'), cancelButtonText: t('Msg.PageEngine.cancel'), type: 'warning' }
    )
    historyLoading.value = true
    const result = await PageVersionApi.rollback(
      formData.value.Id,
      row.Id,
      currentHash.value,
      t('Msg.PageEngine.rollbackSummary', { version: row.VersionNo || row.Id })
    )
    if (!result || result.Code !== 1) throw new Error(result?.Msg || t('Msg.PageEngine.rollbackFailed'))
    const detail = await PageVersionApi.detail(formData.value.Id)
    if (!detail || detail.Code !== 1) throw new Error(detail?.Msg || t('Msg.PageEngine.rollbackReloadFailed'))
    applyServerPage(detail.Data)
    await loadHistory()
    ElNotification({ type: 'success', title: t('Msg.PageEngine.rollbackSuccess'), message: result.Msg || t('Msg.PageEngine.rollbackSuccessMessage') })
  } catch (error) {
    if (error === 'cancel' || error === 'close') return
    ElNotification({ type: 'error', title: t('Msg.PageEngine.rollbackError'), message: error?.message || t('Msg.PageEngine.cannotRollbackVersion') })
  } finally {
    historyLoading.value = false
  }
}

const exportDesign = async () => {
  try {
    const result = await PageVersionApi.export(formData.value?.Id)
    if (!result || result.Code !== 1) throw new Error(result?.Msg || t('Msg.PageEngine.exportFailed'))
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
    ElNotification({ type: 'error', title: t('Msg.PageEngine.exportError'), message: error?.message || t('Msg.PageEngine.cannotExport') })
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
    ElNotification({ type: 'error', title: t('Msg.PageEngine.sourceGenerateFailed'), message: error?.message || t('Msg.PageEngine.cannotGenerateSource') })
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
    if (file.size > 8 * 1024 * 1024) throw new Error(t('Msg.PageEngine.sourceTooLarge'))
    const text = await file.text()
    const parsed = await PageSourceBridge.parse(text)
    sourceText.value = text
    sourceFileName.value = file.name || 'page.microi-page.vue'
    sourceMeta.value = parsed
    sourceDialogVisible.value = true
  } catch (error) {
    ElNotification({ type: 'error', title: t('Msg.PageEngine.sourceReadFailed'), message: error?.message || t('Msg.PageEngine.invalidSource') })
  }
}

const downloadSource = async () => {
  try {
    if (!sourceText.value) await openSourceBridge()
    downloadText(sourceText.value, sourceFileName.value || 'page.microi-page.vue', 'text/x-vue;charset=utf-8')
  } catch (error) {
    ElNotification({ type: 'error', title: t('Msg.PageEngine.sourceDownloadFailed'), message: error?.message || t('Msg.PageEngine.cannotDownloadSource') })
  }
}

const normalizeImportedPage = (source) => {
  const root = source?.Snapshot || source || {}
  const page = root.Page || root
  let jsonObj = page.JsonObj ?? page.jsonObj ?? root.JsonObj
  if (typeof jsonObj === 'string') jsonObj = JSON.parse(jsonObj || '{}')
  if (!jsonObj || typeof jsonObj !== 'object' || Array.isArray(jsonObj)) {
    throw new Error(t('Msg.PageEngine.missingPageObject'))
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
      ? t('Msg.PageEngine.sourceEditedConfirm')
      : t('Msg.PageEngine.sourceConfirm')
    await ElMessageBox.confirm(warning, t('Msg.PageEngine.importVueTitle'), {
      confirmButtonText: t('Msg.PageEngine.importCanvas'), cancelButtonText: t('Msg.PageEngine.cancel'), type: parsed.sourceChanged ? 'warning' : 'info'
    })
    applyImportedPage(imported)
    sourceMeta.value = parsed
    sourceDialogVisible.value = false
    ElNotification({ type: 'success', title: t('Msg.PageEngine.sourceImported'), message: t('Msg.PageEngine.sourceImportedMessage') })
  } catch (error) {
    if (error === 'cancel' || error === 'close') return
    ElNotification({ type: 'error', title: t('Msg.PageEngine.sourceImportFailed'), message: error?.message || t('Msg.PageEngine.invalidSource') })
  } finally {
    sourceBusy.value = false
  }
}

const assetTypeLabel = (value) => ({
  Block: t('Msg.PageEngine.block'),
  Component: t('Msg.PageEngine.component'),
  PageTemplate: t('Msg.PageEngine.pageTemplate'),
  Theme: t('Msg.PageEngine.theme'),
  DataAdapter: t('Msg.PageEngine.dataAdapter'),
}[value] || value || t('Msg.PageEngine.assetFallback'))

const loadAssetLibrary = async () => {
  assetLoading.value = true
  try {
    const result = await PageVersionApi.listPublishedAssets()
    if (!result || result.Code !== 1) throw new Error(result?.Msg || t('Msg.PageEngine.readAssetsFailed'))
    assetItems.value = Array.isArray(result.Data) ? result.Data : (result.Data?.List || [])
  } catch (error) {
    assetItems.value = []
    ElNotification({
      type: 'warning',
      title: t('Msg.PageEngine.assetUnavailable'),
      message: error?.message || t('Msg.PageEngine.installGovernance'),
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
    if (!result || result.Code !== 1 || !result.Data) throw new Error(result?.Msg || t('Msg.PageEngine.assetResolveFailed'))
    const asset = result.Data
    const content = asset.Content || {}
    const type = asset.Package?.AssetType || item.AssetType
    if (type === 'PageTemplate') {
      const jsonObj = content.Page?.JsonObj || content.JsonObj || content
      const imported = normalizeImportedPage({ JsonObj: jsonObj })
      await ElMessageBox.confirm(t('Msg.PageEngine.pageTemplateConfirm'), t('Msg.PageEngine.applyPageTemplate'), {
        confirmButtonText: t('Msg.PageEngine.replaceCanvas'), cancelButtonText: t('Msg.PageEngine.cancel'), type: 'warning'
      })
      pageEngineStore.updateFormData({ ...formData.value, JsonObj: imported.JsonObj })
    } else if (type === 'Block') {
      const wrappers = content.Wrappers || (content.Wrapper ? [content.Wrapper] : [])
      if (!Array.isArray(wrappers) || !wrappers.length) throw new Error(t('Msg.PageEngine.blockMissing'))
      wrappers.forEach((wrapper) => pageEngineStore.addWrapper(rekeyAssetTree(wrapper)))
    } else if (type === 'Component') {
      const widget = content.Widget || content
      if (!widget?.widgetOption) throw new Error(t('Msg.PageEngine.widgetMissing'))
      if (pageEngineStore.curWrapperIdx < 0) throw new Error(t('Msg.PageEngine.selectContainer'))
      const wrapper = formData.value.JsonObj.wrapperList[pageEngineStore.curWrapperIdx]
      const wrapperNumber = wrapper?.wrapperOption?.number
      pageEngineStore.addWidget(pageEngineStore.curWrapperIdx, rekeyAssetTree(widget, wrapperNumber))
    } else if (type === 'Theme') {
      const theme = content.FormConfig || content.Theme || content
      if (!theme || typeof theme !== 'object' || Array.isArray(theme)) throw new Error(t('Msg.PageEngine.invalidTheme'))
      Object.assign(formData.value.JsonObj.formConfig, deepClone(theme))
    } else {
      throw new Error(t('Msg.PageEngine.adapterReference'))
    }
    assetDialogVisible.value = false
    ElNotification({
      type: 'success',
      title: t('Msg.PageEngine.assetApplied'),
      message: t('Msg.PageEngine.assetAppliedMessage', { name: asset.Package?.Name || item.Name, version: asset.Version?.VersionNo || '' }),
    })
  } catch (error) {
    if (error === 'cancel' || error === 'close') return
    ElNotification({ type: 'error', title: t('Msg.PageEngine.applyAssetFailed'), message: error?.message || t('Msg.PageEngine.cannotApplyAsset') })
  } finally {
    assetApplyingKey.value = ''
  }
}

const handleImportFile = async (event) => {
  const file = event?.target?.files?.[0]
  if (!file) return
  try {
    if (file.size > 5 * 1024 * 1024) throw new Error(t('Msg.PageEngine.designTooLarge'))
    const imported = normalizeImportedPage(JSON.parse(await file.text()))
    await ElMessageBox.confirm(t('Msg.PageEngine.designImportConfirm'), t('Msg.PageEngine.importDesignTitle'), {
      confirmButtonText: t('Msg.PageEngine.importCanvas'), cancelButtonText: t('Msg.PageEngine.cancel'), type: 'warning'
    })
    applyImportedPage(imported)
    ElNotification({ type: 'success', title: t('Msg.PageEngine.importDone'), message: t('Msg.PageEngine.importDoneMessage') })
  } catch (error) {
    if (error === 'cancel' || error === 'close') return
    ElNotification({ type: 'error', title: t('Msg.PageEngine.importFailed'), message: error?.message || t('Msg.PageEngine.invalidDesign') })
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
      console.error('[page-engine] JSON parse failed')
    }
  },
})

//清空组件
const clearClick = () => {
  ElMessageBox.confirm(t('Msg.PageEngine.clearConfirm'), t('Msg.PageEngine.prompt'), {
    confirmButtonText: t('Msg.PageEngine.confirm'),
    cancelButtonText: t('Msg.PageEngine.cancel'),
    type: 'warning',
  })
    .then(() => {
      pageEngineStore.clearWrapper()
      //清除缓存
      localStorage.removeItem('page_formData')
      ElNotification({
        type: 'success',
        title: t('Msg.PageEngine.prompt'),
        message: t('Msg.PageEngine.canvasCleared'),
        duration: 1000,
      })
    })
    .catch(() => {
      // console.log('取消')
    }).canel
}

//初始化当前页面，
const setIni = () => {
  ElMessageBox.confirm(t('Msg.PageEngine.initializeConfirm'), t('Msg.PageEngine.prompt'), {
    confirmButtonText: t('Msg.PageEngine.confirm'),
    cancelButtonText: t('Msg.PageEngine.cancel'),
    type: 'warning',
  })
    .then(() => {
      pageEngineStore.setIni()
      ElNotification({
        type: 'success',
        title: t('Msg.PageEngine.prompt'),
        message: t('Msg.PageEngine.initialized'),
        duration: 1000,
      })
    })
    .catch(() => {
      // console.log('取消')
    })
}

//是否切换模板1
const mockClick = (index) => {
  ElMessageBox.confirm(t('Msg.PageEngine.templateConfirm'), t('Msg.PageEngine.prompt'), {
    confirmButtonText: t('Msg.PageEngine.confirm'),
    cancelButtonText: t('Msg.PageEngine.cancel'),
    type: 'warning',
  })
    .then(async () => {
      const loadingInstance = openMciLoading({ fullscreen: true, variant: 'page', label: t('Msg.DataLoading') })
      btnLoading.value = true
      try {
        let mockData = await importTempData(index)
        formData.value.JsonObj = { ...mockData.JsonObj }
        await nextTick()
        ElNotification({
          type: 'success',
          title: t('Msg.PageEngine.prompt'),
          message: t('Msg.PageEngine.templateChanged', { index: index + 1 }),
          duration: 1000,
        })
      } finally {
        btnLoading.value = false
        loadingInstance.close()
      }
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
