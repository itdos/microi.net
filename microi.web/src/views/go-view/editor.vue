<template>
  <div class="go-view-editor-wrapper" v-loading="loading">
    <!-- NaiveUI 主题提供器 -->
    <n-config-provider :theme="darkTheme" :theme-overrides="overridesTheme">
      <n-message-provider>
        <n-dialog-provider>
          <n-notification-provider>
            <n-loading-bar-provider>
              <go-view-message-inject />
              <chart-editor v-if="ready" />
            </n-loading-bar-provider>
          </n-notification-provider>
        </n-dialog-provider>
      </n-message-provider>
    </n-config-provider>
  </div>
</template>

<script>
import { defineComponent, defineAsyncComponent, ref, onMounted, getCurrentInstance, nextTick } from 'vue'
import { darkTheme, NConfigProvider, NMessageProvider, NDialogProvider, NNotificationProvider, NLoadingBarProvider } from 'naive-ui'
import { DiyCommon } from '@/utils/diy.common'
import { setupGoView } from './setup.js'
import GoViewMessageInject from './GoViewMessageInject.vue'

export default defineComponent({
  name: 'GoViewEditor',
  components: {
    NConfigProvider,
    NMessageProvider,
    NDialogProvider,
    NNotificationProvider,
    NLoadingBarProvider,
    GoViewMessageInject,
    ChartEditor: defineAsyncComponent(() => import('./src/views/chart/index.vue'))
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
    // 初始化 go-view 插件
    const app = getCurrentInstance().appContext.app
    setupGoView(app)

    // 获取项目ID
    this.projectId = this.$route.query.Id || this.$route.params?.Id || ''

    // 如果有 projectId，从后端加载项目数据
    if (this.projectId) {
      await this.loadProjectData()
    } else {
      // 新建项目
      this.initNewProject()
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
          const { useChartEditStore } = await import('@goview/store/modules/chartEditStore/chartEditStore')
          const chartEditStore = useChartEditStore()

          // 解析存储的 JSON 数据
          let projectData = res.Data.ContentData
          if (typeof projectData === 'string' && projectData) {
            projectData = JSON.parse(projectData)
          }

          if (projectData) {
            // 使用 useSync 加载数据到 store
            const { useSync } = await import('./src/views/chart/hooks/useSync.hook')
            const { updateComponent } = useSync()
            await updateComponent(projectData, true)

            // 设置项目名称
            if (res.Data.ProjectName) {
              chartEditStore.editCanvasConfig.projectName = res.Data.ProjectName
            }
          } else {
            // ContentData 为空，重置 store 恢复默认画布配置
            chartEditStore.$reset()
          }
        }
      } catch (error) {
        console.error('[go-view] Load project error:', error)
      }
    },
    initNewProject() {
      // 新项目使用默认配置，无需额外操作
    }
  }
})
</script>

<style lang="scss" scoped>
.go-view-editor-wrapper {
  --goview-top-offset: 82px;
  width: 100%;
  height: calc(100vh - var(--goview-top-offset));
  overflow: hidden;
  position: relative;
  // 隔离宿主框架的全局样式对 go-view 的影响
  font-size: 12px;
  line-height: 1.5;
}
</style>
