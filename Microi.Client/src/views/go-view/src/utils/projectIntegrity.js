/**
 * 为异步项目读取分配单调令牌。只有最后一次读取可以提交结果，避免路由切换后旧响应覆盖新项目。
 */
export const createLatestRequestGate = () => {
  let revision = 0

  return {
    begin() {
      revision += 1
      return revision
    },
    isCurrent(token) {
      return token === revision
    },
    invalidate() {
      revision += 1
    }
  }
}

/**
 * 串行执行会修改同一个 GoView Store 的异步任务。失败任务只影响自身，不能阻断后续恢复操作。
 */
export const createSerialTaskQueue = () => {
  let tail = Promise.resolve()

  const run = task => {
    const result = tail.then(() => task())
    tail = result.then(
      () => undefined,
      () => undefined
    )
    return result
  }

  const onIdle = async () => {
    // 等待期间可能继续追加恢复任务，因此要观察到真正稳定的队尾后才能返回。
    while (true) {
      const observedTail = tail
      await observedTail
      if (observedTail === tail) return
    }
  }

  return { run, onIdle }
}

/**
 * 组件 Id 是选择、分组和事件绑定的稳定身份；顶层与分组子项必须位于同一个唯一命名空间。
 */
export const findDuplicateComponentIds = componentList => {
  const seen = new Set()
  const duplicates = new Set()

  const visit = list => {
    if (!Array.isArray(list)) return
    list.forEach(component => {
      if (!component || typeof component !== 'object') return
      const id = typeof component.id === 'string' ? component.id : ''
      if (id) {
        if (seen.has(id)) duplicates.add(id)
        else seen.add(id)
      }
      visit(component.groupList)
    })
  }

  visit(componentList)
  return Array.from(duplicates)
}
