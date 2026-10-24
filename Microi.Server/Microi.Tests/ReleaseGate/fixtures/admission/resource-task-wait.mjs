import {setTimeout as delay} from 'node:timers/promises';

// 已核验依赖上的完整通知包安装曾执行 63 个持久化分片、耗时 17 分 07 秒。
// 因此与租户创建保持一致，固定等待 30 分钟；进度更新和任务续跑均不重置期限。
export const RESOURCE_INSTALL_TIMEOUT_MS = 30 * 60 * 1000;
const POLL_INTERVAL_MS = 2000;
const TERMINAL_STATES = new Set(['Succeeded', 'Failed', 'Canceled']);

// 仅回读已提交任务，传输错误原样抛出，不在这里重试或重新提交。
// 终态或期限到达后独立读取真实 Detail；仍在等待的任务也必须保留真实状态。
export async function waitForResourceTask(taskId, {
  readStatus, readDetail, now = Date.now, sleep = delay
}) {
  const deadline = now() + RESOURCE_INSTALL_TIMEOUT_MS;
  let status;
  do {
    status = await readStatus(taskId);
    if (TERMINAL_STATES.has(status.Status)) break;
    const remaining = deadline - now();
    if (remaining <= 0) break;
    await sleep(Math.min(POLL_INTERVAL_MS, remaining));
  } while (now() < deadline);
  const detail = await readDetail(taskId);
  return {status, detail};
}
