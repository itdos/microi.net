// 快照缺失是设备尚未上报的业务状态，文案由租户提供，通用表单不硬编码业务表名。
export function iotFormPresentation(context = {}) {
  if (String(context.tableName || '').toLowerCase() !== 'diy_yuelong_device') return null
  return {
    emptyRecord: {
      title: '暂无物联网快照',
      message: '该设备尚未收到物联网数据，请稍后再查看。'
    }
  }
}
