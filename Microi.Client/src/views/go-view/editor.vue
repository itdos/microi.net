<template>
  <div class="go-view-editor-wrapper" :data-theme="goViewTheme" :style="wrapperStyle" v-mci-loading:page="loading">
    <!-- NaiveUI 主题提供器 -->
    <n-config-provider :theme="darkTheme" :theme-overrides="overridesTheme">
      <n-message-provider>
        <n-dialog-provider>
          <n-notification-provider>
            <go-view-message-inject />
            <chart-editor v-if="ready" />
          </n-notification-provider>
        </n-dialog-provider>
      </n-message-provider>
    </n-config-provider>
  </div>
</template>

<script>
import { defineComponent, defineAsyncComponent, getCurrentInstance, computed, markRaw } from 'vue'
import { darkTheme, NConfigProvider, NMessageProvider, NDialogProvider, NNotificationProvider } from 'naive-ui'
import { DiyCommon } from '@/utils/diy.common'
import { setupGoView } from './setup.js'
import { createLatestRequestGate } from './src/utils/projectIntegrity.js'
import GoViewMessageInject from './GoViewMessageInject.vue'
import { useDiyStore } from '@/pinia'
import { useDesignStore as useGoViewDesignStore } from '@goview/store/modules/designStore/designStore'

export default defineComponent({
  name: 'GoViewEditor',
  components: {
    NConfigProvider,
    NMessageProvider,
    NDialogProvider,
    NNotificationProvider,
    GoViewMessageInject,
    ChartEditor: defineAsyncComponent(() => import('./src/views/chart/index.vue'))
  },
  setup() {
    const diyStore = useDiyStore()
    const goViewDesignStore = useGoViewDesignStore()
    const wrapperStyle = computed(() => {
      // 根据导航栏和全屏状态动态计算高度
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
      projectLoadGate: markRaw(createLatestRequestGate()),
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
    '$route.fullPath': {
      async handler() {
        const newId = this.getRouteProjectId()
        if (newId && newId !== this.projectId) {
          this.projectId = newId
          this.ready = false
          this.loading = true
          const completed = await this.loadProjectData()
          if (completed) {
            this.ready = true
            this.loading = false
          }
        }
      }
    }
  },
  async mounted() {
    // 初始化 go-view 插件
    const app = getCurrentInstance().appContext.app
    setupGoView(app)

    // 获取项目ID
    this.projectId = this.getRouteProjectId()

    // 如果有 projectId，从后端加载项目数据
    if (this.projectId) {
      const completed = await this.loadProjectData()
      if (!completed) return
    } else {
      // 新建项目
      this.initNewProject()
    }

    this.ready = true
    this.loading = false
  },
  beforeUnmount() {
    this.projectLoadGate.invalidate()
  },
  methods: {
    getRouteProjectId() {
      const routeId = this.$route.query?.Id || this.$route.params?.Id || ''
      if (Array.isArray(routeId)) return routeId[0] || ''
      return typeof routeId === 'string' ? routeId : ''
    },
    async loadProjectData() {
      const projectId = this.projectId
      const loadToken = this.projectLoadGate.begin()
      const isCurrentLoad = () => this.projectLoadGate.isCurrent(loadToken) && projectId === this.projectId

      try {
        const res = await DiyCommon.FormEngine.GetFormData({
          FormEngineKey: 'mic_data_dashboard',
          Id: projectId
        })
        if (!isCurrentLoad()) return false
        if (res.Code !== 1 || !res.Data) {
          throw new Error(res.Msg || '大屏数据加载失败')
        }

        const { useChartEditStore } = await import('@goview/store/modules/chartEditStore/chartEditStore')
        const chartEditStore = useChartEditStore()
        if (!isCurrentLoad()) return false

        // 解析存储的 JSON 数据
        let projectData = res.Data.ContentData
        if (typeof projectData === 'string' && projectData) {
          projectData = JSON.parse(projectData)
        }

        if (projectData) {
          // 使用 useSync 加载数据到 store
          const { useSync } = await import('./src/views/chart/hooks/useSync.hook')
          const { updateComponent } = useSync()
          if (!isCurrentLoad()) return false
          await updateComponent(projectData, true)
          if (!isCurrentLoad()) return false

          // 设置项目名称
          if (res.Data.ProjectName) {
            chartEditStore.editCanvasConfig.projectName = res.Data.ProjectName
          }
        } else {
          // ContentData 为空，重置 store 恢复默认画布配置
          const { waitForComponentUpdates } = await import('./src/views/chart/hooks/useSync.hook')
          await waitForComponentUpdates()
          if (!isCurrentLoad()) return false
          chartEditStore.$reset()
        }
        return isCurrentLoad()
      } catch (error) {
        if (isCurrentLoad()) {
          console.error('[go-view] Load project error:', error)
          this.loading = false
          window['$message']?.error(error instanceof Error ? error.message : '大屏数据加载失败')
        }
        return false
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
  width: 100%;
  overflow: hidden;
  position: relative;
  // 隔离宿主框架的全局样式对 go-view 的影响
  font-size: 12px;
  line-height: 1.5;
}
</style>
