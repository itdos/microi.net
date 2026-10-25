/*
 * V8 ApiEngine
 * ApiEngineKey: official_star_gift_records
 * Version: v1.0.0
 * Function:
 * - 官网活动登记只读工作台；主库逐请求复核当前用户、Star活动登记查看角色与模块授权，提供访问能力、关键词和状态筛选、分页及完整登记资料；不提供业务写入。
 */

var roleId = 'ba43c735-d03e-4aa1-bc86-e185b5aaf014';
var menuId = '01M5K8MNSRFF9WSHHSBZZ8F8VC';
var userId = String(V8.CurrentUser && V8.CurrentUser.Id || '').trim();
if (!userId) return { Code: 1001, Msg: '请先登录。' };
if (String(V8.OsClient).toLowerCase() !== 'itdos') return { Code: 0, Msg: '当前租户不支持此功能。' };

// 不信任浏览器角色、Token 旧快照或管理员级别；撤销角色后下一次请求立即失效。
var user = V8.Db.FromSql('SELECT Id, RoleIds FROM sys_user WHERE Id=@uid AND State=1 AND IsDeleted=0')
  .AddInParameter('@uid', userId).First();
if (!user) return { Code: 1001, Msg: '当前帐号已失效，请重新登录。' };
var roles = [];
try {
  roles = typeof user.RoleIds === 'string' ? JSON.parse(user.RoleIds || '[]') : JSON.parse(JSON.stringify(user.RoleIds || []));
} catch (e) { return { Code: 0, Msg: '帐号角色配置无效，请联系管理员。' }; }
if (!Array.isArray(roles)) return { Code: 0, Msg: '帐号角色配置无效，请联系管理员。' };
var hasRole = roles.some(function (role) { return String(role && role.Id || role) === roleId; });
var grant = hasRole ? V8.Db.FromSql('SELECT r.Id FROM sys_role r INNER JOIN sys_rolelimit l ON l.RoleId=r.Id WHERE r.Id=@rid AND r.IsDeleted=0 AND l.FkId=@mid AND l.Type=@type AND l.IsDeleted=0')
  .AddInParameter('@rid', roleId).AddInParameter('@mid', menuId).AddInParameter('@type', 'Menu').First() : null;
var action = String(V8.Param.Action || 'List');
if (action === 'Capabilities') return { Code: 1, Data: { CanView: !!grant } };
if (!grant) return { Code: 0, Msg: '无权查看 Star 活动登记，请联系管理员授予相应角色。', Data: { CanView: false } };
if (action !== 'List') return { Code: 0, Msg: '不支持的操作。' };

// 固定投影覆盖全部登记与审计字段，客户端不能指定表、选列、角色、排序或任意查询条件。
var fields = [
  { Name: 'ReceiptNo', Label: '登记编号' }, { Name: 'CompanyName', Label: '公司名称' },
  { Name: 'ContactName', Label: '姓名' }, { Name: 'Phone', Label: '电话' },
  { Name: 'StarVerifyStatus', Label: 'Star核验' }, { Name: 'WeChatVerifyStatus', Label: '公众号核验' },
  { Name: 'GiftStatus', Label: '领取状态' }, { Name: 'CampaignKey', Label: '活动标识' },
  { Name: 'StarDeclared', Label: '已声明Star' }, { Name: 'WeChatDeclared', Label: '已声明关注公众号' },
  { Name: 'ConsentVersion', Label: '隐私告知版本' }, { Name: 'ConsentTime', Label: '同意时间' },
  { Name: 'CreateTime', Label: '创建时间' }, { Name: 'UpdateTime', Label: '修改时间' },
  { Name: 'UserName', Label: '创建人' }, { Name: 'UserId', Label: '创建人Id' },
  { Name: 'RequestId', Label: '请求编号' }, { Name: 'RequestHash', Label: '请求摘要' },
  { Name: 'Id', Label: '记录Id' }, { Name: 'IsDeleted', Label: '是否已删除' }
];
var options = {
  StarVerifyStatus: [{ Key: 'pending', Value: '待核验' }, { Key: 'verified', Value: '已核验' }, { Key: 'not_required', Value: '可选未声明' }],
  WeChatVerifyStatus: [{ Key: 'pending', Value: '待人工核验' }, { Key: 'verified', Value: '已人工核验' }],
  GiftStatus: [{ Key: 'pending', Value: '待领取' }, { Key: 'claimed', Value: '已领取' }]
};
var keyword = String(V8.Param.Keyword || '').trim();
if (keyword.length > 100) return { Code: 0, Msg: '搜索内容不能超过100字。' };
var where = [['IsDeleted', '=', 0]];
if (keyword) where = where.concat([
  ['AND', '(', 'CompanyName', 'Like', keyword], ['OR', 'ContactName', 'Like', keyword],
  ['OR', 'Phone', 'Like', keyword], ['OR', 'ReceiptNo', 'Like', keyword, ')']
]);
var filterNames = ['StarVerifyStatus', 'WeChatVerifyStatus', 'GiftStatus'];
for (var i = 0; i < filterNames.length; i++) {
  var name = filterNames[i];
  var value = String(V8.Param[name] || '');
  if (!value) continue;
  if (!options[name].some(function (item) { return item.Key === value; })) return { Code: 0, Msg: '筛选状态无效。' };
  where.push([name, '=', value]);
}
var pageIndex = Math.max(1, Math.min(100000, parseInt(V8.Param.PageIndex, 10) || 1));
var pageSize = Math.max(1, Math.min(100, parseInt(V8.Param.PageSize, 10) || 20));
var result = V8.FormEngine.GetTableData('mci_star_gift_registration', {
  _Where: where, _SelectFields: fields.map(function (field) { return field.Name; }),
  _PageIndex: pageIndex, _PageSize: pageSize, _OrderBys: { CreateTime: 'DESC', Id: 'DESC' }
});
if (result.Code !== 1) return result;
return { Code: 1, Data: { CanView: true, Records: result.Data || [], Total: Number(result.DataCount || 0), PageIndex: pageIndex, PageSize: pageSize, Fields: fields, Options: options } };
