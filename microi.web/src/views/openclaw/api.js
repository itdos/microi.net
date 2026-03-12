/**
 * OpenClaw 暗黑管理系统 - API请求封装
 * 统一通过 Microi 低代码平台接口引擎调用
 */
import request from '@/utils/request'

const BASE = '/api/apiengine'

// ==================== Dashboard ====================
export function getDashboardStats() {
  return request({ url: `${BASE}/oc/dashboard-stats`, method: 'post' })
}

// ==================== 任务管理 ====================
export function taskApi(params) {
  return request({ url: `${BASE}/oc/task-manage`, method: 'post', data: params })
}
export const getTaskList = (p) => taskApi({ action: 'list', ...p })
export const getTaskDetail = (id) => taskApi({ action: 'get', id })
export const addTask = (p) => taskApi({ action: 'add', ...p })
export const updateTask = (p) => taskApi({ action: 'update', ...p })
export const deleteTask = (Id) => taskApi({ action: 'delete', Id })
export const toggleTask = (Id) => taskApi({ action: 'toggle', Id })
export const executeTask = (p) => taskApi({ action: 'execute', ...p })
export const getExecutions = (p) => taskApi({ action: 'executions', ...p })
export const getTaskLogs = (p) => taskApi({ action: 'logs', ...p })
export const cancelExecution = (executionId) => taskApi({ action: 'cancel', executionId })

// ==================== 平台账号 ====================
export function accountApi(params) {
  return request({ url: `${BASE}/oc/account-manage`, method: 'post', data: params })
}
export const getAccountList = (p) => accountApi({ action: 'list', ...p })
export const getAccountDetail = (id) => accountApi({ action: 'get', id })
export const addAccount = (p) => accountApi({ action: 'add', ...p })
export const updateAccount = (p) => accountApi({ action: 'update', ...p })
export const deleteAccount = (Id) => accountApi({ action: 'delete', Id })
export const toggleAccount = (Id) => accountApi({ action: 'toggle', Id })

// ==================== 文章管理 ====================
export function articleApi(params) {
  return request({ url: `${BASE}/oc/article-manage`, method: 'post', data: params })
}
export const getArticleList = (p) => articleApi({ action: 'list', ...p })
export const getArticle = (id) => articleApi({ action: 'get', id })
export const getArticleDetail = (id) => articleApi({ action: 'get', id })
export const updateArticle = (p) => articleApi({ action: 'update', ...p })
export const deleteArticle = (Id) => articleApi({ action: 'delete', Id })
export const reviewArticle = (p) => articleApi({ action: 'review', ...p })
export const getPublishRecords = (articleId) => articleApi({ action: 'publish_records', articleId })

// ==================== 互评记录 ====================
export function interactApi(params) {
  return request({ url: `${BASE}/oc/article-manage`, method: 'post', data: params })
}
export const getInteractList = (p) => {
  return request({ url: `${BASE}/oc/task-manage`, method: 'post', data: { action: 'interact_list', ...p } })
}

// ==================== 节点管理 ====================
export function nodeApi(params) {
  return request({ url: `${BASE}/oc/node-manage`, method: 'post', data: params })
}
export const getNodeList = (p) => nodeApi({ action: 'list', ...p })
export const getNodeDetail = (id) => nodeApi({ action: 'get', id })
export const addNode = (p) => nodeApi({ action: 'add', ...p })
export const updateNode = (p) => nodeApi({ action: 'update', ...p })
export const deleteNode = (Id) => nodeApi({ action: 'delete', Id })
export const sendNodeCommand = (p) => nodeApi({ action: 'command', ...p })

// ==================== 配置管理 ====================
export function configApi(params) {
  return request({ url: `${BASE}/oc/config-manage`, method: 'post', data: params })
}
export const getLlmList = () => configApi({ action: 'llm_list' })
export const addLlm = (p) => configApi({ action: 'llm_add', ...p })
export const updateLlm = (p) => configApi({ action: 'llm_update', ...p })
export const deleteLlm = (Id) => configApi({ action: 'llm_delete', Id })
export const setDefaultLlm = (Id) => configApi({ action: 'llm_set_default', Id })
export const getConfigList = (p) => configApi({ action: 'config_list', ...p })
export const saveConfigs = (configs) => configApi({ action: 'config_save', configs })
