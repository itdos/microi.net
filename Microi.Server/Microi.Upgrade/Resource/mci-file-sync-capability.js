/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 【极重要：这是官方应用托管接口，禁止直接承载个性化代码】
 * 所属官方应用：文件柜
 * ApiEngineKey：mci_file_sync_capability
 * 从可信吾码官方应用源安装、更新或重新安装“文件柜”，都会以官方源码恢复此 Managed 接口。
 * 此接口只返回文件同步协议和当前租户权威文件柜菜单，不执行租户自定义 Hook；
 * 个性化业务请使用独立租户接口引擎，禁止直接修改本接口。
 */

if (!V8.CurrentUser || !V8.CurrentUser.Id) {
  return { Code: 1001, Msg: '登录身份已过期！' };
}
var level = parseInt(V8.CurrentUser.Level || 0, 10);
if (isNaN(level) || level < 9999) {
  return { Code: 0, Msg: '仅平台超级管理员可以使用文件柜同步能力！' };
}

function text(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function isFileManagerComponent(componentPath) {
  var normalized = text(componentPath).replace(/\\/g, '/');
  var queryIndex = normalized.indexOf('?');
  if (queryIndex >= 0) normalized = normalized.substring(0, queryIndex);
  if (normalized.indexOf('@/') === 0) normalized = normalized.substring(2);
  normalized = normalized.replace(/^\/+|\/+$/g, '');
  if (/\.vue$/i.test(normalized)) normalized = normalized.substring(0, normalized.length - 4);
  normalized = normalized.toLowerCase();
  return normalized === 'file-manage'
    || normalized === 'file-manage/index'
    || normalized === 'views/file-manage'
    || normalized === 'views/file-manage/index'
    || normalized === 'src/views/file-manage'
    || normalized === 'src/views/file-manage/index';
}

var menuResult = V8.FormEngine.GetTableData('sys_menu', {
  _Where: [['ComponentPath', 'Like', 'file-manage']],
  _SelectFields: ['Id', 'ComponentPath', 'IsDeleted'],
  _OrderBy: 'CreateTime',
  _OrderByType: 'ASC',
  _PageIndex: 1,
  _PageSize: 100
});
if (!menuResult || menuResult.Code !== 1) {
  return menuResult || { Code: 0, Msg: '文件柜菜单读取失败！' };
}

var rows = menuResult.Data || [];
var fileManagerMenuId = '';
for (var index = 0; index < rows.length; index++) {
  var row = rows[index] || {};
  if (Number(row.IsDeleted || 0) === 1 || !text(row.Id) || !isFileManagerComponent(row.ComponentPath)) continue;
  fileManagerMenuId = text(row.Id);
  break;
}
if (!fileManagerMenuId) {
  return { Code: 0, Msg: '当前租户未安装权威文件柜菜单，请更新【文件柜】应用后重试。' };
}

return {
  Code: 1,
  Data: {
    AppKey: 'app.microi.file-manage',
    AppName: '文件柜',
    FileCabinetVersion: 'v2.1.0',
    ProtocolVersion: 2,
    FileManagerSysMenuId: fileManagerMenuId,
    Capabilities: {
      RecursiveTree: true,
      PublicBucket: true,
      PrivateBucket: true,
      CrossPlatformSync: true,
      RemoteConnectionStore: true,
      CaptchaLogin: true,
      AuthorizedPrivateObjectUrl: true
    }
  }
};
