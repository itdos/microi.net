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
function rgb(value) {
  const hex=String(value).match(/^#([a-f\d]{3}|[a-f\d]{6})$/i)
  if(hex){const s=hex[1].length===3?[...hex[1]].map(c=>c+c).join(''):hex[1];return [0,2,4].map(i=>parseInt(s.slice(i,i+2),16))}
  const match=String(value).match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i)
  return match?match.slice(1,4).map(Number):null
}
function contrast(a,b) {
  const lum=c=>c.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0)
  const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)
}
const mix=(a,b,weight)=>a.map((v,i)=>v*weight+b[i]*(1-weight))
function readableTone(value,backgrounds,dark,fallback) {
  const source=rgb(value)||rgb(fallback),target=dark?[255,255,255]:[0,0,0]
  for(let step=0;step<=20;step++){
    const tone=mix(target,source,step/20).map(Math.round)
    if(backgrounds.every(bg=>contrast(tone,bg)>=4.5))return `rgb(${tone.join(', ')})`
  }
  return dark?'#fff':'#000'
}
export function promotionTheme(context={}) {
  const dark=context.themeMode==='dark', t=context.themeTokens||{}
  const primary=context.themeColor||'#337af5',bg=t.background||(dark?'#111923':'#f3f6fb'),surface=t.surface||(dark?'#1b2533':'#fff')
  const surfaceRgb=rgb(surface)||rgb(dark?'#1b2533':'#fff'),primaryRgb=rgb(primary)||rgb('#337af5')
  const backgrounds=[rgb(bg)||surfaceRgb,surfaceRgb,mix(primaryRgb,surfaceRgb,.12)]
  // 主色保留用户选择；正文及状态文字同时满足卡片、页面和选中菜单底色的可读性。
  const tone=(value,fallback)=>readableTone(value,backgrounds,dark,fallback)
  const onPrimary=rgb(context.themeOnPrimary||'#fff')
  return { '--sp-primary':primary,'--sp-primary-text':tone(context.themePrimaryText||primary,dark?'#9ec5ff':'#2563d7'),
    '--sp-on-primary':onPrimary&&contrast(onPrimary,primaryRgb)>=4.5?(context.themeOnPrimary||'#fff'):(contrast([255,255,255],primaryRgb)>=4.5?'#fff':'#000'),
    '--sp-bg':bg,'--sp-surface':surface,'--sp-text':tone(t.textPrimary,dark?'#eef3fb':'#18273d'),'--sp-muted':tone(t.textSecondary,dark?'#b0bed2':'#64758c'),
    '--sp-success':tone(dark?'#75ddb3':'#137853','#137853'),
    '--sp-warning':readableTone(dark?'#f5c978':'#95600e',[...backgrounds,mix(rgb('#e8a33b'),surfaceRgb,.13)],dark,'#95600e'),
    '--sp-danger':readableTone(dark?'#ffb4b4':'#b91c1c',[...backgrounds,mix(rgb('#ef6970'),surfaceRgb,.1)],dark,'#b91c1c'),
    '--sp-border':t.border||(dark?'#354357':'#e3eaf4') }
}
