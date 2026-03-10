<template>
  <div class="go-view-preview-wrapper" v-loading="loading">
    <n-config-provider :theme="darkTheme" :theme-overrides="overridesTheme">
      <n-message-provider>
        <n-dialog-provider>
          <n-notification-provider>
            <n-loading-bar-provider>
              <go-view-message-inject />
              <div v-if="ready" class="go-view-preview-content">
                <suspense>
                  <preview-page />
                </suspense>
              </div>
            </n-loading-bar-provider>
          </n-notification-provider>
        </n-dialog-provider>
      </n-message-provider>
    </n-config-provider>
  </div>
</template>

<script>
import { defineComponent, defineAsyncComponent, getCurrentInstance } from 'vue'
import { darkTheme, NConfigProvider, NMessageProvider, NDialogProvider, NNotificationProvider, NLoadingBarProvider } from 'naive-ui'
import { DiyCommon } from '@/utils/diy.common'
import { setupGoView } from './setup.js'
import GoViewMessageInject from './GoViewMessageInject.vue'

export default defineComponent({
  name: 'GoViewPreview',
  components: {
    NConfigProvider,
    NMessageProvider,
    NDialogProvider,
    NNotificationProvider,
    NLoadingBarProvider,
    GoViewMessageInject,
    PreviewPage: defineAsyncComponent(() => import('./src/views/preview/suspenseIndex.vue'))
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
          if (typeof projectData === 'string') {
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
  height: calc(100vh - 84px);
  overflow: hidden;
  position: relative;
  margin-top: 10px;
}

.go-view-preview-content {
  width: 100%;
  height: 100%;
}
</style>
