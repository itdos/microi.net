let csrfToken = '';
export async function api(path, data, method = data === undefined ? 'GET' : 'POST') {
  const response = await fetch('/ops-api/' + path, {
    method, credentials: 'same-origin', cache: 'no-store', redirect: 'error',
    headers: { 'Content-Type': 'application/json', ...(method !== 'GET' ? { 'X-Ops-CSRF': csrfToken } : {}) },
    ...(data !== undefined ? { body: JSON.stringify(data) } : {})
  });
  const body = await response.text();
  let result;
  try { result = body ? JSON.parse(body) : {}; } catch { throw new Error('服务响应异常，请重新打开独立运维地址。'); }
  if (!response.ok) {
    const error = new Error(result.error || (response.status === 401 ? '登录已失效，请重新登录。' : `请求失败 (${response.status})`));
    error.status = response.status;
    throw error;
  }
  if (path === 'session') csrfToken = result.csrfToken;
  return result;
}
export const states = { Queued: '等待执行', Running: '正在更新', Recovering: '正在恢复', NeedsAttention: '需要处理', Succeeded: '已完成', Failed: '未完成', RolledBack: '已恢复原容器' };
export function formatTime(value) { return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '—'; }
export function formatBytes(value) { return value > 1024 * 1024 ? (value / 1024 / 1024).toFixed(1) + ' MB' : Math.round(value / 1024) + ' KB'; }
