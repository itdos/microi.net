export const reportTypes = [
  [13,'IP · 请求数'],[15,'IP · 流量'],[1,'URL · 请求数'],[3,'URL · 流量'],[5,'Referer · 请求数'],[7,'Referer · 流量'],
  [9,'回源 URL · 请求数'],[11,'回源 URL · 流量'],[17,'域名流量'],[19,'PV / UV'],[21,'地区'],[23,'运营商']
]
export function parse(value, fallback = {}) { if (typeof value !== 'string') return value ?? fallback; try { return JSON.parse(value) } catch { return fallback } }
export function reportRows(content) {
  const result=[],seen=new Set()
  function walk(value,depth=0) {
    if(depth>8)return
    const v=parse(value,null)
    if(Array.isArray(v)){for(const item of v)walk(item,depth+1);return}
    if(!v||typeof v!=='object')return
    if(['acc','traf','pv','uv','count','traffic','requests'].some(k=>v[k]!=null&&typeof v[k]!=='object')){
      const key=JSON.stringify(v);if(!seen.has(key)){seen.add(key);result.push(v)};return
    }
    for(const [key,item] of Object.entries(v))if(!['header','legend','xAxis','yAxis','format'].includes(key))walk(item,depth+1)
  }
  walk(content)
  return result.slice(0,500)
}
export function bytes(value) { const n=Number(value);if(!Number.isFinite(n))return '—';const units=['B','KB','MB','GB','TB'];let x=n,i=0;while(x>=1024&&i<4){x/=1024;i++}return `${x.toLocaleString('zh-CN',{maximumFractionDigits:2})} ${units[i]}` }
export function csv(rows) { const keys=[...new Set(rows.flatMap(Object.keys))];const quote=v=>`"${String(v??'').replace(/^[=+@-]/,"'$&").replaceAll('"','""')}"`;return '\uFEFF'+[keys,...rows.map(r=>keys.map(k=>r[k]))].map(row=>row.map(quote).join(',')).join('\r\n') }
export const statuses={Pending:'排队中',Running:'执行中',Succeeded:'已回读确认',AwaitingVerification:'等待云端确认',Unknown:'结果未知，需回读',Conflict:'配置冲突，未写入',Expired:'已到期解封',Observed:'观察命中'}
