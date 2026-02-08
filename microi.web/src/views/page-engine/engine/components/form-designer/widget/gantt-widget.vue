<template>
  <div style="height: 100%">
    <div class="gantt-controls">
      <el-button size="small" style="margin-left: 0" button @click="zoomOut"
        >缩小(-)</el-button
      >
      <el-button size="small" style="margin-left: 0" @click="zoomIn"
        >放大(+)</el-button
      >
      <el-select
        size="small"
        v-model="currentZoomLevel"
        @change="changeZoomLevel"
        style="width: 200px"
      >
        <el-option
          v-for="item in levelOptions"
          :key="item.value"
          :label="item.label"
          :value="item.value"
        />
      </el-select>

      <el-input
        v-model="searchKeyword"
        placeholder="搜索任务名称..."
        size="small"
        style="width: 220px"
        clearable
      ></el-input>

      <el-button
        size="small"
        v-show="!props.widgetObj.widgetParams[21]?.value"
        type="primary"
        plain
        @click="saveUpdate"
        >保存修改</el-button
      >
    </div>
    <div
      ref="ganttRef"
      :style="[
        { width: '100%' },
        { height: widgetObj.widgetOption.height - 60 + 'px' },
        { '--selected-bg-color': widgetObj.widgetParams[22]?.value },
      ]"
    ></div>
  </div>
</template>

<script setup name="gantt-widget">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { gantt } from 'dhtmlx-gantt'
import 'dhtmlx-gantt/codebase/dhtmlxgantt.css'
import { formatDate, deepClone } from '../../../utils/util.js'
import { useDebounceFn } from '@vueuse/core'
import { useWidget } from '../../../hooks/useWidget'
import { post, get } from '../../../utils/axiosInstance'
import { debounce } from 'lodash' //引入 debounce 函数
import { defineProps } from 'vue'
import { ElMessageBox, ElNotification } from 'element-plus'

const props = defineProps({
  widgetObj: {
    type: Object,
    required: true,
  },
})

//变更任务列表
let changeTasks = ref([])

//提交修改
const saveUpdate = async () => {
  try {
    if (changeTasks.value.length == 0) {
      ElMessageBox.alert('没有需要提交的修改', '提示', {
        confirmButtonText: '关闭',
      })
      return false
    }
    await ElMessageBox.confirm('是否保存提交？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })
    // 用户点击"确定"后继续更新任务
    console.log('查看变化数据', changeTasks.value)

    let result = changeTasks.value.some((item) => {
      if (item.person instanceof Array && item.person.length > 1) {
        return true
      } else {
        return false
      }
    })

    if (result) {
      ElMessageBox.alert('存在多选的负责人，请检查数据格式', '错误', {
        confirmButtonText: '确定',
        type: 'error',
      })
      return false
    }

    try {
      const response = await post(props.widgetObj.widgetParams[11]?.value, {
        items: JSON.stringify(changeTasks.value),
      })
      if (response && response.length > 0) {
        changeTasks.value = [] //清空变更数据
        console.log('', response)
        ElNotification({
          title: 'Success',
          message: '任务更新到接口',
          type: 'success',
        })
      }
    } catch (error) {
      console.error('任务更新失败:', error)
      ElNotification({
        title: 'Error',
        message: '任务更新失败',
        type: 'error',
      })
    }

    return true
  } catch (error) {
    return false
  }
}

//日期区间
const dateRange = ref()
//是否加载中
const loading = ref(false)

// //设置临时数据
const { loadRemoteData } = useWidget(
  props.widgetObj,
  props.widgetObj.widgetParams[0].typeOptions.dataJson,
  dateRange,
  loading
)
await loadRemoteData()

//甘特图组件标识
const ganttRef = ref()

//滚动条元素
const scrollElement = ref(null) // 存储实际滚动元素

//缩放级别
const levelOptions = [
  {
    value: 'hour',
    label: '小时',
  },
  {
    value: 'day',
    label: '日视图',
  },
  {
    value: 'week',
    label: '周视图',
  },
  {
    value: 'month',
    label: '月视图',
  },
  {
    value: 'quarter',
    label: '季度视图',
  },
  {
    value: 'year',
    label: '年视图',
  },
]

//初始化缩放 - 从配置项读取默认视图模式
const defaultZoomLevel = props.widgetObj.widgetParams[23]?.value || 'day'
const currentZoomLevel = ref(defaultZoomLevel)

// 根据默认视图模式计算索引
const defaultZoomLevelIdx = levelOptions.findIndex(
  (item) => item.value === defaultZoomLevel
)
const currentZoomLevelIdx = ref(
  defaultZoomLevelIdx >= 0 ? defaultZoomLevelIdx : 1
)

// 搜索查询字符串
const searchKeyword = ref('')

//源任务集合
const originalTasks = ref([])
originalTasks.value = props.widgetObj.widgetParams[0].typeOptions.dataJson.tasks

// 修改后的过滤逻辑
const filteredTasks = computed(() => {
  const matchedTasks = originalTasks.value.filter(
    (task) =>
      task.text?.toLowerCase().includes(searchKeyword.value.toLowerCase()) ||
      task.person?.toLowerCase().includes(searchKeyword.value.toLowerCase())
  )

  // 收集所有匹配任务及其父级
  const allParents = matchedTasks.flatMap((task) =>
    getAllParents(task.id, originalTasks.value)
  )

  // 合并去重
  return [...new Set([...matchedTasks, ...allParents])]
})

// 新增函数：递归获取所有父级任务
const getAllParents = (taskId, tasks) => {
  const parents = []
  let currentTask = tasks.find((t) => t.id === taskId)

  while (currentTask?.parent) {
    const parentTask = tasks.find((t) => t.id === currentTask.parent)
    if (parentTask) {
      parents.push(parentTask)
      currentTask = parentTask
    } else {
      break
    }
  }
  return parents
}

//监听查询
const doSearch = debounce(() => {
  gantt.clearAll()
  props.widgetObj.widgetParams[0].typeOptions.dataJson.tasks =
    filteredTasks.value
  gantt.parse(props.widgetObj.widgetParams[0].typeOptions.dataJson)
}, 500)

// 监听筛选关键词变化
watch(searchKeyword, (newVal) => {
  doSearch()
})

// 键盘事件处理函数,用户左右键控制横向滚动条
const handleKeyDown = (e) => {
  if (!scrollElement.value) return

  // 排除输入框等元素中的按键
  if (e.target.tagName.match(/INPUT|TEXTAREA|SELECT/i)) {
    return
  }

  const scrollStep = 100 // 每次滚动的像素数

  switch (e.key) {
    case 'ArrowLeft':
      scrollElement.value.scrollLeft -= scrollStep
      e.preventDefault()
      break
    case 'ArrowRight':
      scrollElement.value.scrollLeft += scrollStep
      e.preventDefault()
      break
    case 'Home':
      scrollElement.value.scrollLeft = 0
      e.preventDefault()
      break
    case 'End':
      scrollElement.value.scrollLeft = scrollElement.value.scrollWidth
      e.preventDefault()
      break
  }
}

// 添加负责人选项的响应式数据
const personOptions = ref([])

// 1. 生成 personMap
const personMap = computed(() => {
  const map = {}
  personOptions.value.forEach((item) => {
    map[item.key] = item.label
  })
  return map
})

// 获取负责人选项的函数
const fetchPersonOptions = async () => {
  try {
    // 模拟接口地址，你可以替换成真实的接口
    const mockApiUrl =
      props.widgetObj.widgetParams[0].typeOptions.dataJson.personapi // 请替换成你的真实接口地址

    // 模拟数据，实际使用时删除这部分，使用真实的接口调用
    // const mockData = []

    const response = await get(mockApiUrl)
    console.log('获取负责人下拉选项', response)

    // 实际接口调用（取消注释并替换上面的模拟数据）
    // const response = await post(mockApiUrl, {})
    // personOptions.value = response.data || []

    // 使用模拟数据
    personOptions.value = response || []

    // 注册到gantt的serverList中
    gantt.serverList('personOptions', personOptions.value)
  } catch (error) {
    console.error('获取负责人选项失败:', error)
    personOptions.value = [
      { key: '张三', label: '张三' },
      { key: '李四', label: '李四' },
      { key: '王五', label: '王五' },
    ]
    gantt.serverList('personOptions', personOptions.value)
  }
}

const getPersonName = (person) => {
  if (person && typeof person == 'object') {
    return person.map((id) => personMap.value[id] || id).join(',')
  }
  if (person && person.indexOf(',') > -1) {
    return person
      .split(',')
      .map((id) => personMap.value[id] || id)
      .join(',')
  }
  return personMap.value[person] || person || ''
}

// 持续时间显示优化：>=24小时拆分为天和小时
const formatDuration = (duration) => {
  const hours = Number(duration) || 0
  if (hours >= 24) {
    const days = Math.floor(hours / 24)
    const remainHours = hours % 24
    const dayText = `${days}天`
    const hourText = remainHours ? `${remainHours}小时` : ''
    return `${dayText}${hourText}`
  }
  return `${hours}小时`
}

//初始化配置
const initGantt = () => {
  if (!ganttRef.value) return

  // 初始化 Gantt 配置
  // 1. 必须的拖动配置
  gantt.config.drag_move = true // 启用任务拖动
  gantt.config.drag_resize = true // 启用调整大小
  gantt.config.drag_progress = true // 启用进度拖动
  gantt.config.drag_links = true // 启用链接拖动
  gantt.config.drag_order = true // 启用排序拖动
  gantt.config.show_tasks_outside_timescale = true // 显示时间轴外的任务
  gantt.config.expand_tasks = true // 默认展开任务

  // 2. 配置拖动行为
  gantt.config.order_branch = props.widgetObj.widgetParams[13]?.value // 允许分支排序
  gantt.config.order_branch_free = props.widgetObj.widgetParams[14]?.value // 允许自由排序

  // 3. 布局配置
  gantt.config.layout = {
    css: 'gantt_container',
    cols: [
      {
        width: props.widgetObj.widgetParams[17]?.value,
        rows: [
          {
            view: 'grid',
            scrollX: 'gridScroll',
            scrollable: true,
            scrollY: 'scrollVer',
          },
          { view: 'scrollbar', id: 'gridScroll', group: 'horizontal' },
        ],
      },
      { resizer: true, width: 1 },
      {
        rows: [
          { view: 'timeline', scrollX: 'scrollHor', scrollY: 'scrollVer' },
          { view: 'scrollbar', id: 'scrollHor', group: 'horizontal' },
        ],
      },
      { view: 'scrollbar', id: 'scrollVer' },
    ],
  }

  // 3. 自定义拖动规则
  gantt.config.drag_move = (source, target, position) => {
    console.log(`拖动 ${source.text} 到 ${target?.text} 的 ${position} 位置`)
    return true // 允许所有拖动
  }

  //取消自动计算周期
  gantt.config.auto_tasks = props.widgetObj.widgetParams[12]?.value

  //配置弹框和气泡插件
  gantt.plugins({
    tooltip: props.widgetObj.widgetParams[1]?.value,
    quick_info: props.widgetObj.widgetParams[10]?.value,
  })

  // 格式化日期
  gantt.locale.date = {
    month_full: [
      '1月',
      '2月',
      '3月',
      '4月',
      '5月',
      '6月',
      '7月',
      '8月',
      '9月',
      '10月',
      '11月',
      '12月',
    ],
    month_short: [
      '1月',
      '2月',
      '3月',
      '4月',
      '5月',
      '6月',
      '7月',
      '8月',
      '9月',
      '10月',
      '11月',
      '12月',
    ],
    day_full: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'],
    day_short: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'],
  }

  // 允许拖放
  gantt.config.drag_project = props.widgetObj.widgetParams[2]?.value

  // 当task的长度改变时，自动调整图表坐标轴区间用于适配task的长度
  gantt.config.fit_tasks = true

  // 设置时间单位为小时
  gantt.config.duration_unit = 'hour'

  // 禁用工作时间计算，使用日历时间计算（起始时间 + 持续时间 = 结束时间）
  gantt.config.work_time = false
  gantt.config.skip_off_time = false // 显示非工作时间

  // 表头高度
  gantt.config.scale_height = props.widgetObj.widgetParams[3]?.value

  // 甘特图行高
  gantt.config.row_height = props.widgetObj.widgetParams[4]?.value

  // 默认任务高度
  gantt.config.bar_height = props.widgetObj.widgetParams[5]?.value

  // 汉化
  gantt.i18n.setLocale('cn')

  // 设置日期格式解析
  gantt.config.date_format = '%d/%m/%Y %H:%i'
  gantt.config.server_date_format = '%d/%m/%Y %H:%i'

  // 动态尺寸
  gantt.config.autosize = props.widgetObj.widgetParams[6]?.value

  if (props.widgetObj.widgetParams[0].typeOptions.dataJson.readonly) {
    if (props.widgetObj.widgetParams[0].typeOptions.dataJson.readonly == 'on') {
      props.widgetObj.widgetParams[7].value = true
    } else {
      props.widgetObj.widgetParams[7].value = false
    }
  }

  // 只读模式
  gantt.config.readonly = props.widgetObj.widgetParams[7]?.value

  // 左侧表格
  gantt.config.show_grid = props.widgetObj.widgetParams[8]?.value

  // 显示进度
  gantt.config.show_progress = props.widgetObj.widgetParams[9]?.value

  // 动态生成tooltip内容
  gantt.templates.tooltip_text = (start, end, task) => {
    const columns =
      props.widgetObj.widgetParams[0].typeOptions.dataJson.columns || []
    let tooltipContent = `<div>`

    // 遍历所有列，生成tooltip内容
    columns.forEach((column) => {
      let value = ''
      switch (column.name) {
        case 'text':
          value = task.text || ''
          break
        case 'start_date':
          value = formatDate(task.start_date, '{y}-{m}-{d} {h}:{i}')
          break
        case 'end_date':
          value = formatDate(task.end_date, '{y}-{m}-{d} {h}:{i}')
          break
        case 'person':
          value = getPersonName(task.person)
          break
        case 'progress':
          value = `${(task.progress * 100).toFixed(0)}%`
          break
        case 'duration':
          value = formatDuration(task.duration)
          break
        case 'status':
          value = task.status || ''
          break
        case 'color':
          value = task.color || ''
          break
        default:
          value = task[column.name] || ''
          break
      }

      if (value !== '' && value !== null && value !== undefined) {
        tooltipContent += `<div>${column.label || column.name}：${value}</div>`
      }
    })

    tooltipContent += `</div>`
    return tooltipContent
  }

  // 计算所有列宽总和
  function calculateTotalWidth(columns) {
    return columns.reduce((total, col) => total + (col.width || 100), 0)
  }
  // 在初始化代码中添加模板函数
  gantt.templates.task_text = function (start, end, task) {
    return `<span style="font-size:${props.widgetObj.widgetParams[15]?.value}px; color:${props.widgetObj.widgetParams[16]?.value}">${task.text}</span>`
  }

  // 支持动态任务条颜色
  gantt.templates.task_class = function (start, end, task) {
    let classes = []
    if (task.color) {
      classes.push('custom-color-task')
      // 直接设置内联样式
      setTimeout(() => {
        const taskElement = gantt.getTaskNode(task.id)
        if (taskElement) {
          taskElement.style.backgroundColor = task.color
        }
      }, 50)
    }
    return classes.join(' ')
  }

  gantt.config.grid_width =
    calculateTotalWidth(
      props.widgetObj.widgetParams[0].typeOptions.dataJson.columns
    ) + 20

  let temp = props.widgetObj.widgetParams[0].typeOptions.dataJson.columns

  for (let i = 0; i < temp.length; i++) {
    const column = temp[i]

    // 根据列名设置不同的模板函数
    switch (column.name) {
      case 'duration':
        column.template = function (task) {
          return formatDuration(task.duration)
        }
        break
      case 'progress':
        column.template = function (task) {
          return `${(task.progress * 100).toFixed(0)}%`
        }
        break
      case 'person':
        column.template = function (task) {
          // 支持多选，person 可能是数组
          return getPersonName(task.person)
        }
        break
      case 'status':
        column.template = function (task) {
          switch (task.status) {
            case '未开始':
              return `<span style="color:#909399">未开始</span>`
            case '不适用':
              return `<span style="color:#909399">不适用</span>`
            case '进行中':
              return `<span style="color:#409EFF;">进行中</span>`
            case '风险':
              return `<span style="color:#F56C6C;">风险</span>`
            case '延误':
              return `<span style="color:#E6A23C;">延误</span>`
            case '已完成':
              return `<span style="color:#67C23A;">已完成</span>`
            case '完成':
              return `<span style="color:#67C23A;">完成</span>`
            default:
              return task.status || ''
          }
        }
        break
      case 'color':
        column.template = function (task) {
          if (task.color) {
            return `<div style="display: inline-block; width: 20px; height: 20px; background-color: ${task.color}; border: 1px solid #ccc; border-radius: 3px;"></div>`
          }
          return ''
        }
        break
      case 'start_date':
        column.template = function (task) {
          return formatDate(task.start_date, '{y}-{m}-{d} {h}:{i}')
        }
        break
      case 'end_date':
        column.template = function (task) {
          return formatDate(task.end_date, '{y}-{m}-{d} {h}:{i}')
        }
        break
      default:
        // 对于其他字段，直接显示原始值
        if (!column.template) {
          column.template = function (task) {
            return task[column.name] || ''
          }
        }
        break
    }
  }

  // 左侧列表字段
  gantt.config.columns =
    props.widgetObj.widgetParams[0].typeOptions.dataJson.columns

  // 清空旧数据
  gantt.clearAll()

  // //链接更新事件
  // gantt.attachEvent('onAfterLinkUpdate', function (id, item) {
  //   console.log('链接已更新:', id, item)
  //   return true
  // })

  // gantt.attachEvent('onLinkDrag', function (id, mode, link, e) {
  //   console.log('正在拖动链接:', id, mode, link)
  //   // mode: "start"|"resize"|"move"|"end"
  //   return true
  // })

  // gantt.attachEvent('onLinkDragEnd', function (id, mode, link, e) {
  //   console.log('链接拖动结束:', id, mode, link)
  //   return true
  // })

  gantt.serverList('statusOptions', [
    { key: '进行中', label: '进行中' },
    { key: '已完成', label: '已完成' },
    { key: '风险', label: '风险' },
    { key: '延误', label: '延误' },
    { key: '未开始', label: '未开始' },
  ])

  // progress字段现在使用数值文本框，不需要生成选项

  // 动态生成编辑框配置
  const generateLightboxSections = () => {
    const sections = []
    const columns =
      props.widgetObj.widgetParams[0].typeOptions.dataJson.columns || []

    // 遍历所有列，为每个列生成对应的编辑字段
    columns.forEach((column) => {
      let section = {
        name: column.label || column.name,
        map_to: column.name,
        height: 32,
      }

      // 根据字段类型设置不同的编辑控件
      switch (column.name) {
        case 'text':
          section.type = 'textarea'
          section.focus = true
          break
        case 'person':
          section.type = 'checkbox'
          section.options = gantt.serverList('personOptions')
          section.height = 120 // 增加负责人富文本框高度
          section.map_to = 'person'
          break
        case 'status':
          section.type = 'select'
          section.options = gantt.serverList('statusOptions')
          break
        case 'progress':
          section.type = 'textarea'
          section.map_to = 'progress'
          break
        case 'start_date':
        case 'end_date':
          section.type = 'time'
          section.time_format = ['%d', '%m', '%Y', '%H:%i']
          section.map_to = 'auto'
          break
        case 'color':
          section.type = 'color'
          break
        case 'duration':
          section.type = 'number'
          break
        default:
          // 默认使用文本框
          section.type = 'textarea'
          break
      }

      sections.push(section)
    })

    // 添加父任务选择（特殊字段）
    sections.push({
      name: '父任务',
      type: 'parent',
      allow_root: 'true',
      root_label: '没有父任务',
      filter: function (id, task) {
        return true
      },
    })

    return sections
  }

  // 设置动态编辑框配置
  const lightboxSections = generateLightboxSections()
  gantt.config.lightbox.sections = lightboxSections

  // 确保编辑框配置正确应用
  console.log('编辑框配置:', lightboxSections)

  // 手动设置编辑框的默认值处理
  gantt.attachEvent('onLightbox', function (id) {
    const task = gantt.getTask(id)
    console.log('编辑框打开，任务数据:', task)

    // 确保progress字段有正确的值
    if (task.progress !== undefined) {
      console.log('当前progress值:', task.progress)
    }

    // 确保时间字段正确显示
    if (task.start_date) {
      console.log('开始时间:', task.start_date)
    }
    if (task.end_date) {
      console.log('结束时间:', task.end_date)
    }

    return true
  })

  // 初始化 Gantt
  gantt.init(ganttRef.value)

  // gantt.config.types = {
  //   milestone: gantt.config.types.milestone,
  // }
  // // 配置标记样式
  // gantt.config.markers = {
  //   left_delimiter: '',
  //   right_delimiter: '',
  //   css: 'vertical-line',
  // }

  // // 添加CSS类
  // gantt.config.scale_height = 50

  const dynamicData = ref()
  dynamicData.value = deepClone(
    props.widgetObj.widgetParams[0].typeOptions.dataJson
  )

  console.log('初始化数据', dynamicData.value)

  // 数据预处理 - 转换数据格式以适配编辑框
  const preprocessData = (data) => {
    if (data.tasks) {
      data.tasks.forEach((task) => {
        // 转换progress为字符串格式
        if (task.progress !== undefined) {
          task.progress = task.progress.toString()
        }
        // 转换person为数组格式
        if (task.person && typeof task.person === 'string') {
          task.person = task.person.split(',').map((p) => p.trim())
        }
        // 转换日期格式：从 yyyy-MM-dd HH:mm 转换为 dd/MM/yyyy HH:mm
        if (task.start_date) {
          // 如果日期格式不包含时间，添加默认时间
          if (!task.start_date.includes(' ')) {
            task.start_date = task.start_date + ' 09:00'
          }
          // 转换日期格式：2025-01-20 09:00 -> 20/01/2025 09:00
          if (task.start_date.includes('-')) {
            const dateTime = task.start_date.split(' ')
            if (dateTime.length === 2) {
              const [date, time] = dateTime
              const [year, month, day] = date.split('-')
              task.start_date = `${day}/${month}/${year} ${time}`
            }
          }
        }
      })
    }
    return data
  }

  // 预处理数据
  const processedData = preprocessData(dynamicData.value)

  // 数据解析
  gantt.parse(processedData)

  // 设置动态任务条颜色
  gantt.attachEvent('onTaskLoading', function (task) {
    if (task.color) {
      // 为每个任务设置CSS变量
      setTimeout(() => {
        const taskElement = gantt.getTaskNode(task.id)
        if (taskElement) {
          taskElement.style.setProperty('--task-color', task.color)
        }
      }, 100)
    }
    return true
  })

  // // 添加自定义竖线
  // gantt.addMarker({
  //   start_date: new Date(2025, 1, 7), // 2023-05-15
  //   css: 'vertical-line custom-line',
  //   text: 'lalal',
  //   title: 'Custom Milestone',
  // })

  // 设置编辑相关事件
  setupEditorEvents()

  // 7. 添加事件监听
  const handleTaskMove = debounce((id, parent) => {
    console.log('任务移动完成:', id, '新父任务:', parent)
    const task = gantt.getTask(id)
    // 清洗并更新数据
    cleanUpdateData(task)
  }, 500) // 1000 毫秒的防抖时间

  gantt.attachEvent('onAfterTaskMove', handleTaskMove)

  //链接创建事件
  gantt.attachEvent('onAfterLinkAdd', async function (id, item) {
    console.log('新链接已添加:', id, item)

    console.log(
      '添加任务关系接口地址:',
      props.widgetObj.widgetParams[18]?.value
    )

    if (props.widgetObj.widgetParams[18]?.value) {
      try {
        const response = await post(
          props.widgetObj.widgetParams[18]?.value,
          item
        )
        if (response && response.length > 0) {
          console.log('添加任务关系', response)
        }
      } catch (error) {
        console.error('添加任务关系失败:', error)
      }
    }
    // id - 链接ID
    // item - 链接对象 {id, source, target, type}
    return true
  })

  // 监听链接删除事件
  gantt.attachEvent('onAfterLinkDelete', async function (id, item) {
    console.log('链接已删除:', id, item)

    console.log(
      '删除任务关系接口地址:',
      props.widgetObj.widgetParams[19]?.value
    )

    if (props.widgetObj.widgetParams[19]?.value) {
      try {
        const response = await post(
          props.widgetObj.widgetParams[19]?.value,
          item
        )
        if (response && response.length > 0) {
          console.log('删除任务关系', response)
        }
      } catch (error) {
        console.error('删除任务关系失败:', error)
      }
    }
    return true
  })
}

const fetchUpdateData = useDebounceFn(async (task) => {
  await cleanUpdateData(task)
}, 1000)

//更新数据
const cleanUpdateData = async (task) => {
  // 创建干净的副本
  const cleanTask = {}
  for (const key in task) {
    if (!key.startsWith('$') && task.hasOwnProperty(key)) {
      cleanTask[key] = task[key]
    }
  }

  // 数据格式转换
  // 转换progress为数字格式
  if (cleanTask.progress !== undefined) {
    cleanTask.progress = parseFloat(cleanTask.progress)
  }
  // 转换person为字符串格式
  if (cleanTask.person && Array.isArray(cleanTask.person)) {
    cleanTask.person = cleanTask.person.join(',')
  }

  //转换日期 - 确保保存到后台时使用标准格式
  cleanTask.start_date = formatDate(cleanTask.start_date, '{y}-{m}-{d} {h}:{i}')
  cleanTask.end_date = formatDate(cleanTask.end_date, '{y}-{m}-{d} {h}:{i}')

  if (
    props.widgetObj.widgetParams[11]?.value &&
    props.widgetObj.widgetParams[21]?.value
  ) {
    console.log('任务已触发更新', cleanTask)
    try {
      const response = await post(props.widgetObj.widgetParams[11]?.value, {
        item: JSON.stringify(cleanTask),
      })
      if (response && response.length > 0) {
        console.log('任务更新到接口', response)
      }
    } catch (error) {
      console.error('任务更新失败:', error)
    }
  } else {
    console.log('触发手动更新')
    // 获取已存在的任务索引
    const index = changeTasks.value.findIndex(
      (task) => task.id === cleanTask.id
    )
    // 如果已存在，用新数据替换；否则推入数组
    if (index > -1) {
      changeTasks.value.splice(index, 1, cleanTask)
    } else {
      changeTasks.value.push(cleanTask)
    }
  }
}

const setupEditorEvents = () => {
  // 编辑完成后
  gantt.attachEvent('onAfterTaskUpdate', async function (id, task) {
    // //清洗并更新数据
    // cleanUpdateData(task)
    await fetchUpdateData(task)
    return true
  })
}

// 初始化缩放功能
const initZoom = () => {
  gantt.ext.zoom.init({
    levels: [
      {
        name: 'hour',
        scale_height: 60,
        min_column_width: 60,
        scales: [
          { unit: 'day', step: 1, format: '%d %M' },
          { unit: 'hour', step: 1, format: '%H:%i' },
        ],
      },
      {
        name: 'day',
        scale_height: 60,
        min_column_width: props.widgetObj.widgetParams[20]?.value
          ? props.widgetObj.widgetParams[20]?.value
          : 35,
        scales: [
          { unit: 'week', step: 1, format: '%M, %Y' },
          { unit: 'day', step: 1, format: '%d ' },
        ],
      },
      {
        name: 'week',
        scale_height: 60,
        min_column_width: 35,
        scales: [
          { unit: 'month', step: 1, format: '%F, %Y' },
          { unit: 'week', step: 1, format: 'W%W' },
        ],
      },
      {
        name: 'month',
        scale_height: 60,
        min_column_width: 35,
        scales: [
          { unit: 'year', step: 1, format: '%Y' },
          { unit: 'month', step: 1, format: '%M' },
        ],
      },
      {
        name: 'quarter',
        scale_height: 60,
        min_column_width: 60,
        scales: [
          { unit: 'year', step: 1, format: '%Y' },
          {
            unit: 'month',
            step: 3,
            format: (date) => {
              const quarter = Math.floor(date.getMonth() / 3) + 1
              return `Q${quarter}`
            },
          },
        ],
      },
      {
        name: 'year',
        scale_height: 60,
        min_column_width: 100,
        scales: [{ unit: 'year', step: 1, format: '%Y' }],
      },
    ],
  })

  // 设置初始缩放级别
  gantt.ext.zoom.setLevel(currentZoomLevel.value)

  // 监听缩放事件更新当前级别
  gantt.ext.zoom.attachEvent('onZoom', (level) => {
    console.log('缩放级别已更改:', level.name)
    currentZoomLevel.value = level.name
    return true
  })
}

// 缩放控制方法
const zoomIn = () => {
  console.log('放大')
  gantt.ext.zoom.zoomIn()
  currentZoomLevelIdx.value =
    currentZoomLevelIdx.value - 1 < 0 ? 0 : currentZoomLevelIdx.value - 1
  currentZoomLevel.value = levelOptions[currentZoomLevelIdx.value].value
}

const zoomOut = () => {
  console.log('缩小')
  gantt.ext.zoom.zoomOut()
  currentZoomLevelIdx.value =
    currentZoomLevelIdx.value + 1 > 5 ? 5 : currentZoomLevelIdx.value + 1
  currentZoomLevel.value = levelOptions[currentZoomLevelIdx.value].value
}

const changeZoomLevel = () => {
  gantt.ext.zoom.setLevel(currentZoomLevel.value)
  currentZoomLevelIdx.value = levelOptions.findIndex(
    (item) => item.value === currentZoomLevel.value
  )
}

onMounted(async () => {
  // 先获取负责人选项
  await fetchPersonOptions()

  initGantt()

  // 配置缩放
  initZoom()

  //  获取滚动元素
  if (!scrollElement.value) {
    scrollElement.value =
      ganttRef.value.querySelectorAll('.gantt_hor_scroll')[1]
  }

  // 添加键盘事件监听
  document.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  // 移除键盘事件监听
  document.removeEventListener('keydown', handleKeyDown)
})
</script>

<style lang="scss">
.microi-page-engine {
  /* 只针对负责人section的checkbox区域 */
  .gantt_cal_lcheckbox {
    max-height: 120px !important; /* 你想要的高度 */
    overflow-y: auto !important;
  }
  .gantt_cal_light {
    z-index: 9999 !important;
  }
  .gantt_cal_cover {
    z-index: 10000 !important;
  }
  .gantt_tooltip {
    z-index: 10000 !important;
  }

  .gantt_modal_box {
    z-index: 10000 !important;
  }
  .gantt_container {
    background-color: transparent !important;
  }
  .gantt-controls {
    padding: 10px 0;
    // background: #f5f5f5;
    display: flex;
    gap: 10px;
  }

  /* 修改左侧表格整体样式 */
  .gantt_grid_scale,
  .gantt_grid_data {
    font-size: 12px; /* 字体大小 */
  }

  .gantt_task_content {
    padding-top: 0px;
  }
  .gantt_task_progress {
    // background: rgb(0, 0, 0, 0.3);
    background: var(--selected-bg-color);
  }

  /* 里程碑竖线样式 */
  .vertical-line {
    background-color: #ff5722;
    width: 2px;
    opacity: 0.7;
    z-index: 1;
  }

  .custom-line {
    background-color: #2196f3;
    width: 2px;
    border-left: 2px dashed #2196f3;
  }

  /* 默认里程碑样式 */
  .gantt_milestone div {
    background-color: #ff5722;
  }
  .dhx_title span {
    color: #000 !important;
    font-size: 14px !important;
  }

  /* 确保任务条有正确的背景色 */
  .gantt_task_line {
    // 2025-12-23 Anderson：去掉!important，否则自定义颜色不生效
    background-color: #4caf50;// !important
  }

  .gantt_task_line .gantt_task_progress {
    // 2025-12-23 Anderson：去掉!important，否则自定义颜色不生效
    background-color: rgba(0, 0, 0, 0.2);// !important
  }
}
</style>
