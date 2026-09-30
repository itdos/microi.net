// 新字段保存文本，旧配置可能保存对象或 JSON；按真实保存格式提取物理表名。
var selected = V8.Form.NotDiyTable;
if (typeof selected === 'string' && /^\s*\{/.test(selected)) {
  try { selected = JSON.parse(selected); } catch (_) { selected = null; }
}
var tableName = typeof selected === 'string' ? selected.trim()
  : selected && typeof selected.TableName === 'string' ? selected.TableName.trim() : '';
if (!tableName) {
  V8.Tips('请先选择非DIY表', false);
  return;
}
V8.FieldSet('BtnLoadNotDiyTable', 'Config.Button.Loading', true);
try {
  var result = await V8.Http.Post({
    Url: '/api/FormEngine/LoadNotDiyTable',
    PostParam: { Name: tableName, DataBaseId: V8.Form.Id, DataBaseName: V8.Form.DbName }
  });
  if (result && result.Code === 1) {
    V8.Tips('加载成功！');
    if (typeof window.GetNotDiyTable === 'function') window.GetNotDiyTable();
  } else {
    V8.Tips('加载失败：' + (result && result.Msg || '接口未返回结果'), false);
  }
} catch (error) {
  V8.Tips('加载失败：' + (error && error.message || '网络异常，请稍后重试'), false);
} finally {
  // 无论接口失败还是网络异常，都允许用户再次操作。
  V8.FieldSet('BtnLoadNotDiyTable', 'Config.Button.Loading', false);
}
