export const trialLabels = { Trial:'试用中',Expiring:'即将到期',Expired:'试用已到期',Converted:'已转化',Disabled:'已停用',Unclassified:'未登记试用' }
export const usageLabels = { Forms:'表单',Fields:'字段',ApiEngines:'接口引擎',Menus:'菜单',Users:'用户',Roles:'角色',Departments:'部门',Workflows:'工作流',Pages:'界面',DataSources:'数据源',Jobs:'任务',MicroServices:'微服务',InstalledApps:'已安装应用版本',PhysicalTables:'物理表',ActiveUsers7Days:'近7天登录用户',ActiveUsers30Days:'近30天登录用户',NeverLoggedInUsers:'从未登录用户',EnabledUsers:'启用用户' }
export const terminalTask = status => ['Succeeded','Failed','Canceled'].includes(status)
// 未读、失败和缺失指标保留未知；只有实际空范围或读取到0才显示0。
export function summarizeUsage(items,targets) {
  const keys=Object.keys(usageLabels), scope=new Map(targets.map(t=>[t.Id,t.ReferralUserId||'unassigned']))
  const empty=total=>({Total:total,Readable:0,Metrics:Object.fromEntries(keys.map(k=>[k,{Value:total===0?0:null,Covered:0}])),OldestCollectedAt:''})
  const result={...empty(scope.size),Team:{}}
  for(const owner of scope.values()){if(!result.Team[owner])result.Team[owner]=empty(1);else result.Team[owner].Total++}
  const seen=new Set()
  for(const item of items){if(!scope.has(item.Id)||seen.has(item.Id))continue;seen.add(item.Id)
    if(!['Ready','Partial','Stale'].includes(item.Status))continue
    const group=result.Team[scope.get(item.Id)]
    for(const aggregate of [result,group]){aggregate.Readable++
      if(item.CollectedAt&&(!aggregate.OldestCollectedAt||item.CollectedAt<aggregate.OldestCollectedAt))aggregate.OldestCollectedAt=item.CollectedAt
      for(const key of keys){const value=item[key];if(typeof value!=='number'||!Number.isFinite(value)||value<0)continue
        aggregate.Metrics[key].Value=(aggregate.Metrics[key].Value??0)+value;aggregate.Metrics[key].Covered++
      }
    }
  }
  return result
}
export function csvCell(value) {
  let text=String(value ?? '').replace(/[\r\n]+/g,' ')
  if(/^[\s]*[=+\-@]/.test(text))text="'"+text
  return '"'+text.replace(/"/g,'""')+'"'
}
export function tenantCsv(rows) {
  const fields=['ClientName','OsClient','ReferralUserName','TrialState','TrialStartTime','TrialEndTime','PromotionContact','PromotionPhone','PromotionNextFollowup','CreateTime']
  return '\ufeff'+[['系统名称','租户标识','推荐人','试用状态','试用开始UTC','试用结束UTC','联系人','联系电话','下次跟进UTC','创建时间'],...rows.map(row=>fields.map(key=>key==='TrialState'?trialLabels[row[key]]||row[key]:row[key]))].map(row=>row.map(csvCell).join(',')).join('\r\n')
}
export function safeTaskSnapshot(value) {
  if(!value||typeof value!=='object'||typeof value.RequestId!=='string'||typeof value.ProgressToken!=='string')return null
  return { RequestId:value.RequestId,ProgressToken:value.ProgressToken,TaskId:String(value.TaskId||'') }
}
export function promotionTheme(context={}) {
  const dark=context.themeMode==='dark', t=context.themeTokens||{}
  return { '--sp-primary':context.themeColor||'#337af5','--sp-primary-text':context.themePrimaryText||context.themeColor||'#2563d7','--sp-on-primary':context.themeOnPrimary||'#fff',
    '--sp-bg':t.background|| (dark?'#111923':'#f3f6fb'),'--sp-surface':t.surface||(dark?'#1b2533':'#fff'),
    '--sp-text':t.textPrimary||(dark?'#eef3fb':'#18273d'),'--sp-muted':t.textSecondary||(dark?'#b0bed2':'#64758c'),
    '--sp-border':t.border||(dark?'#354357':'#e3eaf4') }
}
