export interface DosResult<T = unknown> {
  Code: number
  Data?: T
  DataCount?: number
  Msg?: string
}
export interface HostContext {
  apiBase: string
  osClient: string
  token: string
  appKey: string
  buildVersion: string
  routePath: string
  hostGeneration: string
  hostMountAttempt: string
  hostActions: string[]
}

export interface TablePage<T> {
  rows: T[]
  total: number
}

export interface Metric {
  key: string
  label: string
  value: number | string
  hint: string
  tone: 'primary' | 'success' | 'warning' | 'danger' | 'neutral'
}

export interface ActionState<T = unknown> {
  status: 'idle' | 'loading' | 'success' | 'error'
  data?: T
  message?: string
}
