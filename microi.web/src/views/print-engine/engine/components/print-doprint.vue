<template>
  <div class="microi-print-engine" v-loading="loading">
    <el-container>
      <el-main style="padding: 15px 0">
        <el-card
          style="padding: 5px; height: calc(85vh - 10px); overflow-y: auto"
        >
          <!-- 设计器的 容器 -->
          <div ref="hiprintPrintContainer"></div>
        </el-card>
      </el-main>
    </el-container>
  </div>
</template>

<script setup name="print-doprint">
import {
  onMounted,
  onBeforeUnmount,
  ref,
  getCurrentInstance,
  reactive,
  nextTick,
} from 'vue'

import { buildDefaultRemoteData } from '../utils/util.js'
import { usePrintEngineStore } from '../stores/printEngine'
import { get } from '../utils/axiosInstance'
const printEngineStore = usePrintEngineStore()
// 工具
import { newHiprintPrintTemplate } from '../utils/template-helper'

const loading = ref(true)
const props = defineProps({
  remoteObj: {
    type: Object,
  },
})

//页面配置信息
const pageInfo = reactive({
  //整体数据,格式参考/utils.js buildDefaultRemoteData方法
  remoteData: {},
})

// 存储模板对象的 key
const TEMPLATE_KEY = getCurrentInstance().type.name

//加载页面数据
const loadRemoteData = async () => {
  pageInfo.remoteData = buildDefaultRemoteData() //默认渲染初始数据
}
loadRemoteData()

/**
 * 构建设计器
 * 注意: 必须要在 onMounted 中去构建
 * 因为都是把元素挂载到对应容器中, 必须要先找到该容器
 */
let hiprintTemplate

/**
 * 浏览器打印
 */
const doPrint = () => {
  loading.value = false
  console.log('执行浏览器打印')
  // 参数: 打印时设置 左偏移量，上偏移量
  let options = { leftOffset: -1, topOffset: -1 }
  // 扩展
  let ext = {
    callback: () => {
      console.log('浏览器打印窗口已打开')
    },
    // styleHandler: () => {
    //   // 重写 文本 打印样式
    //   return '<style>.hiprint-printElement-text{color:red !important;}</style>'
    // },
  }
  // 调用浏览器打印
  hiprintTemplate.print(pageInfo.remoteData.PrintObj, options, ext)
}

//设计器容器
const hiprintPrintContainer = ref(null)

const buildDesigner = () => {
  hiprintPrintContainer.value.innerHTML = '' // 先清空, 避免重复构建

  hiprintTemplate = newHiprintPrintTemplate(TEMPLATE_KEY, {
    template: pageInfo.remoteData.PageObj, // 页面对象json(object)
    settingContainer: '#PrintElementOptionSetting', // 元素参数容器
  })
  // 构建 并填充到 容器中
  hiprintTemplate.design(hiprintPrintContainer.value)
}

//动态加载数据接口
const loadDataApi = async (apiUrl) => {
  const response = await get(pageInfo.remoteData.DataApi, {})
  try {
    if (response) {
      pageInfo.remoteData.PrintObj = response //替换动态数据源
      buildDesigner()
      nextTick(() => {
        setTimeout(doPrint, 1000) // 1秒后加载脚本
      })
    }
  } catch (error) {
    console.log(error)
  }
}

let messageHandler = null
/**
 * 这里必须要在 onMounted 中去构建 左侧可拖拽元素 或者 设计器
 * 因为都是把元素挂载到对应容器中, 必须要先找到该容器
 */
onMounted(async () => {
  //如果是组件方式集成
  if (props.remoteObj && Object.keys(props.remoteObj).length > 0) {
    pageInfo.remoteData = props.remoteObj

    if (pageInfo.remoteData.DataApi) {
      loadDataApi(pageInfo.remoteData.DataApi)
    } else {
      buildDesigner()
    }
  } else {
    //构建设计器
    buildDesigner()
  }

  // 接收父窗体跨域token
  messageHandler = async function (event) {
    // if (event.origin !== '你的网址') {
    //   return
    // }
    let receivedData = event.data
    let token = receivedData?.iframeToken
    if (token) {
      console.log('页面引擎已接收到token,一切正常')
      printEngineStore.setToken(token)
    }

    // 父窗体有传数据过来
    let iframeFormData = receivedData?.iframeFormData
    if (iframeFormData) {
      pageInfo.remoteData = JSON.parse(iframeFormData)
      //如果动态api数据接口存在,则重新读一遍
      if (pageInfo.remoteData.DataApi) {
        loadDataApi(pageInfo.remoteData.DataApi)
      } else {
        buildDesigner() //重新builder
      }
    }
  }

  //接收父窗体跨域token
  window.addEventListener('message', messageHandler)
})

onBeforeUnmount(() => {
  // 取消监听事件
  window.removeEventListener('message', messageHandler)
})
</script>

<style lang="scss">
.microi-print-engine {
  .el-textarea__inner {
    font-size: 13px !important;
  }
  .el-form-item__label {
    font-size: 13px !important;
  }

  /* 自定义 provider 构建样式 */
  .jsoneditor-poweredBy {
    display: none !important;
  }
  .custom-style-types {
    .hiprint-printElement-type {
      display: block;
      padding: 0 0 0 0;
      list-style: none;

      li {
        //组件标题样式
        .title {
          display: block;
          padding: 4px 0px;
          clear: both;
          margin-bottom: 10px;
          font-size: 13px;
        }
      }

      ul {
        padding: 0 0 0 0;
        display: block;
        list-style: none;

        //组件按钮样式
        li {
          display: block;
          width: 50%;
          float: left;
          max-width: 100px;

          a {
            padding: 8px;
            text-decoration: none;
            border: 1px solid #ddd;
            width: 90%;
            max-width: 100px;
            display: inline-block;
            text-align: center;
            box-sizing: border-box;
            border: 1px solid #dcdfe6;
            border-radius: 5px;
            box-shadow: 0 0px 4px 0 rgba(0, 0, 0, 0.1);
            font-size: 13px !important;
            transition: background-color 0.3s ease;
            margin-right: 10px;
            margin-bottom: 10px;
            color: #000;
          }
          a:hover {
            color: #000;
            background-color: #409eff;
          }
        }
      }
    }
  }

  .hiprint-option-item-field {
    font-size: 12px !important;
    margin-top: 10px !important;
  }

  .minicolors-swatch {
    width: 25px !important;
    height: 25px !important;
  }

  .design .hiprint-printElement-table-handle {
    background: #409eff !important;
    height: 18pt !important;
    width: 18pt !important;
  }

  .design .hiprint-printElement-table-handle::before {
    content: '\e849';
    font-family: mpe-iconfont;
    font-size: 16px;
    color: #fff;
    margin: 5px;
    display: block;
  }

  .hiprint-option-item-label {
    font-size: 13px !important;
    margin-bottom: 10px !important;
  }

  .el-drawer__header {
    margin-bottom: 0 !important;
  }

  .hiprint-option-item-settingBtn {
    background: #409eff !important;
    cursor: pointer;
    border-radius: var(--el-border-radius-base);
  }
  .hiprint-option-item-deleteBtn {
    background: #f56c6c !important;
    cursor: pointer;
    border-radius: var(--el-border-radius-base);
  }

  .prop-tabs,
  .prop-tab-item,
  .hiprint-option-items {
    background: transparent !important;
  }

  .hiprint-option-items {
    padding-top: 15px !important;
  }

  .custom-tabs-label .el-icon {
    margin-right: 5px !important;
  }
  .hiprint-option-item-field input,
  select,
  textarea {
    color: var(--el-input-text-color, var(--el-text-color-regular)) !important;
    flex-grow: 1 !important;
    font-size: inherit !important;
    height: var(--el-input-inner-height) !important;
    line-height: var(--el-input-inner-height) !important;
    padding: 8px 10px !important;
    border-radius: var(--el-border-radius-base) !important;
    border-color: var(
      --el-input-border-color,
      var(--el-border-color)
    ) !important;
  }

  .hiprint-option-item-field input:focus,
  select:focus,
  textarea:focus {
    outline: none; /* 先移除默认的边框 */
    border: 1.2px solid #409eff !important; /* 设置新的边框颜色 */
  }
}
</style>

<style lang="scss" scoped>
.microi-print-engine {
  .elheader {
    line-height: 60px;
    text-align: center;
    box-shadow: 0 0 5px 0 rgba(0, 0, 0, 0.1);
    margin-top: 15px;

    .leftlogo {
      span {
        font-size: 14px;
        letter-spacing: 4px;

        text-align: center;
        line-height: 1em;
        color: #409eff;
        outline: none;

        // text-shadow: 0 0 4px #409eff;
      }

      @keyframes mpe-spin {
        0% {
          transform: rotate(0deg);
        }
        100% {
          transform: rotate(360deg);
        }
      }

      .spin-icon {
        animation: mpe-spin 4s infinite linear;
        color: #409eff;
        margin-left: 10px;
      }
    }

    .popover {
      position: absolute;
      margin-top: 10px;
      z-index: 10;

      .popover-content {
        background: white;
        border-radius: 4px;
        padding: 10px 20px;
        box-shadow: 0 0 5px 0 rgba(0, 0, 0, 0.1);
      }
    }
  }
}
</style>
