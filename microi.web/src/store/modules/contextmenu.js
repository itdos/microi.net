const state = {
  menuTop: 0, // 右击菜单数据
  menuLeft: 0,
  menuShow: false
};
const mutations = {
  showContextMenu(state, { top, left }) {
    console.log("showContextMenu", top, left);
    state.menuShow = true;
    state.menuTop = top;
    state.menuLeft = left;
  },

  hideContextMenu(state) {
    state.menuShow = false;
  }
};

export default {
  namespaced: true,
  state,
  mutations
};
