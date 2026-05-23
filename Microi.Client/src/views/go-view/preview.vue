<template>
  <div class="go-view-preview-wrapper" :data-theme="goViewTheme" :style="wrapperStyle" v-loading="loading">
    <n-config-provider :theme="darkTheme" :theme-overrides="overridesTheme">
      <n-message-provider>
        <n-dialog-provider>
          <n-notification-provider>
            <go-view-message-inject />
            <div v-if="ready" class="go-view-preview-content">
              <suspense>
                <preview-page />
              </suspense>
            </div>
          </n-notification-provider>
        </n-dialog-provider>
      </n-message-provider>
    </n-config-provider>
  </div>
</template>

<script>
import { defineComponent, defineAsyncComponent, getCurrentInstance, computed } from 'vue'
import { darkTheme, NConfigProvider, NMessageProvider, NDialogProvider, NNotificationProvider } from 'naive-ui'
import { DiyCommon } from '@/utils/diy.common'
import { setupGoView } from './setup.js'
import GoViewMessageInject from './GoViewMessageInject.vue'
import { useDiyStore } from '@/pinia'
import { useDesignStore as useGoViewDesignStore } from '@goview/store/modules/designStore/designStore'

export default defineComponent({
  name: 'GoViewPreview',
  components: {
    NConfigProvider,
    NMessageProvider,
    NDialogProvider,
    NNotificationProvider,
    GoViewMessageInject,
    PreviewPage: defineAsyncComponent(() => import('./src/views/preview/suspenseIndex.vue'))
  },
  setup() {
    const diyStore = useDiyStore()
    const goViewDesignStore = useGoViewDesignStore()
    const wrapperStyle = computed(() => {
      const navbarHeight = diyStore.ShowClassicTop !== 0 ? 50 : 0
      const tabsHeight = 33
      const offset = navbarHeight + tabsHeight
      return { height: `calc(100vh - ${offset}px)` }
    })
    const goViewTheme = computed(() => goViewDesignStore.themeName)
    return { wrapperStyle, goViewTheme }
  },
  data() {
    return {
      projectId: '',
      ready: false,
      loading: true,
      darkTheme,
      overridesTheme: {
        common: {
          primaryColor: '#51d6a9'
        }
      }
    }
  },
  watch: {
    '$route.params.Id': {
      async handler(newId) {
        if (newId && newId !== this.projectId) {
          this.projectId = newId
          this.ready = false
          this.loading = true
          await this.loadProjectData()
          this.ready = true
          this.loading = false
        }
      }
    }
  },
  async mounted() {
    const app = getCurrentInstance().appContext.app
    setupGoView(app)

    this.projectId = this.$route.query.Id || this.$route.params?.Id || ''

    if (this.projectId) {
      await this.loadProjectData()
    }

    this.ready = true
    this.loading = false
  },
  methods: {
    async loadProjectData() {
      try {
        const res = await DiyCommon.FormEngine.GetFormData({
          FormEngineKey: 'mic_data_dashboard',
          Id: this.projectId
        })
        if (res.Code === 1 && res.Data) {
          let projectData = res.Data.ContentData
          if (typeof projectData === 'string' && projectData) {
            projectData = JSON.parse(projectData)
          }

          if (projectData) {
            // 将数据写入 sessionStorage，供 suspenseIndex 的 getSessionStorageInfo 读取
            const storageItem = {
              id: this.projectId,
              editCanvasConfig: projectData.editCanvasConfig,
              requestGlobalConfig: projectData.requestGlobalConfig,
              componentList: projectData.componentList
            }
            window.sessionStorage.setItem('GO_CHART_STORAGE_LIST', JSON.stringify([storageItem]))
          } else {
            // ContentData 为空，清除旧数据避免显示上一个项目
            window.sessionStorage.setItem('GO_CHART_STORAGE_LIST', JSON.stringify([{
              id: this.projectId,
              editCanvasConfig: {},
              requestGlobalConfig: {},
              componentList: []
            }]))
          }
        }
      } catch (error) {
        console.error('[go-view] Load preview error:', error)
      }
    }
  }
})
</script>

<style lang="scss" scoped>
.go-view-preview-wrapper {
  width: 100%;
  overflow: hidden;
  position: relative;
}

.go-view-preview-content {
  width: 100%;
  height: 100%;
}
</style>
