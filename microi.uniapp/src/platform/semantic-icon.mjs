const RULES = [
  { icon: 'notice', words: ['公告', '新闻', '通知', '消息', '资讯'] },
  { icon: 'calendar', words: ['日程', '日历', '计划', '排期'] },
  { icon: 'travel', words: ['出差', '行程', '参会', '外出'] },
  { icon: 'leave', words: ['请假', '休假', '调休', '补考勤'] },
  { icon: 'clock', words: ['打卡', '考勤', '工时', '签到'] },
  { icon: 'trend', words: ['销售', '商机', '线索', '目标', '业绩'] },
  { icon: 'customer', words: ['客户', '联系人', '会员'] },
  { icon: 'supplier', words: ['供应商', '供应链'] },
  { icon: 'contract', words: ['合同', '协议', '签约'] },
  { icon: 'finance', words: ['财务', '费用', '报销', '收款', '付款', '结算', '发票', '提成'] },
  { icon: 'inventory', words: ['采购', '库存', '仓库', '物料', '资产', '商品'] },
  { icon: 'project', words: ['项目', '实施', '开发', '工单', '服务'] },
  { icon: 'workflow', words: ['审批', '流程', '申请', '任务'] },
  { icon: 'chart', words: ['报表', '统计', '分析', '看板', '汇总'] },
  { icon: 'team', words: ['人员', '员工', '组织', '部门', '用户', '团队'] },
  { icon: 'settings', words: ['设置', '配置', '参数', '字典'] },
  { icon: 'document', words: ['日报', '周报', '总结', '档案', '文档', '记录'] }
]

export const resolveSemanticIcon = (source = {}) => {
  const text = [source.title, source.description, source.parentName, source.table, source.name]
    .filter(Boolean)
    .join(' ')
  const matched = RULES.find((rule) => rule.words.some((word) => text.includes(word)))
  return matched ? matched.icon : 'app'
}

export default resolveSemanticIcon
