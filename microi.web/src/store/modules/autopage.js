const state = {
  //页面数据
  formData: {},
  //当前选中容器索引
  curWrapperIdx: -1,
  //当前选中组件索引
  curWidgetIdx: -1,
  //当前选中容器
  curWrapper: {},
  //当前选中组件
  curWidget: {}
};
const mutations = {
  //切换左侧栏
  changeLeft(state) {
    state.formData.JsonObj.formConfig.left = !state.formData.JsonObj.formConfig.left;
  },
  //修改页面数据
  updateFormData(state, { newFormData }) {
    state.formData = newFormData;
  },
  //设置当前选中容器索引
  setCurWrapperIdx(state, { curWrapperIdx }) {
    state.curWrapperIdx = curWrapperIdx;
    state.curWrapper = state.formData.JsonObj.wrapperList[curWrapperIdx];
  },
  //设置当前选中组件索引
  setCurWidgetIdx(state, { curWidgetIdx }) {
    state.curWidgetIdx = curWidgetIdx;
    state.curWidget = state.formData.JsonObj.wrapperList[state.curWrapperIdx].widgetList[curWidgetIdx];
  },

  //添加容器
  addWrapper(state, { newWrapper }) {
    state.formData.JsonObj.wrapperList.push(newWrapper);
  },

  //删除容器
  delWrapper(state, { index }) {
    state.formData.JsonObj.wrapperList.splice(index, 1);
  },
  //清空容器
  clearWrapper(state) {
    state.formData.JsonObj.wrapperList = [];
  },

  //添加组件到指定容器 , 参数1 : 容器索引 ,参数2 : 组件对象
  addWidget(state, { wrapperIdx, newWidget }) {
    state.formData.JsonObj.wrapperList[wrapperIdx].widgetList.push(newWidget);
  },

  //删除组件 , 参数1 : 容器索引 ,参数2 : 组件对象
  delWidget(state, { wrapperIdx, widgetIdx }) {
    state.formData.JsonObj.wrapperList[wrapperIdx].widgetList.splice(widgetIdx, 1);
  },
  //清空容器内组件
  clearWidget(state, { wrapperIdx }) {
    state.formData.JsonObj.wrapperList[wrapperIdx].widgetList = [];
  }
};

export default {
  namespaced: true,
  state,
  mutations
};
