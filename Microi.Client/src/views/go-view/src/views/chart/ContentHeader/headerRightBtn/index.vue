<template>
  <n-space class="go-mt-0" :wrap="false">
    <n-button v-for="item in comBtnList" :key="item.title" :type="item.type" :disabled="saving" ghost @click="item.event">
      <template #icon>
        <component :is="item.icon"></component>
      </template>
      <span>{{ item.title }}</span>
    </n-button>
  </n-space>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { renderIcon, goDialog, setSessionStorage, getSessionStorage } from '@goview/utils'
import { StorageEnum } from '@goview/enums/storageEnum'
import { useRoute, useRouter } from 'vue-router'
import { useChartEditStore } from '@goview/store/modules/chartEditStore/chartEditStore'
import { syncData } from '../../ContentEdit/components/EditTools/hooks/useSyncUpdate.hook'
import { waitForComponentUpdates } from '../../hooks/useSync.hook'
import { icon } from '@goview/plugins'
import { findDuplicateComponentIds } from '@goview/utils/projectIntegrity.js'
import { DiyCommon } from '@/utils/diy.common'
import { cloneDeep } from 'lodash'

const { BrowsersOutlineIcon, SendIcon, AnalyticsIcon } = icon.ionicons5
const chartEditStore = useChartEditStore()

const routerParamsInfo = useRoute()
const router = useRouter()
const saving = ref(false)

const translateMessage = (key: string, fallback: string) => {
  const translated = window['$t']?.(key)
  return typeof translated === 'string' && translated && translated !== key ? translated : fallback
}

// 获取当前项目 ID
const getProjectId = () => {
  const { Id } = routerParamsInfo.params
  if (Array.isArray(Id)) return Id[0] || ''
  return typeof Id === 'string' ? Id : ''
}

// 保存到后端
const saveToServer = async () => {
  if (saving.value) return null
  const projectId = getProjectId()
  if (!projectId) return null
  saving.value = true

  try {
    // 异步恢复完成后再复制快照，保证项目切换、预览和服务端保存使用同一份稳定数据。
    await waitForComponentUpdates()
    // 保存开始后若发生路由切换，宁可放弃本次保存，也不能把旧画布写进另一个项目。
    if (getProjectId() !== projectId) return null

    const storageInfo = cloneDeep(chartEditStore.getStorageInfo())
    const duplicateIds = findDuplicateComponentIds(storageInfo.componentList)
    if (duplicateIds.length) {
      console.error('[go-view] Refused to save duplicate component ids:', { projectId, duplicateIds })
      window['$message'].error(
        translateMessage(
          'Msg.GoViewDuplicateComponentIds',
          '检测到重复组件 Id，已阻止保存。请刷新页面后重试。'
        )
      )
      return null
    }

    const contentData = JSON.stringify(storageInfo)
    const res = await DiyCommon.FormEngine.UptFormData({
      FormEngineKey: 'mic_data_dashboard',
      Id: projectId,
      ContentData: contentData
    })
    if (res.Code === 1) {
      window['$message'].success(translateMessage('Msg.SaveSuccess', '保存成功'))
      return storageInfo
    } else {
      window['$message'].error(res.Msg || translateMessage('Msg.SaveFail', '保存失败'))
      return null
    }
  } catch (error) {
    console.error('[go-view] Save error:', error)
    window['$message'].error(translateMessage('Msg.SaveFail', '保存失败'))
    return null
  } finally {
    saving.value = false
  }
}

// 保存
const saveHandle = async () => {
  await saveToServer()
}

// 预览：先保存，再路由跳转到预览页
const previewHandle = async () => {
  const savedStorageInfo = await saveToServer()
  if (!savedStorageInfo) return
  const projectId = getProjectId()
  // 将数据写入 sessionStorage 供预览页读取
  setSessionStorage(StorageEnum.GO_CHART_STORAGE_LIST, [{ id: projectId, ...savedStorageInfo }])
  // 在宿主框架中路由跳转到预览页
  router.push(`/mic/data-dashboard/preview/${projectId}`)
}

const btnList = [
  {
    select: true,
    title: '同步内容',
    type: 'primary',
    icon: renderIcon(AnalyticsIcon),
    event: syncData
  },
  {
    select: true,
    title: '预览',
    icon: renderIcon(BrowsersOutlineIcon),
    event: previewHandle
  },
  {
    select: true,
    title: '保存',
    icon: renderIcon(SendIcon),
    event: saveHandle
  }
]

const comBtnList = computed(() => {
  if (chartEditStore.getEditCanvas.isCodeEdit) {
    return btnList
  }
  const cloneList = cloneDeep(btnList)
  cloneList.shift()
  return cloneList
})
</script>

<style lang="scss" scoped>
.align-center {
  margin-top: -4px;
}
</style>
