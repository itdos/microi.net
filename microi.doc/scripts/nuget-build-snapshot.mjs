import {
  NUGET_FALLBACK_STATS,
  loadNugetSnapshot
} from '../docs/.vitepress/theme/utils/nuget-downloads.js'

export const NUGET_BUILD_DEFINE = '__MICROI_NUGET_BUILD_SNAPSHOT__'

/**
 * 构建只读官方已持久化的统计，保留原采集时间；不能触发采集或写回数据库。
 * SSR 与客户端必须使用同一个冻结值，避免无 JavaScript 的读者停在固定历史数字。
 */
export function nugetBuildSnapshotPlugin({
  fetchImpl = globalThis.fetch,
  timeoutMs = 4500,
  warn = message => console.warn(message)
} = {}) {
  let snapshotPromise
  return {
    name: 'microi-nuget-build-snapshot',
    apply: 'build',
    async config() {
      // VitePress 分别编译客户端和 SSR，同一插件实例只读取一次并共享结果。
      snapshotPromise ||= loadNugetSnapshot({ fetchImpl, timeoutMs })
        .then(snapshot => Object.freeze({
          ...snapshot,
          stage: 'build',
          cacheState: 'build-snapshot',
          didRefresh: false,
          isLive: false
        }))
        .catch(() => {
          // 网络、超时或契约错误不伪造新日期，也不把历史兜底称为最新采集。
          warn(`[NuGet] 构建快照读取失败，保留历史快照及原采集时间 ${NUGET_FALLBACK_STATS.queriedAt}；浏览器仍可读取后续成功快照。`)
          return NUGET_FALLBACK_STATS
        })
      return { define: { [NUGET_BUILD_DEFINE]: JSON.stringify(await snapshotPromise) } }
    }
  }
}
