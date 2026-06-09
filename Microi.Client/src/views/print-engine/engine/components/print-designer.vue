<template>
  <div class="microi-print-engine">
    <!-- 顶部工具栏 -->
    <div class="mpe-toolbar">
      <div class="mpe-toolbar__left">
        <div class="mpe-brand">
          <div class="mpe-brand-icon">
            <el-icon class="mpe-brand-spin" :size="18"><Tools /></el-icon>
          </div>
          <span class="mpe-brand-text">{{ pageInfo.setting.title }}</span>
        </div>
      </div>
      <div class="mpe-toolbar__center">
        <div class="mpe-btn-group">
          <button class="mpe-btn" @click.stop="undo" title="撤销 (Ctrl+Z)">
            <el-icon :size="15"><Back /></el-icon>
            <span>撤销</span>
          </button>
          <button class="mpe-btn" @click.stop="redo" title="重做 (Ctrl+Y)">
            <el-icon :size="15"><Right /></el-icon>
            <span>重做</span>
          </button>
        </div>
        <div class="mpe-divider-v"></div>
        <div class="mpe-btn-group">
          <button class="mpe-btn" @click.stop="rotatePaper" title="旋转纸张">
            <el-icon :size="15"><RefreshRight /></el-icon>
            <span>旋转</span>
          </button>
          <el-popconfirm width="200" confirm-button-text="确定" cancel-button-text="再想想" title="您确定要清空纸张吗?" @confirm="clearPaper">
            <template #reference>
              <button class="mpe-btn" title="清空纸张">
                <el-icon :size="15"><Delete /></el-icon>
                <span>清空</span>
              </button>
            </template>
          </el-popconfirm>
          <button class="mpe-btn" @click.stop="exportJson" title="导出JSON">
            <el-icon :size="15"><Memo /></el-icon>
            <span>JSON</span>
          </button>
          <el-popconfirm width="200" confirm-button-text="确定" cancel-button-text="再想想" title="加载模拟数据会覆盖当前纸张,您确定操作吗?" @confirm="loadMockData">
            <template #reference>
              <button class="mpe-btn" title="加载模板">
                <el-icon :size="15"><Star /></el-icon>
                <span>模板</span>
              </button>
            </template>
          </el-popconfirm>
          <button class="mpe-btn" @click.stop="showDataDialog" title="数据管理">
            <el-icon :size="15"><Tickets /></el-icon>
            <span>数据</span>
          </button>
        </div>
        <div class="mpe-divider-v"></div>
        <div class="mpe-btn-group">
          <button class="mpe-btn mpe-btn--success" @click.stop="getHtml" title="预览">
            <el-icon :size="15"><Monitor /></el-icon>
            <span>预览</span>
          </button>
          <button class="mpe-btn mpe-btn--primary" @click.stop="doPrint" title="浏览器打印">
            <el-icon :size="15"><Printer /></el-icon>
            <span>打印</span>
          </button>
          <el-popconfirm class="box-item" title="确定直接打印吗?" placement="top-start" @confirm="onlyPrint2" confirm-button-text="确定" cancel-button-text="取消">
            <template #reference>
              <button class="mpe-btn mpe-btn--primary" title="直接打印">
                <el-icon :size="15"><Printer /></el-icon>
                <span>直接打印</span>
              </button>
            </template>
          </el-popconfirm>
        </div>
      </div>
      <div class="mpe-toolbar__right">
        <button class="mpe-btn mpe-btn--warning" @click.stop="saveFormData" title="保存模板">
          <el-icon :size="15"><Collection /></el-icon>
          <span>保存</span>
        </button>
      </div>
    </div>

    <!-- 主体区域 -->
    <div class="mpe-body">
      <!-- 左侧组件面板 -->
      <div class="mpe-sidebar mpe-sidebar--left">
        <div class="mpe-sidebar__header">
          <el-tabs v-model="pageInfo.setting.activeName" class="mpe-tabs">
            <el-tab-pane name="first">
              <template #label>
                <span class="mpe-tab-label">
                  <el-icon :size="14"><Rank /></el-icon>
                  基础组件
                </span>
              </template>
            </el-tab-pane>
            <el-tab-pane name="second">
              <template #label>
                <span class="mpe-tab-label">
                  <el-icon :size="14"><Cpu /></el-icon>
                  扩展组件
                </span>
              </template>
            </el-tab-pane>
          </el-tabs>
        </div>
        <div class="mpe-sidebar__body">
          <div v-show="pageInfo.setting.activeName === 'first'" ref="providerContainer1" class="container custom-style-types"></div>
          <div v-show="pageInfo.setting.activeName === 'second'" ref="providerContainer2" class="container custom-style-types"></div>
        </div>
      </div>

      <!-- 中间设计区域 -->
      <div class="mpe-canvas-wrapper">
        <!-- 纸张/缩放工具条 -->
        <div class="mpe-canvas-toolbar">
          <div class="mpe-paper-btns">
            <template v-for="(value, type) in paperTypes" :key="type">
              <button class="mpe-paper-btn" :class="{ 'mpe-paper-btn--active': curPaperType === type }" @click="setPaper(type, value)">{{ type }}</button>
            </template>
            <button class="mpe-paper-btn" @click="showPaperPop">自定义</button>
          </div>
          <div class="mpe-popover-anchor">
            <div class="mpe-popover" v-show="paperPopVisible">
              <div class="mpe-popover__title">设置纸张宽高(mm)</div>
              <div class="mpe-popover__row">
                <el-input size="small" v-model="paperWidth" placeholder="宽(mm)" />
                <span class="mpe-popover__sep">×</span>
                <el-input size="small" v-model="paperHeight" placeholder="高(mm)" />
              </div>
              <div class="mpe-popover__actions">
                <el-button size="small" type="primary" @click.stop="setPaperOther">确定</el-button>
                <el-button size="small" @click.stop="paperPopVisible = false">取消</el-button>
              </div>
            </div>
          </div>
          <div class="mpe-zoom-ctrl">
            <el-icon class="mpe-zoom-btn" @click="changeScale(false)" :size="16"><ZoomOut /></el-icon>
            <span class="mpe-zoom-value">{{ (scaleValue * 100).toFixed(0) }}%</span>
            <el-icon class="mpe-zoom-btn" @click="changeScale(true)" :size="16"><ZoomIn /></el-icon>
          </div>
          <div class="hiprint-printPagination"></div>
        </div>
        <!-- 设计器画布 -->
        <div class="mpe-canvas">
          <div ref="hiprintPrintContainer"></div>
        </div>
      </div>

      <!-- 右侧属性面板 -->
      <div class="mpe-sidebar mpe-sidebar--right">
        <div class="mpe-sidebar__header">
          <div class="mpe-panel-title">
            <el-icon :size="14"><Operation /></el-icon>
            <span>属性面板</span>
          </div>
        </div>
        <div class="mpe-sidebar__body">
          <el-form label-position="top" class="mpe-prop-form">
            <el-form-item label="模板编号">
              <el-input disabled v-model="pageInfo.remoteData.Number" placeholder="" size="small"></el-input>
            </el-form-item>
            <el-form-item label="模板标题">
              <el-input v-model="pageInfo.remoteData.Title" placeholder="" size="small"></el-input>
            </el-form-item>
            <el-form-item label="模板简介">
              <el-input v-model="pageInfo.remoteData.Desc" placeholder="" type="textarea" :rows="2" size="small"></el-input>
            </el-form-item>
            <el-form-item label="接口引擎">
              <el-select
                v-model="selectedApiEngineId"
                placeholder="选择接口引擎快速填充"
                size="small"
                filterable
                clearable
                style="width: 100%"
                @change="onApiEngineChange"
              >
                <el-option
                  v-for="item in apiEngineList"
                  :key="item.Id"
                  :label="item.ApiName + ' (' + item.ApiEngineKey + ')'"
                  :value="item.Id"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="数据接口">
              <el-input v-model="pageInfo.remoteData.DataApi" placeholder="请输入动态数据webapi接口地址" type="textarea" :rows="2" size="small"></el-input>
            </el-form-item>
          </el-form>
          <div class="mpe-element-options">
            <div id="PrintElementOptionSetting"></div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <print-preview ref="previewDialog" />

  <el-drawer size="50%" title="页面数据" v-model="pageInfo.pageDialog" direction="ltr">
    <el-form>
      <el-form-item label="">
        <JsonEditor v-if="pageInfo.pageDialog" height="600px" v-model="pageInfo.pageStr" :option="jsonEditorOption" />
      </el-form-item>
    </el-form>
  </el-drawer>

  <el-drawer size="50%" title="动态数据" v-model="pageInfo.dataDialog" direction="ltr" @closed="updateData">
    <el-form>
      <el-form-item label="">
        <el-button @click="getDataTemp">查看动态数据JSON结构</el-button>
      </el-form-item>
      <el-form-item label="">
        <JsonEditor v-if="pageInfo.dataDialog" height="600px" v-model="pageInfo.printStr" :option="jsonEditorOption" />
      </el-form-item>
    </el-form>
  </el-drawer>

  <!-- 代码编辑器弹窗 (用于增强hiprint函数类配置项) -->
  <el-dialog
    v-model="codeEditorState.visible"
    :title="'编辑代码 - ' + codeEditorState.fieldName"
    width="70%"
    top="5vh"
    destroy-on-close
    append-to-body
    @closed="onCodeEditorClosed"
  >
    <DiyCodeEditor
      v-if="codeEditorState.visible"
      v-model="codeEditorState.code"
      :field="{
        Name: codeEditorState.fieldName,
        Component: 'CodeEditor',
        Config: { CodeEditor: { Language: 'javascript', Theme: 'vs-dark' } }
      }"
      :FormMode="'Edit'"
      height="500px"
    />
    <template #footer>
      <el-button @click="codeEditorState.visible = false">取 消</el-button>
      <el-button type="primary" @click="saveCodeEditorValue">确 定</el-button>
    </template>
  </el-dialog>
</template>

<script setup name="print-designer">
import {
  onMounted,
  onBeforeUnmount,
  ref,
  getCurrentInstance,
  reactive,
  nextTick,
  defineAsyncComponent,
} from 'vue'
import { ElMessage, ElNotification } from 'element-plus'
import { hiprint } from 'vue-plugin-hiprint'
import { DiyCommon } from '@/utils/diy.common'
import { buildDefaultRemoteData } from '../utils/util.js'
import { EventBus } from '../utils/eventBus.js'
import { usePrintEngineStore } from '../stores/printEngine'
import { get } from '../utils/axiosInstance'
import { useDark, useToggle } from '@vueuse/core'
import { isObjectOrArray } from '../utils/util'
const printEngineStore = usePrintEngineStore()

import {
  Moon,
  Sunny,
  ZoomOut,
  ZoomIn,
  RefreshRight,
  Brush,
  Monitor,
  Tickets,
  Printer,
  Operation,
  Rank,
  Cpu,
  Memo,
  Collection,
  Clock,
  Delete,
  Star,
  Back,
  Right,
  Tools,
} from '@element-plus/icons-vue'

//预览组件
import printPreview from './print-preview.vue'

//拖拽元素集合
import { provider1 } from '../utils/provider1'
import { provider2 } from '../utils/provider2'

//模拟页面数据
import pageData from '../mock/template'
//模拟打印数据
import printData from '../mock/printData'

// 组合式函数 hooks
import { usePaper } from '../hooks/use-paper'
import { useZoom } from '../hooks/use-zoom'

// 工具
import { newHiprintPrintTemplate, removeHiprintPrintTemplate } from '../utils/template-helper'
import { normalizePrintTablePagination } from '../utils/print-pagination.js'

// json编辑器
import JsonEditor from 'ceel-json-editor'
import 'jsoneditor/dist/jsoneditor.css'

// 代码编辑器 (异步加载)
const DiyCodeEditor = defineAsyncComponent(() =>
  import('@/views/form-engine/diy-field-component/diy-code-editor.vue')
)

//是否暗黑模式
const isDark = useDark()
isDark.value = false

const jsonEditorOption = {
  mode: 'code',
  onChange: (v) => {
    console.log(v)
  },
}

const props = defineProps({
  remoteObj: {
    type: Object,
  },
})

//页面配置信息
const pageInfo = reactive({
  setting: {
    title: '打印引擎',
    version: 'V1.0.0',
    activeName: 'first', //选项卡索引
  },
  pageStr: '', //页面数据字符串
  pageDialog: false, //查看Json
  printStr: '', //打印数据字符串
  dataDialog: false,
  //模拟数据
  mockData: {
    pageJson: pageData,
    printJson: printData,
  },
  //整体数据,格式参考/utils.js buildDefaultRemoteData方法
  remoteData: {},
})

// 存储模板对象的 key
const TEMPLATE_KEY = getCurrentInstance().type.name

//纸张hooks
const {
  paperTypes,
  curPaperType,
  paperPopVisible,
  paperWidth,
  paperHeight,
  showPaperPop,
  setPaper,
  setPaperOther,
} = usePaper(TEMPLATE_KEY)

//缩放hooks
const { scaleValue, changeScale } = useZoom(TEMPLATE_KEY)

//中转服务
const nodeTransition = {
  isOpen: false, // 中转服务开关
  serverUrl: 'http://localhost:17521', // 服务器地址 //'https://v5.printjs.cn:17521'
  serverToken: 'hiprint*', //服务器TOKEN
  mac: '00:15:5d:f9:ef:0b', // 模拟mac地址
  printer: 'Microsoft Print to PDF', //打印机名称
}
//如果开启中转服务，采用默认地址
if (nodeTransition.isOpen) {
  nodeTransition.serverUrl = 'https://v5.printjs.cn:17521'
}

// 初始化 provider
hiprint.init({
  host: nodeTransition.serverUrl, // 可在此处设置连接地址与端口号
  token: nodeTransition.serverToken, // 可在此处设置连接 token 可缺省
  providers: [provider1(), provider2()],
})

//加载页面数据
const loadRemoteData = async () => {
  pageInfo.remoteData = buildDefaultRemoteData() //默认渲染初始数据
}
loadRemoteData()

// 接口引擎列表
const apiEngineList = ref([])
const loadApiEngines = async () => {
  try {
    const res = await DiyCommon.FormEngine.GetTableData('sys_apiengine', {
      _SelectFields: ['Id', 'ApiName', 'ApiEngineKey', 'IsEnable'],
      _Where: [['IsEnable', '=', 1]],
      _PageSize: 500,
      _OrderBy: 'ApiName',
    })
    if (res.Code === 1) {
      apiEngineList.value = res.Data || []
    }
  } catch (e) {
    console.error('[PrintEngine] 加载接口引擎列表失败:', e)
  }
}
const selectedApiEngineId = ref(null)
const onApiEngineChange = (val) => {
  if (!val) return
  const engine = apiEngineList.value.find(item => item.Id === val)
  if (engine) {
    // 用接口引擎的地址填充数据接口输入框
    pageInfo.remoteData.DataApi = engine.ApiAddress || ('/apiengine/' + engine.ApiEngineKey)
  }
}
loadApiEngines()

// ═══════════════════════════════
// 代码编辑器增强 (替换hiprint函数类textarea)
// ═══════════════════════════════
// hiprint 函数字段的中文标签关键词（用于识别函数类 textarea）
const FUNC_LABEL_KEYWORDS = /格式化|样式|渲染|合并|聚合|onRendered/

const codeEditorState = reactive({
  visible: false,
  fieldName: '',
  code: '',
  targetTextarea: null,
})

let optionObserver = null

const openCodeEditor = (textarea, fieldName) => {
  codeEditorState.targetTextarea = textarea
  codeEditorState.fieldName = fieldName
  codeEditorState.code = textarea.value || ''
  codeEditorState.visible = true
}

const saveCodeEditorValue = () => {
  if (codeEditorState.targetTextarea) {
    const textarea = codeEditorState.targetTextarea
    // 使用 jQuery 触发以兼容 hiprint 的事件监听
    if (window.$ || window.jQuery) {
      const $ = window.$ || window.jQuery
      $(textarea).val(codeEditorState.code).trigger('change')
    } else {
      // 回退：原生方式
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype, 'value'
      ).set
      nativeInputValueSetter.call(textarea, codeEditorState.code)
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
      textarea.dispatchEvent(new Event('change', { bubbles: true }))
    }
  }
  codeEditorState.visible = false
}

const onCodeEditorClosed = () => {
  codeEditorState.targetTextarea = null
  codeEditorState.fieldName = ''
  codeEditorState.code = ''
}

/**
 * 判断一个 textarea 是否是 hiprint 的函数配置项
 * hiprint 的函数 textarea 特征：class="auto-submit", style含height:80px, 父级label含函数关键词
 */
const isFuncTextarea = (textarea) => {
  if (!textarea.classList.contains('auto-submit')) return null
  const row = textarea.closest('.hiprint-option-item-row') || textarea.closest('.hiprint-option-item')
  if (!row) return null
  const label = row.querySelector('.hiprint-option-item-label')
  if (!label) return null
  const labelText = label.textContent.trim()
  if (FUNC_LABEL_KEYWORDS.test(labelText)) return labelText
  // 也检查 placeholder 是否包含 function 关键字
  const placeholder = textarea.getAttribute('placeholder') || ''
  if (placeholder.startsWith('function')) return labelText || '函数'
  return null
}

const enhanceTextarea = (textarea) => {
  if (textarea.dataset.codeEnhanced) return

  const labelText = isFuncTextarea(textarea)
  if (!labelText) return

  textarea.dataset.codeEnhanced = 'true'

  // 创建编辑按钮
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'mpe-code-edit-btn'
  btn.innerHTML = '<svg viewBox="0 0 1024 1024" width="14" height="14" style="vertical-align:-2px;margin-right:4px;fill:currentColor"><path d="M149.6 904.8h64.8l534.4-534.4-64.8-64.8-534.4 534.4v64.8zm-80 80v-113.6l614.4-614.4 113.6 113.6-614.4 614.4H69.6zm693.2-693.2l-48-48 50.4-50.4c13.2-13.2 34.8-13.2 48 0l0.8 0.8c13.2 13.2 13.2 34.8 0 48l-51.2 49.6z"/></svg>编辑代码'
  btn.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    openCodeEditor(textarea, labelText)
  })

  // 插入到 textarea 后面
  textarea.parentNode.insertBefore(btn, textarea.nextSibling)
}

const enhanceAllTextareas = (root) => {
  root.querySelectorAll('textarea.auto-submit').forEach(enhanceTextarea)
}

const setupOptionObserver = () => {
  const container = document.getElementById('PrintElementOptionSetting')
  if (!container) return

  // 增强已存在的 textarea
  enhanceAllTextareas(container)

  // 监听未来添加的 textarea（hiprint 在点击元素时会重新渲染整个 option panel）
  optionObserver = new MutationObserver(() => {
    // 使用 requestAnimationFrame 合并频繁的 DOM 变化
    requestAnimationFrame(() => enhanceAllTextareas(container))
  })
  optionObserver.observe(container, { childList: true, subtree: true })
}

/**
 * 构建左侧可拖拽元素
 * 注意: 可拖拽元素必须在 hiprint.init() 之后调用
 */
const providerContainer1 = ref(null)
const providerContainer2 = ref(null)
const buildLeftElement = () => {
  // ----- providerModule1 -----
  hiprint.PrintElementTypeManager.build(
    providerContainer1.value,
    'providerModule1'
  )
  // ----- providerModule2 -----
  hiprint.PrintElementTypeManager.build(
    providerContainer2.value,
    'providerModule2'
  )
}

/**
 * 构建设计器
 * 注意: 必须要在 onMounted 中去构建
 * 因为都是把元素挂载到对应容器中, 必须要先找到该容器
 */
let hiprintTemplate

//设计器容器
const hiprintPrintContainer = ref(null)

const buildDesigner = () => {
  hiprintPrintContainer.value.innerHTML = '' // 先清空, 避免重复构建

  hiprintTemplate = newHiprintPrintTemplate(TEMPLATE_KEY, {
    template: pageInfo.remoteData.PageObj, // 页面对象json(object)
    settingContainer: '#PrintElementOptionSetting', // 元素参数容器
    paginationContainer: '.hiprint-printPagination',
    defaultPanelName: '默认面板名称',
    history: true, // 启用撤销/重做功能
    onDataChanged: (type, json) => {
      console.log('[PrintEngine] 模板变更:', type)
    },
    onPanelAddClick: (panel, createPanel) => {
      panel.name = '新面板' + (panel.index + 1)

      createPanel(panel)

      ElNotification({
        title: panel.name,
        message: '新面板创建成功',
        type: 'success',
      })
    },
  })
  // 构建 并填充到 容器中
  hiprintTemplate.design(hiprintPrintContainer.value, { grid: true })
}

//加载模拟数据
const loadMockData = async () => {
  //模拟数据
  pageInfo.remoteData.PageObj = pageInfo.mockData.pageJson
  pageInfo.remoteData.PrintObj = pageInfo.mockData.printJson

  // 构建设计器
  buildDesigner()
}

//打开动态数据
const showDataDialog = () => {
  if (
    pageInfo.remoteData.PrintObj &&
    typeof pageInfo.remoteData.PrintObj === 'string'
  ) {
    pageInfo.remoteData.PrintObj = JSON.parse(pageInfo.remoteData.PrintObj)
  }
  pageInfo.printStr = JSON.stringify(pageInfo.remoteData.PrintObj, null, '  ')
  nextTick(() => {
    pageInfo.dataDialog = true
  })
}
//更新动态数据
const updateData = () => {
  pageInfo.remoteData.PrintObj = JSON.parse(pageInfo.printStr)
}

/**
 * 浏览器打印（同 print-doprint.vue 的修复逻辑）
 * 修复：边框消失 / 多条数据第2页为空 / 背景色污染 / 分页内容重叠
 */
const doPrint = () => {
  const printData = pageInfo.remoteData.PrintObj
  const dataArray = Array.isArray(printData) ? printData : [printData]

  // 逐条调用 getHtml，子元素扁平追加（保持分页层级结构正确）
  const wrapper = document.createElement('div')
  wrapper.className = 'hiprint-printTemplate'
  dataArray.forEach((item) => {
    const pageEl = hiprintTemplate.getHtml(item)
    if (pageEl && pageEl.length) {
      const children = pageEl[0].childNodes
      while (children.length > 0) {
        wrapper.appendChild(children[0])
      }
    }
  })

  // 仅收集 hiprint 相关样式，避免注入应用背景色等无关 CSS
  let collectedStyles = ''
  document.querySelectorAll('style').forEach((s) => {
    const css = s.innerHTML
    if (css.indexOf('hiprint-print') > -1 || css.indexOf('hiprint_') > -1 || css.indexOf('.hiprintEp498') > -1) {
      collectedStyles += `<style>${css}</style>\n`
    }
  })
  collectedStyles += `<style>
    @page {
      margin: 0;
    }
    html, body { background: #fff !important; margin: 0 !important; padding: 0 !important; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
    table, .hiprint-printElement-tableTarget, .hiprint-printElement-tableTarget table {
      border-collapse: collapse !important; border-spacing: 0 !important;
    }
    td, th,
    .hiprint-printElement-tableTarget td, .hiprint-printElement-tableTarget th,
    .hiprint-printElement-table td, .hiprint-printElement-table th {
      border: 0.75pt solid #000 !important; box-sizing: border-box !important;
    }
    .hiprint-printPaper { page-break-after: always; overflow: hidden; }
    .hiprint-printPanel { page-break-after: always; }
    .hiprint-printPanel .hiprint-printPaper:last-child { page-break-after: avoid; }
    .hiprint-printTemplate .hiprint-printPanel:last-child { page-break-after: avoid; }
    @media print {
      html, body { background: #fff !important; }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      td, th, .hiprint-printElement-tableTarget td, .hiprint-printElement-tableTarget th {
        border: 0.75pt solid #000 !important;
      }
    }
  </style>`

  const oldFrame = document.getElementById('hiwprint_iframe')
  if (oldFrame) oldFrame.parentNode.removeChild(oldFrame)
  const iframe = document.createElement('iframe')
  iframe.id = 'hiwprint_iframe'
  iframe.style.cssText = 'visibility:hidden;position:absolute;left:-10000px;top:0;width:297mm;height:210mm;border:0;'
  iframe.srcdoc = `<!DOCTYPE html><html><head><title></title><meta charset="UTF-8">${collectedStyles}</head><body style="background:#fff!important;"></body></html>`
  let fired = false
  iframe.onload = function () {
    if (fired) return
    fired = true
    const win = iframe.contentWindow || iframe.contentDocument
    const doc = win.document ? win.document : win
    doc.body.innerHTML = wrapper.outerHTML
    setTimeout(() => {
      normalizePrintTablePagination(doc)
      // Force layout after moving rows, then give Chrome print preview a tick
      // to capture the normalized DOM instead of a boundary-clipped layout.
      void doc.body.offsetHeight
      setTimeout(() => {
        try { win.focus() } catch (e) { /* ignore */ }
        try {
          if (win.StyleMedia) { doc.execCommand('print', false, null) } else { win.print() }
        } catch (e) { win.print() }
        console.log('浏览器打印窗口已打开')
      }, 80)
    }, 300)
  }
  document.body.appendChild(iframe)
}

//获取打印客户端
function getClientByMac(data) {
  for (const key in data) {
    if (data.hasOwnProperty(key)) {
      const client = data[key]
      if (client.mac === nodeTransition.mac) {
        return { key, client }
      }
    }
  }
  return null
}

//直接打印
const onlyPrint2 = () => {
  if (window.hiwebSocket.opened) {
    let dataType = isObjectOrArray(pageInfo.remoteData.PrintObj)
    console.log('直接打印', hiwebSocket)

    // 是否开启中转服务
    if (nodeTransition.isOpen) {
      const { key, client } = getClientByMac(hiwebSocket.clients)
      console.log('打印机列表', client.printerList)
      // 调用浏览器打印(是否启用中转服务，启用自行配置)
      hiprintTemplate.print2(pageInfo.remoteData.PrintObj, {
        client: key,
        printer: nodeTransition.printer,
        title: '直接打印',
        printByFragments: dataType === 'array' ? true : false, // 是否需要分批打印，分批打印能够支持连续打印大量数据，但会增加打印所需时间
      })
    } else {
      hiprintTemplate.print2(pageInfo.remoteData.PrintObj, {
        title: '直接打印',
        printByFragments: dataType === 'array' ? true : false, // 是否需要分批打印，分批打印能够支持连续打印大量数据，但会增加打印所需时间
      })
    }

    // 先移除旧监听再添加，避免事件监听累积
    hiprintTemplate.off && hiprintTemplate.off('printSuccess')
    hiprintTemplate.on('printSuccess', function () {
      ElNotification({
        title: '打印回调',
        message: '打印成功',
        type: 'success',
      })
    })
    return
  } else {
    ElNotification({
      title: '客户端未连接',
      message: '连接【' + window.hiwebSocket.host + '】失败！',
      type: 'error',
    })
  }
}

//打印组件
const previewDialog = ref(null)
/**
 * 获取预览html
 */
const getHtml = () => {
  let html = hiprintTemplate.getHtml(pageInfo.remoteData.PrintObj)
  previewDialog.value.showModal(html)
}

// ----------------- 模板对象 api 部分 -----------------

//旋转纸张
const rotatePaper = () => {
  hiprintTemplate.rotatePaper()

  ElMessage({
    message: '纸张已旋转',
    type: 'success',
  })
}

//清空所有元素
const clearPaper = () => {
  hiprintTemplate.clear()
  pageInfo.remoteData.PrintObj = {}
  // localStorage.removeItem(pageInfo.remoteData.Id)
}

//获取页面Json
const exportJson = () => {
  let json = hiprintTemplate.getJson()
  pageInfo.pageStr = JSON.stringify(json, null, '  ')
  pageInfo.pageDialog = true
}

//从页面json配置提取数据源格式
const getDataTemp = () => {
  //获取页面json
  let json = hiprintTemplate.getJson()
  let printElements = json.panels[0].printElements //元素集合

  let fields = {}
  printElements.forEach(function (item) {
    if (item.printElementType.type === 'table' && 'field' in item.options) {
      let tableFields = item.options.columns[0].map((item) => ({
        [item.field]: '',
      }))

      const result = tableFields.reduce((acc, item) => {
        Object.keys(item).forEach((key) => {
          acc[key] = item[key]
        })
        return acc
      }, {})
      if (item.options.field) {
        fields[item.options.field] = [result]
      }
    } else {
      if ('field' in item.options) {
        if (item.options.field) {
          fields[item.options.field] = ''
        }
      }
    }
  })
  pageInfo.printStr = JSON.stringify(fields, null, '  ')
}

// ----------------- 自定义业务逻辑处理 -----------------

// 撤销/重做
const undo = () => {
  hiprintTemplate && hiprintTemplate.undo && hiprintTemplate.undo()
}
const redo = () => {
  hiprintTemplate && hiprintTemplate.redo && hiprintTemplate.redo()
}

//动态加载数据接口
const loadDataApi = async (url) => {
  try {
    const response = await get(url || pageInfo.remoteData.DataApi, {})
    if (response) {
      pageInfo.remoteData.PrintObj = response //替换动态数据源
      buildDesigner()
    }
  } catch (error) {
    console.error('[PrintEngine] 加载数据接口失败:', error)
    ElMessage.error('加载数据接口失败')
  }
}

let messageHandler = null
// 键盘快捷键处理
const keyboardHandler = (e) => {
  // Ctrl+Z 撤销 / Ctrl+Y 重做 / Ctrl+S 保存
  if (e.ctrlKey || e.metaKey) {
    if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
    if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); redo() }
    if (e.key === 's') { e.preventDefault(); saveFormData() }
  }
}
/**
 * 这里必须要在 onMounted 中去构建 左侧可拖拽元素 或者 设计器
 * 因为都是把元素挂载到对应容器中, 必须要先找到该容器
 */
onMounted(async () => {
  //构建左侧可拖拽元素
  buildLeftElement()

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
    // 安全修复：限定同源，避免外部 origin 注入 token
    try {
      if (event.origin && event.origin !== window.location.origin && event.origin !== 'null') {
        return
      }
    } catch (e) { return }
    let receivedData = event.data
    let token = receivedData?.iframeToken
    if (token) {
      console.log('页面引擎已接收到token,一切正常')
      printEngineStore.setToken(token)
    }

    // 父窗体有传数据过来
    let iframeFormData = receivedData?.iframeFormData
    if (iframeFormData) {
      try {
        pageInfo.remoteData = JSON.parse(iframeFormData)
      } catch (e) {
        console.warn('[print-designer] iframeFormData JSON 解析失败：', e && e.message)
        return
      }

      if (
        pageInfo.remoteData.PrintObj &&
        typeof pageInfo.remoteData.PrintObj === 'string'
      ) {
        try {
          pageInfo.remoteData.PrintObj = JSON.parse(pageInfo.remoteData.PrintObj)
        } catch (e) {
          console.warn('[print-designer] PrintObj JSON 解析失败：', e && e.message)
          pageInfo.remoteData.PrintObj = null
        }
      }
      buildDesigner() //重新builder

      //如果动态api数据接口存在,则重新读一遍
      if (pageInfo.remoteData.DataApi) {
        loadDataApi(pageInfo.remoteData.DataApi)
      }
    }
  }

  //接收父窗体跨域token
  window.addEventListener('message', messageHandler)
  // 注册键盘快捷键
  window.addEventListener('keydown', keyboardHandler)
  // 启动代码编辑器增强 (监听hiprint函数textarea)
  nextTick(() => setupOptionObserver())
})

onBeforeUnmount(() => {
  console.log('销毁')
  // 取消监听事件
  window.removeEventListener('message', messageHandler)
  window.removeEventListener('keydown', keyboardHandler)
  // 清理代码编辑器观察器
  if (optionObserver) {
    optionObserver.disconnect()
    optionObserver = null
  }
  // 清理打印模板，释放内存
  removeHiprintPrintTemplate(TEMPLATE_KEY)
  hiprintTemplate = null
  // 清理打印 iframe
  const oldFrame = document.getElementById('hiwprint_iframe')
  if (oldFrame) oldFrame.parentNode.removeChild(oldFrame)
})

//保存页面数据
const saveFormData = async () => {
  let tempData = {
    Id: pageInfo.remoteData.Id,
    Title: pageInfo.remoteData.Title,
    Number: pageInfo.remoteData.Number,
    Desc: pageInfo.remoteData.Desc,
    DataApi: pageInfo.remoteData.DataApi,
    PageObj: hiprintTemplate.getJson(),
    PrintObj: pageInfo.remoteData.PrintObj,
  }

  // [组件集成] 平台将使用事件总线形式来实现穿透交互.
  EventBus.emit('savePrintJson', tempData)

  // [iframe] 通过 postMessage 方式向父窗口通信
  const dataToSend = JSON.stringify(tempData)
  window.parent.postMessage({ key: 'savePrintJson', value: dataToSend }, '*')

  ElMessage({
    message: '保存成功',
    type: 'success',
  })

  console.log('savePrintJson', JSON.stringify(tempData, null, '  '))
}
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
      padding: 0;
      list-style: none;

      > li {
        .title {
          display: block;
          padding: 6px 0 4px;
          clear: both;
          margin-bottom: 8px;
          font-size: 12px;
          font-weight: 600;
          color: #606266;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          border-bottom: 1px solid #f0f0f0;
        }
      }

      ul {
        padding: 0;
        display: flex;
        flex-wrap: wrap;
        list-style: none;
        gap: 6px;
        margin-bottom: 6px;

        li {
          width: calc(50% - 3px);
          max-width: none;
          float: none;

          a {
            padding: 8px 8px;
            text-decoration: none;
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: flex-start;
            text-align: left;
            box-sizing: border-box;
            border: 1px solid #e4e7ed;
            border-radius: 8px;
            font-size: 12px !important;
            color: #606266;
            background: #fafafa;
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            cursor: move;
            gap: 6px;

            &::before {
              flex-shrink: 0;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              width: 20px;
              height: 20px;
              font-size: 13px;
              border-radius: 4px;
              background: linear-gradient(135deg, rgba(102, 126, 234, 0.12) 0%, rgba(118, 75, 162, 0.12) 100%);
              color: #667eea;
              transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            }

            &:hover {
              color: #fff;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              border-color: transparent;
              box-shadow: 0 4px 12px rgba(102, 126, 234, 0.35);
              transform: translateY(-1px);

              &::before {
                background: rgba(255, 255, 255, 0.2);
                color: #fff;
              }
            }
          }
        }
      }
    }

    /* ===== Provider1 基础组件图标 ===== */
    /* 表格/文本 */
    a[tid="providerModule1.customText"]::before { content: "T"; font-weight: 700; }
    a[tid="providerModule1.customText1"]::before { content: "⚿"; }
    a[tid="providerModule1.longText"]::before { content: "¶"; }
    a[tid="providerModule1.html"]::before { content: "⬚"; }
    a[tid="providerModule1.table"]::before { content: "⊞"; }
    a[tid="providerModule1.image"]::before { content: "🖼"; font-size: 12px; }
    a[tid="providerModule1.barcode"]::before { content: "⦀"; font-weight: 700; letter-spacing: -2px; }
    a[tid="providerModule1.qrcode"]::before { content: "⊟"; }

    /* 辅助/图形 */
    a[tid="providerModule1.hline"]::before { content: "─"; }
    a[tid="providerModule1.vline"]::before { content: "│"; }
    a[tid="providerModule1.rect"]::before { content: "▭"; }
    a[tid="providerModule1.oval"]::before { content: "◯"; }

    /* 高级 */
    a[tid="providerModule1.emptyTable"]::before { content: "⊞"; }
    a[tid="providerModule1.customText"]::before { content: "✎"; }
    a[tid="providerModule1.barcodeSvg"]::before { content: "⦀"; font-weight: 700; }
    a[tid="providerModule1.qrcodeSvg"]::before { content: "⊟"; }

    /* ===== Provider2 扩展组件图标 ===== */
    /* 常规 */
    a[tid="providerModule2.header"]::before { content: "H"; font-weight: 700; }
    a[tid="providerModule2.type"]::before { content: "☰"; }
    a[tid="providerModule2.order"]::before { content: "#"; font-weight: 700; }
    a[tid="providerModule2.date"]::before { content: "📅"; font-size: 12px; }
    a[tid="providerModule2.platform"]::before { content: "⚑"; }
    a[tid="providerModule2.bindingline"]::before { content: "⋮"; font-weight: 700; }
    a[tid="providerModule2.iframe"]::before { content: "⧉"; }

    /* 客户 */
    a[tid="providerModule2.khname"]::before { content: "👤"; font-size: 12px; }
    a[tid="providerModule2.tel"]::before { content: "📞"; font-size: 12px; }
    a[tid="providerModule2.address"]::before { content: "📍"; font-size: 12px; }

    /* 财务 */
    a[tid="providerModule2.amount"]::before { content: "¥"; font-weight: 700; }
    a[tid="providerModule2.amountUpper"]::before { content: "壹"; font-size: 11px; }
    a[tid="providerModule2.taxRate"]::before { content: "%"; font-weight: 700; }

    /* 签章 */
    a[tid="providerModule2.signLine"]::before { content: "✍"; }
    a[tid="providerModule2.sealImage"]::before { content: "㊞"; }
    a[tid="providerModule2.dateLine"]::before { content: "📆"; font-size: 12px; }
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
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
    height: 18pt !important;
    width: 18pt !important;
    border-radius: 4px;
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
    font-size: 12px !important;
    margin-bottom: 8px !important;
    color: #909399;
    font-weight: 500;
  }

  .el-drawer__header {
    margin-bottom: 0 !important;
  }

  .hiprint-option-item-settingBtn {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
    cursor: pointer;
    border-radius: 6px;
    border: none;
    transition: all 0.2s;
    &:hover { opacity: 0.85; }
  }
  .hiprint-option-item-deleteBtn {
    background: linear-gradient(135deg, #f5576c 0%, #ff6b6b 100%) !important;
    cursor: pointer;
    border-radius: 6px;
    border: none;
    transition: all 0.2s;
    &:hover { opacity: 0.85; }
  }

  .prop-tabs,
  .prop-tab-item,
  .hiprint-option-items {
    background: transparent !important;
  }

  .hiprint-option-items {
    padding-top: 12px !important;
  }

  .hiprint-option-item-field input,
  .hiprint-option-item-field select,
  .hiprint-option-item-field textarea {
    color: var(--el-input-text-color, var(--el-text-color-regular)) !important;
    flex-grow: 1 !important;
    font-size: 12px !important;
    height: 30px !important;
    line-height: 30px !important;
    padding: 6px 10px !important;
    border-radius: 6px !important;
    border: 1px solid var(--el-input-border-color, var(--el-border-color)) !important;
    transition: all 0.2s;
  }

  .hiprint-option-item-field input:focus,
  .hiprint-option-item-field select:focus,
  .hiprint-option-item-field textarea:focus {
    outline: none;
    border-color: #667eea !important;
    box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.15) !important;
  }

  .hiprint-pagination .selected {
    border: 2px solid #667eea !important;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
    color: #fff;
    border-radius: 6px;
  }
  .hiprint-pagination .selected a {
    color: #fff;
  }
}
</style>

<style lang="scss" scoped>
$primary: #667eea;
$primary-dark: #764ba2;
$accent: #5a67d8;
$success: #48bb78;
$warning: #ed8936;
$danger: #f56565;
$bg-dark: #1a1c2e;
$bg-sidebar: #ffffff;
$border: #e2e8f0;
$text: #2d3748;
$text-secondary: #718096;

.microi-print-engine {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f0f2f5;
  overflow: hidden;

  // ═══════════════════════════════
  //  顶部工具栏
  // ═══════════════════════════════
  .mpe-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 52px;
    padding: 0 16px;
    background: $bg-dark;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
    position: relative;
    z-index: 100;
    flex-shrink: 0;

    &__left, &__right {
      display: flex;
      align-items: center;
    }
    &__center {
      display: flex;
      align-items: center;
      gap: 8px;
    }
  }

  .mpe-brand {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .mpe-brand-icon {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: linear-gradient(135deg, $primary 0%, $primary-dark 100%);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .mpe-brand-spin {
    color: #fff;
    animation: mpe-spin 6s infinite linear;
  }

  @keyframes mpe-spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .mpe-brand-text {
    font-size: 13px;
    font-weight: 600;
    color: #e2e8f0;
    letter-spacing: 1px;
    white-space: nowrap;
  }

  .mpe-divider-v {
    width: 1px;
    height: 24px;
    background: rgba(255, 255, 255, 0.15);
    margin: 0 4px;
  }

  .mpe-btn-group {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .mpe-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 6px 12px;
    border: none;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.85);
    background: rgba(255, 255, 255, 0.08);
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    white-space: nowrap;

    &:hover {
      background: rgba(255, 255, 255, 0.16);
      color: #fff;
    }

    &--primary {
      background: linear-gradient(135deg, $primary 0%, $primary-dark 100%);
      color: #fff;
      &:hover {
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        transform: translateY(-1px);
      }
    }

    &--success {
      background: linear-gradient(135deg, $success 0%, #38a169 100%);
      color: #fff;
      &:hover {
        box-shadow: 0 4px 12px rgba(72, 187, 120, 0.4);
        transform: translateY(-1px);
      }
    }

    &--warning {
      background: linear-gradient(135deg, $warning 0%, #dd6b20 100%);
      color: #fff;
      &:hover {
        box-shadow: 0 4px 12px rgba(237, 137, 54, 0.4);
        transform: translateY(-1px);
      }
    }
  }

  // ═══════════════════════════════
  //  主体区域
  // ═══════════════════════════════
  .mpe-body {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  // ═══════════════════════════════
  //  侧边栏（左/右共用）
  // ═══════════════════════════════
  .mpe-sidebar {
    display: flex;
    flex-direction: column;
    background: $bg-sidebar;
    border-right: 1px solid $border;
    flex-shrink: 0;

    &--left {
      width: 260px;
    }
    &--right {
      width: 280px;
      border-right: none;
      border-left: 1px solid $border;
    }

    &__header {
      flex-shrink: 0;
      padding: 0 12px;
      border-bottom: 1px solid $border;
    }

    &__body {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
    }
  }

  .mpe-tabs {
    :deep(.el-tabs__header) {
      margin-bottom: 0;
    }
    :deep(.el-tabs__nav-wrap::after) {
      display: none;
    }
    :deep(.el-tabs__active-bar) {
      background: linear-gradient(90deg, $primary, $primary-dark);
      height: 2px;
      border-radius: 1px;
    }
    :deep(.el-tabs__item) {
      height: 44px;
      line-height: 44px;
      font-size: 13px;
      color: $text-secondary;
      &.is-active { color: $primary; font-weight: 600; }
    }
  }

  .mpe-tab-label {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }

  .mpe-panel-title {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 44px;
    font-size: 13px;
    font-weight: 600;
    color: $text;
  }

  .mpe-prop-form {
    :deep(.el-form-item) {
      margin-bottom: 12px;
    }
    :deep(.el-form-item__label) {
      font-size: 12px;
      color: $text-secondary;
      font-weight: 500;
      padding-bottom: 4px !important;
    }
  }

  .mpe-element-options {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid $border;
  }

  // ═══════════════════════════════
  //  中间画布区域
  // ═══════════════════════════════
  .mpe-canvas-wrapper {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
  }

  .mpe-canvas-toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 16px;
    background: #fff;
    border-bottom: 1px solid $border;
    flex-shrink: 0;
    flex-wrap: wrap;
  }

  .mpe-paper-btns {
    display: flex;
    gap: 4px;
  }

  .mpe-paper-btn {
    padding: 4px 12px;
    border: 1px solid $border;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    color: $text-secondary;
    background: #fff;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      border-color: $primary;
      color: $primary;
    }

    &--active {
      background: linear-gradient(135deg, $primary 0%, $primary-dark 100%);
      color: #fff;
      border-color: transparent;
      box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
    }
  }

  .mpe-popover-anchor {
    position: relative;
  }

  .mpe-popover {
    position: absolute;
    top: 100%;
    left: 0;
    margin-top: 8px;
    background: #fff;
    border-radius: 10px;
    padding: 14px 18px;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
    z-index: 100;
    min-width: 240px;
    border: 1px solid $border;

    &__title {
      font-size: 12px;
      color: $text-secondary;
      margin-bottom: 5px;
      font-weight: 500;
    }
    &__row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 5px;
    }
    &__sep {
      color: $text-secondary;
      font-size: 13px;
    }
    &__actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }
  }

  .mpe-zoom-ctrl {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-left: auto;
  }

  .mpe-zoom-btn {
    cursor: pointer;
    color: $text-secondary;
    padding: 4px;
    border-radius: 4px;
    transition: all 0.2s;
    &:hover {
      color: $primary;
      background: rgba(102, 126, 234, 0.08);
    }
  }

  .mpe-zoom-value {
    font-size: 12px;
    font-weight: 600;
    color: $text;
    min-width: 38px;
    text-align: center;
  }

  .mpe-canvas {
    flex: 1;
    overflow: auto;
    padding: 16px;
    background:
      radial-gradient(circle at 10% 20%, rgba(102, 126, 234, 0.03) 0%, transparent 50%),
      radial-gradient(circle at 90% 80%, rgba(118, 75, 162, 0.03) 0%, transparent 50%),
      #f0f2f5;

    // 给 hiprint 画布添加阴影效果
    :deep(.hiprint-printPaper) {
      box-shadow: 0 2px 16px rgba(0, 0, 0, 0.08);
      border-radius: 2px;
    }
  }

  .mpe-element-options {
    :deep(.mpe-code-edit-btn) {
      display: block;
      width: 100%;
      margin-top: 4px;
      padding: 4px 8px;
      font-size: 12px;
      color: #fff;
      background: linear-gradient(135deg, $primary 0%, $primary-dark 100%);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      transition: opacity 0.2s;
      &:hover {
        opacity: 0.85;
      }
    }
  }
}
</style>
