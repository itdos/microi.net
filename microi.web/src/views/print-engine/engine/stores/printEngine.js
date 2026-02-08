import { defineStore } from 'pinia'
export const usePrintEngineStore = defineStore('printEngine', {
  // 定义状态
  state: () => ({
    //token
    token: localStorage.getItem('print_token') || '',  // 初始化时从 localStorage 读取 token
  }),
  // 定义 actions，可以包含异步操作
  actions: {
    //设置token
    setToken(newToken) {
      this.token = newToken;
      localStorage.setItem('print_token', newToken);  // 保存 token 到 localStorage
    },
    //清楚token
    clearToken() {
      this.token = '';
      localStorage.removeItem('print_token');  // 清除 localStorage 中的 token
    },
  },
})
