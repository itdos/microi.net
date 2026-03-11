<template>
  <n-space class="go-mt-0" :wrap="false">
    <n-button v-for="item in comBtnList" :key="item.title" :type="item.type" ghost @click="item.event">
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
import { useRoute } from 'vue-router'
import { useChartEditStore } from '@goview/store/modules/chartEditStore/chartEditStore'
import { syncData } from '../../ContentEdit/components/EditTools/hooks/useSyncUpdate.hook'
import { icon } from '@goview/plugins'
import { DiyCommon } from '@/utils/diy.common'
import { cloneDeep } from 'lodash'

const { BrowsersOutlineIcon, SendIcon, AnalyticsIcon } = icon.ionicons5
const chartEditStore = useChartEditStore()

const routerParamsInfo = useRoute()
const saving = ref(false)

// 获取当前项目 ID
const getProjectId = () => {
  const { Id } = routerParamsInfo.params
  return typeof Id === 'string' ? Id : Id[0]
}

// 保存到后端
const saveToServer = async () => {
  const projectId = getProjectId()
  if (!projectId) return false
  const storageInfo = chartEditStore.getStorageInfo()
  const contentData = JSON.stringify(storageInfo)
  try {
    saving.value = true
    const res = await DiyCommon.FormEngine.UptFormData({
      FormEngineKey: 'mic_data_dashboard',
      Id: projectId,
      ContentData: contentData
    })
    if (res.Code === 1) {
      window['$message'].success('保存成功')
      return true
    } else {
      window['$message'].error(res.Msg || '保存失败')
      return false
    }
  } catch (error) {
    console.error('[go-view] Save error:', error)
    window['$message'].error('保存失败')
    return false
  } finally {
    saving.value = false
  }
}

// 保存
const saveHandle = async () => {
  await saveToServer()
}

// 预览：先保存，再新开预览页
const previewHandle = async () => {
  const saved = await saveToServer()
  if (!saved) return
  const projectId = getProjectId()
  // 将数据写入 sessionStorage 供预览页读取
  const storageInfo = chartEditStore.getStorageInfo()
  setSessionStorage(StorageEnum.GO_CHART_STORAGE_LIST, [{ id: projectId, ...storageInfo }])
  // 在宿主框架中打开预览路由
  window.open(`/#/mic/data-dashboard/preview/${projectId}`, '_blank')
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
