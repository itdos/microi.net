/**
 * go-view 路由适配层
 * 使用 microi.web 的主路由实例
 */

// 延迟获取 router 实例（避免循环依赖）
function getRouterInstance() {
  // @ts-ignore - 从 window 获取 vue-router 实例
  const app = window['$vue']
  if (app && app.config && app.config.globalProperties.$router) {
    return app.config.globalProperties.$router
  }
  // fallback: 通过 hash 模拟基本路由操作
  return {
    push(to: any) {
      if (typeof to === 'string') {
        window.location.hash = '#' + to
      } else if (to.path) {
        window.location.hash = '#' + to.path
      } else if (to.name) {
        console.warn('[go-view router] name-based navigation requires full router instance')
      }
    },
    replace(to: any) { this.push(to) },
    go(n: number) { window.history.go(n) },
    back() { window.history.back() },
    resolve(to: any) {
      if (typeof to === 'object' && to.name) {
        // 简单映射 go-view 关键路由名到 microi.web 路径
        const nameMap: Record<string, string> = {
          'mic_data_dashboard_design': '/mic/data-dashboard/design',
          'mic_data_dashboard_preview': '/mic/data-dashboard/preview',
          'ChartPreview': '/mic/data-dashboard/preview',
          'ChartHome': '/mic/data-dashboard/design',
        }
        const basePath = nameMap[to.name] || '/'
        return {
          path: basePath,
          href: '#' + basePath,
          fullPath: basePath
        }
      }
      return { path: '/', href: '#/', fullPath: '/' }
    },
    currentRoute: { value: { params: {}, query: {} } }
  }
}

const routerProxy = new Proxy({} as any, {
  get(_target, prop) {
    const instance = getRouterInstance()
    const value = instance[prop]
    if (typeof value === 'function') {
      return value.bind(instance)
    }
    return value
  }
})

export default routerProxy
