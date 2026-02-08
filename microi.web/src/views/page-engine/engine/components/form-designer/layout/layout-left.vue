<template>
  <div class="layout-left">
    <el-card class="box-card">
      <vue-custom-scrollbar class="scroll-area" :settings="settings">
        <el-tabs>
          <el-tab-pane>
            <template #label>
              <el-text>
                <el-icon>
                  <Grid />
                </el-icon>
                组件
              </el-text>
            </template>

            <div class="component-list" @dragstart="handleDragWidgetStart">
              <template
                v-for="(item, index) in widgetList"
                :key="'widget_' + index"
              >
                <div
                  v-if="item.show == 1"
                  class="list"
                  :draggable="true"
                  :data-index="index"
                >
                  <span class="iconfont">
                    <el-icon v-if="item.icon">
                      <component :is="item.icon"></component>
                    </el-icon>
                    <img
                      v-else
                      height="25"
                      :src="item.img == '' ? getAssetUrl(item.type) : item.img"
                      draggable="false"
                    />
                  </span>
                  <span class="btn_name">{{ item.label }}</span>
                </div>
              </template>
            </div>
          </el-tab-pane>
          <el-tab-pane>
            <template #label>
              <el-text>
                <el-icon>
                  <FullScreen />
                </el-icon>
                容器
              </el-text>
            </template>

            <div class="component-list" @dragstart="handleDragWrapperStart">
              <div
                v-for="(item, index) in wrapperList"
                :key="'wrapper_' + index"
                class="list"
                :draggable="true"
                :data-index="index"
              >
                <span class="iconfont">
                  <el-icon v-if="item.icon">
                    <component :is="item.icon"></component>
                  </el-icon>
                  <img
                    v-else
                    height="25"
                    :src="item.img == '' ? getAssetUrl(item.type) : item.img"
                    draggable="false"
                  />
                </span>
                <span class="btn_name">{{ item.label }}</span>
              </div>
            </div>
          </el-tab-pane>
        </el-tabs>
      </vue-custom-scrollbar>
    </el-card>
  </div>
</template>

<script setup name="layout-left">
import { wrapperList } from '../../../utils/formjson'
import vueCustomScrollbar from 'vue-custom-scrollbar/src/vue-scrollbar.vue'
import 'vue-custom-scrollbar/dist/vueScrollbar.css'
import { usePageEngineStore } from '../../../stores/pageEngine'
import { storeToRefs } from 'pinia'
const pageEngineStore = usePageEngineStore()
const { widgetList, formData } = storeToRefs(pageEngineStore)

const settings = {
  suppressScrollY: false,
  suppressScrollX: true,
  wheelPropagation: false,
}

// 动态获取图片 URL
const getAssetUrl = (type) => {
  return new URL(`../../../assets/${type}.png`, import.meta.url).href
}

//拖拽组件启动
const handleDragWidgetStart = (e) => {
  e.dataTransfer.setData('widgetIdx', e.target.dataset.index)
}
//拖拽容器启动
const handleDragWrapperStart = (e) => {
  e.dataTransfer.setData('wrapperIdx', e.target.dataset.index)
}
</script>

<style lang="scss">
.microi-page-engine {
  .layout-left {
    .el-card.is-always-shadow,
    .el-card.is-hover-shadow:focus,
    .el-card.is-hover-shadow:hover {
      box-shadow: 0 0 0px 0 rgba(0, 0, 0, 0.1) !important;
    }
    // background-color: #fff;
    .el-card__body,
    .el-main {
      padding: 10px 0 20px 20px;
    }
  }
  .iconfont {
    font-family: element-icons !important;
  }
}
</style>

<style lang="scss">
.microi-page-engine {
  .layout-left {
    padding: 10px 0;
    .box-card {
      .scroll-area {
        position: relative;
        margin: auto;
        width: 100%;
        height: 80vh;
      }
      .component-list {
        padding-bottom: 10px;
        display: grid;
        grid-gap: 12px;
        grid-template-columns: repeat(auto-fill, 74px);
        grid-template-rows: repeat(auto-fill, 70px);
        .list {
          height: 68px;
          border: 2px dotted #409eff;
          cursor: grab;
          text-align: center;
          border-radius: 8px;
          // box-shadow: 0 0px 4px 0 rgba(0, 0, 0, 0.1);
          &:active {
            cursor: grabbing;
          }

          &:hover {
            color: hsl(210, 100%, 63%);
          }

          .iconfont {
            display: block;
            // font-size: 20px;
            margin-top: 10px;
            margin-bottom: 0px;
            height: 24px;
          }

          .btn_name {
            font-size: 12px;
            line-height: 20px;
            width: 56px;
            padding: 0px 5px;
            word-break: keep-all;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
        }
      }
    }
  }
}
</style>
