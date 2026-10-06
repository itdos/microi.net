/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：模块引擎
 * ApiEngineKey：mci-tree-drag-sort
 * 从可信吾码官方应用源安装、更新或重新安装“模块引擎”，都会以官方源码恢复此 Managed 接口。
 * 强烈建议仅修改该应用声明的 CreateIfMissing 个性化 Hook；若当前阶段没有 Hook，
 * 请新增独立租户接口并由官方接口通过受支持扩展点调用，禁止直接修改本接口。
 */

/*
 * V8 ApiEngine
 * ApiEngineKey: mci-tree-drag-sort
 * Version: v1.0.4
 * Function:
 * - 按当前模块权限处理树形拖动排序，支持跨级移动、间隔10重排全部兄弟节点、循环检查、旧快照冲突与共享事务回滚。
 */

var request = JSON.parse(JSON.stringify(V8.Param || {}));
if (request.TestParam1 != null && !((typeof request.TestParam1 === 'string' && request.TestParam1.length <= 200) || (typeof request.TestParam1 === 'number' && isFinite(request.TestParam1)) || typeof request.TestParam1 === 'boolean')) return {Code:0,Msg:'调试参数格式无效。'};
var transport = ['ApiEngineKey','ApiAddress','OsClient','_InvokeType','_DeviceId','_Lang','TestParam1','_ClientIP','_RawBody','_HttpMethod','_ContentType','_RouteValues','_RequestMethod','_RequestPath','_RequestScheme','_RequestHost','_RequestPathBase'];
var allowed = ['Action','MenuId','MovedId','TargetId','Position','ExpectedSnapshot'];
for (var key in request) {
    if (transport.indexOf(key) >= 0) { delete request[key]; continue; }
    if (allowed.indexOf(key) < 0) return { Code:0, Msg:'不支持的请求字段：' + key };
}
var action = String(request.Action || 'Snapshot');
if (['Snapshot','Move'].indexOf(action) < 0) return { Code:0, Msg:'不支持的排序动作。' };
var contextResult = V8.Method.TreeMutationClientOperation({Action:'Context',MenuId:String(request.MenuId || '')});
if (contextResult.Code !== 1) return contextResult;
var context = JSON.parse(JSON.stringify(contextResult.Data));
var names = ['Id',context.SortField,context.ParentField];
if (context.AncestorField) names.push(context.AncestorField);
if (context.HasChildrenField) names.push(context.HasChildrenField);
var kind = String(context.DbType || '').toLowerCase();
/** 标识符只接受可信模块原子返回的真实元数据，不接受请求字段。 */
function quote(name) {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(name)) throw new Error('字段标识不合法。');
    return kind === 'sqlserver' ? '['+name+']' : kind === 'mysql' ? '`'+name+'`' : '"'+name+'"';
}
var sql = 'SELECT '+(kind === 'sqlserver' ? 'TOP 20001 ' : '')+names.map(quote).join(',')+' FROM '+quote(context.TableName);
if (kind === 'sqlserver') sql += ' WITH (UPDLOCK,HOLDLOCK)';
sql += ' WHERE '+((kind === 'oracle' || kind === 'dameng') ? 'ROWNUM <= 20001 AND ' : '')+'('+quote('IsDeleted')+'=0 OR '+quote('IsDeleted')+' IS NULL) ORDER BY '+quote('Id');
if (kind === 'mysql' || kind === 'postgresql') sql += ' LIMIT 20001 FOR UPDATE';
else if (kind === 'oracle' || kind === 'dameng') sql += ' FOR UPDATE';
else if (kind === 'kingbase') sql += ' LIMIT 20001 FOR UPDATE';
else if (kind !== 'sqlserver') return {Code:0,Msg:'当前数据库类型尚不支持安全树排序。'};
var rows = JSON.parse(JSON.stringify(V8.DbTrans.FromSql(sql).ToArray()));
if (rows.length > 20000) return {Code:0,Msg:'当前树超过20000条，请先按独立树模块拆分后排序。'};
/** 生成确定性快照，防止旧页面覆盖其他用户的调整。 */
function fingerprint(list) {
    return V8.EncryptHelper.Sha256Hex(JSON.stringify(list.map(function(row) { return names.map(function(name) {return row[name] === undefined ? null : row[name];}); })));
}
var snapshot = fingerprint(rows);
if (action === 'Snapshot') return {Code:1,Data:{Snapshot:snapshot}};
if (typeof request.ExpectedSnapshot !== 'string' || request.ExpectedSnapshot !== snapshot) return {Code:0,Msg:'树数据已发生变化，请刷新后重新拖动。',DataAppend:{ReasonCode:'TREE_SNAPSHOT_CONFLICT'}};
var movedId = String(request.MovedId || ''), targetId = String(request.TargetId || ''), position = String(request.Position || '');
if (['Before','After','Inside','Root'].indexOf(position) < 0) return {Code:0,Msg:'请选择有效的放置位置。'};
var byId = {}, children = {};
/** 将旧库中的 null、空字符串统一为根节点键，仅用于排序分组。 */
function parentId(row) { var value = String(row[context.ParentField] || ''); return value === '0' || value === '00000000-0000-0000-0000-000000000000' ? '' : value; }
rows.forEach(function(row) {
    byId[String(row.Id)] = row;
    var parent = parentId(row); if (!children[parent]) children[parent] = []; children[parent].push(row);
});
var moved = byId[movedId], target = byId[targetId];
if (!moved || (position !== 'Root' && !target)) return {Code:0,Msg:'待移动记录或目标记录不存在，请刷新列表。'};
if (movedId === targetId) return {Code:0,Msg:'不能把节点拖动到自身。'};
var oldParent = parentId(moved), newParent = position === 'Root' ? '' : position === 'Inside' ? targetId : parentId(target);
var current = newParent, visited = {};
while (current) {
    if (current === movedId) return {Code:0,Msg:'不能移入自身或自己的子级。'};
    if (visited[current]) return {Code:0,Msg:'现有树存在循环，请先修复父级关系。'};
    visited[current] = true; if (!byId[current]) return {Code:0,Msg:'父级关系不完整，请先修复。'}; current = parentId(byId[current]);
}
/** 原顺序以排序字段和Id稳定排序，确保所有兄弟节点按10、20、30统一重排。 */
function ordered(parent) {
    return (children[parent] || []).filter(function(row) {return String(row.Id) !== movedId;}).sort(function(a,b) {
        var gap = Number(a[context.SortField] || 0)-Number(b[context.SortField] || 0);
        return gap || (String(a.Id) < String(b.Id) ? -1 : String(a.Id) > String(b.Id) ? 1 : 0);
    });
}
var destination = ordered(newParent), index = destination.length;
if (position === 'Before' || position === 'After') {
    index = destination.findIndex(function(row) {return String(row.Id) === targetId;});
    if (index < 0) return {Code:0,Msg:'目标记录不属于当前父级。'};
    if (position === 'After') index++;
}
destination.splice(index,0,moved);
var changes = {};
/** 合并每个受影响行的白名单变更，同一行只写一次。 */
function change(id,key,value) { if (!changes[id]) changes[id] = {Id:id}; changes[id][key] = value; }
if (oldParent !== newParent) change(movedId,context.ParentField,newParent);
var affected = oldParent === newParent ? [newParent] : [oldParent,newParent];
affected.forEach(function(parent) {
    var siblings = parent === newParent ? destination : ordered(parent);
    siblings.forEach(function(row,i) {change(String(row.Id),context.SortField,(i+1)*10);});
    if (context.HasChildrenField && parent && byId[parent] && Number(byId[parent][context.HasChildrenField] || 0) !== (siblings.length ? 1 : 0)) change(parent,context.HasChildrenField,siblings.length ? 1 : 0);
});
if (context.AncestorField && oldParent !== newParent) {
    var prefix = [], ancestor = newParent;
    while (ancestor) {prefix.unshift(ancestor);ancestor = parentId(byId[ancestor]);}
    var queue = [{Id:movedId,Ancestors:prefix}], walked = {};
    for (var q=0;q<queue.length;q++) {
        var node = queue[q];if (walked[node.Id]) return {Code:0,Msg:'子级关系存在循环，已停止排序。'};walked[node.Id]=true;
        change(node.Id,context.AncestorField,node.Ancestors.join(','));
        (children[node.Id] || []).forEach(function(child) {queue.push({Id:String(child.Id),Ancestors:node.Ancestors.concat(node.Id)});});
    }
}
var updates = Object.keys(changes).map(function(id) {return changes[id];});
var result = V8.Method.TreeMutationClientOperation({Action:'WriteRows',MenuId:request.MenuId,Rows:updates,PlacementIds:[movedId,targetId,newParent].filter(Boolean)});
if (result.Code !== 1) return result;
updates.forEach(function(update) {Object.keys(update).forEach(function(name) {byId[update.Id][name]=update[name];});});
return {Code:1,Msg:'排序已保存。',Data:{UpdatedRows:updates.length,Snapshot:fingerprint(rows),ParentId:newParent}};
