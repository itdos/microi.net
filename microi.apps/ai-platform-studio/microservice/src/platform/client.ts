import { createMicroiV8 } from '../utils/microi.v8.js'
import type { DosResult, HostContext, TablePage } from '../domain/models'

const clients = new Map<string, ReturnType<typeof createMicroiV8>>()

function getClient(context: HostContext) {
  const key = `${context.apiBase}|${context.osClient}|${context.token}`
  const existing = clients.get(key)
  if (existing) return existing
  const client = createMicroiV8({ apiBase: context.apiBase, osClient: context.osClient, token: context.token })
  client.configure({ apiBase: context.apiBase, osClient: context.osClient, token: context.token })
  clients.set(key, client)
  return client
}

function unwrap<T>(value: unknown, fallback: string): DosResult<T> {
  const result = value as DosResult<T> | null
  if (!result || typeof result.Code !== 'number') throw new Error(fallback)
  if (result.Code !== 1) throw new Error(result.Msg || fallback)
  return result
}

export async function runEngine<T>(context: HostContext, key: string, params: Record<string, unknown> = {}): Promise<T> {
  const result = unwrap<T>(await getClient(context).ApiEngine.Run(key, params), `接口 ${key} 调用失败`)
  return result.Data as T
}

export async function getTable<T>(context: HostContext, table: string, params: Record<string, unknown> = {}): Promise<TablePage<T>> {
  const result = unwrap<T[]>(await getClient(context).FormEngine.GetTableData(table, {
    _PageIndex: 1,
    _PageSize: 200,
    _OrderBy: 'UpdateTime',
    _OrderByType: 'DESC',
    ...params
  }), `读取 ${table} 失败`)
  return { rows: Array.isArray(result.Data) ? result.Data : [], total: Number(result.DataCount ?? 0) }
}

export async function addRow<T>(context: HostContext, table: string, data: Record<string, unknown>): Promise<T> {
  return unwrap<T>(await getClient(context).FormEngine.AddFormData(table, data), `新增 ${table} 失败`).Data as T
}

export async function updateRow<T>(context: HostContext, table: string, data: Record<string, unknown>): Promise<T> {
  return unwrap<T>(await getClient(context).FormEngine.UptFormData(table, data), `更新 ${table} 失败`).Data as T
}

export async function runBackground<T>(
  context: HostContext,
  key: string,
  params: Record<string, unknown>,
  title: string,
  options: Record<string, unknown>
): Promise<T> {
  const result = unwrap<T>(await getClient(context).post('/api/BackgroundTask/RunApiEngine', {
    ApiEngineKey: key,
    Param: params,
    Title: title,
    Options: options
  }), `后台任务 ${key} 提交失败`)
  return result.Data as T
}

export async function listBackground<T>(context: HostContext): Promise<T[]> {
  const result = unwrap<T[]>(await getClient(context).post('/api/BackgroundTask/List', {}), '读取后台任务失败')
  return Array.isArray(result.Data) ? result.Data : []
}

export async function cancelBackground(context: HostContext, id: string): Promise<void> {
  unwrap(await getClient(context).post('/api/BackgroundTask/Cancel', { Id: id }), '停止后台任务失败')
}
