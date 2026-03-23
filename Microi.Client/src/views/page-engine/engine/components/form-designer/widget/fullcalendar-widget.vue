<template>
  <div class="demo-app">
    <div class="demo-app-main">
      <FullCalendar
        class="demo-app-calendar"
        ref="calendar"
        :options="calendarOptions"
      >
        <template v-slot:eventContent="arg">
          <div class="argDiv">
            <b>{{ arg.timeText }}</b>
            <i>{{ arg.event.title }}</i>
          </div>
        </template>
      </FullCalendar>
    </div>
  </div>
</template>

<script setup name="fullcalendar-widget">
import { ref, watch, h } from 'vue'
import { ElNotification, ElMessageBox } from 'element-plus'
// import { useWidget } from '../../../hooks/useWidget'
import FullCalendar from '@fullcalendar/vue3'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import resourceTimelinePlugin from '@fullcalendar/resource-timeline'
import { EventBus } from '../../../utils/eventBus.js'
import { post } from '../../../utils/axiosInstance'

import { usePageEngineStore } from '../../../stores/pageEngine'
import { storeToRefs } from 'pinia'
const pageEngineStore = usePageEngineStore()
const { curWrapper, formData } = storeToRefs(pageEngineStore)

const props = defineProps({
  widgetObj: {
    type: Object,
    required: true,
  },
})

// let eventGuid = 0
// let todayStr = new Date().toISOString().replace(/T.*$/, '') // YYYY-MM-DD of today
// const INITIAL_EVENTS = [
//   {
//     id: createEventId(),
//     title: '全天事件',
//     start: todayStr,
//   },
//   {
//     id: createEventId(),
//     title:
//       '定时事件,蛇口街道付了款撒京东方雷克萨京东方雷克萨觉得发啦手机端非定时事件,蛇口街道付了款撒京东方雷克萨京东方雷克萨觉得发啦手机端非',
//     start: todayStr + 'T12:00:00',
//   },
// ]
// function createEventId() {
//   return String(eventGuid++)
// }

// 定义一个对象，用于缓存事件数据
let eventCache = {}

const calendar = ref(null)

//定义响应式变量 calendarOptions，作为 FullCalendar 的配置对象
const calendarOptions = ref({
  locale: 'zh-cn', // 中文
  buttonText: {
    today: '今天',
    day: '日',
    week: '周',
    month: '月',
  },
  height: props.widgetObj.widgetOption.height, //控件高度
  eventColor: props.widgetObj.widgetParams[1].value, //事件颜色
  weekNumberCalculation: props.widgetObj.widgetParams[2].value, //周数计算方式,周一在周日前面
  allDaySlot: props.widgetObj.widgetParams[3].value, //开启全天事件
  editable: props.widgetObj.widgetParams[4].value, //启用编辑功能
  selectable: props.widgetObj.widgetParams[5].value, //启用选择功能
  selectMirror: props.widgetObj.widgetParams[6].value, //镜像选择
  dayMaxEvents: props.widgetObj.widgetParams[7].value, //每日最大事件数限制
  weekends: props.widgetObj.widgetParams[8].value, //显示周末
  navLinks: props.widgetObj.widgetParams[9].value, //点击日期文字链接
  droppable: props.widgetObj.widgetParams[10].value, //拖拽位置
  // schedulerLicenseKey: '<YOUR-LICENSE-KEY-GOES-HERE>',// 设置LicenseKey
  // axisFormat: 'h(:mm)tt', //时间格式
  //注册使用的插件。
  plugins: [
    dayGridPlugin,
    timeGridPlugin,
    interactionPlugin,
    resourceTimelinePlugin,
  ],
  //设置顶部工具栏布局。
  headerToolbar: {
    left: 'prev,next today',
    center: 'title',
    right: 'dayGridMonth,timeGridWeek,timeGridDay',
  },
  initialView: 'dayGridMonth', //初始化视图为“月”视图。
  events: fetchEvents, // 动态获取事件的方法(initialEvents: INITIAL_EVENTS, // 设置初始事件数据)
  select: handleDateSelect, //处理用户选择日期时弹出输入框创建事件(可以选择区间)
  eventClick: handleEventClick, //事件点击
  eventsSet: handleEvents, //当事件集合更新时同步到 currentEvents。
  //页面初始化渲染
  datesSet: (info) => {
    datesSet(info)
  },
  //显示该日期的详细信息或者进行其他业务逻辑处理时
  dateClick: (arg) => {
    // console.log('点击查看日期和当天事件', arg)
  },
  eventDrop: async (dragEnd) => {
    console.log('事件拖拽', dragEnd)
    if (props.widgetObj.widgetParams[13]?.value) {
      let start = formmatTime(dragEnd.event.startStr)
      let end = formmatTime(dragEnd.event.endStr)
      try {
        const response = await post(props.widgetObj.widgetParams[13]?.value, {
          id: dragEnd.event.id,
          start: start,
          end: end,
        })
        if (response && response.length > 0) {
          reloadEvents()
          ElNotification({
            title: '温馨提示',
            message: '已同步更新事件日期',
            type: 'success',
            duration: 0,
          })
        }
      } catch (error) {
        console.error('删除事件失败:', error)
      }
    } else {
      ElNotification({
        title: '温馨提示',
        message: '请先设置拖拽事件接口地址',
        type: 'warning',
        duration: 0,
      })
    }
  },
  eventDidMount: function (info) {
    info.el.addEventListener('contextmenu', async function (e) {
      e.preventDefault() // 阻止默认右键菜单

      ElMessageBox.confirm(
        `您确定要删除事件 '${info.event.title}' 吗？`,
        '删除事件',
        {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning',
        }
      )
        .then(async () => {
          info.event.remove()
          if (props.widgetObj.widgetParams[12]?.value) {
            try {
              const response = await post(
                props.widgetObj.widgetParams[12]?.value,
                {
                  id: info.event.id,
                }
              )
              if (response && response.length > 0) {
                reloadEvents()
              }
            } catch (error) {
              console.error('删除事件失败:', error)
            }
          } else {
            ElNotification({
              title: '温馨提示',
              message: '请先设置删除事件接口地址',
              type: 'warning',
              duration: 0,
            })
          }
        })
        .catch(() => {})
    })
  },
})

//存储当前事件列表。
const currentEvents = ref([])

////监听到的当前view模式
const viewType = ref('')

//动态加载数据
async function fetchEvents(fetchInfo, successCallback, failureCallback) {
  const start = formmatTime(fetchInfo.start)
  const end = formmatTime(fetchInfo.end)
  const key = `${start}-${end}` // 更清晰的 key 标识

  console.log('日历控件动态加载数据', start, end)

  if (eventCache[key]) {
    console.log('从缓存中获取数据', eventCache[key])
    return successCallback(eventCache[key])
  }

  if (props.widgetObj.widgetParams[0]?.value) {
    try {
      const response = await get(props.widgetObj.widgetParams[0]?.value, {
        pageid: formData.value.Id,
        start: start,
        end: end,
      })
      if (response && response.length > 0) {
        // reloadEvents()
        eventCache[key] = response // 缓存数据
        successCallback(response)
      }
    } catch (error) {
      console.error('加载事件失败:', error)
    }
  } else {
    const events = props.widgetObj.widgetParams[0].typeOptions.dataJson
    eventCache[key] = events
    successCallback(events)
  }

  // // 模拟从后端获取数据
  // // 实际开发中替换为 fetch 请求
  // setTimeout(() => {
  //   // const events = [...INITIAL_EVENTS]  // 深拷贝避免引用污染
  //   const events = props.widgetObj.widgetParams[0].typeOptions.dataJson
  //   eventCache[key] = events
  //   successCallback(events)
  // }, 200)

  // fetch(`/api/events?start=${start}&end=${end}`)
  //   .then((res) => res.json())
  //   .then((events) => {
  //     if (!eventCache[start]) {
  //       eventCache[start] = {}
  //     }
  //     eventCache[start][end] = events
  //     successCallback(events)
  //   })
  //   .catch(failureCallback)
}

function datesSet(info) {
  //注意：该方法在页面初始化时就会触发一次
  viewType.value = info.view.type
}

//切换是否显示周末
function handleWeekendsToggle() {
  calendarOptions.value.weekends = !calendarOptions.value.weekends // update a property
}

//处理用户选择日期时弹出输入框创建事件
async function handleDateSelect(selectInfo) {
  let start = formmatTime(selectInfo.startStr) // 格式化开始时间
  let end = formmatTime(selectInfo.endStr) // / 格式化结束时间
  let pageid = formData.value.Id // 获取页面id

  ElMessageBox.prompt('请为您的活动输入新标题', '添加事件', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
  })
    .then(async ({ value }) => {
      if (!value) {
        ElNotification({
          title: '温馨提示',
          message: '请为您的活动输入新标题',
          type: 'warning',
          duration: 0,
        })
        return
      }
      if (props.widgetObj.widgetParams[11]?.value) {
        let calendarApi = selectInfo.view.calendar
        calendarApi.unselect() // 清除日期选择
        try {
          const response = await post(props.widgetObj.widgetParams[11]?.value, {
            value,
            start,
            end,
            pageid,
          })
          if (response && response.length > 0) {
            reloadEvents()
          }
        } catch (error) {
          console.error('创建事件失败:', error)
        }
      } else {
        ElNotification({
          title: '温馨提示',
          message: '请设置创建事件接口地址',
          type: 'warning',
          duration: 0,
        })
      }
    })
    .catch(() => {})
}
//点击事件做业务处理。
function handleEventClick(clickInfo) {
  console.log('点击了事件', clickInfo.event.id)
  if (clickInfo.event.id) {
    EventBus.emit('fullCalendarClick', clickInfo.event.id)
    window.parent?.postMessage(
      { key: 'fullCalendarWidget', value: clickInfo.event.id },
      '*'
    )
  }
}
//当事件集合更新时同步到 currentEvents。
function handleEvents(events) {
  currentEvents.value = events
}

//重新加载事件
function reloadEvents() {
  console.log('重新加载事件')
  const calendarApi = calendar.value.getApi()
  const view = calendarApi.view
  const start = formmatTime(view.activeStart)
  const end = formmatTime(view.activeEnd)

  // 清除当前视图范围内的缓存
  const key = `${start}-${end}`
  delete eventCache[key]

  // 触发 FullCalendar 重新加载数据
  calendarApi.refetchEvents()
}

//UTC时间去掉T
const formmatTime = (time) => {
  const utcTimestamp = time
  const date = new Date(utcTimestamp)
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  const hours = String(date.getUTCHours()).padStart(2, '0')
  const minutes = String(date.getUTCMinutes()).padStart(2, '0')
  const seconds = String(date.getUTCSeconds()).padStart(2, '0')
  const formattedDateTime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
  return formattedDateTime
}

// 防抖工具函数
const debounce = (func, delay) => {
  let timeoutId
  return function (...args) {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => func.apply(this, args), delay)
  }
}

// 防抖更新日历配置函数
const debouncedUpdateCalendarConfig = debounce(
  ([newWidgetObj, newWrapperOption]) => {
    const calendarApi = calendar.value?.getApi()
    if (calendarApi) {
      calendarApi.setOption('height', newWidgetObj.widgetOption.height)
      calendarApi.setOption('eventColor', newWidgetObj.widgetParams[1].value)
      calendarApi.setOption(
        'weekNumberCalculation',
        newWidgetObj.widgetParams[2].value
      )
      calendarApi.setOption('allDaySlot', newWidgetObj.widgetParams[3].value)
      calendarApi.setOption('editable', newWidgetObj.widgetParams[4].value)
      calendarApi.setOption('selectable', newWidgetObj.widgetParams[5].value)
      calendarApi.setOption('selectMirror', newWidgetObj.widgetParams[6].value)
      calendarApi.setOption('dayMaxEvents', newWidgetObj.widgetParams[7].value)
      calendarApi.setOption('weekends', newWidgetObj.widgetParams[8].value)
      calendarApi.setOption('navLinks', newWidgetObj.widgetParams[9].value)
      calendarApi.setOption('droppable', newWidgetObj.widgetParams[10].value)
      calendarApi.render() // 强制重新渲染
    }
  },
  1000
) // 1000ms 防抖延迟

// 防抖重新加载事件函数
const debouncedReloadEvents = debounce(async (newVal, oldVal) => {
  console.log('change', newVal, oldVal)
  if (newVal != oldVal) {
    await reloadEvents()
  }
}, 1000) // 1000ms 防抖延迟

watch(
  () => [props.widgetObj, curWrapper.value.wrapperOption],
  ([newWidgetObj, newWrapperOption]) => {
    // 使用防抖函数替代直接更新
    debouncedUpdateCalendarConfig([newWidgetObj, newWrapperOption])
  },
  { deep: true }
)

watch(
  () => props.widgetObj.widgetParams[0].value,
  async (newVal, oldVal) => {
    // 使用防抖函数替代直接重新加载
    debouncedReloadEvents(newVal, oldVal)
  },
  {
    // immediate: true,
    deep: true,
  }
)
</script>

<style>
/* 隐藏版权信息 */
.microi-page-engine .fc-license-message {
  display: none !important;
}
</style>

<style lang="css" scoped>
.demo-app-calendar {
  width: 100%;
}
h2 {
  margin: 0;
  font-size: 16px;
}

ul {
  margin: 0;
  padding: 0 0 0 1.5em;
}

li {
  margin: 1.5em 0;
  padding: 0;
}

b {
  /* used for event dates/times */
  margin-right: 3px;
}

.demo-app {
  display: flex;
  min-height: 100%;
  font-family: Arial, Helvetica Neue, Helvetica, sans-serif;
  font-size: 14px;
}

.demo-app-sidebar {
  width: 300px;
  line-height: 1.5;
  background: #eaf9ff;
  border-right: 1px solid #d3e2e8;
}

.demo-app-sidebar-section {
  padding: 2em;
}

.demo-app-main {
  flex-grow: 1;
  /* padding: 3em; */
}

.fc {
  /* the calendar root */
  max-width: 100%;
  margin: 0 auto;
}
.argDiv {
  padding: 2px;
  white-space: normal;
  word-break: break-all;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
</style>
