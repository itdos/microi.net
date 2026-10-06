/* OFFICIAL_MANAGED_API_ENGINE_NOTICE_V1
 * 所属官方应用：视觉引擎；ApiEngineKey：platform-vision-subject-options。
 * 这是当前租户表单下拉数据源，只返回启用的视觉识别对象。
 */
// Version: v1.0.0
var subjectResult = V8.FormEngine.GetTableData('mci_vision_subject', {
  _Where: [['Enabled', '=', 1]],
  _SelectFields: ['Id', 'Name', 'ObjectNo', 'RecognitionMode'],
  _OrderBy: 'Name',
  _OrderByType: 'ASC',
  _PageIndex: 1,
  _PageSize: 1000
});
if (!subjectResult || Number(subjectResult.Code) !== 1) return subjectResult;
var subjectRows = subjectResult.Data && (subjectResult.Data.List || subjectResult.Data) || [];
var subjectOptions = [];
for (var subjectIndex = 0; subjectIndex < subjectRows.length; subjectIndex++) {
  subjectOptions.push({
    Key: String(subjectRows[subjectIndex].Id),
    Value: String(subjectRows[subjectIndex].Name),
    Mode: String(subjectRows[subjectIndex].RecognitionMode || 'General')
  });
}
return { Code: 1, Data: subjectOptions };
