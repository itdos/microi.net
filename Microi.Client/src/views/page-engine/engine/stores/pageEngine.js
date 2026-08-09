import { getCurrentInstance, inject } from 'vue'
import { createPinia, defineStore } from 'pinia'
import { generateId, deepClone, } from '../utils/util.js'

export const PAGE_ENGINE_STORE_KEY = Symbol('microi-page-engine-store')
export const PAGE_ENGINE_RENDER_CONTEXT_KEY = Symbol('microi-page-engine-render-context')

const useDefaultPageEngineStore = defineStore('pageEngine', {
  // 定义状态
  state: () => ({
    //页面数据
    formData: {},
    //当前选中容器索引
    curWrapperIdx: -1,
    //当前选中组件索引
    curWidgetIdx: -1,
    //当前选中容器
    curWrapper: {},
    //当前选中组件
    curWidget: {},
    //token
    token: localStorage.getItem('page_token') || '',  // 初始化时从 localStorage 读取 token
    //是否开启暗黑模式
    dark: localStorage.getItem('page_dark') || false, // 初始化时从 localStorage 读取 isDark
    // 当前服务端内容哈希与历史能力状态，用于多人协作的乐观并发保护。
    currentHash: '',
    historyAvailable: false,
    // 设计期本地撤销/重做只保存有界 JSON 快照，不进入服务器版本历史。
    undoStack: [],
    redoStack: [],
    currentDesignSnapshot: '',
    historyApplying: false,
    historyLimitCount: 50,
    historyLimitBytes: 20 * 1024 * 1024,
    components: {},//注册组件
    widgetList: []//组件列表
  }),

  // 定义 actions，可以包含异步操作
  actions: {
    //切换左侧栏
    changeLeft() {
      this.formData.JsonObj.formConfig.left =
        !this.formData.JsonObj.formConfig.left
    },
    //修改页面数据
    updateFormData(newFormData) {
      this.formData = newFormData
      this.resetDesignHistory()
    },
    setVersionState(currentHash, historyAvailable) {
      this.currentHash = currentHash || ''
      this.historyAvailable = historyAvailable === true
    },
    serializeDesignSnapshot() {
      try {
        return JSON.stringify(this.formData?.JsonObj || {})
      } catch (error) {
        return ''
      }
    },
    resetDesignHistory() {
      this.undoStack = []
      this.redoStack = []
      this.currentDesignSnapshot = this.serializeDesignSnapshot()
      this.historyApplying = false
    },
    trimDesignHistory() {
      while (this.undoStack.length > this.historyLimitCount) this.undoStack.shift()
      let totalBytes = this.currentDesignSnapshot.length
        + this.undoStack.reduce((sum, item) => sum + item.length, 0)
        + this.redoStack.reduce((sum, item) => sum + item.length, 0)
      while (totalBytes > this.historyLimitBytes && this.undoStack.length) {
        totalBytes -= this.undoStack[0].length
        this.undoStack.shift()
      }
      while (totalBytes > this.historyLimitBytes && this.redoStack.length) {
        totalBytes -= this.redoStack[0].length
        this.redoStack.shift()
      }
    },
    captureDesignHistory() {
      if (this.historyApplying) return false
      const next = this.serializeDesignSnapshot()
      if (!next || next === this.currentDesignSnapshot) return false
      if (!this.currentDesignSnapshot) {
        this.currentDesignSnapshot = next
        return false
      }
      this.undoStack.push(this.currentDesignSnapshot)
      this.currentDesignSnapshot = next
      this.redoStack = []
      this.trimDesignHistory()
      return true
    },
    applyDesignSnapshot(snapshot) {
      if (!snapshot) return false
      let parsed
      try { parsed = JSON.parse(snapshot) } catch (error) { return false }
      this.historyApplying = true
      this.formData.JsonObj = parsed
      this.currentDesignSnapshot = snapshot
      this.curWrapperIdx = -1
      this.curWidgetIdx = -1
      this.curWrapper = {}
      this.curWidget = {}
      return true
    },
    undoDesign() {
      this.captureDesignHistory()
      const target = this.undoStack.pop()
      if (!target) return false
      if (this.currentDesignSnapshot) this.redoStack.push(this.currentDesignSnapshot)
      this.trimDesignHistory()
      return this.applyDesignSnapshot(target)
    },
    redoDesign() {
      const target = this.redoStack.pop()
      if (!target) return false
      if (this.currentDesignSnapshot) this.undoStack.push(this.currentDesignSnapshot)
      this.trimDesignHistory()
      return this.applyDesignSnapshot(target)
    },
    finishDesignHistoryApply() {
      this.historyApplying = false
    },
    //设置当前选中容器索引
    setCurWrapperIdx(curWrapperIdx) {
      this.curWrapperIdx = curWrapperIdx
      this.curWrapper = this.formData.JsonObj.wrapperList[curWrapperIdx]
    },
    //设置当前选中组件索引
    setCurWidgetIdx(curWidgetIdx) {
      this.curWidgetIdx = curWidgetIdx
      this.curWidget =
        this.formData.JsonObj.wrapperList[this.curWrapperIdx].widgetList[
        curWidgetIdx
        ]
    },
    //直接设置当前选中组件（用于Tab容器内的组件）
    setCurWidgetDirect(widget) {
      this.curWidgetIdx = 0
      this.curWidget = widget
    },

    //添加容器
    addWrapper(newWrapper) {
      this.formData.JsonObj.wrapperList.push(newWrapper)
    },

    //删除容器
    delWrapper(index) {
      this.formData.JsonObj.wrapperList.splice(index, 1)
      this.curWrapperIdx = -1
    },
    //克隆容器及子元素
    copyWrapper(newWrapper) {

      let newWrapperNumber = generateId(); //动态生成新容器编号
      let cloneWrapper = deepClone(newWrapper); //克隆容器
      cloneWrapper.wrapperOption.number = newWrapperNumber; //赋予新编号
      let widgetList = cloneWrapper.widgetList;
      widgetList.forEach(widget => {
        widget.widgetOption.number = generateId();
        widget.widgetOption.wrapperNumber = newWrapperNumber;
      });
      this.formData.JsonObj.wrapperList.push(cloneWrapper)
    },

    //克隆组件
    copyWidget(curWrapper, curWidget) {
      let newWidgetNumber = generateId(); //动态生成新容器编号
      let cloneWidget = deepClone(curWidget); //克隆容器
      cloneWidget.widgetOption.number = newWidgetNumber; //赋予新编号
      curWrapper.widgetList.push(cloneWidget)
    },
    //清空容器
    clearWrapper() {
      this.formData.JsonObj.wrapperList = []
      this.curWrapperIdx = -1
      this.curWidgetIdx = -1
    },

    //添加组件到指定容器 , 参数1 : 容器索引 ,参数2 : 组件对象
    addWidget(wrapperIdx, newWidget) {
      this.formData.JsonObj.wrapperList[wrapperIdx].widgetList.push(newWidget)
    },

    //删除组件 , 参数1 : 容器索引 ,参数2 : 组件对象
    delWidget(wrapperIdx, widgetIdx) {
      this.formData.JsonObj.wrapperList[wrapperIdx].widgetList.splice(
        widgetIdx,
        1
      )
    },
    //清空容器内组件
    clearWidget(wrapperIdx) {
      this.formData.JsonObj.wrapperList[wrapperIdx].widgetList = []
    },
    //设置token
    setToken(newToken) {
      this.token = newToken;
      localStorage.setItem('page_token', newToken);  // 保存 token 到 localStorage
    },
    //清除token
    clearToken() {
      this.token = '';
      localStorage.removeItem('page_token');  // 清除 localStorage 中的 token
    },

    //设置暗黑模式
    setDark(isDark) {
      this.dark = isDark;
      localStorage.setItem('page_dark', isDark);
      this.formData.JsonObj.formConfig.dark = isDark
    },

    setLastRefreshTime() {
      this.formData.JsonObj.formConfig.lastRefreshTime = new Date().toLocaleString()
    },

    //初始化
    setIni() {
      this.setDark(true)
      this.clearWrapper()
      localStorage.removeItem('page_formData');
    }
  }
})

// 嵌套界面引擎必须拥有独立状态，不能复用宿主页面的 formData。
// 普通页面仍使用应用级 Pinia；pageengine-widget 会为子渲染树 provide 独立 store。
export const usePageEngineStore = (pinia) => {
  if (!pinia && getCurrentInstance()) {
    const isolatedStore = inject(PAGE_ENGINE_STORE_KEY, null)
    if (isolatedStore) return isolatedStore
  }
  return useDefaultPageEngineStore(pinia)
}

export const createIsolatedPageEngineStore = () => {
  return useDefaultPageEngineStore(createPinia())
}
