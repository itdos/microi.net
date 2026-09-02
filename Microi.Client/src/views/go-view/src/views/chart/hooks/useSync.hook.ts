import { getUUID } from '@goview/utils'
import { useChartEditStore } from '@goview/store/modules/chartEditStore/chartEditStore'
import { ChartEditStorage } from '@goview/store/modules/chartEditStore/chartEditStore.d'
import { useChartHistoryStore } from '@goview/store/modules/chartHistoryStore/chartHistoryStore'
import { useChartLayoutStore } from '@goview/store/modules/chartLayoutStore/chartLayoutStore'
import { ChartLayoutStoreEnum } from '@goview/store/modules/chartLayoutStore/chartLayoutStore.d'
import { fetchChartComponent, fetchConfigComponent, createComponent } from '@goview/packages/index'
import { CreateComponentType, CreateComponentGroupType } from '@goview/packages/index.d'
import { BaseEvent, EventLife } from '@goview/enums/eventEnum'
import { PublicGroupConfigClass } from '@goview/packages/public/publicConfig'
import { createSerialTaskQueue } from '@goview/utils/projectIntegrity.js'
import merge from 'lodash/merge'
import cloneDeep from 'lodash/cloneDeep'

// 所有 useSync() 调用共享同一队列，避免多个入口同时恢复组件时交错写入 Pinia。
const componentUpdateQueue = createSerialTaskQueue()

export const waitForComponentUpdates = () => componentUpdateQueue.onIdle()

/**
 * * 画布-版本升级对旧数据无法兼容的补丁
 * @param object
 */
const canvasVersionUpdatePolyfill = (object: any) => {
  return object
}

/**
 * * 组件-版本升级对旧数据无法兼容的补丁
 * @param newObject
 * @param sources
 */
const componentVersionUpdatePolyfill = (newObject: any, sources: any) => {
  try {
    // 判断是否是组件
    if (sources.id) {
      // 处理事件补丁
      const hasVnodeBeforeMount = 'vnodeBeforeMount' in sources.events
      const hasVnodeMounted = 'vnodeMounted' in sources.events

      if (hasVnodeBeforeMount) {
        newObject.events.advancedEvents.vnodeBeforeMount = sources?.events.vnodeBeforeMount
      }
      if (hasVnodeMounted) {
        newObject.events.advancedEvents.vnodeMounted = sources?.events.vnodeMounted
      }
      if (hasVnodeBeforeMount || hasVnodeMounted) {
        sources.events = {
          baseEvent: {
            [BaseEvent.ON_CLICK]: undefined,
            [BaseEvent.ON_DBL_CLICK]: undefined,
            [BaseEvent.ON_MOUSE_ENTER]: undefined,
            [BaseEvent.ON_MOUSE_LEAVE]: undefined
          },
          advancedEvents: {
            [EventLife.VNODE_MOUNTED]: undefined,
            [EventLife.VNODE_BEFORE_MOUNT]: undefined
          },
          interactEvents: []
        }
      }
      return newObject
    }
  } catch (error) {
    return newObject
  }
}

/**
 * * 合并处理
 * @param newObject 新的模板数据
 * @param sources 新拿到的数据
 * @returns object
 */
const componentMerge = (newObject: any, sources: any, notComponent = false) => {
  // 持久化 JSON 可能还会被预览或另一次恢复复用，合并过程不能反向修改输入数据。
  const sourceCopy = cloneDeep(sources ?? {})
  // 处理组件补丁
  componentVersionUpdatePolyfill(newObject, sourceCopy)

  // 非组件不处理
  if (notComponent) return merge(newObject, sourceCopy)
  // 组件排除 newObject
  const option = sourceCopy.option
  if (option === undefined) return merge(newObject, sourceCopy)

  // 为 undefined 的 sources 来源对象属性将被跳过详见 https://www.lodashjs.com/docs/lodash.merge
  delete sourceCopy.option
  return {
    ...merge(newObject, sourceCopy),
    option: option
  }
}

// 请求处理
export const useSync = () => {
  const chartEditStore = useChartEditStore()
  const chartHistoryStore = useChartHistoryStore()
  const chartLayoutStore = useChartLayoutStore()
  /**
   * * 组件动态注册
   * @param projectData 项目数据
   * @param isReplace 是否替换数据
   * @returns
   */
  const updateComponent = (projectData: ChartEditStorage, isReplace = false, changeId = false) =>
    componentUpdateQueue.run(async () => {
      const componentList = Array.isArray(projectData?.componentList) ? projectData.componentList : []
      const incomingCanvasConfig = canvasVersionUpdatePolyfill(cloneDeep(projectData?.editCanvasConfig ?? {}))
      const incomingRequestConfig = cloneDeep(projectData?.requestGlobalConfig ?? {})

      // 列表组件注册
      componentList.forEach((component: CreateComponentType | CreateComponentGroupType) => {
        const initComponent = (target: CreateComponentType) => {
          if (!window['$vue'].component(target.chartConfig.chartKey)) {
            window['$vue'].component(target.chartConfig.chartKey, fetchChartComponent(target.chartConfig))
            window['$vue'].component(target.chartConfig.conKey, fetchConfigComponent(target.chartConfig))
          }
        }

        if (component.isGroup) {
          (component as CreateComponentGroupType).groupList.forEach(initComponent)
        } else {
          initComponent(component as CreateComponentType)
        }
      })

      // 先在局部列表完整重建组件，全部成功后再一次性提交，避免失败或并发期间留下半份画布。
      const nextComponentList: Array<CreateComponentType | CreateComponentGroupType> = []
      const create = async (_componentInstance: CreateComponentType) => {
        let newComponent: CreateComponentType = await createComponent(_componentInstance.chartConfig)
        if (_componentInstance.chartConfig.redirectComponent) {
          _componentInstance.chartConfig.dataset && (newComponent.option.dataset = _componentInstance.chartConfig.dataset)
          newComponent.chartConfig.title = _componentInstance.chartConfig.title
          newComponent.chartConfig.chartFrame = _componentInstance.chartConfig.chartFrame
        }
        const source = changeId ? { ..._componentInstance, id: getUUID() } : _componentInstance
        return componentMerge(newComponent, source) as CreateComponentType
      }

      try {
        const listLength = componentList.length
        for (const [index, comItem] of componentList.entries()) {
          const percentage = Math.trunc(((index + 1) / listLength) * 100)
          chartLayoutStore.setItemUnHandle(ChartLayoutStoreEnum.PERCENTAGE, percentage)

          if (comItem.isGroup) {
            const groupSource = changeId ? { ...comItem, id: getUUID() } : comItem
            const groupClass = componentMerge(new PublicGroupConfigClass(), groupSource) as CreateComponentGroupType
            const targetList: CreateComponentType[] = []
            for (const groupItem of (comItem as CreateComponentGroupType).groupList) {
              targetList.push(await create(groupItem))
            }
            groupClass.groupList = targetList
            nextComponentList.push(groupClass)
          } else {
            nextComponentList.push(await create(comItem as CreateComponentType))
          }
        }

        if (isReplace) {
          const nextCanvasConfig = componentMerge(
            cloneDeep(chartEditStore.editCanvasConfig),
            incomingCanvasConfig,
            true
          )
          const nextRequestConfig = componentMerge(
            cloneDeep(chartEditStore.requestGlobalConfig),
            incomingRequestConfig,
            true
          )

          chartEditStore.componentList = nextComponentList
          chartEditStore.editCanvasConfig = nextCanvasConfig
          chartEditStore.requestGlobalConfig = nextRequestConfig
          chartHistoryStore.clearBackStack()
          chartHistoryStore.clearForwardStack()
        } else {
          componentMerge(chartEditStore.editCanvasConfig, incomingCanvasConfig, true)
          componentMerge(chartEditStore.requestGlobalConfig, incomingRequestConfig, true)
          nextComponentList.forEach(component => chartEditStore.addComponentList(component, false, true))
        }
      } finally {
        chartLayoutStore.setItemUnHandle(ChartLayoutStoreEnum.PERCENTAGE, 0)
      }
    })

  return {
    updateComponent
  }
}
