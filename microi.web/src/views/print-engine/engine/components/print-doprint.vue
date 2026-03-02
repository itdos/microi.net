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
 *
 * 修复说明：
 * 1. 边框消失：hiprint 原生 hiwprint 只注入 styleHandler CSS + print-lock.css（项目中不存在），
 *    hiprint 自身 CSS 不会进入 print iframe。修复：从页面 <style> 中筛选 hiprint 相关 CSS 注入。
 * 2. 第 2 页为空：hiprint getSimpleHtml(array) 存在 hinnn._paperList 状态污染。
 *    修复：对每条数据单独调用 getHtml(item)，逐条收集，合并到同一层 wrapper。
 * 3. 背景色污染：仅收集 hiprint 相关样式，不收集 Element UI/应用布局等无关 CSS。
 * 4. 分页重叠：保持 hiprint-printTemplate > hiprint-printPanel 的扁平 DOM 结构，
 *    确保 page-break-after: always 正常生效。
 */
const doPrint = () => {
  loading.value = false
  console.log('执行浏览器打印')

  const printData = pageInfo.remoteData.PrintObj
  const dataArray = Array.isArray(printData) ? printData : [printData]

  // ── 步骤1：逐条调用 getHtml，扁平化合并到同一个 wrapper ──
  // getHtml 返回 jQuery(<div class="hiprint-printTemplate">panels...</div>)
  // 要保持 hiprint-printTemplate > hiprint-printPanel 的扁平结构（分页依赖此层级）
  const wrapper = document.createElement('div')
  wrapper.className = 'hiprint-printTemplate'
  dataArray.forEach((item) => {
    const pageEl = hiprintTemplate.getHtml(item)
    if (pageEl && pageEl.length) {
      // 取出 getHtml 返回的 hiprint-printTemplate 内部子元素（即 hiprint-printPanel），
      // 直接追加到 wrapper，避免嵌套 hiprint-printTemplate 破坏分页结构
      const children = pageEl[0].childNodes
      while (children.length > 0) {
        wrapper.appendChild(children[0])
      }
    }
  })

  // ── 步骤2：仅收集 hiprint 相关样式，避免注入应用背景色等无关 CSS ──
  let collectedStyles = ''
  document.querySelectorAll('style').forEach((styleEl) => {
    const css = styleEl.innerHTML
    // 只收集包含 hiprint 关键类名的 <style> 块
    if (
      css.indexOf('hiprint-print') > -1 ||
      css.indexOf('hiprint_') > -1 ||
      css.indexOf('.hiprintEp498') > -1
    ) {
      collectedStyles += `<style>${css}</style>\n`
    }
  })
  // 追加打印专项修复样式
  collectedStyles += `<style>
    /* 重置 body 背景防止染色 */
    html, body {
      background: #fff !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    table,
    .hiprint-printElement-tableTarget,
    .hiprint-printElement-tableTarget table {
      border-collapse: collapse !important;
      border-spacing: 0 !important;
    }
    td, th,
    .hiprint-printElement-tableTarget td,
    .hiprint-printElement-tableTarget th,
    .hiprint-printElement-table td,
    .hiprint-printElement-table th {
      border: 0.75pt solid #000 !important;
      box-sizing: border-box !important;
    }
    /* 确保分页正确 */
    .hiprint-printPaper {
      page-break-after: always;
      overflow: hidden;
    }
    .hiprint-printPanel {
      page-break-after: always;
    }
    .hiprint-printPanel .hiprint-printPaper:last-child {
      page-break-after: avoid;
    }
    .hiprint-printTemplate .hiprint-printPanel:last-child {
      page-break-after: avoid;
    }
    @media print {
      html, body { background: #fff !important; }
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      td, th,
      .hiprint-printElement-tableTarget td,
      .hiprint-printElement-tableTarget th {
        border: 0.75pt solid #000 !important;
      }
    }
  </style>`

  // ── 步骤3：构建 print iframe ──
  const oldFrame = document.getElementById('hiwprint_iframe')
  if (oldFrame) oldFrame.parentNode.removeChild(oldFrame)

  const iframe = document.createElement('iframe')
  iframe.id = 'hiwprint_iframe'
  iframe.style.cssText = 'visibility:hidden;height:0;width:0;position:absolute;'
  iframe.srcdoc = `<!DOCTYPE html><html><head><title></title><meta charset="UTF-8">${collectedStyles}</head><body style="background:#fff!important;"></body></html>`

  let fired = false
  iframe.onload = function () {
    if (fired) return
    fired = true
    const win = iframe.contentWindow || iframe.contentDocument
    const doc = win.document ? win.document : win
    doc.body.innerHTML = wrapper.outerHTML
    // 等待图片等资源加载后再触发打印
    setTimeout(() => {
      try { win.focus() } catch (e) { /* ignore */ }
      try {
        if (win.StyleMedia) {
          doc.execCommand('print', false, null)
        } else {
          win.print()
        }
      } catch (e) {
        win.print()
      }
      console.log('浏览器打印窗口已打开')
    }, 300)
  }

  document.body.appendChild(iframe)
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
      // 智能提取打印数据：
      // 支持以下 API 响应格式：
      //   1. 直接数组: [{...}, {...}]  → 批量打印，每项一页
      //   2. 包装对象: {Code:1, Data:[{...},{...}]} → 提取 Data 字段
      //   3. 包装对象: {Code:1, Data:{...}}         → 提取 Data 字段（单条）
      //   4. 普通对象: {...}                         → 直接使用（单条）
      let printData = response
      if (!Array.isArray(response) && response !== null && typeof response === 'object') {
        // 常见接口包装格式：取 Data / data / list / rows 字段
        const dataField = response.Data ?? response.data ?? response.list ?? response.rows ?? null
        if (dataField !== null && dataField !== undefined) {
          printData = dataField
        }
      }
      console.log('[PrintEngine] API 返回数据条数:', Array.isArray(printData) ? printData.length : 1, printData)
      pageInfo.remoteData.PrintObj = printData //替换动态数据源
      buildDesigner()
      nextTick(() => {
        setTimeout(doPrint, 1000) // 1秒后执行打印
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
