const state = {
  SysConfig: {}
};
const mutations = {
  SetSysConfig(state, val) {
    state.SysConfig = val;
  }
};
const actions = {};
// 返回改变后的数值
const getters = {};
export default {
  namespaced: true,
  state,
  mutations,
  actions,
  getters
};
