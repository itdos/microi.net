import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// 此发布入口只生成当前租户方案业务的 V8 源码，所有公式来自同一个纯函数模块。
const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const workspace = path.resolve(project, '..')
const outputFlag = process.argv.indexOf('--output-root')
const target = outputFlag >= 0
  ? path.resolve(process.argv[outputFlag + 1])
  : path.join(workspace, 'Microi-V8-Engine/集福鲤平台 (api.jifulii.com)/xjy.Product.Internal')
const common = fs.readFileSync(path.join(project, 'src/tenants/xjy/proposal-cost-model.mjs'), 'utf8').replace(/^export /gm, '')
const header = (table, type, version, description) => `/*\n * V8 Event\n * TableKey: ${table}\n * EventType: ${type}\n * Version: ${version}\n * 功能说明：\n * - ${description}\n */\n`
const descriptors = []
function event(table, label, type, eventLabel, version, description, body) {
  const file = path.join(target, '表单引擎', `${label}（${table}）`, '表单V8事件', `${eventLabel}（${type}）.js`)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, header(table, type, version, description) + common + '\n' + body.trim() + '\n')
  descriptors.push({ formEngineKey: table, eventType: type, file, description })
}

const server = `
// 当前服务器使用 Insert/Update/Delete；同时兼容旧事件的 Add/Upt/Del。
var costAction = String(V8.FormSubmitAction || '').toLowerCase();
var costIsAdd = costAction === 'insert' || costAction === 'add';
var costIsDelete = costAction === 'delete' || costAction === 'del';
// 增删改共享父方案行锁，跨 API 节点串行计算同一方案，事务失败则点位及汇总同时回滚。
function lockCostPlan(id) {
  if (!id) throw new Error('请先保存需求方案，再维护安装点位');
  if (!V8.DbTrans) throw new Error('成本计算缺少表单事务');
  var row = V8.DbTrans.FromSql('SELECT Id,HesuanNS,ShisuanNS,ShisuanNSMD FROM diy_kehufaxx WHERE Id=@p0 AND IsDeleted=0 FOR UPDATE')
    .AddInParameter('@p0', id).First();
  if (!row || !row.Id) throw new Error('所属需求方案不存在或已删除');
  return row;
}
// 只读当前父记录下的计算输入，不依赖列表分页，不读取照片或视频等重字段。
function readCostPoints(id) {
  if (!id) return [];
  return V8.DbTrans.FromSql('SELECT Id,AnzhuangdianweiId,ShebeiSL,Renshu,ShebeiDJZL,ShebeiDJ,GenghuanLXJG,IsDeleted FROM diy_anzhuang_dw WHERE AnzhuangdianweiId=@p0 AND IsDeleted=0 ORDER BY Id FOR UPDATE')
    .AddInParameter('@p0', id).ToArray();
}
// 部分更新必须合并权威 OldForm，防止只改场所名称时把价格或人数重置为零。
function mergedCostForm() {
  var result = {}, key;
  var oldValues = JSON.parse(JSON.stringify(V8.OldForm || {}));
  var newValues = JSON.parse(JSON.stringify(V8.Form || {}));
  for (key in oldValues) result[key] = oldValues[key];
  for (key in newValues) result[key] = newValues[key];
  return result;
}
// 派生金额由服务端覆盖，客户端不能通过伪造只读字段改变最终报价。
function applyCostForm(values) {
  for (var key in values) V8.Form[key] = values[key];
}
`

event('diy_anzhuang_dw', '需求方案安装点位', 'SubmitBeforeServerV8', '后端表单提交前V8事件', 'v1.0.0',
  '按父方案统一年数计算本点位租赁、买断费用；校验输入并锁定父方案，防止跨方案移动及并发汇总丢失。', server + `
var form = mergedCostForm();
var oldParent = V8.OldForm && V8.OldForm.AnzhuangdianweiId;
if (oldParent && oldParent != form.AnzhuangdianweiId) return { Code: 0, Msg: '安装点位不能直接转移到另一需求方案，请复制到目标方案' };
var parent = lockCostPlan(form.AnzhuangdianweiId);
if (costIsDelete) return { Code: 1 };
var error = validateProposalCostInputs(form, true);
if (error) return { Code: 0, Msg: error };
if (!costPresent(form.ShebeiSL)) V8.Form.ShebeiSL = form.ShebeiSL = 1;
applyCostForm(calculateInstallationPointCosts(form, proposalCostYears(parent)));
return { Code: 1 };
`)

event('diy_anzhuang_dw', '需求方案安装点位', 'SubmitAfterServerV8', '后端表单提交后V8事件', 'v1.0.0',
  '点位新增、修改、复制或删除后，在同一事务按全部点位重算父方案合作后费用，保持合作前成本不变。', server + `
var form = mergedCostForm();
var parent = lockCostPlan(form.AnzhuangdianweiId);
var points = readCostPoints(parent.Id);
var update = aggregateInstallationPointCosts(points, proposalCostYears(parent));
update.Id = parent.Id;
var saved = V8.FormEngine.UptFormData('diy_kehufaxx', update, V8.DbTrans);
if (!saved || saved.Code != 1) return { Code: 0, Msg: saved && saved.Msg || '需求方案成本汇总失败' };
return { Code: 1 };
`)

event('diy_kehufaxx', '需求方案', 'SubmitBeforeServerV8', '后端表单提交前V8事件', 'v1.0.0',
  '保留合作前成本公式；统一试算年数并批量更新点位计算，主表合作后字段由全部点位合计，拒绝客户端伪造汇总。', server + `
if (costIsDelete) return { Code: 1 };
var form = mergedCostForm();
var error = validateProposalCostInputs(form, false);
if (error) return { Code: 0, Msg: error };
var years = proposalCostYears(form);
if (!costIsAdd) lockCostPlan(form.Id);
var points = readCostPoints(form.Id);
// 一次批量调用共享原事务；不触发点位事件，避免父子相互递归重算。
var updates = [];
for (var i = 0; i < points.length; i++) {
  var values = calculateInstallationPointCosts(points[i], years);
  values.Id = points[i].Id;
  values.FormEngineKey = 'diy_anzhuang_dw';
  updates.push(values);
}
if (updates.length) {
  var saved = V8.FormEngine.UptTableData(updates, V8.DbTrans);
  if (!saved || saved.Code != 1) return { Code: 0, Msg: saved && saved.Msg || '点位试算年数同步失败' };
}
V8.Form.HesuanNS = form.HesuanNS = years;
applyCostForm(calculateCurrentProposalCosts(form));
applyCostForm(aggregateInstallationPointCosts(points, years));
return { Code: 1 };
`)

event('diy_anzhuang_dw', '需求方案安装点位', 'InFormV8', '前端表单进入V8事件', 'v1.0.0',
  '进入点位时继承父方案试算年数，保留原设备数量并实时预览点位费用。', `
if (V8.LoadMode === 'Design') return;
if (!costPresent(V8.Form.ShebeiSL)) V8.Form.ShebeiSL = 1;
var parent = V8.ParentV8 && V8.ParentV8.Form;
if (!parent && V8.Form.AnzhuangdianweiId) {
  var response = await V8.FormEngine.GetFormData('diy_kehufaxx', { Id: V8.Form.AnzhuangdianweiId });
  if (!response || response.Code != 1) { V8.Tips(response && response.Msg || '所属方案读取失败', false); return; }
  parent = response.Data;
}
V8.Form.ShisuanNS = V8.Form.ShisuanNSMD = proposalCostYears(parent || V8.Form);
window.CalcInstallationPointCosts = function () {
  var values = calculateInstallationPointCosts(V8.Form, V8.Form.ShisuanNS);
  for (var key in values) V8.FormSet(key, values[key]);
};
window.CalcInstallationPointCosts();
`)

event('diy_anzhuang_dw', '需求方案安装点位', 'OutFormV8', '前端表单提交后V8事件', 'v1.0.1',
  '点位关闭后刷新父表合作后汇总；不覆盖父表未保存的现状输入，不重复写库。', `
if (V8.LoadMode === 'Design') return;
var parent = V8.ParentV8;
if (parent && parent.Form && typeof parent.RefreshProposalPointCosts === 'function') {
  await parent.RefreshProposalPointCosts();
}
`)

event('diy_kehufaxx', '需求方案', 'InFormV8', '前端表单进入V8事件', 'v1.0.0',
  '保留合作前原公式及新增方案继承规则；合作后仅刷新全部点位汇总，所有试算年数统一使用主表年数。', `
if (V8.LoadMode === 'Design') return;
// 新增只继承现状输入，不继承上一方案的点位汇总或设备报价。
if (V8.FormMode === 'Add' && V8.Form.KehuID) {
  var previous = await V8.FormEngine.GetTableData('diy_kehufaxx', {
    _Where: [['KehuID', '=', V8.Form.KehuID]], _OrderBy: 'Paixu', _OrderByType: 'DESC',
    _PageIndex: 1, _PageSize: 1,
    _SelectFields: ['Renshu','DangqianYSFS','TongzhuangSDJ','DangqianYSSBSL','HesuanNS','Paixu']
  });
  if (previous && previous.Code == 1 && previous.Data && previous.Data.length) {
    var source = previous.Data[0];
    var inherited = ['Renshu','DangqianYSFS','TongzhuangSDJ','DangqianYSSBSL','HesuanNS'];
    for (var i = 0; i < inherited.length; i++) if (costPresent(source[inherited[i]])) V8.Form[inherited[i]] = source[inherited[i]];
    V8.Form.Paixu = costNumber(source.Paixu) + 1;
  }
}
if (!costPresent(V8.Form.DangqianYSSBSL)) V8.Form.DangqianYSSBSL = 1;
if (!costPresent(V8.Form.TongzhuangSDJ)) V8.Form.TongzhuangSDJ = 0;
V8.Form.HesuanNS = proposalCostYears(V8.Form);
window.CalcHezuoqian = function () {
  var values = calculateCurrentProposalCosts(V8.Form);
  for (var key in values) V8.FormSet(key, values[key]);
  V8.FieldSet('TongzhuangSDJ', 'Visible', String(V8.Form.DangqianYSFS || '').indexOf('桶装水') >= 0);
};
// 请求序号阻止快速修改年数时旧响应覆盖新结果；刷新只更新派生字段。
var requestId = 0;
V8.RefreshProposalPointCosts = async function () {
  var request = ++requestId, years = proposalCostYears(V8.Form);
  V8.Form.ShisuanNS = V8.Form.ShisuanNSMD = years;
  if (V8.FormMode === 'Add') {
    var empty = aggregateInstallationPointCosts([], years);
    for (var name in empty) V8.FormSet(name, empty[name]);
    return;
  }
  var result = await V8.ApiEngine.Run('xjy_compare_customer_proposals', { Ids: [V8.Form.Id], Years: years });
  if (request !== requestId) return;
  if (!result || result.Code != 1 || !result.Data || !result.Data.length) { V8.Tips(result && result.Msg || '比价汇总读取失败', false); return; }
  var values = result.Data[0].CostFields;
  for (var key in values) V8.FormSet(key, values[key]);
};
window.CalcHezuohou = function () { return V8.RefreshProposalPointCosts(); };
window.CalcHezuoqian();
await V8.RefreshProposalPointCosts();
`)

const engineFile = path.join(target, '接口引擎/客户管理/客户方案一键比价(xjy_compare_customer_proposals).js')
const engine = `/*
 * V8 ApiEngine
 * ApiEngineKey: xjy_compare_customer_proposals
 * Version: v1.0.2
 * 功能说明：
 * - 读取授权需求方案的全部点位，返回点位租赁和买断合计；支持单方案页面刷新、统一年数预览及多方案比价，不写入现状成本。
 */
${common}
var ids = V8.Param.Ids || V8.Param.ids || [];
if (!V8.CurrentUser || !V8.CurrentUser.Id) return { Code: 0, Msg: '请先登录' };
if (!ids || ids.length < 1 || ids.length > 50) return { Code: 0, Msg: '请选择 1 至 50 个方案进行比价' };
if (costPresent(V8.Param.Years) && validateProposalCostInputs({ HesuanNS: V8.Param.Years }, false)) return { Code: 0, Msg: '试算年数必须是正整数' };
var plansResult = V8.FormEngine.GetTableData('diy_kehufaxx', {
  _SysMenuId: 'd242a6ec-6773-4307-9ffd-3f4ce47736fa',
  _Where: [['Id','In',ids]], _PageIndex: 1, _PageSize: 50,
  _SelectFields: ['Id','FanganMC','YujiHZSJ','Renshu','DangqianYSFS','TongzhuangSDJ','DangqianYSSBSL','HesuanNS','ShisuanNS','ShisuanNSMD','Paixu']
});
if (!plansResult || plansResult.Code != 1) return plansResult;
var plans = JSON.parse(JSON.stringify(plansResult.Data || []));
if (!plans.length) return { Code: 0, Msg: '需求方案不存在或无权查看' };
// 只查询已获准返回的父记录，绑定参数批量读全部点位，避免 1000 条截断和逐方案 N+1。
var placeholders = [], byParent = {};
for (var i = 0; i < plans.length; i++) { placeholders.push('@p' + i); byParent[String(plans[i].Id)] = []; }
// 菜单列表可能裁剪到列表列；权限筛选完成后只补读这些已授权方案的计算输入。
var planQuery = V8.Db.FromSql('SELECT Id,FanganMC,YujiHZSJ,Renshu,DangqianYSFS,TongzhuangSDJ,DangqianYSSBSL,HesuanNS,ShisuanNS,ShisuanNSMD,Paixu FROM diy_kehufaxx WHERE IsDeleted=0 AND Id IN (' + placeholders.join(',') + ')');
for (var p = 0; p < plans.length; p++) planQuery = planQuery.AddInParameter('@p' + p, plans[p].Id);
plans = planQuery.ToArray();
var query = V8.Db.FromSql('SELECT Id,AnzhuangdianweiId,AnzhuangCS,ShebeiXH,ShebeiMC,ShebeiSL,Renshu,ShebeiDJZL,ShebeiDJ,GenghuanLXJG,ShuizhiYQ,DashuiFS,JiareFS,ShuiwenYQ,GaofengSDKSL,IsDeleted FROM diy_anzhuang_dw WHERE IsDeleted=0 AND AnzhuangdianweiId IN (' + placeholders.join(',') + ') ORDER BY Paixu,Id');
for (var p = 0; p < plans.length; p++) query = query.AddInParameter('@p' + p, plans[p].Id);
var points = query.ToArray();
for (var j = 0; j < points.length; j++) if (byParent[String(points[j].AnzhuangdianweiId)]) byParent[String(points[j].AnzhuangdianweiId)].push(points[j]);
var output = [];
for (var k = 0; k < plans.length; k++) {
  var plan = plans[k], rows = byParent[String(plan.Id)];
  var years = costPresent(V8.Param.Years) ? Number(V8.Param.Years) : proposalCostYears(plan);
  var costs = aggregateInstallationPointCosts(rows, years);
  var currentForm = {};
  for (var field in plan) currentForm[field] = plan[field];
  currentForm.HesuanNS = years;
  var current = calculateCurrentProposalCosts(currentForm);
  var people = 0, rental = 0, filter = 0, locations = [];
  for (var r = 0; r < rows.length; r++) {
    var row = rows[r], qty = costPresent(row.ShebeiSL) ? costNumber(row.ShebeiSL) : 1;
    people += costNumber(row.Renshu); rental += costNumber(row.ShebeiDJZL) * qty; filter += costNumber(row.GenghuanLXJG) * qty;
    var location = {};
    for (var column in row) location[column] = row[column];
    var detail = calculateInstallationPointCosts(row, years);
    for (var detailKey in detail) location[detailKey] = detail[detailKey];
    locations.push(location);
  }
  output.push({
    Id: plan.Id, FanganMC: plan.FanganMC || '需求方案', YujiHZSJ: plan.YujiHZSJ,
    PointCount: rows.length, DeviceCount: costs.HezuoHYSSBSL, PeopleCount: people,
    RentalPriceTotal: costs.HezuoHFWCB, BuyoutPriceTotal: costs.ShebeiMDCBDT, FilterPriceTotal: costRound(filter),
    CurrentAnnualCost: current.DangqianYSZCBAll, CurrentMultiYearCost: current.DuonianLJCB,
    RentalAnnualCost: costs.HezuoHYSZCBAll, BuyoutAnnualCost: costs.HezuoHYSZCBAllMD,
    RentalMultiYearCost: costs.DuonianLJCBAfter, BuyoutMultiYearCost: costs.DuonianLJCBMD,
    Years: years, CostFields: costs, Locations: locations
  });
}
return { Code: 1, Data: output, DataCount: output.length };
`
fs.mkdirSync(path.dirname(engineFile), { recursive: true })
fs.writeFileSync(engineFile, engine)
descriptors.push({ apiEngineKey: 'xjy_compare_customer_proposals', file: engineFile })
const report = outputFlag >= 0 ? target : path.join(workspace, '.tmp/proposal-point-costs')
fs.mkdirSync(report, { recursive: true })
fs.writeFileSync(path.join(report, 'resources.json'), JSON.stringify(descriptors, null, 2))
console.log(JSON.stringify({ resources: descriptors.length, report }))
