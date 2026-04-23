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
                  <span class="list-icon">
                    <el-icon v-if="item.icon" :size="15">
                      <component :is="item.icon"></component>
                    </el-icon>
                    <img
                      v-else
                      height="18"
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
                <span class="list-icon">
                  <el-icon v-if="item.icon" :size="15">
                    <component :is="item.icon"></component>
                  </el-icon>
                  <img
                    v-else
                    height="18"
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
      box-shadow: none !important;
    }
    .el-card {
      border: none;
      background-color: var(--el-bg-color);
      transition: background-color 0.3s;
    }
    .el-card__body,
    .el-main {
      padding: 8px 8px 10px 10px;
    }
    .el-tabs__header {
      margin-bottom: 8px;
    }
    .el-tabs__item {
      font-size: 13px;
      padding: 0 12px;
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
    padding: 0;
    border-right: 1px solid var(--el-border-color-lighter);
    transition: border-color 0.3s;
    .box-card {
      .scroll-area {
        position: relative;
        margin: auto;
        width: 100%;
        height: calc(100vh - 80px);
      }
      .component-list {
        padding: 0 4px 8px 0;
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        overflow-y: scroll;

        .list {
          width: calc(50% - 3px);
          border: 1px solid var(--el-border-color-lighter);
          cursor: grab;
          border-radius: 8px;
          background: var(--el-fill-color-blank);
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: flex-start;
          padding: 8px 8px;
          gap: 7px;
          box-sizing: border-box;

          &:active {
            cursor: grabbing;
            transform: scale(0.96);
          }

          &:hover {
            color: #fff;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-color: transparent;
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.35);
            transform: translateY(-1px);

            .list-icon {
              background: rgba(255, 255, 255, 0.2);
              color: #fff;
              img {
                filter: brightness(0) invert(1);
              }
            }
            .btn_name {
              color: #fff;
            }
          }

          .list-icon {
            flex-shrink: 0;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 24px;
            height: 24px;
            border-radius: 5px;
            background: linear-gradient(135deg, rgba(102, 126, 234, 0.12) 0%, rgba(118, 75, 162, 0.12) 100%);
            color: #667eea;
            font-size: 13px;
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            img {
              transition: filter 0.25s;
            }
          }

          .btn_name {
            font-size: 12px;
            line-height: 1.2;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            color: var(--el-text-color-regular);
            transition: color 0.25s;
          }
        }
      }
    }
  }
}
</style>
