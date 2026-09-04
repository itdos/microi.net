export const TASK_TIMELINE_STATES = Object.freeze([
  '待接单',
  '待服务',
  '待商家验收',
  '待客户验收',
  '待评价',
  '已结束'
])

export function buildTaskTimeline(task = {}, formatTime = (value) => value || '') {
  const currentIndex = TASK_TIMELINE_STATES.indexOf(String(task.state || ''))
  // 完结日期只认真实评价时间，避免用通用 UpdateTime 把未评价任务误画成“已结束”。
  const times = [
    task.CreateTime,
    task.acceptedTime,
    task.finishTime,
    task.ShangjiaYSSJ,
    task.KehuYSSJ,
    task.PingjiaSJ
  ]

  return TASK_TIMELINE_STATES.map((name, index) => {
    const active = currentIndex >= 0 && index <= currentIndex
    return {
      name,
      active,
      current: currentIndex === index,
      time: active && times[index] ? formatTime(times[index]) : ''
    }
  })
}
