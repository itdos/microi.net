export const routes = [
  { path: '/overview', title: '治理总览', eyebrow: 'CONTROL CENTER', icon: '◫' },
  { path: '/portal', title: '门户编排', eyebrow: 'PORTAL', icon: '▦' },
  { path: '/identity', title: '身份与权限', eyebrow: 'IDENTITY', icon: '◎' },
  { path: '/access', title: '用户组与授权', eyebrow: 'ACCESS', icon: '⌁' },
  { path: '/configuration', title: '配置治理', eyebrow: 'CONFIG', icon: '▣' },
  { path: '/release', title: '灰度与发布', eyebrow: 'RELEASE', icon: '⇧' },
  { path: '/services', title: '服务目录', eyebrow: 'SERVICE', icon: '⌘' },
  { path: '/observability', title: '可观测与告警', eyebrow: 'OBSERVE', icon: '⌁' },
  { path: '/assets', title: '资产与协作', eyebrow: 'ASSETS', icon: '◇' },
  { path: '/import', title: '迁移导入', eyebrow: 'MIGRATION', icon: '⇄' }
] as const

export type RoutePath = typeof routes[number]['path']

export function normalizeRoute(value: unknown): RoutePath {
  const text = String(value ?? '').trim()
  const matched = routes.find((item) => text === item.path || text.endsWith(item.path) || text.includes(`${item.path}?`))
  return matched?.path ?? '/overview'
}

export function isInternalPath(value: unknown): value is string {
  const text = String(value ?? '')
  return text.startsWith('/') && !text.startsWith('//') && !text.includes('access_key=') && !text.includes('/login')
}
