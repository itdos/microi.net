// 安装点位复制通过正式点位事件计算，确保父方案汇总与统一年数同步。
if (String(V8.Param.FormEngineKey || '').toLowerCase() === 'diy_anzhuang_dw') {
  if (!V8.CurrentUser || !V8.CurrentUser.Id || !V8.Param.Id) return { Code: 0, Msg: '请先登录并选择安装点位' };
  var sourceResult = V8.FormEngine.GetFormData('diy_anzhuang_dw', { Id: V8.Param.Id });
  if (!sourceResult || sourceResult.Code != 1) return sourceResult;
  var source = JSON.parse(JSON.stringify(sourceResult.Data));
  var row = {};
  var copyFields = ['AnzhuangdianweiId','AnzhuangCS','ShebeiXH','ShebeiXHID','ShebeiMC','ShebeiSL','Renshu','ShebeiDJZL','ShebeiDJ','GenghuanLXJG','ShuizhiYQ','DashuiFS','JiareFS','ShuiwenYQ','GaofengSDKSL','Paixu','XianchangZP','ShipinSC','AnzhuangXGT'];
  for (var ci = 0; ci < copyFields.length; ci++) row[copyFields[ci]] = source[copyFields[ci]];
  row.Id = V8.Method.NewGuid();
  row._InvokeType = 'Client';
  return V8.FormEngine.AddFormData('diy_anzhuang_dw', row);
}
