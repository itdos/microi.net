<template>
  <div class="layout-right">
    <el-card class="box-card">
      <vue-custom-scrollbar class="scroll-area" :settings="settings">
        <el-tabs v-model="activeName">
          <el-tab-pane name="first">
            <template #label>
              <el-text>
                <el-icon>
                  <Grid />
                </el-icon>
                组件
              </el-text>
            </template>
            <Suspense>
              <widgetAttr></widgetAttr>
            </Suspense>
          </el-tab-pane>
          <el-tab-pane name="second">
            <template #label>
              <el-text>
                <el-icon>
                  <FullScreen />
                </el-icon>
                容器
              </el-text>
            </template>
            <Suspense>
              <wrapperAttr></wrapperAttr>
            </Suspense>
          </el-tab-pane>
          <el-tab-pane name="third">
            <template #label>
              <el-text>
                <el-icon>
                  <Memo />
                </el-icon>
                页面
              </el-text>
            </template>
            <Suspense>
              <formAttr></formAttr>
            </Suspense>
          </el-tab-pane>
        </el-tabs>
      </vue-custom-scrollbar>
    </el-card>
  </div>
</template>
<script setup name="layout-right">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import formAttr from '../form-attr.vue'
import wrapperAttr from '../wrapper/wrapper-attr.vue'
import widgetAttr from '../widget/widget-attr.vue'
import { EventBus } from '../../../utils/eventBus.js'
import vueCustomScrollbar from 'vue-custom-scrollbar/src/vue-scrollbar.vue'
import 'vue-custom-scrollbar/dist/vueScrollbar.css'
import { usePageEngineStore } from '../../../stores/pageEngine'
import { storeToRefs } from 'pinia'

const pageEngineStore = usePageEngineStore()
const { formData } = storeToRefs(pageEngineStore)

//当前选项卡
const activeName = ref('third')

onMounted(() => {
  EventBus.on('activeName', (tabIdx) => {
    activeName.value = tabIdx
  })
})

const settings = {
  suppressScrollY: false,
  suppressScrollX: true,
  wheelPropagation: false,
}

onBeforeUnmount(() => {
  EventBus.off('activeName')
})
</script>

<style lang="scss">
.microi-page-engine {
  .layout-right {
    .el-card__body,
    .el-main {
      padding: 10px 10px 10px 20px;
    }

    .el-card.is-always-shadow,
    .el-card.is-hover-shadow:focus,
    .el-card.is-hover-shadow:hover {
      box-shadow: 0 0 0px 0 rgba(0, 0, 0, 0.1) !important;
    }

    .el-select,
    .el-input,
    .el-input-number {
      width: 150px;
    }
    .el-form-item {
      margin-bottom: 6px;
    }

    .el-collapse-item__content {
      padding-bottom: 0;
    }
    .el-collapse-item__header {
      color: #409eff;
      font-size: 14px !important;
    }
    .el-form-item__label {
      font-size: 13px !important;
    }

    .el-textarea__inner {
      width: 90%;
    }
  }
}
</style>

<style lang="scss" scoped>
.layout-right {
  padding: 10px 0;
  .box-card {
    .scroll-area {
      position: relative;
      margin: auto;
      width: 100%;
      height: calc(80vh + 10px);
    }
  }
}
</style>
