import { defineStore } from 'pinia'
import { generateId, deepClone, } from '../utils/util'
export const usePageEngineStore = defineStore('pageEngine', {
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
    //是否开启新手引导
    tour: localStorage.getItem('page_tour') || true, // 初始化时从 localStorage 读取 tourOpen
    //是否开启暗黑模式
    dark: localStorage.getItem('page_dark') || false, // 初始化时从 localStorage 读取 isDark
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

    //设置引导
    setTour(isOpen) {
      this.tour = isOpen;
      localStorage.setItem('page_tour', isOpen);
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
      this.setTour(true)
      this.setDark(true)
      this.clearWrapper()
      localStorage.removeItem('page_formData');
    }
  }
})
