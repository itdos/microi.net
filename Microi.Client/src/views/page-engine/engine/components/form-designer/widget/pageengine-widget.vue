<template>
  <div class="pageengine-widget">
    <button
      v-if="pageId && canDesignPage"
      type="button"
      class="nested-page-design-btn"
      :aria-label="$pet('界面设计')"
      @click="openNestedPageDesigner"
    >
      <el-icon><EditPen /></el-icon>
      <span>{{ $pet('界面设计') }}</span>
    </button>
    <div v-if="!pageId" class="pageengine-widget__placeholder">
      <el-icon :size="34"><DataBoard /></el-icon>
      <span>{{ $pet('请选择要嵌入的界面引擎') }}</span>
    </div>
    <div v-else-if="loading" class="pageengine-widget__placeholder">
      <el-icon class="is-loading" :size="30"><Loading /></el-icon>
      <span>{{ $pet('正在加载界面引擎...') }}</span>
    </div>
    <el-alert
      v-else-if="error"
      :title="error"
      type="error"
      show-icon
      :closable="false"
    />
    <nested-form-renderer
      v-else-if="nestedPage"
      :key="'pageengine_' + widgetObj.widgetOption.number + '_' + pageId"
      :remoteObj="nestedPage"
    />
  </div>
</template>

<script setup name="pageengine-widget">
import { computed, defineAsyncComponent, inject, provide, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useDiyStore } from '@/pinia'
import { DiyCommon } from '@/utils/diy.common'
import {
  createIsolatedPageEngineStore,
  PAGE_ENGINE_RENDER_CONTEXT_KEY,
  PAGE_ENGINE_STORE_KEY,
} from '../../../stores/pageEngine'

const NestedFormRenderer = defineAsyncComponent(() => import('../../form-renderer/index.vue'))

const props = defineProps({
  widgetObj: {
    type: Object,
    required: true,
  },
})

const pageId = computed(() => props.widgetObj.widgetParams?.[0]?.value || '')
const router = useRouter()
const diyStore = useDiyStore()
const loading = ref(false)
const error = ref('')
const nestedPage = ref(null)
const parentPageIds = inject(PAGE_ENGINE_RENDER_CONTEXT_KEY, computed(() => []))
const isolatedStore = createIsolatedPageEngineStore()

provide(PAGE_ENGINE_STORE_KEY, isolatedStore)
provide(PAGE_ENGINE_RENDER_CONTEXT_KEY, computed(() => {
  const ids = Array.isArray(parentPageIds.value) ? parentPageIds.value.slice() : []
  if (pageId.value && ids.indexOf(pageId.value) < 0) ids.push(pageId.value)
  return ids
}))

const canDesignPage = computed(() => {
  const user = diyStore.GetCurrentUser || {}
  const adminValue = String(user._IsAdmin ?? '').toLowerCase()
  const isAdmin = user._IsAdmin === true || Number(user._IsAdmin) === 1 || adminValue === 'true'
  return isAdmin || Number(user.Level || 0) >= 9999
})

const openNestedPageDesigner = () => {
  if (!pageId.value || !canDesignPage.value) return
  router.push({ path: '/mic/autopage', query: { Id: pageId.value } })
}

const parseNestedPage = (row) => {
  if (!row) return null
  const result = { ...row }
  try {
    if (typeof result.JsonObj === 'string') result.JsonObj = JSON.parse(result.JsonObj || '{}')
  } catch (parseError) {
    throw new Error('嵌套界面引擎 JSON 配置无效：' + (parseError?.message || parseError))
  }
  return result
}

const loadNestedPage = async () => {
  nestedPage.value = null
  error.value = ''
  if (!pageId.value) return
  const ancestorIds = Array.isArray(parentPageIds.value) ? parentPageIds.value : []
  if (ancestorIds.indexOf(pageId.value) >= 0) {
    error.value = '检测到界面引擎循环嵌套，请检查页面配置。'
    return
  }
  loading.value = true
  try {
    const result = await DiyCommon.FormEngine.GetFormData('mic_page', { Id: pageId.value })
    if (!result || result.Code !== 1 || !result.Data) {
      throw new Error((result && result.Msg) || '界面引擎不存在')
    }
    nestedPage.value = parseNestedPage(result.Data)
  } catch (loadError) {
    error.value = '加载嵌套界面失败：' + (loadError?.message || loadError)
  } finally {
    loading.value = false
  }
}

watch(pageId, loadNestedPage, { immediate: true })
</script>

<style lang="scss" scoped>
.pageengine-widget {
  position: relative;
  width: 100%;
  height: auto;
  min-height: 0;
  overflow: visible;
  background: var(--el-bg-color);
}

.nested-page-design-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 5;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 0 9px;
  border: 1px solid color-mix(in srgb, var(--el-color-primary) 28%, var(--el-border-color-lighter));
  border-radius: 999px;
  background: color-mix(in srgb, var(--el-color-primary) 7%, var(--el-bg-color));
  color: var(--el-color-primary);
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  transition: background-color .18s ease, border-color .18s ease, transform .18s ease;
}

.nested-page-design-btn:hover {
  border-color: color-mix(in srgb, var(--el-color-primary) 52%, var(--el-border-color));
  background: color-mix(in srgb, var(--el-color-primary) 12%, var(--el-bg-color));
  transform: translateY(-1px);
}

@media screen and (max-width: 768px) {
  .nested-page-design-btn {
    top: 78px;
    right: 12px;
    height: 28px;
    padding: 0 7px;
    font-size: 12px;
  }
}

.pageengine-widget__placeholder {
  display: flex;
  height: 100%;
  min-height: 180px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--el-text-color-secondary);
  border: 1px dashed var(--el-border-color);
  border-radius: var(--mci-shape-panel, 8px);
}

.pageengine-widget :deep(.microi-page-engine) {
  width: 100%;
  min-height: 0;
  padding-top: 0;
}
</style>
