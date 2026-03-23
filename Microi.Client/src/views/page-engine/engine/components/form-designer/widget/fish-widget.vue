<template>
  <el-row type="flex" class="fishbone-container">
    <el-col :span="4" class="flex-container">
      <img width="100%" src="../../../assets/fishbottom.png" />
    </el-col>
    <el-col :span="16" class="flex-container">
      <div class="fishbone">
        <div>
          <el-row type="flex" class="top-bone">
            <div
              class="item-bone"
              v-for="(item, index) in widgetObj.widgetParams[0].typeOptions
                .dataJson"
              :key="index"
            >
              <ul
                class="item-bone-children"
                :style="fatherBonelineStyle"
                v-if="index % 2 == 0"
              >
                <div
                  v-if="index % 2 == 0"
                  :style="fatherBoneLabelStyleTop"
                  class="textTop"
                  @click="doRouter(item.label, item.router)"
                >
                  {{ item.label }}
                </div>

                <li
                  v-for="(ele, i) in item.children"
                  class="children-item"
                  :key="i"
                >
                  <div v-if="ele.title" class="title">{{ ele.title }}</div>
                  <div
                    @click="doRouter(item.label, item.router)"
                    class="text"
                    :style="childBoneLabelStyle"
                    v-else
                  >
                    {{ ele.label }}
                  </div>
                </li>
              </ul>
            </div>
          </el-row>
          <div class="center-line" :style="centerBoneLineStyle"></div>
          <el-row type="flex" class="bottom-bone">
            <div
              class="item-bone"
              v-for="(item, index) in widgetObj.widgetParams[0].typeOptions
                .dataJson"
              :key="index"
            >
              <ul
                class="item-bone-children"
                :style="fatherBonelineStyle"
                v-if="index % 2 != 0"
              >
                <div
                  v-if="index % 2 != 0"
                  :style="fatherBoneLabelStyleBom"
                  class="textBottom"
                  @click="doRouter(item.label, item.router)"
                >
                  {{ item.label }}
                </div>
                <li
                  v-for="(ele, i) in item.children"
                  :key="i"
                  class="children-item1"
                >
                  <div v-if="ele.title" class="title">
                    {{ ele.title }}
                  </div>
                  <div
                    class="text"
                    @click="doRouter(item.label, item.router)"
                    :style="childBoneLabelStyle"
                    v-else
                  >
                    {{ ele.label }}
                  </div>
                </li>
              </ul>
            </div>
          </el-row>
        </div>
      </div>
    </el-col>

    <el-col :span="4" class="flex-container">
      <img width="100%" src="../../../assets/fishtop.png" />
    </el-col>
  </el-row>
</template>

<script setup name="fish-widget">
import { ref, computed } from 'vue'
import { EventBus } from '../../../utils/eventBus.js'
import { usePageEngineStore } from '../../../stores/pageEngine'
import { storeToRefs } from 'pinia'

import { useWidget } from '../../../hooks/useWidget'
const pageEngineStore = usePageEngineStore()
const { formData } = storeToRefs(pageEngineStore)

const props = defineProps({
  widgetObj: {
    type: Object,
    required: true,
  },
})
//日期区间
const dateRange = ref()
//是否加载中
const loading = ref(false)

// //设置临时数据
// const dynamicData = ref()
// dynamicData.value = props.widgetObj.widgetParams[0].typeOptions.dataJson
const { loadRemoteData } = useWidget(
  props.widgetObj,
  props.widgetObj.widgetParams[0].typeOptions.dataJson,
  dateRange,
  loading
)
await loadRemoteData()

const centerBoneLineStyle = computed(() => {
  return {
    width: props.widgetObj.widgetParams[1]?.value,
    backgroundColor: props.widgetObj.widgetParams[2]?.value,
    height: props.widgetObj.widgetParams[3]?.value,
  }
})

const fatherBonelineStyle = computed(() => {
  return {
    borderRight: props.widgetObj.widgetParams[4]?.value,
    margin: props.widgetObj.widgetParams[5]?.value,
    padding: props.widgetObj.widgetParams[6]?.value,
  }
})

const fatherBoneLabelStyleTop = computed(() => {
  return {
    top: props.widgetObj.widgetParams[7]?.value,
    fontSize: props.widgetObj.widgetParams[9]?.value,
    color: props.widgetObj.widgetParams[10]?.value,
    right: props.widgetObj.widgetParams[11]?.value,
    fontWeight: props.widgetObj.widgetParams[12]?.value,
  }
})

const fatherBoneLabelStyleBom = computed(() => {
  return {
    bottom: props.widgetObj.widgetParams[8]?.value,
    fontSize: props.widgetObj.widgetParams[9]?.value,
    color: props.widgetObj.widgetParams[10]?.value,
    right: props.widgetObj.widgetParams[11]?.value,
    fontWeight: props.widgetObj.widgetParams[12]?.value,
  }
})

const childBoneLabelStyle = computed(() => {
  return {
    fontSize: props.widgetObj.widgetParams[14]?.value,
    color: props.widgetObj.widgetParams[15]?.value,
    margin: props.widgetObj.widgetParams[16]?.value,
    fontWeight: props.widgetObj.widgetParams[17]?.value,
  }
})

const doRouter = (label, linkUrl) => {
  if (formData.value.JsonObj.formConfig.link) {
    EventBus.emit('fishWidget', linkUrl)
    window.parent?.postMessage({ key: 'fishWidget', value: linkUrl }, '*')
    console.log('鱼骨图触发连接', label, linkUrl)
  } else {
    console.log('链接跳转已禁用')
  }
}
</script>
<style lang="scss" scoped>
.flex-container {
  display: flex;
  align-items: center; /* 垂直居中 */
  justify-content: center; /* 水平居中，可选 */
  // height: 500px; /* 容器的高度，可以根据需要设置 */
  // background-color: red;
}

.fishbone {
  padding: 30px 0;

  position: relative;
  $bnoe-color: #409eff;
  max-width: 100%;

  width: 100%;
  // height: 100%;

  //底部一级文本样式
  .textBottom {
    cursor: pointer;
    position: absolute;
    //bottom: -28px;
    text-align: center;
    // font-weight: bold;
    //right: -25px;
    transform: skewx(45deg);
    //color: #409eff;
  }

  //顶部一级文本样式
  .textTop {
    cursor: pointer;
    position: absolute;
    //top: -28px;
    text-align: center;
    // font-weight: bold;
    //right: -25px;
    transform: skewx(-45deg);
    //color: #409eff;
  }

  //中间主干线线样式
  .center-line {
    position: relative;
  }

  .top-bone,
  .bottom-bone {
    .item-bone {
      position: relative;
      display: flex;
      // margin: 0 20px; ////////////////////////////上下刺间距///////////////////////////
    }

    .children-item {
      position: relative;
      cursor: pointer;
      &:not(:last-child) {
        border-bottom: 2px solid $bnoe-color;
        &:after {
          position: absolute;
          right: -8px;
          bottom: -6px;
          content: ' ';
          border: 5px solid transparent;
          border-left: 5px solid #409eff;
          transform: skewx(-45deg);
        }
      }
    }

    .item-bone-children {
      position: relative;
      height: 100%;
      transform: skewX(45deg);
      list-style-type: none;

      .text {
        cursor: pointer;
        text-align: right;
        // padding-right: 20px;
        transform: skewx(-45deg);
        //  font-size: 12px;
        width: 100%;
        white-space: nowrap;
        // color: #409eff;
      }
    }
  }

  .bottom-bone {
    bottom: 0;
    .item-bone-children {
      position: relative;
      transform: skewX(-45deg);
      .text {
        transform: skewX(45deg);
      }
      .title {
        transform: skewX(45deg);
      }
      .children-item1 {
        cursor: pointer;
        position: relative;
        &:not(:last-child) {
          border-bottom: 2px solid $bnoe-color;
          &:after {
            position: absolute;
            right: -8px;
            bottom: -6px;
            content: ' ';
            border: 5px solid transparent;
            border-left: 5px solid #409eff !important;
            transform: skewx(45deg);
          }
        }
      }
    }
  }
}
</style>
