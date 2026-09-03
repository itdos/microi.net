/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 所属官方应用：视觉引擎；ApiEngineKey：platform-vision-category-options。
 * 这是当前租户表单下拉数据源，只返回启用的视觉对象分类。
 */
// Version: v1.0.0
var categoryResult = V8.FormEngine.GetTableData('mci_vision_category', {
  _Where: [['Enabled', '=', 1]],
  _SelectFields: ['Id', 'Name'],
  _OrderBys: { Sort: 'ASC', Name: 'ASC' },
  _PageIndex: 1,
  _PageSize: 500
});
if (!categoryResult || Number(categoryResult.Code) !== 1) return categoryResult;
var categoryRows = categoryResult.Data && (categoryResult.Data.List || categoryResult.Data) || [];
var categoryOptions = [];
for (var categoryIndex = 0; categoryIndex < categoryRows.length; categoryIndex++) {
  categoryOptions.push({ Key: String(categoryRows[categoryIndex].Id), Value: String(categoryRows[categoryIndex].Name) });
}
return { Code: 1, Data: categoryOptions };
