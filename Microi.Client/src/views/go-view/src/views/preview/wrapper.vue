<template>
  <preview :key="key"></preview>
</template>

<script setup lang="ts">
import { getSessionStorageInfo } from './utils'
import type { ChartEditStorageType } from './index.d'
import { SavePageEnum } from '@goview/enums/editPageEnum'
import { setSessionStorage } from '@goview/utils'
import { StorageEnum } from '@goview/enums/storageEnum'
import { ref, onBeforeUnmount } from 'vue'
import Preview from './index.vue'

let key = ref(Date.now())

// 修复内存泄漏：以前从 <script setup> 顶层向 window.opener 注册匿名监听器，
// 预览窗关闭后主窗仍残留。现改为命名函数 + onBeforeUnmount 逆清理。
const _ownerListeners: Array<{ saveEvent: string; handler: (e: any) => void }> = []
try {
  const listenerArr = [SavePageEnum.JSON, SavePageEnum.CHART_TO_PREVIEW]
  listenerArr.forEach((saveEvent: string) => {
    if (!window.opener || !window.opener.addEventListener) return
    const handler = async (e: any) => {
      const localStorageInfo: ChartEditStorageType = (await getSessionStorageInfo()) as unknown as ChartEditStorageType
      setSessionStorage(StorageEnum.GO_CHART_STORAGE_LIST, [{ ...e.detail, id: localStorageInfo.id }])
      key.value = Date.now()
    }
    window.opener.addEventListener(saveEvent, handler)
    _ownerListeners.push({ saveEvent, handler })
  })
} catch (error) {
  console.log(error)
}

onBeforeUnmount(() => {
  try {
    if (window.opener && window.opener.removeEventListener) {
      _ownerListeners.forEach(({ saveEvent, handler }) => {
        window.opener.removeEventListener(saveEvent, handler)
      })
    }
  } catch (e) {}
  _ownerListeners.length = 0
})
</script>
