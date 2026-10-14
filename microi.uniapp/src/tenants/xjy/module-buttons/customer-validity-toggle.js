// 只修改当前页面菜单的统计参数，不保存菜单或客户记录；各页面实例独立切换。
var menu = V8.SysMenuModel;
if (!menu || !menu.ViewSchema) throw new Error('当前客户页面缺少统计配置，请刷新后重试');
var schema = typeof menu.ViewSchema === 'string'
  ? JSON.parse(menu.ViewSchema)
  : JSON.parse(JSON.stringify(menu.ViewSchema));
var metrics = [];
for (var view of schema.Views || []) {
  if (view.Scene !== 'List' || view.Device !== 'PC' || view.Enabled === false) continue;
  for (var metric of (view.Layout && view.Layout.Hero && view.Layout.Hero.Metrics) || []) {
    if (metric.ApiEngineKey === 'xjy-customer-contract-totals') metrics.push(metric);
  }
}
if (!metrics.length) throw new Error('当前客户页面未配置合同金额统计');
var current = metrics[0].ParamMap && metrics[0].ParamMap.ValidOnly;
var validOnly = current === false || String(current) === 'false' || String(current) === '0';

// PC 框架会覆盖 ParamMap.Filters；使用独立顶层参数，由统计 V8 兼容读取。
for (var metric of metrics) {
  metric.ParamMap = Object.assign({}, metric.ParamMap, { Summary: true, ValidOnly: validOnly });
}
menu.ViewSchema = typeof menu.ViewSchema === 'string' ? JSON.stringify(schema) : schema;
for (var button of menu.PageBtns || []) {
  if (button.Id !== '5b8f5887-344a-4d68-a38e-af78d66d7db8') continue;
  button.Name = '仅有效期内：' + (validOnly ? '开启' : '关闭');
  button._RawName = button.Name;
  button.Icon = validOnly ? 'fas fa-toggle-on' : 'fas fa-toggle-off';
  button.BtnStyle = validOnly ? 'primary' : 'info';
}
// 普通刷新沿用现有关键词、高级筛选和页码，顶部金额由平台自动重新请求。
V8.RefreshTable();
