/*
 * 服务拓扑：合并声明依赖、在线实例和运行聚合边，返回有界图数据。
 */
function fail(msg) { return { Code: 0, Msg: msg }; }
function admin() { var u = V8.CurrentUser || {}; return u && u.Id && Number(u.Level || 0) >= 9999; }
if (!admin()) return fail('权限不足：只有超级管理员才能查看服务拓扑。');
var servicesResult = V8.FormEngine.GetTableData('mci_service_registry', { _Where: [['Enabled', '=', 1]], _PageIndex: 1, _PageSize: 500 });
if (!servicesResult || servicesResult.Code !== 1) return servicesResult || fail('读取服务目录失败。');
var services = servicesResult.Data || [], nodes = [], serviceById = {}, declaredEdges = [];
for (var i = 0; i < services.length; i++) {
  var service = services[i] || {}; serviceById[String(service.Id || '')] = service;
  var instances = V8.FormEngine.GetTableDataCount('mci_service_instance', { _Where: [['ServiceId', '=', service.Id], ['AND', 'State', '=', 'Ready'], ['AND', 'LeaseExpiresAt', '>', System.DateTime.UtcNow.ToString('yyyy-MM-dd HH:mm:ss')]] });
  nodes.push({ Id: service.Id, Key: service.ServiceKey, Name: service.Name, Type: service.ServiceType, Environment: service.Environment, HealthState: service.HealthState, ReadyInstances: Number((instances && (instances.Data || instances.DataCount)) || 0) });
  try {
    var dependencies = JSON.parse(String(service.DependenciesJson || '[]'));
    for (var d = 0; d < dependencies.length; d++) declaredEdges.push({ From: service.Id, ToKey: String(dependencies[d].ServiceKey || dependencies[d].Key || dependencies[d]), Source: 'Declared' });
  } catch (error) {}
}
var edgesResult = V8.FormEngine.GetTableData('mci_service_call_edge', { _OrderBy: 'LastSeenTime', _OrderByType: 'DESC', _PageIndex: 1, _PageSize: 1000 });
if (!edgesResult || edgesResult.Code !== 1) return edgesResult || fail('读取运行拓扑失败。');
var runtimeEdges = edgesResult.Data || [], missing = [];
for (var e = 0; e < declaredEdges.length; e++) {
  var found = false;
  for (var n = 0; n < nodes.length; n++) if (nodes[n].Key === declaredEdges[e].ToKey) { declaredEdges[e].To = nodes[n].Id; found = true; break; }
  if (!found) missing.push({ FromServiceId: declaredEdges[e].From, DependencyKey: declaredEdges[e].ToKey });
}
return { Code: 1, Data: { Nodes: nodes, RuntimeEdges: runtimeEdges, DeclaredEdges: declaredEdges, MissingDependencies: missing, GeneratedAt: DateNow('yyyy-MM-dd HH:mm:ss') } };
