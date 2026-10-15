import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import { DatabaseSync } from 'node:sqlite'
import { loadOrderListSummary } from '../src/tenants/xjy/order-list-summary.mjs'

const source = fs.readFileSync(new URL('../src/tenants/xjy/api-engines/xjy-order-contract-totals.js', import.meta.url), 'utf8')
const menuId = 'fc56123e-cfa1-4690-a6a4-929f202a817b'
const orders = [
  ['active','已审批','未断约','2026-10-15','2026-10-15',1000],
  ['expired','已到期','未断约','2025-01-01','2025-12-31',2000],
  ['ended','已审批','已断约','2026-01-01','2027-01-01',3000],
  ['future','已审批','未断约','2026-10-16','2027-01-01',4000],
  ['pending','待审批','未断约','2026-01-01','2027-01-01',5000],
  ['void','已作废','未断约','2026-01-01','2027-01-01',6000],
  ['hidden','已审批','未断约','2026-01-01','2027-01-01',7000]
]
const products = [
  ['r1','active','租赁','2',100,null,null,2],
  ['b1','active','买断+包年换芯','4',null,20,50,2],
  ['r2','expired','','2',200,null,null,1],
  ['b2','expired','买断','1',300,null,null,1],
  ['f2','expired','包年换芯','3',null,40,null,1],
  ['r3','ended','租赁','2',400,null,null,1],
  ['r4','future','租赁','2',500,null,null,1],
  ['bad','pending','买断','1',9999,null,null,1],
  ['hidden-product','hidden','买断','1',999999,null,null,1]
]

function execute(params = {}, options = {}) {
  const db = new DatabaseSync(':memory:')
  const requests = [], queries = []
  db.exec('CREATE TABLE Diy_Dingdan (Id TEXT,DingdanZT TEXT,HetongZT TEXT,HetongKSSJ TEXT,HetongJSSJ TEXT,DingdanJE REAL,IsDeleted INTEGER); CREATE TABLE Diy_DingdanSP (Id TEXT,DingdanID TEXT,HezuoFS TEXT,HezuoFSZ TEXT,Zongjia REAL,LvxinZJ REAL,ShebeiSJDJ REAL,Shuliang INTEGER,IsDeleted INTEGER)')
  const insert = db.prepare('INSERT INTO Diy_Dingdan VALUES(?,?,?,?,?,?,0)')
  for (const row of options.orders || orders) insert.run(...row)
  const insertProduct = db.prepare('INSERT INTO Diy_DingdanSP VALUES(?,?,?,?,?,?,?,?,0)')
  for (const row of options.products || products) insertProduct.run(...row)
  const V8 = { Param: { SysMenuId: menuId, ...params }, OsClient: options.osClient || 'xjy', CurrentUser: options.anonymous ? null : {Id:'user'},
    Method: {GetCurrentToken:()=>({CurrentUser:{Id:'user'},OsClient:'xjy',Token:'fixture'})},
    Http:{PostResponse:request=>{
      const body = JSON.parse(request.PostParamString); requests.push(body)
      if (options.denied) return {StatusCode:200,Content:JSON.stringify({Code:0,Msg:'没有菜单权限'})}
      let visible = (options.orders || orders).filter(row=>row[0] !== 'hidden')
      if (body._Keyword === 'none') visible = []
      if (body._Where?.length) visible = visible.filter(row => row[0] === 'active')
      const offset = (body._PageIndex - 1) * body._PageSize
      return {StatusCode:200,Content:JSON.stringify({Code:1,Data:options.truncated ? [] : visible.slice(offset,offset+body._PageSize).map(row=>({Id:row[0],DingdanZT:row[1]})),DataCount:options.count ?? visible.length})}
    }},
    Db:{FromSql:sql=>{const bindings={};const query={AddInParameter:(key,value)=>{bindings[key]=value;return query},ToArray:()=>{queries.push({sql,bindings});return db.prepare(sql).all(bindings)}};return query}}
  }
  try {
    const result = vm.runInNewContext(`(function(){${source}\n})()`,{V8,DateNow:()=> '2026-10-15'})
    return {result:JSON.parse(JSON.stringify(result)),requests,queries}
  } finally {db.close()}
}

test('有效合同边界与组合商品、历史空设备总价按客户口径核算，待审批只计订单金额',()=>{
  const {result,requests,queries}=execute()
  assert.equal(result.Code,1,result.Msg)
  assert.deepEqual(result.Data.Metrics,{rental:'100.00',buyout:'400.00',annualFilter:'20.00',sum:'21000.00'})
  assert.deepEqual(result.Data.StatusCounts,{All:6,已审批:3,已到期:1,待审批:1,已作废:1})
  assert.equal(requests.length,1);assert.equal(queries.length,2)
  assert.equal(requests[0]._SysMenuId,menuId)
  assert.equal(result.Data.ValidOnly,true)
})

test('关闭后包括过期、断约、未来合同；买断累计值不变，订单金额不重复加商品',()=>{
  const {result}=execute({Filters:{ValidOnly:false}})
  assert.equal(result.Code,1,result.Msg)
  assert.deepEqual(result.Data.Metrics,{rental:'1200.00',buyout:'400.00',annualFilter:'60.00',sum:'21000.00'})
})

test('快捷状态只改变金额；其余状态角标不消失，状态零值可见',()=>{
  const {result}=execute({Filters:{SelectedStatus:'已到期',ValidOnly:false}})
  assert.deepEqual(result.Data.Metrics,{rental:'200.00',buyout:'300.00',annualFilter:'40.00',sum:'2000.00'})
  assert.equal(result.Data.StatusCounts.All,6)
  assert.equal(result.Data.StatusCounts['待审批'],1)
  assert.deepEqual(execute({Filters:{SelectedStatus:'已驳回'}}).result.Data.Metrics,{rental:'0.00',buyout:'0.00',annualFilter:'0.00',sum:'0.00'})
})

test('PC筛选、有效期顶层参数和移动端参数优先级保持一致',()=>{
  const filters={_Keyword:'学校',_Where:[['YewuYID','=','user']],_Search:{KehuMC:'学校'},_SearchEqual:{DingdanZT:'已审批'},_SearchNumber:{DingdanJE:{Min:1}},_SearchDateTime:{CreateTime:['2026-01-01','2026-12-31']}}
  const {result,requests}=execute({Filters:filters,ValidOnly:false})
  for(const key in filters) assert.deepEqual(requests[0][key],filters[key])
  assert.equal(result.Data.ValidOnly,false)
  assert.equal(execute({ValidOnly:false,Filters:{ValidOnly:true}}).result.Data.ValidOnly,true)
})

test('无记录真实返回零值，权限、截断、错误租户/菜单和匿名请求失败关闭',()=>{
  assert.equal(execute({Filters:{_Keyword:'none'}}).result.Data.StatusCounts.All,0)
  for(const options of [{denied:true},{truncated:true},{count:20001},{anonymous:true},{osClient:'other'}]) assert.equal(execute({},options).result.Code,0)
  assert.equal(execute({SysMenuId:'other'}).result.Code,0)
})

test('存量空状态纳入全部数量和订单金额，不影响商品金额',()=>{
  const {result}=execute({}, {orders:[['legacy',null,null,null,null,12.34]],products:[]})
  assert.equal(result.Code,1,result.Msg)
  assert.equal(result.Data.StatusCounts.All,1)
  assert.equal(result.Data.Metrics.sum,'12.34')
})

test('缺失金额保留已获取合计并附提示，不当作确认零价',()=>{
  const extra=['missing','active','买断','1',null,null,null,1]
  const {result}=execute({}, {products:[...products,extra]})
  assert.equal(result.Code,1,result.Msg)
  assert.equal(result.Data.Metrics.buyout,'400.00')
  assert.equal(result.Data.IncompleteMetrics.buyout,1)
})

test('客户端单次请求、全状态与四金额校验，缺失金额和权限错误不伪装为零',async()=>{
  const calls=[]
  const data=execute().result.Data
  data.IncompleteMetrics.buyout=1
  const result=await loadOrderListSummary({menuId,selectedStatus:'已审批',validOnly:false,filters:{_Keyword:'学校'},run:async(key,params)=>{calls.push({key,params});return {Code:1,Data:data}}})
  assert.equal(calls.length,1)
  assert.equal(calls[0].params.Filters.ValidOnly,false)
  assert.equal(calls[0].params.Filters.SelectedStatus,'已审批')
  assert.match(result.warning,/买断1项待核对/)
  for(const response of [{Code:0,Msg:'无权限'},{Code:1,Data:{...data,Metrics:{...data.Metrics,sum:null}}}]) await assert.rejects(()=>loadOrderListSummary({menuId,run:async()=>response}))
})

test('PC开关修改全部四个指标且不覆盖其它视图、按钮或页面实例',()=>{
  const source=fs.readFileSync(new URL('../src/tenants/xjy/module-buttons/order-validity-toggle.js',import.meta.url),'utf8')
  const config=JSON.parse(fs.readFileSync(new URL('../profiles/xjy/metadata/order-list-statistics.json',import.meta.url),'utf8'))
  const button=JSON.parse(fs.readFileSync(new URL('../profiles/xjy/metadata/order-validity-button.json',import.meta.url),'utf8')).button
  const original={Views:[{Scene:'List',Device:'PC',Layout:{Hero:{Metrics:config.metrics}}},{Scene:'Detail',Device:'All',Layout:{Title:'保留'}}]}
  const menu={ViewSchema:JSON.stringify(original),PageBtns:[button,{Id:'old',Name:'保留'}]}
  const other=structuredClone(menu);let refresh=0
  const toggle=()=>vm.runInNewContext(source,{V8:{SysMenuModel:menu,RefreshTable:()=>refresh++}})
  toggle()
  assert.ok(JSON.parse(menu.ViewSchema).Views[0].Layout.Hero.Metrics.every(m=>m.ParamMap.ValidOnly===false))
  assert.equal(menu.PageBtns[0].Name,'仅有效期内：关闭')
  assert.deepEqual(JSON.parse(menu.ViewSchema).Views[1],original.Views[1])
  assert.equal(other.ViewSchema,JSON.stringify(original))
  toggle()
  assert.ok(JSON.parse(menu.ViewSchema).Views[0].Layout.Hero.Metrics.every(m=>m.ParamMap.ValidOnly===true))
  assert.equal(refresh,2)
})
