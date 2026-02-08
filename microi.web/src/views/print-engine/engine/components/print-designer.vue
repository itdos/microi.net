<template>
  <div class="microi-print-engine">
    <el-container>
      <el-header class="elheader">
        <el-row>
          <el-col :span="4">
            <div class="leftlogo">
              <span>{{ pageInfo.setting.title }}</span>
              <el-icon class="spin-icon" :size="20">
                <Tools />
              </el-icon>
            </div>
          </el-col>
          <el-col :span="12">
            <el-button-group>
              <el-button
                size="small"
                @click.stop="rotatePaper"
                plain
                :icon="RefreshRight"
                >旋转</el-button
              >
              <el-popconfirm
                width="200"
                confirm-button-text="确定"
                cancel-button-text="再想想"
                title="您确定要清空纸张吗?"
                @confirm="clearPaper"
              >
                <template #reference>
                  <el-button size="small" plain :icon="Delete">清空</el-button>
                </template>
              </el-popconfirm>

              <el-button
                @click.stop="exportJson"
                plain
                :icon="Memo"
                size="small"
                >JSON</el-button
              >

              <el-popconfirm
                width="200"
                confirm-button-text="确定"
                cancel-button-text="再想想"
                title="加载模拟数据会覆盖当前纸张,您确定操作吗?"
                @confirm="loadMockData"
              >
                <template #reference>
                  <el-button plain size="small" :icon="Star">模板</el-button>
                </template>
              </el-popconfirm>

              <el-button
                size="small"
                @click.stop="showDataDialog"
                plain
                :icon="Tickets"
                >数据</el-button
              >
              <!-- <el-popconfirm
                  width="200"
                  confirm-button-text="确定"
                  cancel-button-text="再想想"
                  title="每隔10秒自动缓存JSON，您确定要关闭吗?"
                  @confirm="unLockClick"
                >
                  <template #reference>
                    <el-button size="small" plain :icon="Clock"
                      >关闭自动缓存</el-button
                    >
                  </template>
                </el-popconfirm> -->
            </el-button-group>
          </el-col>
          <el-col :span="8">
            <el-button
              type="success"
              size="small"
              @click.stop="getHtml"
              round
              :icon="Monitor"
              >预览</el-button
            >
            <el-button
              @click.stop="doPrint"
              round
              type="primary"
              :icon="Printer"
              size="small"
              >打印</el-button
            >

            <el-popconfirm
              class="box-item"
              title="确定直接打印吗?"
              placement="top-start"
              @confirm="onlyPrint2"
              confirm-button-text="确定"
              cancel-button-text="取消"
            >
              <template #reference>
                <el-button size="small" round type="primary" :icon="Printer"
                  >直接打印</el-button
                >
              </template>
            </el-popconfirm>

            <el-button
              @click.stop="saveFormData"
              size="small"
              round
              type="warning"
              :icon="Collection"
              >保存</el-button
            >

            <!-- <el-switch
              @change="darkChange"
              v-model="isDark"
              style="
                --el-switch-on-color: #e6a23c;
                --el-switch-off-color: #409eff;
                margin-left: 10px;
              "
              :active-action-icon="Moon"
              :inactive-action-icon="Sunny"
            /> -->
          </el-col>
        </el-row>
      </el-header>
      <el-container>
        <el-aside width="280px" style="padding: 15px">
          <el-card style="height: 85vh; overflow-y: auto">
            <el-tabs v-model="pageInfo.setting.activeName" class="demo-tabs">
              <el-tab-pane name="first">
                <template #label>
                  <span class="custom-tabs-label">
                    <el-link
                      style="font-size: 13px"
                      :icon="Rank"
                      :underline="false"
                      >基础组件</el-link
                    >
                  </span>
                </template>
                <div
                  ref="providerContainer1"
                  class="container custom-style-types"
                ></div>
              </el-tab-pane>
              <el-tab-pane name="second">
                <template #label>
                  <span class="custom-tabs-label">
                    <el-link
                      style="font-size: 13px"
                      :icon="Cpu"
                      :underline="false"
                      >扩展组件</el-link
                    >
                  </span>
                </template>
                <!-- 这里自定义显示样式 custom-style-types -->
                <div
                  ref="providerContainer2"
                  class="container custom-style-types"
                ></div>
              </el-tab-pane>
            </el-tabs>
          </el-card>
        </el-aside>
        <el-container>
          <el-header style="text-align: center">
            <el-row>
              <el-col :span="24">
                <el-space wrap :size="10">
                  <el-button-group>
                    <template v-for="(value, type) in paperTypes" :key="type">
                      <el-button
                        size="small"
                        :type="curPaperType === type ? 'primary' : ''"
                        @click="setPaper(type, value)"
                      >
                        {{ type }}</el-button
                      >
                    </template>
                    <el-button
                      size="small"
                      auto-insert-space
                      @click="showPaperPop"
                      >自定义</el-button
                    >
                  </el-button-group>
                  <div class="popover">
                    <div class="popover-content mpe-flex-col" v-show="paperPopVisible">
                      <div>设置纸张宽高(mm)</div>
                      <div class="mpe-flex-row mpe-mt-10" style="line-height: 30px">
                        <el-input
                          size="small"
                          v-model="paperWidth"
                          placeholder="宽(mm)"
                        />
                        <span class="mpe-ml-10 mpe-mr-10">x</span>

                        <el-input
                          size="small"
                          v-model="paperHeight"
                          placeholder="高(mm)"
                        />
                      </div>
                      <el-row :gutter="20" style="margin-top: 10px">
                        <el-col :span="12">
                          <el-button
                            style="width: 100%"
                            type="primary"
                            @click.stop="setPaperOther"
                            >确定</el-button
                          >
                        </el-col>
                        <el-col :span="12">
                          <el-button
                            style="width: 100%"
                            type="info"
                            plain
                            @click.stop="paperPopVisible = false"
                            >取消</el-button
                          >
                        </el-col>
                      </el-row>
                    </div>
                  </div>
                  <div>
                    <el-space wrap>
                      <el-icon
                        style="cursor: pointer"
                        @click="changeScale(false)"
                        :size="20"
                      >
                        <ZoomOut />
                      </el-icon>
                      <el-text>{{ (scaleValue * 100).toFixed(0) }}%</el-text>
                      <el-icon
                        style="cursor: pointer"
                        @click="changeScale(true)"
                        :size="20"
                      >
                        <ZoomIn />
                      </el-icon>
                    </el-space>
                  </div>

                  <!-- 多面板的容器 -->
                  <div class="hiprint-printPagination"></div>
                </el-space>
              </el-col>
            </el-row>
          </el-header>
          <el-main style="padding: 10px 0">
            <el-card
              style="padding: 5px; height: calc(85vh - 10px); overflow-y: auto"
            >
              <!-- 设计器的 容器 -->
              <div ref="hiprintPrintContainer"></div>
            </el-card>
          </el-main>
        </el-container>

        <el-aside width="300px" style="padding: 15px">
          <el-card style="padding: 0px; height: 85vh; overflow-y: auto">
            <template #header>
              <div class="card-header">
                <el-link
                  style="font-size: 13px"
                  :icon="Operation"
                  :underline="false"
                  >属性面板</el-link
                >
              </div>
            </template>

            <el-form label-position="left">
              <el-form-item label="模板编号">
                <el-input
                  disabled=""
                  v-model="pageInfo.remoteData.Number"
                  placeholder=""
                ></el-input>
              </el-form-item>
              <el-form-item label="模板标题">
                <el-input
                  v-model="pageInfo.remoteData.Title"
                  placeholder=""
                ></el-input>
              </el-form-item>
              <el-form-item label="模板简介">
                <el-input
                  v-model="pageInfo.remoteData.Desc"
                  placeholder=""
                  type="textarea"
                ></el-input>
              </el-form-item>
              <el-form-item label="数据接口">
                <el-input
                  v-model="pageInfo.remoteData.DataApi"
                  placeholder="请输入动态数据webapi接口地址"
                  type="textarea"
                ></el-input>
              </el-form-item>
            </el-form>

            <!-- 元素参数的 容器 -->
            <div id="PrintElementOptionSetting"></div>
          </el-card>
        </el-aside>
      </el-container>
    </el-container>
  </div>

  <print-preview ref="previewDialog" />

  <el-drawer
    size="50%"
    title="页面数据"
    v-model="pageInfo.pageDialog"
    direction="ltr"
  >
    <el-form>
      <el-form-item label="">
        <JsonEditor
          v-if="pageInfo.pageDialog"
          height="600px"
          v-model="pageInfo.pageStr"
          :option="jsonEditorOption"
        />
      </el-form-item>
    </el-form>
  </el-drawer>

  <el-drawer
    size="50%"
    title="动态数据"
    v-model="pageInfo.dataDialog"
    direction="ltr"
    @closed="updateData"
  >
    <el-form>
      <el-form-item label="">
        <el-button @click="getDataTemp">查看动态数据JSON结构</el-button>
      </el-form-item>
      <el-form-item label="">
        <JsonEditor
          v-if="pageInfo.dataDialog"
          height="600px"
          v-model="pageInfo.printStr"
          :option="jsonEditorOption"
        />
      </el-form-item>
    </el-form>
  </el-drawer>
</template>

<script setup name="print-designer">
import {
  onMounted,
  onBeforeUnmount,
  ref,
  getCurrentInstance,
  reactive,
  nextTick,
} from 'vue'
import { ElMessage, ElNotification } from 'element-plus'
import { hiprint } from 'vue-plugin-hiprint'
import { buildDefaultRemoteData } from '../utils/util.js'
import { EventBus } from '../utils/eventBus.js'
import { usePrintEngineStore } from '../stores/printEngine'
import { get } from '../utils/axiosInstance'
import { useDark, useToggle } from '@vueuse/core'
import { isObjectOrArray } from '../utils/util'
const printEngineStore = usePrintEngineStore()

let intervalId = null

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
import { newHiprintPrintTemplate } from '../utils/template-helper'

// json编辑器
import JsonEditor from 'ceel-json-editor'
import 'jsoneditor/dist/jsoneditor.css'

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
    title: 'Microi.Net-打印引擎',
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
  nodeTransition.serverUrl('https://v5.printjs.cn:17521')
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
 * 浏览器打印
 */
const doPrint = () => {
  // 参数: 打印时设置 左偏移量，上偏移量
  let options = { leftOffset: -1, topOffset: -1 }
  // 扩展
  let ext = {
    callback: () => {
      console.log('浏览器打印窗口已打开')
    },
    styleHandler: () => {
      // // 重写 文本 打印样式
      // return '<style>.hiprint-printElement-text{color:red !important;}</style>'
    },
  }
  let dataType = isObjectOrArray(pageInfo.remoteData.PrintObj)
  let tempPrintData = pageInfo.remoteData.PrintObj
  if (dataType === 'array') {
    //如果打印对象是数组，则打印第一个对象
    hiprintTemplate.print(tempPrintData[0], options, ext)
  } else {
    hiprintTemplate.print(tempPrintData, options, ext)
  }
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

//动态加载数据接口
const loadDataApi = async (apiUrl) => {
  const response = await get(pageInfo.remoteData.DataApi, {})
  try {
    if (response) {
      pageInfo.remoteData.PrintObj = response //替换动态数据源
      buildDesigner()
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

      if (
        pageInfo.remoteData.PrintObj &&
        typeof pageInfo.remoteData.PrintObj === 'string'
      ) {
        pageInfo.remoteData.PrintObj = JSON.parse(pageInfo.remoteData.PrintObj)
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
})

onBeforeUnmount(() => {
  console.log('销毁')
  // 取消监听事件
  window.removeEventListener('message', messageHandler)
})

//保存页面数据
const saveFormData = async () => {
  ElMessage({
    message: '操作成功',
    type: 'success',
  })

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
          }
          a:hover {
            color: #fff;
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

  .hiprint-pagination .selected {
    border: #2196f3 2px solid !important;
    background: #409eff !important;
    color: #fff;
  }
  .hiprint-pagination .selected a {
    color: #fff;
  }
}
</style>

<style lang="scss" scoped>
.microi-print-engine {
  .elheader {
    line-height: 55px;
    text-align: center;
    box-shadow: 0 0 5px 0 rgba(0, 0, 0, 0.1);
    margin-top: 15px;
    background-color: #fff;

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
        margin-left: 5px;
      }
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
</style>