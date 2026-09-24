export const TASK_TIMELINE_STATES = Object.freeze([
  '待接单',
  '待服务',
  '待客服验收',
  '待客户验收',
  '待评价',
  '已结束'
])

export function formatTaskLoadError(error) {
  const detail = String(error && error.message || '任务加载失败').trim()
  const taskMissing = Number(error && error.code) === 2 || /NoExistData/i.test(detail)
  if (!taskMissing) return detail
  return `该售后任务已不存在，可能已被删除或归档\n${detail}`
}

export function buildTaskTimeline(task = {}, formatTime = (value) => value || '', options = {}) {
  const currentIndex = TASK_TIMELINE_STATES.indexOf(String(task.state || ''))
  const merchantEnabled = options.merchantAcceptanceEnabled !== false
  const customerEnabled = options.customerAcceptanceEnabled !== false
  const evaluationEnabled = options.evaluationEnabled !== false
  const reachedPostService = currentIndex >= 2 || !!task.finishTime || !!task.ShangjiaYSSJ || !!task.KehuYSSJ || !!task.PingjiaSJ
  const endedTime = task.PingjiaSJ || (currentIndex === 5 ? (task.ShangjiaYSSJ || task.finishTime || task.KehuYSSJ) : '')
  const steps = TASK_TIMELINE_STATES.map((name) => ({ name, active: false, skipped: false, current: false, time: '' }))

  for (let index = 0; index <= 1; index += 1) {
    steps[index].active = currentIndex >= index
    steps[index].current = currentIndex === index
    const value = index === 0 ? task.CreateTime : task.acceptedTime
    steps[index].time = steps[index].active && value ? formatTime(value) : ''
  }

  steps[2].skipped = !merchantEnabled
  steps[2].active = merchantEnabled && reachedPostService
  steps[2].current = merchantEnabled && currentIndex === 2
  steps[2].time = !merchantEnabled ? '不适用' : (steps[2].active && task.finishTime ? formatTime(task.finishTime) : '')

  steps[3].skipped = !customerEnabled
  steps[3].active = customerEnabled && !!task.KehuYSSJ
  steps[3].current = customerEnabled && currentIndex === 3
  steps[3].time = !customerEnabled
    ? '不适用'
    : (task.KehuYSSJ ? formatTime(task.KehuYSSJ) : (reachedPostService ? '可随时验收' : ''))

  steps[4].skipped = !evaluationEnabled
  steps[4].active = evaluationEnabled && (currentIndex >= 4 || !!task.PingjiaSJ)
  steps[4].current = evaluationEnabled && currentIndex === 4
  const evaluationEntryTime = merchantEnabled ? task.ShangjiaYSSJ : task.finishTime
  steps[4].time = !evaluationEnabled ? '不适用' : (steps[4].active && evaluationEntryTime ? formatTime(evaluationEntryTime) : '')

  steps[5].active = currentIndex === 5
  steps[5].current = currentIndex === 5
  steps[5].time = steps[5].active && endedTime ? formatTime(endedTime) : ''
  return steps
}
