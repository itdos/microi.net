// 演示插件主入口文件

// 插件路由配置
export const routes = [
  {
    path: '/demo',
    name: 'DemoIndex',
    component: () => import('./index.vue')
  }
]

// 插件组件（用于在选中区域中渲染）
export const components = {
  DemoComponent: () => import('./index.vue')
}

// 插件初始化函数
export async function init() {
  console.log('演示插件初始化完成')
}

// 插件卸载函数
export async function destroy() {
  console.log('演示插件卸载完成')
}
