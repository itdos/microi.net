function orderStatusPolicy(row, today) {
  row = row || {};
  var labels = { 1: '待审批', 2: '进行中', 4: '已终止', 5: '终止待审批', 7: '已到期' };
  var oldLabels = { '待审批': 1, '已驳回': 1, '已审批': 2, '已完成': 2,
    '进行中': 2, '已作废': 4, '已终止': 4, '待审批作废': 5,
    '待审核作废': 5, '终止待审批': 5, '已到期': 7 };
  // 优先使用已有稳定数字值；兼容旧标签，6、3分别归并到1、2。
  var state = Number(row.DingdanZTZ) || oldLabels[String(row.DingdanZT || '')] || 1;
  if (state === 6) state = 1;
  if (state === 3) state = 2;
  function day(value) {
    var text = String(value || '').trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return '';
    var parsed = new Date(text + 'T00:00:00Z');
    return !isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === text ? text : '';
  }
  var current = day(today), serviceEnd = day(row.FuwuJSSJ), contractEnd = day(row.HetongJSSJ);
  if (!current) throw new Error('服务端日期无效');
  var expired = !!((serviceEnd && serviceEnd < current) || (contractEnd && contractEnd < current));
  if (row.HetongZT === '已断约' || state === 4) state = 4;
  // 审批阶段保持可办理；驳回不能因日期刷新重新丢失“待审批”。
  else if (state !== 1 && state !== 5) state = expired ? 7 : 2;
  if (!labels[state]) throw new Error('订单状态无效');
  return { DingdanZT: labels[state], DingdanZTZ: state, Expired: expired };
}
export function resolveOrderStatus(row={},today){
 if(!today){const d=new Date();today=String(d.getFullYear())+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
 const result=orderStatusPolicy(row,today);return {DingdanZT:result.DingdanZT,DingdanZTZ:result.DingdanZTZ};
}
